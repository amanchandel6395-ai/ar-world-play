import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { createShare } from "@/lib/share.functions";
import { KIOSK, useIdleReset } from "@/lib/kiosk";
import type { SceneId } from "@/ar/scenes";
import type { InteractionId, Candidate } from "@/lib/config";
import { useLang } from "@/lib/i18n";
import { getEnhancePrompt } from "@/lib/enhance-prompt";
import { createLeaderComposite } from "@/lib/photo-compositor";

export const CAMPAIGN_SLOGANS = [
  "अबकी बार 400 पार, मोदी-योगी सरकार",
  "एक भारत, श्रेष्ठ भारत 🇮🇳",
  "विकास भी, विरासत भी 🚩",
  "सबका साथ, सबका विकास, सबका विश्वास 🌸",
  "मोदी की गारंटी ✦",
  "जय श्री राम · विकसित भारत संकल्प 🚩",
  "सेवा, सुशासन और गरीब कल्याण",
  "बुलडोज़र बाबा की जय · सुशासन और सुरक्षा",
];

async function stampSloganOnBlob(
  blob: Blob,
  slogan: string | null,
  candidateEndorsement?: string,
): Promise<Blob> {
  if (!slogan && !candidateEndorsement) return blob;
  return new Promise((resolve) => {
    const img = new Image();
    const u = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(u);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(blob);

      // Draw original photo
      ctx.drawImage(img, 0, 0);

      const W = canvas.width;
      const H = canvas.height;
      const bannerHeight = candidateEndorsement
        ? Math.max(90, Math.round(H * 0.11))
        : Math.max(70, Math.round(H * 0.085));
      const fontSize = Math.max(20, Math.round(bannerHeight * (candidateEndorsement ? 0.32 : 0.4)));

      // Gradient background banner at bottom
      const gradient = ctx.createLinearGradient(0, H - bannerHeight, 0, H);
      gradient.addColorStop(0, "rgba(10, 10, 18, 0.90)");
      gradient.addColorStop(1, "rgba(5, 5, 8, 0.98)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, H - bannerHeight, W, bannerHeight);

      // Saffron top accent line
      ctx.fillStyle = "#FF9933";
      ctx.fillRect(0, H - bannerHeight, W, Math.max(4, Math.round(H * 0.005)));

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 2;

      if (candidateEndorsement) {
        // Line 1: Slogan
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold ${fontSize}px "Space Grotesk", "Noto Sans Devanagari", sans-serif`;
        ctx.fillText(slogan || "", W / 2, H - bannerHeight * 0.62);

        // Line 2: Candidate Endorsement
        ctx.fillStyle = "#FFB347";
        ctx.font = `600 ${Math.max(14, Math.round(fontSize * 0.65))}px "Space Grotesk", "Noto Sans Devanagari", sans-serif`;
        ctx.fillText(candidateEndorsement, W / 2, H - bannerHeight * 0.25);
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold ${fontSize}px "Space Grotesk", "Noto Sans Devanagari", sans-serif`;
        ctx.fillText(slogan || "", W / 2, H - bannerHeight / 2 + 2);
      }

      canvas.toBlob((b) => resolve(b || blob), "image/jpeg", 0.95);
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      resolve(blob);
    };
    img.src = u;
  });
}

