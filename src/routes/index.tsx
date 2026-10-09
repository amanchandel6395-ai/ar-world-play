import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicConfig } from "@/lib/config.functions";
import type { PublicConfig } from "@/lib/config";
import type { SceneId } from "@/ar/scenes";
import { useDevMode } from "@/lib/kiosk";
import { LangToggleLabel, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZUITAR · AI Camera + AR" },
      { name: "description", content: "Choose your experience: live AR selfies and styling with ZUITAR." },
      { property: "og:title", content: "ZUITAR · AI Camera + AR" },
      { property: "og:description", content: "Live AR selfies and styling, right in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const cards: { id: SceneId; kicker: "selfieWith" | "style"; tone: string }[] = [
  { id: "yogi", kicker: "selfieWith", tone: "from-saffron/40" },
  { id: "modi", kicker: "selfieWith", tone: "from-gold/35" },
  { id: "bjp", kicker: "style", tone: "from-leaf/40" },
];

function Home() {
  const [dev, setDev] = useDevMode();
  const [flash, setFlash] = useState<string | null>(null);
  const [lang, setLang, t] = useLang();
  const fetchConfig = useServerFn(getPublicConfig);
  const [ready, setReady] = useState<PublicConfig["ready"] | null>(null);
  const [boothOpen, setBoothOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [canFlipCamera, setCanFlipCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isHindi = lang === "hi";

  useEffect(() => {
    fetchConfig().then((c) => setReady(c.ready)).catch(() => setReady(null));
    setCanFlipCamera(window.matchMedia("(pointer: coarse)").matches);
  }, [fetchConfig]);

  useEffect(() => {
    if (!boothOpen || photo) return;
    let active = true;
    setCameraReady(false);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(isHindi ? "इस ब्राउज़र में कैमरा उपलब्ध नहीं है।" : "Camera access is not available in this browser.");
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (active) {
          setCameraError(
            isHindi
              ? "कैमरा शुरू नहीं हो सका। ब्राउज़र में camera permission दें और पेज HTTPS पर खोलें।"
              : "Could not start the camera. Allow camera access in your browser and open this page over HTTPS.",
          );
        }
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [boothOpen, photo, isHindi, facingMode]);

  const finishPhoto = (source: CanvasImageSource, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;

    const scale = Math.min(1, 2048 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const footerHeight = Math.max(62, Math.round(canvas.width * 0.12));
    context.fillStyle = "#111827";
    context.fillRect(0, canvas.height - footerHeight, canvas.width, footerHeight);
    context.fillStyle = "#fbbf24";
    context.font = `600 ${Math.max(16, Math.round(canvas.width * 0.035))}px sans-serif`;
    context.textBaseline = "middle";
    context.fillText("ZUITAR · PHOTO BOOTH DEMO", Math.round(canvas.width * 0.05), canvas.height - footerHeight / 2);
    setPhoto(canvas.toDataURL("image/jpeg", 0.92));
    setCameraReady(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    finishPhoto(video, video.videoWidth, video.videoHeight);
  };

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCameraError(isHindi ? "कृपया image फ़ाइल चुनें।" : "Please choose an image file.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      finishPhoto(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      setCameraError(null);
    } catch {
      setCameraError(isHindi ? "यह फोटो खुल नहीं सकी। दूसरी image चुनें।" : "This photo could not be opened. Choose another image.");
    }
  };

  const press = useRef<number | null>(null);
  const startPress = () => {
    press.current = window.setTimeout(() => {
      setDev(!dev);
      setFlash(!dev ? "Development mode ON" : "Development mode OFF");
      window.setTimeout(() => setFlash(null), 1800);
    }, 2500);
  };
  const endPress = () => press.current && clearTimeout(press.current);

  return (
    <main className="flex min-h-dvh flex-col bg-stage px-5 py-8 text-foreground md:px-10 lg:py-12">
      <header className="flex flex-col items-center text-center">
        <h1
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          className="select-none text-5xl font-bold tracking-[0.25em] text-gradient md:text-7xl"
        >
          ZUITAR
        </h1>
        <p className="mt-3 text-lg text-muted-foreground md:text-2xl">{t.choose}</p>
        <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className="zt-btn-ghost mt-3 border border-border">
          {LangToggleLabel(lang)}
        </button>
      </header>

      <div className="mx-auto mt-8 grid w-full max-w-7xl flex-1 gap-4 md:mt-12 md:grid-cols-3 md:gap-6">
        {cards.map((c, i) => (
          <Link
            key={c.id}
            to="/experience/$scene"
            params={{ scene: c.id }}
            className={`zt-card group relative flex min-h-44 flex-col justify-end overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${c.tone} to-card p-6 transition-transform active:scale-[0.98] md:min-h-[24rem] md:p-8`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <span className="absolute right-6 top-6 text-6xl font-bold text-foreground/10 md:text-8xl">0{i + 1}</span>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">{t[c.kicker]}</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{t[c.id]}</h2>
            <p className="mt-2 text-muted-foreground">{t[`${c.id}Sub`]}</p>
            {!ready?.[c.id] ? (
              <span className="mt-5 inline-flex w-fit items-center rounded-full border border-warning/60 px-5 py-2.5 text-base font-semibold text-warning">
                {t.setupBadge}
              </span>
            ) : (
              <span className="mt-5 inline-flex w-fit items-center rounded-full bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground">
                {t.start} →
              </span>
            )}
          </Link>
        ))}
      </div>

      <section className="mx-auto mt-7 w-full max-w-7xl rounded-3xl border border-border bg-card p-5 md:mt-9 md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold md:text-2xl">{isHindi ? "अपना फोटो बूथ डेमो" : "Try the photo booth demo"}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
              {isHindi
                ? "फोन या लैपटॉप के कैमरे से फोटो लें, या फोटो चुनें। फिर दोबारा लें या डाउनलोड करें। इसमें AI edit या दूसरा व्यक्ति नहीं जोड़ा जाता।"
                : "Use a phone or laptop camera, or choose a photo to retake or download. No AI edits or other people are added."}
            </p>
          </div>
          <button onClick={() => { setPhoto(null); setBoothOpen(true); }} className="zt-btn-primary shrink-0">
            {isHindi ? "कैमरा खोलें" : "Open camera"}
          </button>
        </div>
      </section>

      {dev && (
        <nav className="mx-auto mt-6 flex gap-3 font-mono text-xs text-muted-foreground">
          <Link to="/selfie" className="underline">engine test: selfie</Link>
          <Link to="/world" className="underline">engine test: world</Link>
        </nav>
      )}
      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-overlay px-5 py-2 text-sm">{flash}</div>
      )}

      {boothOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stage/95 px-4 py-6 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="booth-title" className="mx-auto flex min-h-full w-full max-w-2xl flex-col rounded-3xl border border-border bg-card p-5 shadow-2xl md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="booth-title" className="text-2xl font-bold">{isHindi ? "फोटो बूथ डेमो" : "Photo booth demo"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{isHindi ? "फोटो आपके ब्राउज़र में ही रहती है।" : "Your photo stays in your browser."}</p>
              </div>
              <button aria-label={isHindi ? "बंद करें" : "Close"} onClick={() => setBoothOpen(false)} className="zt-btn-ghost">✕</button>
            </div>

            <div className="mt-5 flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
              {photo ? (
                <img src={photo} alt={isHindi ? "आपकी ली गई फोटो" : "Your captured photo"} className="max-h-[65vh] w-full object-contain" />
              ) : cameraError ? (
                <p role="alert" className="max-w-md p-6 text-center text-sm text-white">{cameraError}</p>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => setCameraReady(true)}
                  className="max-h-[65vh] w-full object-contain"
                />
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {photo ? (
                <>
                  <button onClick={() => { setPhoto(null); setCameraError(null); }} className="zt-btn-ghost">{isHindi ? "दोबारा लें" : "Retake"}</button>
                  <a href={photo} download="zuitar-photo-booth.jpg" className="zt-btn-primary">{isHindi ? "डाउनलोड" : "Download photo"}</a>
                </>
              ) : (
                <>
                  <button onClick={capturePhoto} disabled={!cameraReady || !!cameraError} className="zt-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                    {isHindi ? "फोटो लें" : "Capture photo"}
                  </button>
                  {canFlipCamera && cameraReady && !cameraError && (
                    <button
                      onClick={() => { setCameraReady(false); setFacingMode((mode) => mode === "user" ? "environment" : "user"); }}
                      className="zt-btn-ghost"
                    >
                      {isHindi ? "कैमरा बदलें" : "Flip camera"}
                    </button>
                  )}
                  <label className="zt-btn-ghost cursor-pointer">
                    {isHindi ? "फोटो चुनें" : "Choose photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => { void choosePhoto(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }}
                    />
                  </label>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
