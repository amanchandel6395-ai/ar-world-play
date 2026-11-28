import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicConfig } from "@/lib/config.functions";
import { createShare } from "@/lib/share.functions";
import QRCode from "qrcode";
import type { PublicConfig, Candidate } from "@/lib/config";
import type { SceneId } from "@/ar/scenes";
import { useDevMode } from "@/lib/kiosk";
import { LangToggleLabel, useLang } from "@/lib/i18n";
import { resolveCandidateFromEnv } from "@/lib/candidateResolver";
import { getEnhancePrompt } from "@/lib/enhance-prompt";

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
    title: { en: "Selfie with CM Yogi Ji", hi: "सेल्फ़ी सीएम योगी जी के साथ" },
    badge: { en: "CM Yogi Ji", hi: "मुख्यमंत्री योगी आदित्यनाथ जी" },
    desc: {
      en: "Live selfie, handshake, meeting, scarf & gift with CM Yogi Ji",
      hi: "लाइव सेल्फ़ी, हाथ मिलाना, मुलाक़ात, अंगवस्त्र व उपहार भेंट",
    },
  },
  {
    id: "modi",
    kicker: "selfieWith",
    tone: "from-orange-500/30 via-amber-500/15 to-card",
    image: "/assets/modi.png",
    title: { en: "Selfie with PM Modi Ji", hi: "सेल्फ़ी पीएम मोदी जी के साथ" },
    badge: { en: "PM Modi Ji", hi: "प्रधानमंत्री नरेंद्र मोदी जी" },
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
  // Standard mode is Booth Mode with instant QR mobile handoff + direct sharing
  const boothMode = true;
  const [adminSettings, setAdminSettings] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("zuitar_admin_settings") : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enableYogi: true,
      enableModi: true,
      enableYogiGeneration: true,
      enableModiGeneration: true,
      enableBjpGeneration: true,
    };
  });

  const isPoliticianStopped = (id: string) => {
    if (id === "yogi" && adminSettings.enableYogiGeneration === false) return true;
    if (id === "modi" && adminSettings.enableModiGeneration === false) return true;
    if (id === "bjp" && adminSettings.enableBjpGeneration === false) return true;
    return false;
  };
  const fetchConfig = useServerFn(getPublicConfig);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
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
  const [cameraFailed, setCameraFailed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [canFlipCamera, setCanFlipCamera] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isHindi = lang === "hi";
  const displayedPhoto = showAi && aiPhoto ? aiPhoto : photo;

  const currentCandidate = resolveCandidateFromEnv(
    typeof window !== "undefined" ? window.location.search : undefined,
    candidates
  );
  const candidateId = currentCandidate?.id || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("candidate") : null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("zuitar_admin_settings");
      if (saved) setAdminSettings(JSON.parse(saved));
    } catch {}
    fetchConfig()
      .then((c) => {
        setReady(c.ready);
        setDemoAiReady(c.demo.aiReady);
        if (c.candidates) setCandidates(c.candidates);
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
    setCameraFailed(false);
    setCameraError(null);

    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        .then((stream) => {
          if (!active) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setCameraReady(true);
          setCameraFailed(false);
        })
        .catch((err) => {
          console.warn("Camera access failed or unavailable, fallback active:", err);
          setCameraReady(false);
          setCameraFailed(true);
        });
    } else {
      setCameraFailed(true);
    }

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [boothOpen, photo, facingMode]);

  const toggleCameraFlip = () => {
    setCameraReady(false);
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const startCountdownAndCapture = () => {
    if (countdown !== null) return;
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(null);
        capturePhoto();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const finishPhoto = (source: CanvasImageSource, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;

    const scale = Math.min(1, 2048 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return;

    context.save();
    // Mirror the capture if taken from front user camera so result matches preview
    if (source === videoRef.current && facingMode === "user") {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    context.restore();

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
    if (isPoliticianStopped(scene)) {
      setAiError(
        isHindi
          ? "यह सेवा अभी एडमिन द्वारा अस्थायी रूप से रोकी गई है।"
          : "This feature is temporarily stopped by administrator."
      );
      return;
    }
    setAiBusy(true);
    setAiError(null);
    setLastAttempt({ scene, interaction });
    try {
      let finalImg: string | null = null;

      // Tier 1: Try server-side enhancement (/api/enhance) with CometAPI / Lovable / Gemini
      try {
        const image = await (await fetch(photo)).blob();
        const form = new FormData();
        form.append("image", image, "customer-photo.jpg");
        form.append("scene", scene);
        form.append("interaction", interaction);
        const response = await fetch("/api/enhance", { method: "POST", body: form });
        const result = (await response.json().catch(() => ({}))) as { b64?: string; code?: string; message?: string };
        if (response.ok && result.b64) {
          finalImg = `data:image/jpeg;base64,${result.b64}`;
        } else {
          console.warn("Backend /api/enhance returned error or quota zero, using Puter.js fallback...", result);
        }
      } catch (backendErr) {
        console.warn("Backend /api/enhance request failed, using Puter.js fallback...", backendErr);
      }

      // Tier 2: Free Puter.js client-side AI image generation (free, no API key needed, never stops)
      if (!finalImg && typeof window !== "undefined") {
        try {
          const puter = (window as any).puter;
          if (puter?.ai?.txt2img) {
            const prompt = getEnhancePrompt(scene, interaction);
            console.log("Generating with free Puter.js AI model...");
            let imgEl: any = null;
            try {
              imgEl = await puter.ai.txt2img(prompt, { model: "google/gemini-2.5-flash-image" });
            } catch {
              imgEl = await puter.ai.txt2img(prompt);
            }
            if (imgEl && imgEl.src) {
              finalImg = imgEl.src;
            }
          }
        } catch (puterErr) {
          console.warn("Puter.js generation failed:", puterErr);
        }
      }

      if (finalImg) {
        setAiPhoto(finalImg);
        setShowAi(true);
        setModalQr(null);
        if (boothMode) {
          setTimeout(() => {
            void makeModalQrWithPhoto(finalImg);
          }, 100);
        }
      } else {
        throw new Error(isHindi ? "AI फोटो तैयार नहीं हो सकी। कृपया दोबारा प्रयास करें।" : "The AI photo could not be generated. Please retry.");
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
        </div>
      </header>

      {currentCandidate && (
        <div className="mx-auto mt-6 w-full max-w-7xl overflow-hidden rounded-3xl border-2 border-primary/50 bg-gradient-to-r from-orange-500/15 via-background to-emerald-500/15 p-5 shadow-2xl md:p-7">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {currentCandidate.photoUrl ? (
              <img
                src={currentCandidate.photoUrl}
                alt={currentCandidate.name[lang] || currentCandidate.name.en}
                className="h-28 w-28 rounded-2xl border-2 border-primary object-cover shadow-lg shrink-0"
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-2 border-primary bg-primary/20 text-3xl font-bold text-primary shadow-lg">
                {(currentCandidate.name[lang] || currentCandidate.name.en || "P")[0]}
              </div>
            )}
            <div className="flex-1 space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1 text-xs font-extrabold text-primary">
                <span>🇮🇳</span>
                <span>{isHindi ? "बोलता पोस्टर अभियान · विशेष समर्थन" : "Bolta Poster Campaign · Endorsement"}</span>
              </div>
              <h2 className="text-2xl font-black md:text-4xl text-gradient">
                {currentCandidate.name[lang] || currentCandidate.name.en}
              </h2>
              <p className="text-sm font-bold text-foreground/90 md:text-base">
                {currentCandidate.partyRole[lang] || currentCandidate.partyRole.en} ·{" "}
                <span className="text-primary font-semibold">{currentCandidate.constituency[lang] || currentCandidate.constituency.en}</span>
              </p>
              {currentCandidate.slogan && (
                <p className="text-xs font-medium italic text-muted-foreground md:text-sm">
                  "{currentCandidate.slogan[lang] || currentCandidate.slogan.en}"
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <span className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md text-center">
                {isHindi ? "✓ प्रत्याशी समर्थन मोड सक्रिय" : "✓ Candidate Mode Active"}
              </span>
              <button
                type="button"
                onClick={() => {
                  window.history.replaceState({}, "", window.location.pathname);
                  window.location.reload();
                }}
                className="text-[11px] text-muted-foreground underline hover:text-foreground text-center"
              >
                {isHindi ? "सामान्य मोड में बदलें" : "Clear candidate selection"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="relative mb-4 flex h-52 w-52 sm:h-56 sm:w-56 items-center justify-center overflow-hidden rounded-2xl border-2 border-border/80 bg-black/10 shadow-md group-hover:border-primary/60 group-hover:shadow-xl transition-all">
                <img
                  src={c.image}
                  alt={c.badge[lang]}
                  className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  loading="eager"
                />
              </div>
              <h2 className="text-2xl font-bold leading-tight md:text-3xl">{c.title[lang]}</h2>
              <p className="mt-1.5 text-xs text-muted-foreground md:text-sm">{c.desc[lang]}</p>
            </div>

            {/* Action Buttons: Take Selfie & Upload Photo */}
            <div className="mt-2 flex flex-col gap-2 pt-3 border-t border-border/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPoliticianStopped(c.id)}
                  onClick={() => {
                    setSelectedModalScene(c.id as "modi" | "yogi" | "bjp");
                    setBoothOpen(true);
                    setPhoto(null);
                    setAiPhoto(null);
                    setShowAi(false);
                    setCameraError(null);
                  }}
                  className={`zt-btn-primary flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold text-center shadow-lg transition-all ${
                    isPoliticianStopped(c.id) ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground" : ""
                  }`}
                >
                  <span>🤳</span>
                  <span>
                    {isPoliticianStopped(c.id)
                      ? (isHindi ? "अस्थायी रूप से बंद" : "Temporarily Paused")
                      : (isHindi ? "सेल्फ़ी लें" : "Take Selfie")}
                  </span>
                </button>

                <label
                  className={`zt-btn-secondary flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold cursor-pointer text-center shadow-md border border-amber-500/40 transition-all ${
                    isPoliticianStopped(c.id) ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                  }`}
                >
                  <span>📁</span>
                  <span>{isHindi ? "फोटो अपलोड" : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isPoliticianStopped(c.id)}
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
              {isHindi ? "सेल्फ़ी लें / कैमरा खोलें" : "Take Selfie / Open Camera"}
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

            <div className="mt-5 flex min-h-72 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black border border-border/40 relative">
              {photo ? (
                <div className="relative flex h-full w-full items-center justify-center">
                  <img
                    src={displayedPhoto ?? photo}
                    alt={isHindi ? "आपकी ली गई फोटो" : "Your captured photo"}
                    className="max-h-[65vh] w-full object-contain"
                  />
                  {showAi && (
                    <span className="absolute left-3 top-3 rounded-full bg-warning px-3 py-1 text-xs font-bold text-background shadow">
                      {isHindi ? "AI से बना" : "AI GENERATED"}
                    </span>
                  )}
                  {aiBusy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-xs">
                      <span className="rounded-xl bg-overlay px-5 py-3 font-semibold text-primary shadow-lg border border-primary/30">
                        {isHindi ? "AI फोटो तैयार कर रहा है…" : "Enhancing with AI…"}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative flex h-full min-h-[340px] w-full items-center justify-center bg-black overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={() => {
                      videoRef.current?.play().catch(() => {});
                      setCameraReady(true);
                      setCameraFailed(false);
                    }}
                    className={`max-h-[65vh] w-full object-contain transition-transform duration-200 ${
                      facingMode === "user" ? "-scale-x-100" : ""
                    } ${cameraReady ? "block" : "hidden"}`}
                  />

                  {/* Camera Starting / Loading indicator */}
                  {!cameraReady && !cameraFailed && (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-white space-y-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500/30 border-t-amber-500" />
                      <p className="text-sm font-semibold text-white/90">
                        {isHindi ? "कैमरा शुरू हो रहा है…" : "Starting camera…"}
                      </p>
                    </div>
                  )}

                  {/* Fallback only if hardware camera access is unavailable */}
                  {cameraFailed && (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-white space-y-4 max-w-sm">
                      <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl border border-primary/40 shadow-inner">
                        📸
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-bold">
                          {isHindi ? "कैमरा एक्सेस नहीं मिला" : "Camera Access Unavailable"}
                        </h3>
                        <p className="text-xs text-white/70">
                          {isHindi
                            ? "सीधे कैमरे से सेल्फ़ी लेने के लिए नीचे बटन दबाएँ या गैलरी से फ़ोटो चुनें।"
                            : "Use native camera capture or choose a photo from gallery."}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2.5 w-full pt-1">
                        <label className="zt-btn-primary flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold shadow-lg cursor-pointer w-full text-center">
                          <span>📸</span>
                          <span>{isHindi ? "कैमरा से सेल्फ़ी लें" : "Take Photo with Camera"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="user"
                            className="sr-only"
                            onChange={(event) => {
                              void choosePhoto(event.currentTarget.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <label className="zt-btn-secondary flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold border border-white/20 cursor-pointer w-full text-center">
                          <span>📁</span>
                          <span>{isHindi ? "गैलरी से फ़ोटो चुनें" : "Choose from Gallery"}</span>
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
                      </div>
                    </div>
                  )}

                  {/* Controls overlaid directly on top of video when active */}
                  {cameraReady && (
                    <>
                      {/* Top Bar: Flip Camera */}
                      <div className="absolute top-3 right-3 z-20">
                        <button
                          type="button"
                          onClick={toggleCameraFlip}
                          aria-label={isHindi ? "कैमरा बदलें" : "Flip camera"}
                          className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/25 px-3 py-1.5 text-xs font-bold text-white shadow-xl hover:bg-black/80 active:scale-95 transition-all"
                        >
                          <span className="text-base">🔄</span>
                          <span>{facingMode === "user" ? (isHindi ? "बैक कैमरा" : "Back Camera") : (isHindi ? "फ्रंट कैमरा" : "Front Camera")}</span>
                        </button>
                      </div>

                      {/* Countdown Display */}
                      {countdown !== null && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                          <span className="text-8xl font-black text-amber-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] animate-pulse">
                            {countdown}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
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
                    <div className="flex flex-wrap items-center justify-center gap-2.5 mt-3">
                      <a
                        href={displayedPhoto ?? photo}
                        download={showAi ? "zuitar-ai-photo.jpg" : "zuitar-photo.jpg"}
                        className="zt-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg transition-all active:scale-95"
                      >
                        <span>⬇️</span>
                        <span>{isHindi ? "फ़ोन में डाउनलोड करें" : "Download to device"}</span>
                      </a>
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
                    <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
                      <a
                        href={displayedPhoto ?? photo}
                        download={showAi ? "zuitar-ai-photo.jpg" : "zuitar-photo.jpg"}
                        className="zt-btn-primary text-xs sm:text-sm flex items-center gap-2 px-5 py-2.5 font-bold shadow-xl bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all active:scale-95"
                      >
                        <span className="text-base">⬇️</span>
                        <span>{isHindi ? "फोटो डाउनलोड करें" : "Download Photo"}</span>
                      </a>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const currentSrc = displayedPhoto ?? photo;
                            if (!currentSrc) return;
                            const blob = await (await fetch(currentSrc)).blob();
                            const file = new File([blob], "campaign-selfie.jpg", { type: "image/jpeg" });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                files: [file],
                                title: "Bolta Poster Campaign",
                                text: `Meri Photo | Bolta Poster Campaign - ${window.location.origin}`
                              });
                              return;
                            }
                            const text = encodeURIComponent(`Bolta Poster Campaign! Dekhein: ${window.location.origin}`);
                            window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
                          } catch {}
                        }}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs shadow-md transition-all active:scale-95"
                      >
                        <span className="text-sm">💬</span>
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const currentSrc = displayedPhoto ?? photo;
                            if (!currentSrc) return;
                            const blob = await (await fetch(currentSrc)).blob();
                            const file = new File([blob], "instagram-story.jpg", { type: "image/jpeg" });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                files: [file],
                                title: "Instagram Story",
                                text: `#BoltaPoster #ZUITAR ${window.location.origin}`
                              });
                              return;
                            }
                            if (navigator.clipboard) {
                              await navigator.clipboard.writeText(`#BoltaPoster #ZUITAR ${window.location.origin}`);
                            }
                            alert(isHindi ? "फ़ोटो डाउनलोड हो गई! Instagram खोलकर Story में लगाएं 📸" : "Photo ready! Open Instagram to share to story 📸");
                          } catch {}
                        }}
                        className="rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-bold flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs shadow-md transition-all active:scale-95"
                      >
                        <span className="text-sm">📸</span>
                        <span>Instagram</span>
                      </button>

                      <button
                        onClick={() => void makeModalQrWithPhoto()}
                        disabled={modalQrBusy}
                        className="zt-btn-secondary text-xs sm:text-sm flex items-center gap-1.5 px-3 py-2 border border-border"
                      >
                        <span>📱</span>
                        <span>{modalQrBusy ? "..." : (isHindi ? "QR कोड" : "Scan QR")}</span>
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
                        className="zt-btn-ghost text-xs sm:text-sm"
                      >
                        🔄 {isHindi ? "दोबारा लें" : "Retake"}
                      </button>

                      {aiPhoto && (
                        <button
                          onClick={() => setShowAi((value) => !value)}
                          className="zt-btn-ghost border border-border text-xs sm:text-sm"
                        >
                          {showAi
                            ? (isHindi ? "मूल फ़ोटो" : "Original")
                            : (isHindi ? "AI फ़ोटो" : "AI Photo")}
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

                      {/* Politician Stopped Banner */}
                      {isPoliticianStopped(selectedModalScene) && (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-xs font-semibold text-destructive">
                          ⚠️ {isHindi
                            ? "एडमिन द्वारा इस विकल्प के साथ फोटो जेनरेशन अभी अस्थायी रूप से बंद की गई है।"
                            : "Photo generation for this option is temporarily paused by administrator."}
                        </div>
                      )}

                      {/* Primary Generate Button */}
                      <button
                        type="button"
                        onClick={() => void enhancePhoto(selectedModalScene, selectedModalInteraction)}
                        disabled={aiBusy || isPoliticianStopped(selectedModalScene)}
                        className="zt-btn-primary mt-1 py-3 text-base font-bold flex items-center justify-center gap-2 w-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>✦</span>
                        <span>
                          {aiBusy
                            ? (isHindi ? "AI फोटो तैयार कर रहा है…" : "Generating AI Photo…")
                            : isPoliticianStopped(selectedModalScene)
                            ? (isHindi ? "अस्थायी रूप से बंद" : "Temporarily Paused")
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
                <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                  {cameraReady ? (
                    <>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        disabled={countdown !== null}
                        className="zt-btn-primary flex items-center gap-2 py-3 px-6 text-sm sm:text-base font-bold shadow-xl rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-all active:scale-95"
                      >
                        <span className="text-lg">🔴</span>
                        <span>{isHindi ? "फोटो खींचें" : "Capture Photo"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={startCountdownAndCapture}
                        disabled={countdown !== null}
                        className="zt-btn-secondary flex items-center gap-1.5 py-3 px-4 text-xs sm:text-sm font-semibold border border-amber-500/40 rounded-full transition-all"
                      >
                        <span>⏱️</span>
                        <span>{isHindi ? "3s टाइमर" : "3s Timer"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={toggleCameraFlip}
                        className="zt-btn-ghost flex items-center gap-1.5 py-3 px-4 text-xs sm:text-sm font-semibold border border-border/80 rounded-full transition-all"
                      >
                        <span>🔄</span>
                        <span>{isHindi ? "कैमरा बदलें" : "Flip"}</span>
                      </button>
                    </>
                  ) : (
                    <label className="zt-btn-primary flex items-center justify-center gap-2 py-3 px-6 text-sm font-bold cursor-pointer shadow-lg rounded-full">
                      <span>📸</span>
                      <span>{isHindi ? "कैमरा से सेल्फ़ी लें" : "Take with Camera"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="sr-only"
                        onChange={(event) => {
                          void choosePhoto(event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                  )}

                  <label className="zt-btn-secondary flex items-center justify-center gap-1.5 py-3 px-5 text-xs sm:text-sm font-semibold cursor-pointer border border-border rounded-full">
                    <span>📁</span>
                    <span>{isHindi ? "गैलरी से चुनें" : "Upload Photo"}</span>
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
                </div>
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

      {/* Contact Section */}
      <footer className="mt-16 w-full max-w-7xl mx-auto rounded-3xl border border-border/80 bg-card/90 p-6 md:p-8 backdrop-blur text-foreground shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="text-2xl">🇮🇳</span>
              <h3 className="text-xl font-bold">बोलता पोस्टर अभियान · ZUITAR</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {isHindi
                ? "मोदी जी, योगी जी और भाजपा लुक के साथ डिजिटल प्रचार एवं AI सेल्फी बूथ।"
                : "Digital campaign & AI selfie booth with Modi ji, Yogi ji and BJP look."}
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                👤 <span className="text-foreground font-semibold">Aman Pal</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                📍 <span>Lucknow, Uttar Pradesh</span>
              </span>
              <a
                href="tel:9068734941"
                className="flex items-center gap-1.5 text-primary hover:underline font-semibold"
              >
                📞 <span>+91 9068734941</span>
              </a>
              <a
                href="mailto:zuitaiofficial@gmail.com"
                className="flex items-center gap-1.5 text-primary hover:underline font-semibold"
              >
                ✉️ <span>zuitaiofficial@gmail.com</span>
              </a>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href="https://wa.me/919068734941?text=Namaste%20Aman%20ji,%20hume%20bolta%20poster%20campaign%20ka%20hissa%20banna%20hai."
              target="_blank"
              rel="noreferrer"
              className="zt-btn-primary flex items-center gap-2 px-6 py-3.5 text-sm font-bold shadow-xl bg-emerald-600 hover:bg-emerald-500 text-white rounded-full border-none transition-all hover:scale-105"
            >
              <span className="text-xl">💬</span>
              <span>{isHindi ? "अपना नाम जुड़वाएं (WhatsApp)" : "Request to Add Name"}</span>
            </a>
          </div>
        </div>
        <div className="mt-6 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} ZUITAR · All Rights Reserved · संपर्क: +91 9068734941 · Lucknow, Uttar Pradesh
        </div>
      </footer>

      {/* Floating Corner WhatsApp CTA */}
      <a
        href="https://wa.me/919068734941?text=Namaste%20Aman%20ji,%20hume%20bolta%20poster%20campaign%20ka%20hissa%20banna%20hai."
        target="_blank"
        rel="noreferrer"
        aria-label="Request to add your name on WhatsApp"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 px-5 py-3.5 text-white shadow-2xl transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-400/50"
      >
        <span className="text-xl">💬</span>
        <span className="font-bold text-xs sm:text-sm whitespace-nowrap">
          {isHindi ? "अपना नाम जुड़वाएं" : "Request to Add Name"}
        </span>
      </a>
    </main>
  );
}