async function toBase64(b: Blob) {
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ResultView({
  photo,
  sceneId,
  interaction: initialInteraction,
  allowAi,
  candidate,
  onRetake,
  onHome,
}: {
  photo: Blob;
  sceneId: SceneId;
  interaction: InteractionId;
  allowAi: boolean;
  candidate?: Candidate;
  onRetake: () => void;
  onHome: () => void;
}) {
  const [selectedInteraction, setSelectedInteraction] = useState<InteractionId>(initialInteraction);
  const [aiPhoto, setAiPhoto] = useState<Blob | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const share = useServerFn(createShare);
  const [lang, , t] = useLang();
  const isHindi = lang === "hi";
  const [boothMode, setBoothMode] = useState(false);

  const candidateSlogan = candidate
    ? (candidate.slogan[lang] || candidate.slogan.hi || candidate.slogan.en)
    : null;

  const allSlogans = useMemo(() => {
    if (!candidateSlogan) return CAMPAIGN_SLOGANS;
    return [candidateSlogan, ...CAMPAIGN_SLOGANS.filter((s) => s !== candidateSlogan)];
  }, [candidateSlogan]);

  const candidateEndorsement = candidate
    ? `${isHindi ? "समर्थन:" : "Endorsement:"} ${candidate.name[lang] || candidate.name.hi || candidate.name.en} · ${candidate.constituency[lang] || candidate.constituency.hi || candidate.constituency.en}`
    : undefined;

  const [selectedSlogan, setSelectedSlogan] = useState<string | null>(
    candidateSlogan || "एक भारत, श्रेष्ठ भारत 🇮🇳",
  );

  useEffect(() => {
    const isBooth =
      new URLSearchParams(window.location.search).get("mode") === "booth" ||
      localStorage.getItem("zuitar.deviceMode") === "booth";
    setBoothMode(isBooth);
    if (isBooth) {
      // In booth mode, generate the QR code automatically for phone transfer
      void makeQr();
    }
  }, []);

  const sceneOptions: Array<{
    id: InteractionId;
    icon: string;
    label: { en: string; hi: string };
  }> =
    sceneId === "yogi"
      ? [
          { id: "selfie", icon: "🤳", label: { en: "Live Selfie with Yogi Ji", hi: "योगी जी के साथ सेल्फ़ी" } },
          { id: "handshake", icon: "🤝", label: { en: "Handshake with Yogi Ji", hi: "योगी जी से हाथ मिलाएँ" } },
          { id: "hug", icon: "🫂", label: { en: "Warm Hug / Respect", hi: "योगी जी से स्नेह व आशीर्वाद" } },
          { id: "meeting", icon: "💬", label: { en: "Official Meeting", hi: "योगी जी के साथ बैठक व चर्चा" } },
          { id: "scarf", icon: "🧣", label: { en: "Saffron Scarf Honor", hi: "भगवा अंगवस्त्र पहनाना" } },
          { id: "gift", icon: "🎁", label: { en: "Presenting Gift / Memento", hi: "स्मृति चिन्ह / उपहार भेंट" } },
        ]
      : sceneId === "modi"
        ? [
            { id: "selfie", icon: "🤳", label: { en: "Live Selfie with Modi Ji", hi: "मोदी जी के साथ सेल्फ़ी" } },
            { id: "handshake", icon: "🤝", label: { en: "Handshake with Modi Ji", hi: "मोदी जी से हाथ मिलाएँ" } },
            { id: "hug", icon: "🫂", label: { en: "Warm Hug / Affection", hi: "मोदी जी से आत्मीय गले मिलना" } },
            { id: "meeting", icon: "💬", label: { en: "Official High-Level Meeting", hi: "मोदी जी के साथ बैठक व संवाद" } },
            { id: "scarf", icon: "🧣", label: { en: "Ceremonial Scarf Honor", hi: "अंगवस्त्र पहनाकर सम्मान" } },
            {
              id: "gift",
              icon: "🎁",
              label: { en: "Presenting Gift / Memento", hi: "स्मृति चिन्ह / उपहार भेंट" },
            },
          ]
        : [
            { id: "selfie", icon: "🪷", label: { en: "BJP Lotus Look", hi: "भाजपा कमल लुक" } },
            { id: "scarf", icon: "🧣", label: { en: "BJP Cap & Scarf", hi: "भाजपा टोपी व पटका" } },
            { id: "gift", icon: "🎁", label: { en: "Ceremonial Memento", hi: "स्मृति चिन्ह व सम्मान" } },
            { id: "event", icon: "🚩", label: { en: "BJP Flag Style", hi: "भाजपा ध्वज लुक" } },
          ];

  useIdleReset(KIOSK.resultTimeoutMs, onHome);

  const current = showAi && aiPhoto ? aiPhoto : photo;
  const url = useMemo(() => URL.createObjectURL(current), [current]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const download = async () => {
    try {
      const exportBlob = await stampSloganOnBlob(current, selectedSlogan, candidateEndorsement);
      const exportUrl = URL.createObjectURL(exportBlob);
      const a = document.createElement("a");
      a.href = exportUrl;
      a.download = showAi ? "zuitar-ai-campaign-photo.jpg" : "zuitar-campaign-photo.jpg";
      a.click();
      setTimeout(() => URL.revokeObjectURL(exportUrl), 2000);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.download = showAi ? "zuitar-ai-generated.jpg" : "zuitar-photo.jpg";
      a.click();
    }
  };

  const shareWhatsApp = async () => {
    setMsg(null);
    try {
      const exportBlob = await stampSloganOnBlob(current, selectedSlogan, candidateEndorsement);
      const file = new File([exportBlob], "campaign-photo.jpg", { type: "image/jpeg" });
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: selectedSlogan || "Bolta Poster Campaign",
          text: `${selectedSlogan || "Meri Photo"}${candidateEndorsement ? ` (${candidateEndorsement})` : ""} | Bolta Poster Campaign - ${window.location.origin}`,
        });
        return;
      }
      await download();
      const text = encodeURIComponent(
        `${selectedSlogan || "Meri Photo"}${candidateEndorsement ? ` (${candidateEndorsement})` : ""} - Bolta Poster Campaign! Dekhein: ${window.location.origin}`
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        void download();
      }
    }
  };

  const shareInstagram = async () => {
    setMsg(null);
    try {
      const exportBlob = await stampSloganOnBlob(current, selectedSlogan, candidateEndorsement);
      const file = new File([exportBlob], "instagram-story.jpg", { type: "image/jpeg" });
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Instagram Story",
          text: `${selectedSlogan || "Bolta Poster Campaign"}${candidateEndorsement ? ` (${candidateEndorsement})` : ""} #BoltaPoster #ZUITAR`,
        });
        return;
      }
      await download();
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${selectedSlogan || "Bolta Poster Campaign"}${candidateEndorsement ? ` (${candidateEndorsement})` : ""} #BoltaPoster #ZUITAR`);
      }
      setMsg(isHindi ? "फ़ोटो डाउनलोड हो गई! Instagram खोलकर Story में लगाएं 📸" : "Photo downloaded! Open Instagram and post to Story 📸");
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        void download();
      }
    }
  };

  const makeQr = async () => {
    setQrBusy(true);
    setMsg(null);
    try {
      const stamped = await stampSloganOnBlob(current, selectedSlogan, candidateEndorsement);
      const { token } = await share({
        data: { imageBase64: await toBase64(stamped), aiGenerated: showAi },
      });
      const link = `${window.location.origin}/r/${token}`;
      setQr(await QRCode.toDataURL(link, { width: 640, margin: 1 }));
    } catch {
      setMsg("Couldn't create the QR code. Please try again.");
    } finally {
      setQrBusy(false);
    }
  };

  const enhance = async (ix?: InteractionId) => {
    const targetIx = ix ?? selectedInteraction;
    if (ix) setSelectedInteraction(ix);
    setAiBusy(true);
    setMsg(null);
    try {
      let b64: string | null = null;
      let lastError: Error | null = null;

      // 1. Try internal backend API (/api/enhance)
      try {
        const fd = new FormData();
        fd.append("image", photo, "capture.jpg");
        fd.append("scene", sceneId);
        fd.append("interaction", targetIx);
        const res = await fetch("/api/enhance", { method: "POST", body: fd });
        if (res.ok) {
          const j = (await res.json().catch(() => ({}))) as { b64?: string; error?: string };
          if (j.b64) b64 = j.b64;
          else if (j.error) lastError = new Error(j.error);
        }
      } catch (e) {
        console.warn("Backend /api/enhance failed, trying client-side AI fallback...", e);
      }

      // 2. Client-side Puter.js fallback
      if (!b64 && typeof window !== "undefined") {
        try {
          const prompt = getEnhancePrompt(sceneId, targetIx);
          const puter = (window as any).puter;
          if (puter?.ai?.txt2img) {
            const imgEl = await puter.ai.txt2img(prompt);
            if (imgEl && imgEl.src && imgEl.src.startsWith("data:image")) {
              b64 = imgEl.src.split(",")[1];
            }
          }
        } catch (e) {
          console.warn("Puter fallback failed:", e);
        }
      }

      // 3. Client-side Pollinations AI fallback
      if (!b64) {
        try {
          const prompt = encodeURIComponent(getEnhancePrompt(sceneId, targetIx));
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
          const pollRes = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(8000) });
          if (pollRes.ok) {
            const pollBlob = await pollRes.blob();
            if (pollBlob && pollBlob.size > 1000) {
              b64 = await toBase64(pollBlob);
            }
          }
        } catch (e) {
          console.warn("Pollinations fallback failed:", e);
        }
      }

      // 4. Guaranteed 100% Photo Booth Composite (Customer + Leader Cutout + Slogan Banner)
      if (!b64) {
        try {
          const photoUrl = URL.createObjectURL(photo);
          const candidateName = candidate?.name[lang] || candidate?.name.hi;
          const candidateConstituency =
            candidate?.constituency[lang] || candidate?.constituency.hi;
          const compositeDataUrl = await createLeaderComposite(photoUrl, {
            scene: sceneId,
            interaction: targetIx,
            ...(selectedSlogan ? { slogan: selectedSlogan } : {}),
            ...(candidateName ? { candidateName } : {}),
            ...(candidateConstituency ? { candidateConstituency } : {}),
          });
          URL.revokeObjectURL(photoUrl);
          if (compositeDataUrl.startsWith("data:image")) {
            const generatedBase64 = compositeDataUrl.split(",")[1];
            if (generatedBase64) b64 = generatedBase64;
          }
        } catch (e) {
          console.warn("Composite fallback failed:", e);
        }
      }

      if (b64) {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        setAiPhoto(new Blob([arr], { type: "image/jpeg" }));
        setShowAi(true);
        setQr(null);
      } else {
        throw lastError || new Error("AI image generation temporary unavailable. Original photo is ready!");
      }
    } catch (e) {
      console.error("AI image generation error:", e);
      setMsg(e instanceof Error && e.message ? e.message : "AI enhancement failed.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row bg-background text-foreground">
      <div className="relative flex min-h-[50dvh] flex-1 items-center justify-center overflow-hidden bg-black/90 p-4">
        <img
          src={url}
          alt={showAi ? t.aiGenerated : t.capture}
          className="max-h-[80dvh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
        />

        {/* Candidate Badge overlay */}
        {candidate && (
          <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-primary/50 bg-black/75 px-3 py-1.5 shadow-lg backdrop-blur-md">
            {candidate.photoUrl && (
              <img
                src={candidate.photoUrl}
                alt=""
                className="h-7 w-7 rounded-full border border-primary object-cover"
              />
            )}
            <span className="text-xs font-bold text-white">
              🇮🇳 {candidate.name[lang] || candidate.name.hi} ({candidate.constituency[lang] || candidate.constituency.hi})
            </span>
          </div>
        )}

        {/* Selected Slogan Banner overlay */}
        {selectedSlogan && (
          <div className="absolute inset-x-6 bottom-8 mx-auto max-w-md rounded-2xl border border-primary/40 bg-black/85 px-4 py-2.5 text-center shadow-2xl backdrop-blur-md">
            <p className="text-xs sm:text-sm font-bold tracking-wide text-white drop-shadow">
              {selectedSlogan}
            </p>
            {candidateEndorsement && (
              <p className="mt-1 text-[11px] font-semibold text-primary drop-shadow">
                {candidateEndorsement}
              </p>
            )}
          </div>
        )}

        {showAi && (
          <span className="absolute right-6 top-6 rounded-full bg-warning px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-background">
            {t.aiGenerated}
          </span>
        )}

        {aiBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
            <div className="flex items-center gap-3 rounded-2xl bg-black/85 border border-primary/40 px-6 py-4 text-white text-base font-semibold shadow-xl">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <span>{isHindi ? "AI फोटो तैयार कर रहा है…" : "Enhancing with AI…"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Control Actions & Social Sharing Sidebar */}
      <div className="flex w-full flex-col gap-3.5 p-4 pb-8 lg:w-[26rem] lg:justify-center lg:p-8">
        {qr && boothMode ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card border border-border p-5 text-center shadow-md">
            <span className="text-3xl">📱</span>
            <p className="text-lg sm:text-xl font-bold">
              {isHindi ? "फ़ोन से QR कोड स्कैन करें" : "Scan QR with your phone"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isHindi
                ? "कैमरा खोलकर स्कैन करें, फ़ोटो आपके फ़ोन में खुल जाएगी और सीधे डाउनलोड हो जाएगी।"
                : "Open your mobile camera to scan and download the photo to your phone."}
            </p>
            <img
              src={qr}
              alt="QR code to download your photo"
              className="w-56 sm:w-64 rounded-xl bg-foreground p-3 shadow-lg"
            />
            <p className="text-xs text-muted-foreground">{t.expires}</p>
            <div className="flex gap-2 mt-2 w-full">
              <button onClick={() => setQr(null)} className="zt-btn-ghost flex-1">
                ✕ {t.close}
              </button>
              <button onClick={onRetake} className="zt-btn-secondary flex-1">
                🔄 {t.retake}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Direct Social Share & Download Actions */}
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3.5 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {isHindi ? "डाउनलोड एवं सोशल शेयरिंग:" : "Download & Social Sharing:"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={download}
                  className="zt-btn-primary flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold shadow-sm"
                >
                  <span>⬇️</span>
                  <span>{isHindi ? "डाउनलोड करें" : "Download"}</span>
                </button>
                <button
                  type="button"
                  onClick={shareWhatsApp}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 py-2.5 text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>💬</span>
                  <span>{isHindi ? "WhatsApp स्टेटस" : "WhatsApp"}</span>
                </button>
                <button
                  type="button"
                  onClick={shareInstagram}
                  className="rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-bold flex items-center justify-center gap-1.5 py-2.5 text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <span>📸</span>
                  <span>{isHindi ? "Instagram स्टोरी" : "Instagram"}</span>
                </button>
                <button
                  type="button"
                  onClick={makeQr}
                  disabled={qrBusy}
                  className="zt-btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold"
                >
                  <span>📱</span>
                  <span>{qrBusy ? "..." : (isHindi ? "फोन में भेजें (QR)" : "QR Code")}</span>
                </button>
              </div>
            </div>

            {/* Campaign Slogans Picker */}
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {isHindi ? "अभियान स्लोगन / नारा चुनें:" : "Campaign Slogan:"}
                </p>
                {selectedSlogan && (
                  <button
                    type="button"
                    onClick={() => setSelectedSlogan(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    {isHindi ? "हटाएं" : "Clear"}
                  </button>
                )}
              </div>
              <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
                {allSlogans.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSlogan(selectedSlogan === s ? null : s)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      selectedSlogan === s
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                        : "border-border/70 hover:bg-muted text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation buttons: Retake & Home */}
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={onRetake} className="zt-btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium">
                <span>🔄</span>
                <span>{t.retake}</span>
              </button>
              <button onClick={onHome} className="zt-btn-secondary flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium">
                <span>🏠</span>
                <span>{t.home}</span>
              </button>
            </div>

            {/* AI Feature Enhancement Studio */}
            {allowAi && (
              <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card/60 p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {isHindi ? "AI दृश्य बदलें (Selfie, Scarf, Gift):" : "Change Interaction:"}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {sceneOptions.length} {isHindi ? "विकल्प" : "options"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-[30vh] overflow-y-auto pr-1">
                  {sceneOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedInteraction(opt.id)}
                      disabled={aiBusy}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
                        selectedInteraction === opt.id
                          ? "border-primary bg-primary/15 text-primary font-bold ring-2 ring-primary/40 shadow-xs"
                          : "border-border/60 hover:bg-muted text-foreground"
                      } disabled:opacity-50`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-lg">{opt.icon}</span>
                        <span>{opt.label[lang]}</span>
                      </span>
                      {selectedInteraction === opt.id ? (
                        <span className="text-[11px] font-bold text-primary bg-primary/20 rounded-full px-2 py-0.5">
                          ✓ {isHindi ? "चुना गया" : "Selected"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">○</span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => enhance(selectedInteraction)}
                  disabled={aiBusy}
                  className="zt-btn-primary flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-md w-full"
                >
                  <span>✦</span>
                  <span>
                    {aiBusy
                      ? (isHindi ? "AI फोटो तैयार कर रहा है…" : "Generating AI Photo…")
                      : (isHindi ? "AI फ़ोटो बनाएँ (Generate)" : "Generate AI Photo ✦")}
                  </span>
                </button>
              </div>
            )}

            {aiPhoto && (
              <button
                onClick={() => {
                  setShowAi((v) => !v);
                  setQr(null);
                }}
                className="zt-btn-ghost border border-border text-xs py-2"
              >
                {showAi ? (isHindi ? "मूल फ़ोटो देखें" : "Show original photo") : (isHindi ? "AI फ़ोटो देखें" : "Show AI-generated version")}
              </button>
            )}
          </>
        )}

        {msg && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-3">
            <p className="text-center text-xs sm:text-sm font-medium text-foreground">{msg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
