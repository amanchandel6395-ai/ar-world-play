import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { createShare } from "@/lib/share.functions";
import { KIOSK, useIdleReset } from "@/lib/kiosk";
import type { SceneId } from "@/ar/scenes";
import type { InteractionId, Candidate } from "@/lib/config";
import { useLang } from "@/lib/i18n";
import { getEnhancePrompt } from "@/lib/enhance-prompt";

export const CAMPAIGN_SLOGANS = [
  "एक भारत, श्रेष्ठ भारत 🇮🇳",
  "मोदी की गारंटी ✦",
  "विकसित भारत @ 2047 🇮🇳",
  "सबका साथ, सबका विकास, सबका विश्वास 🌸",
  "जय श्री राम 🚩",
  "सेवा, सुशासन और गरीब कल्याण",
  "अबकी बार 400 पार ✦",
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
  allowVideo,
  videoConfigured,
  candidate,
  onRetake,
  onHome,
}: {
  photo: Blob;
  sceneId: SceneId;
  interaction: InteractionId;
  allowAi: boolean;
  allowVideo: boolean;
  /** admin switched video on but it has not passed an end-to-end test yet */
  videoConfigured?: boolean;
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
    setBoothMode(
      new URLSearchParams(window.location.search).get("mode") === "booth" ||
        localStorage.getItem("zuitar.deviceMode") === "booth",
    );
  }, []);

  const sceneOptions: Array<{
    id: InteractionId;
    icon: string;
    label: { en: string; hi: string };
  }> =
    sceneId === "modi"
      ? [
          {
            id: "selfie",
            icon: "🤳",
            label: { en: "Selfie with PM Modi", hi: "पीएम मोदी जी के साथ सेल्फ़ी" },
          },
          {
            id: "handshake",
            icon: "🤝",
            label: { en: "Handshake with Modi", hi: "मोदी जी से हाथ मिलाएँ" },
          },
          { id: "hug", icon: "🫂", label: { en: "Hug with Modi", hi: "मोदी जी से गले मिलें" } },
          {
            id: "meeting",
            icon: "💬",
            label: { en: "Meeting with Modi", hi: "मोदी जी से मुलाक़ात" },
          },
          { id: "scarf", icon: "🧣", label: { en: "Saffron Scarf Honor", hi: "अंगवस्त्र सम्मान" } },
          { id: "gift", icon: "🎁", label: { en: "Presenting Gift / Memento", hi: "स्मृति चिन्ह / उपहार भेंट" } },
        ]
      : sceneId === "yogi"
        ? [
            {
              id: "selfie",
              icon: "🤳",
              label: { en: "Selfie with CM Yogi", hi: "सीएम योगी जी के साथ सेल्फ़ी" },
            },
            {
              id: "handshake",
              icon: "🤝",
              label: { en: "Handshake with Yogi", hi: "योगी जी से हाथ मिलाएँ" },
            },
            { id: "hug", icon: "🫂", label: { en: "Hug with Yogi", hi: "योगी जी से गले मिलें" } },
            {
              id: "meeting",
              icon: "💬",
              label: { en: "Meeting with Yogi", hi: "योगी जी से मुलाक़ात" },
            },
            {
              id: "scarf",
              icon: "🧣",
              label: { en: "Saffron Scarf Honor", hi: "अंगवस्त्र सम्मान" },
            },
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
  const [video, setVideo] = useState<{
    state: "idle" | "busy" | "ready";
    url?: string;
    progress?: number | null;
  }>({ state: "idle" });
  const [videoMsg, setVideoMsg] = useState<string | null>(null);
  const alive = useRef(true);
  const pollTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(pollTimer.current);
    };
  }, []);
  const codeMsg = (code: string | undefined, kind: "ai" | "video") =>
    code === "not_configured"
      ? kind === "ai"
        ? t.aiNotSetup
        : t.videoNotSetup
      : code === "credits" || code === "quota_exceeded"
        ? t.aiCredits
        : code === "busy" || code === "rate_limit"
          ? t.aiBusy
          : kind === "ai"
            ? t.aiFail
            : t.videoFail;
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
      const { token } = await share({
        data: { imageBase64: await toBase64(current), aiGenerated: showAi },
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
      const prompt = getEnhancePrompt(sceneId, targetIx);
      let generatedBlob: Blob | null = null;
      let lastError: Error | null = null;

      // --- Tier 1: Puter.js (Client-side Gemini 2.5 Flash / 3 Pro Image) ---
      try {
        let puterInstance = typeof window !== "undefined" ? (window as any).puter : undefined;
        if (!puterInstance && typeof window !== "undefined") {
          if (!(window as any).puter) {
            await new Promise<void>((resolve, reject) => {
              const existingScript = document.querySelector('script[src*="puter.com"]');
              if (existingScript) {
                existingScript.addEventListener("load", () => resolve());
                existingScript.addEventListener("error", () => reject(new Error("Failed to load Puter.js")));
                if ((window as any).puter) return resolve();
              } else {
                const s = document.createElement("script");
                s.src = "https://js.puter.com/v2/";
                s.onload = () => resolve();
                s.onerror = () => reject(new Error("Failed to load Puter.js"));
                document.head.appendChild(s);
              }
            });
          }
          puterInstance = (window as any).puter;
        }

        if (puterInstance?.ai?.txt2img) {
          try {
            const img = await puterInstance.ai.txt2img(prompt, {
              model: "google/gemini-2.5-flash-image",
            });
            if (img?.src) {
              const res = await fetch(img.src);
              generatedBlob = await res.blob();
            }
          } catch (e1) {
            console.warn("Puter gemini-2.5-flash-image failed, trying fallback model:", e1);
            const imgFallback = await puterInstance.ai.txt2img(prompt, {
              model: "google/gemini-3-pro-image",
            });
            if (imgFallback?.src) {
              const res = await fetch(imgFallback.src);
              generatedBlob = await res.blob();
            }
          }
        }
      } catch (puterErr) {
        console.warn("Puter AI generation failed, falling back to backend API:", puterErr);
        lastError = puterErr instanceof Error ? puterErr : new Error("Puter AI failed");
      }

      // --- Tier 2: Backend API Fallback (/api/enhance) ---
      if (!generatedBlob) {
        try {
          const fd = new FormData();
          fd.append("image", photo, "capture.jpg");
          fd.append("scene", sceneId);
          fd.append("interaction", targetIx);
          const res = await fetch("/api/enhance", { method: "POST", body: fd });
          if (res.ok) {
            const { b64 } = (await res.json()) as { b64: string };
            if (b64) {
              const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              generatedBlob = new Blob([bin], { type: "image/jpeg" });
            }
          } else {
            const j = (await res.json().catch(() => ({}))) as { code?: string };
            throw new Error(codeMsg(j.code, "ai"));
          }
        } catch (backendErr) {
          console.error("Backend API enhancement fallback failed:", backendErr);
          if (!lastError) lastError = backendErr instanceof Error ? backendErr : new Error("AI enhancement failed.");
        }
      }

      if (generatedBlob) {
        setAiPhoto(generatedBlob);
        setShowAi(true);
        setQr(null);
      } else {
        throw lastError || new Error("All AI image generation providers failed.");
      }
    } catch (e) {
      console.error("AI image generation error:", e);
      setMsg(e instanceof Error && e.message ? e.message : "AI enhancement failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const makeVideo = async () => {
    setVideo({ state: "busy", progress: null });
    setVideoMsg(null);
    const fail = (m: string) => {
      if (!alive.current) return;
      setVideo({ state: "idle" });
      setVideoMsg(m);
    };
    try {
      const fd = new FormData();
      fd.append("image", photo, "capture.jpg");
      fd.append("scene", sceneId);
      fd.append("interaction", interaction);
      const res = await fetch("/api/video", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { id?: string; code?: string };
      if (!res.ok || !j.id) return fail(codeMsg(j.code, "video"));
      const id = j.id;
      const deadline = Date.now() + 6 * 60_000;
      const poll = async () => {
        if (!alive.current) return;
        if (Date.now() > deadline) return fail(t.videoFail);
        try {
          const r = await fetch(`/api/video?id=${encodeURIComponent(id)}`);
          const p = (await r.json().catch(() => ({}))) as {
            status?: string;
            url?: string | null;
            progress?: number | null;
            code?: string;
          };
          if (!alive.current) return;
          if (!r.ok) {
            if (r.status === 429 || r.status >= 500)
              pollTimer.current = window.setTimeout(poll, 8000);
            else fail(codeMsg(p.code, "video"));
            return;
          }
          if (p.status === "completed" && p.url) return setVideo({ state: "ready", url: p.url });
          if (p.status === "failed") return fail(t.videoFail);
          setVideo({ state: "busy", progress: p.progress ?? null });
          pollTimer.current = window.setTimeout(poll, 6000);
        } catch {
          pollTimer.current = window.setTimeout(poll, 8000);
        }
      };
      pollTimer.current = window.setTimeout(poll, 5000);
    } catch {
      fail(t.videoFail);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-stage lg:flex-row">
      <div className="relative flex flex-1 items-center justify-center p-4 lg:p-8">
        <img
          src={url}
          alt="Your ZUITAR photo"
          className="max-h-[70dvh] w-auto max-w-full rounded-2xl shadow-2xl lg:max-h-[88dvh]"
        />
        {candidate && (
          <div className="absolute top-6 left-6 z-10 flex items-center gap-2 rounded-full border border-primary/50 bg-black/80 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
            {candidate.photoUrl && (
              <img
                src={candidate.photoUrl}
                alt=""
                className="h-6 w-6 rounded-full border border-primary object-cover"
              />
            )}
            <span className="text-xs font-bold text-white">
              🇮🇳 {candidate.name[lang] || candidate.name.hi} ({candidate.constituency[lang] || candidate.constituency.hi})
            </span>
          </div>
        )}
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
          <span className="absolute left-6 top-6 rounded-full bg-warning px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-background lg:left-12 lg:top-12">
            {t.aiGenerated}
          </span>
        )}
        {aiBusy && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl bg-overlay px-6 py-4 text-lg">Enhancing with AI…</div>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-3 p-4 pb-8 lg:w-[26rem] lg:justify-center lg:p-8">
        {qr ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-5 text-center">
            <span className="text-3xl">📱</span>
            <p className="text-xl font-bold">
              {isHindi ? "फ़ोन से QR कोड स्कैन करें" : "Scan QR with your phone"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isHindi
                ? "कैमरा खोलकर स्कैन करें, फ़ोटो आपके फ़ोन में खुल जाएगी और डाउनलोड हो जाएगी।"
                : "Open your mobile camera to scan and download the photo to your phone."}
            </p>
            <img
              src={qr}
              alt="QR code to download your photo"
              className="w-64 rounded-xl bg-foreground p-3 lg:w-72 shadow-lg"
            />
            <p className="text-xs text-muted-foreground">{t.expires}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setQr(null)} className="zt-btn-ghost">
                ✕ {t.close}
              </button>
              <button onClick={onRetake} className="zt-btn-secondary">
                🔄 {t.retake}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Direct Social Share & Download Actions */}
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3.5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {isHindi ? "शेयर और डाउनलोड करें:" : "Share & Download:"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={download}
                  className="zt-btn-primary flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold"
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
                  <span>{qrBusy ? t.creating : (isHindi ? "फोन में भेजें (QR)" : "QR Code")}</span>
                </button>
              </div>
            </div>

            {/* Campaign Slogans Picker */}
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
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
                        ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm"
                        : "border-border/70 hover:bg-muted text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

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

            {allowAi && (
              <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card/60 p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    {isHindi ? "1. फीचर चुनें (Meeting, Selfie, Gift):" : "1. Choose Feature:"}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {sceneOptions.length} {isHindi ? "विकल्प" : "options"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-[36vh] overflow-y-auto pr-1">
                  {sceneOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedInteraction(opt.id)}
                      disabled={aiBusy}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                        selectedInteraction === opt.id
                          ? "border-primary bg-primary/15 text-primary font-bold ring-2 ring-primary/40 shadow-sm"
                          : "border-border/60 hover:bg-muted text-foreground"
                      } disabled:opacity-50`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-xl">{opt.icon}</span>
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
                  onClick={() => void enhance(selectedInteraction)}
                  disabled={aiBusy}
                  className="zt-btn-primary mt-1 py-3 text-base font-bold flex items-center justify-center gap-2 w-full shadow-lg"
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
                className="zt-btn-ghost border border-border"
              >
                {showAi ? "Show original photo" : "Show AI-generated version"}
              </button>
            )}
            {allowVideo && video.state === "idle" && (
              <button onClick={makeVideo} className="zt-btn-ghost border border-border">
                ▶ {t.makeVideo}
              </button>
            )}
            {!allowVideo && videoConfigured && (
              <p className="rounded-2xl border border-border px-4 py-3 text-center text-sm text-muted-foreground">
                {t.videoUnavailable}
              </p>
            )}
            {video.state === "busy" && (
              <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
                <div className="h-6 w-6 shrink-0 animate-spin rounded-full border-4 border-muted border-t-primary" />
                <p className="text-sm">
                  {t.videoWorking}
                  {typeof video.progress === "number" ? ` ${Math.round(video.progress)}%` : ""}
                </p>
              </div>
            )}
            {video.state === "ready" && video.url && (
              <div className="flex flex-col gap-2 rounded-2xl bg-card p-3">
                <div className="relative">
                  <video
                    src={video.url}
                    controls
                    playsInline
                    className="mx-auto max-h-[50dvh] rounded-xl"
                    aria-label={t.videoReady}
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-warning px-3 py-1 text-xs font-bold uppercase text-background">
                    {t.aiGenerated}
                  </span>
                </div>
                <a
                  href={video.url}
                  download="zuitar-ai-video.mp4"
                  target="_blank"
                  rel="noreferrer"
                  className="zt-btn-secondary text-center"
                >
                  {t.downloadVideo}
                </a>
              </div>
            )}
            {videoMsg && <p className="text-center text-destructive">{videoMsg}</p>}
          </>
        )}
        {msg && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-center text-sm font-medium text-destructive">{msg}</p>
            {allowAi && !aiPhoto && (
              <button onClick={enhance} disabled={aiBusy} className="zt-btn-secondary text-xs">
                {t.retry}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
