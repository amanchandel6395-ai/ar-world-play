import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicConfig } from "@/lib/config.functions";
import { createShare } from "@/lib/share.functions";
import QRCode from "qrcode";
import type { PublicConfig } from "@/lib/config";
import type { SceneId } from "@/ar/scenes";
import { useDevMode } from "@/lib/kiosk";
import { LangToggleLabel, useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZUITAR · AI Camera + AR" },
      {
        name: "description",
        content: "Choose your experience: live AR selfies and styling with ZUITAR.",
      },
      { property: "og:title", content: "ZUITAR · AI Camera + AR" },
      {
        property: "og:description",
        content: "Live AR selfies and styling, right in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const cards: {
  id: SceneId;
  kicker: "selfieWith" | "style";
  tone: string;
  image: string;
  title: { en: string; hi: string };
  badge: { en: string; hi: string };
  desc: { en: string; hi: string };
}[] = [
  {
    id: "yogi",
    kicker: "selfieWith",
    tone: "from-amber-600/30 via-orange-500/15 to-card",
    image: "/assets/yogi.png",
    title: { en: "Selfie with CM Yogi", hi: "सेल्फ़ी सीएम योगी के साथ" },
    badge: { en: "CM Yogi Adityanath", hi: "मुख्यमंत्री योगी आदित्यनाथ" },
    desc: {
      en: "Live selfie, handshake, meeting, scarf & gift with CM Yogi",
      hi: "लाइव सेल्फ़ी, हाथ मिलाना, मुलाक़ात, अंगवस्त्र व उपहार भेंट",
    },
  },
  {
    id: "modi",
    kicker: "selfieWith",
    tone: "from-orange-500/30 via-amber-500/15 to-card",
    image: "/assets/modi.png",
    title: { en: "Selfie with PM Modi", hi: "सेल्फ़ी पीएम मोदी के साथ" },
    badge: { en: "PM Narendra Modi", hi: "प्रधानमंत्री नरेंद्र मोदी" },
    desc: {
      en: "Live selfie, handshake, hug, meeting, scarf & gift with PM Modi",
      hi: "लाइव सेल्फ़ी, हाथ मिलाना, गले मिलना, मुलाक़ात, अंगवस्त्र व उपहार भेंट",
    },
  },
  {
    id: "bjp",
    kicker: "style",
    tone: "from-emerald-600/30 via-green-600/15 to-card",
    image: "/assets/bjp.png",
    title: { en: "BJP Look", hi: "भाजपा लुक" },
    badge: { en: "Official BJP Look", hi: "आधिकारिक भाजपा लुक" },
    desc: {
      en: "Lotus emblem, scarf, cap, flag and stage background",
      hi: "कमल प्रतीक, पटका, टोपी, ध्वज एवं मंच पृष्ठभूमि",
    },
  },
];

function Home() {
  const [dev, setDev] = useDevMode();
  const [flash, setFlash] = useState<string | null>(null);
  const [lang, setLang, t] = useLang();
  const [boothMode, setBoothMode] = useState(false);
  const setDeviceMode = (booth: boolean) => {
    localStorage.setItem("zuitar.deviceMode", booth ? "booth" : "personal");
    setBoothMode(booth);
  };
  const fetchConfig = useServerFn(getPublicConfig);
  const [ready, setReady] = useState<PublicConfig["ready"] | null>(null);
  const [demoAiReady, setDemoAiReady] = useState(false);
  const [boothOpen, setBoothOpen] = useState(false);
  const [activeSceneTab, setActiveSceneTab] = useState<SceneId | "all">("all");
  const [photo, setPhoto] = useState<string | null>(null);
  const [aiPhoto, setAiPhoto] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [modalQr, setModalQr] = useState<string | null>(null);
  const [modalQrBusy, setModalQrBusy] = useState(false);
  const shareFn = useServerFn(createShare);
  const [selectedModalScene, setSelectedModalScene] = useState<"modi" | "yogi" | "bjp">("modi");
  const [selectedModalInteraction, setSelectedModalInteraction] = useState<string>("selfie");
  const [lastAttempt, setLastAttempt] = useState<{ scene: string; interaction: string } | null>(
    null,
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [canFlipCamera, setCanFlipCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isHindi = lang === "hi";
  const displayedPhoto = showAi && aiPhoto ? aiPhoto : photo;

  useEffect(() => {
    setBoothMode(
      new URLSearchParams(window.location.search).get("mode") === "booth" ||
        localStorage.getItem("zuitar.deviceMode") === "booth",
    );
    fetchConfig()
      .then((c) => {
        setReady(c.ready);
        setDemoAiReady(c.demo.aiReady);
      })
      .catch(() => {
        setReady(null);
        setDemoAiReady(false);
      });
    setCanFlipCamera(window.matchMedia("(pointer: coarse)").matches);
  }, [fetchConfig]);

  useEffect(() => {
    if (!boothOpen || photo) return;
    let active = true;
    setCameraReady(false);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        isHindi
          ? "इस ब्राउज़र में कैमरा उपलब्ध नहीं है।"
          : "Camera access is not available in this browser.",
      );
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode }, audio: false })
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
    context.fillText(
      "ZUITAR · PHOTO BOOTH DEMO",
      Math.round(canvas.width * 0.05),
      canvas.height - footerHeight / 2,
    );
    setPhoto(canvas.toDataURL("image/jpeg", 0.92));
    setAiPhoto(null);
    setShowAi(false);
    setAiError(null);
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
      setCameraError(
        isHindi
          ? "यह फोटो खुल नहीं सकी। दूसरी image चुनें।"
          : "This photo could not be opened. Choose another image.",
      );
    }
  };

  const enhancePhoto = async (scene = "photo", interaction = "selfie") => {
    if (!photo || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    setLastAttempt({ scene, interaction });
    try {
      const image = await (await fetch(photo)).blob();
      const form = new FormData();
      form.append("image", image, "customer-photo.jpg");
      form.append("scene", scene);
      form.append("interaction", interaction);
      const response = await fetch("/api/enhance", { method: "POST", body: form });
      const result = (await response.json().catch(() => ({}))) as { b64?: string; code?: string };
      if (!response.ok || !result.b64) {
        const message =
          result.code === "not_configured"
            ? isHindi
              ? "AI अभी booth settings में चालू नहीं है।"
              : "AI is not enabled in booth settings yet."
            : result.code === "credits"
              ? isHindi
                ? "AI credits उपलब्ध नहीं हैं।"
                : "AI credits are unavailable."
              : isHindi
                ? "AI edit अभी पूरा नहीं हो सका।"
                : "The AI edit could not be completed.";
        throw new Error(message);
      }
      setAiPhoto(`data:image/jpeg;base64,${result.b64}`);
      setShowAi(true);
      setModalQr(null);
      if (boothMode) {
        setTimeout(() => {
          void makeModalQrWithPhoto(`data:image/jpeg;base64,${result.b64}`);
        }, 100);
      }
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : isHindi ? "AI edit विफल हुआ।" : "AI edit failed.",
      );
    } finally {
      setAiBusy(false);
    }
  };

  const makeModalQrWithPhoto = async (targetPhoto?: string) => {
    const raw = targetPhoto ?? (showAi && aiPhoto ? aiPhoto : photo);
    if (!raw) return;
    setModalQrBusy(true);
    try {
      const b64 = raw.replace(/^data:image\/\w+;base64,/, "");
      const { token } = await shareFn({ data: { imageBase64: b64, aiGenerated: showAi } });
      const link = `${window.location.origin}/r/${token}`;
      setModalQr(await QRCode.toDataURL(link, { width: 512, margin: 1 }));
    } catch {
      setAiError(isHindi ? "QR कोड नहीं बन सका।" : "Could not generate QR code.");
    } finally {
      setModalQrBusy(false);
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
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="zt-btn-ghost border border-border text-xs px-3 py-1.5"
          >
            {LangToggleLabel(lang)}
          </button>
          <div className="flex rounded-full border border-border bg-overlay/50 p-0.5 text-xs" aria-label={t.deviceMode}>
            <button
              type="button"
              onClick={() => setDeviceMode(false)}
              aria-pressed={!boothMode}
              className={`rounded-full px-3 py-1 transition-all ${
                !boothMode ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📱 {t.personalMode}
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode(true)}
              aria-pressed={boothMode}
              className={`rounded-full px-3 py-1 transition-all ${
                boothMode ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🏢 {t.boothMode}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-8 grid w-full max-w-7xl flex-1 gap-6 md:mt-12 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c, i) => (
          <div
            key={c.id}
            className={`zt-card group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${c.tone} p-6 shadow-xl transition-all hover:border-primary/50 md:p-7`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            {/* Top kicker and index */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
                  {t[c.kicker]}
                </p>
                <span className="mt-1 inline-block rounded-full bg-overlay/80 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {c.badge[lang]}
                </span>
              </div>
              <span className="text-4xl font-extrabold text-foreground/15 md:text-5xl">
                0{i + 1}
              </span>
            </div>

            {/* Picture + Title Showcase */}
            <div className="my-5 flex flex-col items-center text-center">
              <div className="relative mb-4 flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl border-2 border-border/80 bg-background/50 shadow-inner group-hover:border-primary/60 group-hover:shadow-lg transition-all">
                <img
                  src={c.image}
                  alt={c.badge[lang]}
                  className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                  loading="eager"
                />
              </div>
              <h2 className="text-2xl font-bold leading-tight md:text-3xl">{c.title[lang]}</h2>
              <p className="mt-1.5 text-xs text-muted-foreground md:text-sm">{c.desc[lang]}</p>
            </div>

            {/* Action Buttons: Live Selfie, Upload Photo, Video */}
            <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-border/60">
              <div className={`grid ${boothMode ? "grid-cols-2" : "grid-cols-3"} gap-2`}>
                <Link
                  to="/experience/$scene"
                  params={{ scene: c.id }}
                  search={boothMode ? { mode: "booth" } : undefined}
                  onClick={() =>
                    localStorage.setItem("zuitar.deviceMode", boothMode ? "booth" : "personal")
                  }
                  className="zt-btn-primary flex items-center justify-center gap-1 py-2.5 text-xs sm:text-sm font-semibold text-center"
                >
                  <span>🤳</span>
                  <span>{boothMode ? (isHindi ? "सेल्फ़ी लें" : "Take Selfie") : (isHindi ? "लाइव सेल्फ़ी" : "Live Selfie")}</span>
                </Link>

                {!boothMode && (
                  <label className="zt-btn-secondary flex items-center justify-center gap-1 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer text-center">
                    <span>📁</span>
                    <span>{isHindi ? "फोटो अपलोड" : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) {
                          setSelectedModalScene(c.id as "modi" | "yogi" | "bjp");
                          setBoothOpen(true);
                          void choosePhoto(file);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                )}

                <Link
                  to="/experience/$scene"
                  params={{ scene: c.id }}
                  search={boothMode ? { mode: "booth" } : undefined}
                  onClick={() =>
                    localStorage.setItem("zuitar.deviceMode", boothMode ? "booth" : "personal")
                  }
                  className="zt-btn-ghost border border-border flex items-center justify-center gap-1 py-2.5 text-xs sm:text-sm font-semibold text-center"
                >
                  <span>🎥</span>
                  <span>{isHindi ? "वीडियो" : "Video"}</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="mx-auto mt-7 w-full max-w-7xl rounded-3xl border border-border bg-card p-5 md:mt-9 md:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold md:text-2xl">
              {isHindi ? "अपना फोटो बूथ डेमो" : "Try the photo booth demo"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">
              {isHindi
                ? "फोन या लैपटॉप से फोटो लें या चुनें। AI से फोटो बेहतर करें, फिर देखें और डाउनलोड करें।"
                : "Take or choose a photo on your phone or laptop. Enhance your photo with AI, then preview and download it."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setPhoto(null);
                setBoothOpen(true);
              }}
              className="zt-btn-primary"
            >
              {isHindi ? "कैमरा खोलें" : "Open camera"}
            </button>
            <label className="zt-btn-ghost cursor-pointer border border-border">
              {isHindi ? "फोटो अपलोड करें" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  setBoothOpen(true);
                  void choosePhoto(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </section>

      {dev && (
        <nav className="mx-auto mt-6 flex gap-3 font-mono text-xs text-muted-foreground">
          <span className="rounded border px-2 py-1">TEST MODE</span>
          <Link to="/selfie" className="underline">
            engine test: selfie
          </Link>
          <Link to="/world" className="underline">
            engine test: world
          </Link>
        </nav>
      )}
      {flash && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-overlay px-5 py-2 text-sm">
          {flash}
        </div>
      )}

      {boothOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stage/95 px-4 py-6 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="booth-title"
            className="mx-auto flex min-h-full w-full max-w-2xl flex-col rounded-3xl border border-border bg-card p-5 shadow-2xl md:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="booth-title" className="text-2xl font-bold">
                  {isHindi ? "फोटो बूथ डेमो" : "Photo booth demo"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isHindi
                    ? "फोटो device पर रहती है; AI edit चुनने पर सेवा को भेजी जाएगी।"
                    : "Your photo stays on this device unless you choose AI edit, which sends it to the service."}
                </p>
              </div>
              <button
                aria-label={isHindi ? "बंद करें" : "Close"}
                onClick={() => setBoothOpen(false)}
                className="zt-btn-ghost"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
              {photo ? (
                <div className="relative flex h-full w-full items-center justify-center">
                  <img
                    src={displayedPhoto ?? photo}
                    alt={isHindi ? "आपकी ली गई फोटो" : "Your captured photo"}
                    className="max-h-[65vh] w-full object-contain"
                  />
                  {showAi && (
                    <span className="absolute left-3 top-3 rounded-full bg-warning px-3 py-1 text-xs font-bold text-background">
                      {isHindi ? "AI से बना" : "AI GENERATED"}
                    </span>
                  )}
                  {aiBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="rounded-xl bg-overlay px-5 py-3">
                        {isHindi ? "AI photo बना रहा है…" : "Enhancing with AI…"}
                      </span>
                    </div>
                  )}
                </div>
              ) : cameraError ? (
                <p role="alert" className="max-w-md p-6 text-center text-sm text-white">
                  {cameraError}
                </p>
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
                modalQr ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-5 text-center w-full">
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
                      src={modalQr}
                      alt="QR code to download your photo"
                      className="w-64 rounded-xl bg-foreground p-3 lg:w-72 shadow-lg"
                    />
                    <p className="text-xs text-muted-foreground">{t.expires}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setModalQr(null)} className="zt-btn-ghost">
                        ✕ {t.close}
                      </button>
                      <button
                        onClick={() => {
                          setPhoto(null);
                          setAiPhoto(null);
                          setShowAi(false);
                          setModalQr(null);
                          setAiError(null);
                          setCameraError(null);
                        }}
                        className="zt-btn-secondary"
                      >
                        🔄 {isHindi ? "दोबारा लें" : "Retake"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                      <button
                        onClick={() => {
                          setPhoto(null);
                          setAiPhoto(null);
                          setShowAi(false);
                          setModalQr(null);
                          setAiError(null);
                          setCameraError(null);
                        }}
                        className="zt-btn-ghost text-xs sm:text-sm"
                      >
                        🔄 {isHindi ? "दोबारा लें" : "Retake"}
                      </button>

                      {!boothMode ? (
                        <>
                          <a
                            href={displayedPhoto ?? photo}
                            download={showAi ? "zuitar-ai-photo.jpg" : "zuitar-photo-booth.jpg"}
                            className="zt-btn-primary text-xs sm:text-sm flex items-center gap-1.5"
                          >
                            <span>⬇️</span>
                            <span>{isHindi ? "डाउनलोड" : "Download photo"}</span>
                          </a>
                          <button
                            onClick={() => void makeModalQrWithPhoto()}
                            disabled={modalQrBusy}
                            className="zt-btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
                          >
                            <span>📱</span>
                            <span>{modalQrBusy ? "..." : (isHindi ? "QR कोड" : "Scan QR")}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => void makeModalQrWithPhoto()}
                          disabled={modalQrBusy}
                          className="zt-btn-primary text-xs sm:text-sm flex items-center gap-1.5 px-4 py-2 font-bold"
                        >
                          <span>📱</span>
                          <span>
                            {modalQrBusy
                              ? "..."
                              : (isHindi ? "फ़ोन में डाउनलोड (QR स्कैन)" : "Download to Phone (QR)")}
                          </span>
                        </button>
                      )}

                      {aiPhoto && (
                        <button
                          onClick={() => setShowAi((value) => !value)}
                          className="zt-btn-ghost border border-border text-xs sm:text-sm"
                        >
                          {showAi
                            ? (isHindi ? "असली फ़ोटो देखें" : "Show original")
                            : (isHindi ? "AI फ़ोटो देखें" : "Show AI photo")}
                        </button>
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-3 border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-primary">
                          {isHindi
                            ? "फीचर चुनें (Meeting, Selfie, Handshake, Scarf, Gift):"
                            : "Choose Feature (Meeting, Selfie, Handshake, Scarf, Gift):"}
                        </p>
                      </div>

                      {/* Scene / Leader Tabs */}
                      <div className="flex rounded-xl border border-border bg-background/50 p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedModalScene("modi")}
                          className={`flex-1 rounded-lg py-2 font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            selectedModalScene === "modi"
                              ? "bg-primary text-primary-foreground shadow"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <img src="/assets/modi.png" alt="Modi" className="h-4 w-4 rounded-full object-cover" />
                          <span>{isHindi ? "पीएम मोदी" : "PM Modi"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedModalScene("yogi")}
                          className={`flex-1 rounded-lg py-2 font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            selectedModalScene === "yogi"
                              ? "bg-primary text-primary-foreground shadow"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <img src="/assets/yogi.png" alt="Yogi" className="h-4 w-4 rounded-full object-cover" />
                          <span>{isHindi ? "सीएम योगी" : "CM Yogi"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedModalScene("bjp")}
                          className={`flex-1 rounded-lg py-2 font-semibold transition-all flex items-center justify-center gap-1.5 ${
                            selectedModalScene === "bjp"
                              ? "bg-primary text-primary-foreground shadow"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <img src="/assets/bjp.png" alt="BJP" className="h-4 w-4 rounded-full object-contain" />
                          <span>{isHindi ? "भाजपा लुक" : "BJP Look"}</span>
                        </button>
                      </div>

                      {/* Options Grid for Selected Leader */}
                      <div className="grid grid-cols-2 gap-2 max-h-[30vh] overflow-y-auto pr-1">
                        {selectedModalScene === "modi" && (
                          <>
                            {[
                              { id: "selfie", icon: "🤳", label: { en: "Selfie with Modi", hi: "मोदी जी से सेल्फी" } },
                              { id: "handshake", icon: "🤝", label: { en: "Handshake with Modi", hi: "मोदी जी से हाथ मिलाएँ" } },
                              { id: "hug", icon: "🫂", label: { en: "Hug with Modi", hi: "मोदी जी से गले मिलें" } },
                              { id: "meeting", icon: "💬", label: { en: "Meeting with Modi", hi: "मोदी जी से मुलाक़ात" } },
                              { id: "scarf", icon: "🧣", label: { en: "Saffron Scarf", hi: "अंगवस्त्र सम्मान" } },
                              { id: "gift", icon: "🎁", label: { en: "Gift / Memento", hi: "उपहार / स्मृति चिन्ह भेंट" } },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedModalInteraction(opt.id)}
                                disabled={aiBusy}
                                className={`flex items-center justify-between rounded-xl border p-2.5 text-xs sm:text-sm font-medium transition-all ${
                                  selectedModalInteraction === opt.id
                                    ? "border-primary bg-primary/15 text-primary font-bold ring-2 ring-primary/40"
                                    : "border-border/60 hover:bg-muted text-foreground"
                                } disabled:opacity-50`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-base sm:text-lg">{opt.icon}</span>
                                  <span>{opt.label[lang]}</span>
                                </span>
                                {selectedModalInteraction === opt.id && (
                                  <span className="text-[10px] font-bold text-primary">✓</span>
                                )}
                              </button>
                            ))}
                          </>
                        )}

                        {selectedModalScene === "yogi" && (
                          <>
                            {[
                              { id: "selfie", icon: "🤳", label: { en: "Selfie with Yogi", hi: "योगी जी से सेल्फी" } },
                              { id: "handshake", icon: "🤝", label: { en: "Handshake with Yogi", hi: "योगी जी से हाथ मिलाएँ" } },
                              { id: "hug", icon: "🫂", label: { en: "Hug with Yogi", hi: "योगी जी से गले मिलें" } },
                              { id: "meeting", icon: "💬", label: { en: "Meeting with Yogi", hi: "योगी जी से मुलाक़ात" } },
                              { id: "scarf", icon: "🧣", label: { en: "Saffron Scarf", hi: "अंगवस्त्र सम्मान" } },
                              { id: "gift", icon: "🎁", label: { en: "Gift / Memento", hi: "उपहार / स्मृति चिन्ह भेंट" } },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedModalInteraction(opt.id)}
                                disabled={aiBusy}
                                className={`flex items-center justify-between rounded-xl border p-2.5 text-xs sm:text-sm font-medium transition-all ${
                                  selectedModalInteraction === opt.id
                                    ? "border-primary bg-primary/15 text-primary font-bold ring-2 ring-primary/40"
                                    : "border-border/60 hover:bg-muted text-foreground"
                                } disabled:opacity-50`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-base sm:text-lg">{opt.icon}</span>
                                  <span>{opt.label[lang]}</span>
                                </span>
                                {selectedModalInteraction === opt.id && (
                                  <span className="text-[10px] font-bold text-primary">✓</span>
                                )}
                              </button>
                            ))}
                          </>
                        )}

                        {selectedModalScene === "bjp" && (
                          <>
                            {[
                              { id: "selfie", icon: "🪷", label: { en: "BJP Lotus Look", hi: "भाजपा कमल लुक" } },
                              { id: "scarf", icon: "🧣", label: { en: "Cap & Scarf Look", hi: "टोपी व पटका लुक" } },
                              { id: "gift", icon: "🎁", label: { en: "Ceremonial Memento", hi: "स्मृति चिन्ह व सम्मान" } },
                              { id: "event", icon: "🚩", label: { en: "BJP Flag Style", hi: "भाजपा ध्वज लुक" } },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setSelectedModalInteraction(opt.id)}
                                disabled={aiBusy}
                                className={`flex items-center justify-between rounded-xl border p-2.5 text-xs sm:text-sm font-medium transition-all ${
                                  selectedModalInteraction === opt.id
                                    ? "border-primary bg-primary/15 text-primary font-bold ring-2 ring-primary/40"
                                    : "border-border/60 hover:bg-muted text-foreground"
                                } disabled:opacity-50`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="text-base sm:text-lg">{opt.icon}</span>
                                  <span>{opt.label[lang]}</span>
                                </span>
                                {selectedModalInteraction === opt.id && (
                                  <span className="text-[10px] font-bold text-primary">✓</span>
                                )}
                              </button>
                            ))}
                          </>
                        )}
                      </div>

                      {/* Primary Generate Button */}
                      <button
                        type="button"
                        onClick={() => void enhancePhoto(selectedModalScene, selectedModalInteraction)}
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

                      {dev && demoAiReady && (
                        <button
                          onClick={() => void enhancePhoto("demo", "selfie")}
                          disabled={aiBusy}
                          className="zt-btn-secondary disabled:opacity-50 text-xs"
                        >
                          {isHindi ? "✦ TEST: काल्पनिक AI सेल्फी" : "✦ TEST: Fictional AI selfie"}
                        </button>
                      )}
                    </div>
                  </>
                )
              ) : (
                <>
                  <button
                    onClick={capturePhoto}
                    disabled={!cameraReady || !!cameraError}
                    className="zt-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isHindi ? "फोटो लें" : "Capture photo"}
                  </button>
                  {canFlipCamera && cameraReady && !cameraError && (
                    <button
                      onClick={() => {
                        setCameraReady(false);
                        setFacingMode((mode) => (mode === "user" ? "environment" : "user"));
                      }}
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
                      onChange={(event) => {
                        void choosePhoto(event.currentTarget.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </>
              )}
            </div>
            {photo && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {isHindi
                  ? "AI edit चुनने पर फोटो AI सेवा को भेजी जाएगी और परिणाम AI-generated चिह्नित होगा।"
                  : "Choosing AI edit sends the photo to the AI service; its result is labelled AI-generated."}
              </p>
            )}
            {aiError && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <p role="alert" className="text-center text-sm font-medium text-destructive">
                  {aiError}
                </p>
                {lastAttempt && (
                  <button
                    onClick={() => void enhancePhoto(lastAttempt.scene, lastAttempt.interaction)}
                    disabled={aiBusy}
                    className="zt-btn-secondary text-xs"
                  >
                    {isHindi ? "दोबारा प्रयास करें (Retry)" : "Retry"}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
