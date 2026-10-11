import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useServerFn } from "@tanstack/react-start";
import { createShare } from "@/lib/share.functions";
import { KIOSK, useIdleReset } from "@/lib/kiosk";
import type { SceneId } from "@/ar/scenes";
import type { InteractionId } from "@/lib/config";
import { useLang } from "@/lib/i18n";

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

  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = showAi ? "zuitar-ai-generated.jpg" : "zuitar-photo.jpg";
    a.click();
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
      const fd = new FormData();
      fd.append("image", photo, "capture.jpg");
      fd.append("scene", sceneId);
      fd.append("interaction", targetIx);
      const res = await fetch("/api/enhance", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { code?: string };
        throw new Error(codeMsg(j.code, "ai"));
      }
      const { b64 } = (await res.json()) as { b64: string };
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      setAiPhoto(new Blob([bin], { type: "image/jpeg" }));
      setShowAi(true);
      setQr(null);
    } catch (e) {
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
            <div className="grid grid-cols-2 gap-2.5">
              {!boothMode ? (
                <>
                  <button onClick={download} className="zt-btn-primary flex items-center justify-center gap-1.5">
                    <span>⬇️</span>
                    <span>{t.download}</span>
                  </button>
                  <button onClick={makeQr} disabled={qrBusy} className="zt-btn-secondary flex items-center justify-center gap-1.5">
                    <span>📱</span>
                    <span>{qrBusy ? t.creating : t.qr}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={makeQr}
                  disabled={qrBusy}
                  className="col-span-2 zt-btn-primary flex items-center justify-center gap-2 py-3 text-base font-bold shadow-lg"
                >
                  <span>📱</span>
                  <span>
                    {qrBusy
                      ? t.creating
                      : (isHindi ? "फ़ोन में डाउनलोड करें (QR स्कैन)" : "Download to Phone (Scan QR)")}
                  </span>
                </button>
              )}
              <button onClick={onRetake} className="zt-btn-secondary flex items-center justify-center gap-1.5">
                <span>🔄</span>
                <span>{t.retake}</span>
              </button>
              <button onClick={onHome} className="zt-btn-secondary flex items-center justify-center gap-1.5">
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
