import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { SCENES, type SceneId } from "@/ar/scenes";
import { startFrontEngine, type EngineHandle, type EngineStatus } from "@/ar/engine/frontEngine";
import { detectCapabilities, type Caps } from "@/ar/capabilities";
import { DebugPanel, deviceLabel, type DebugRow } from "@/components/ar/DebugPanel";
import { WorldAR } from "@/components/ar/WorldAR";
import { RoomARView } from "@/components/ar/RoomARView";
import { KIOSK, useDevMode, useIdleReset } from "@/lib/kiosk";
import { getPublicConfig } from "@/lib/config.functions";
import type { InteractionId, PublicConfig } from "@/lib/config";
import { LangToggleLabel, useLang } from "@/lib/i18n";
import { ResultView } from "./ResultView";

type Phase = "intro" | "live" | "result" | "world";

export function Experience({ sceneId }: { sceneId: SceneId }) {
  const scene = SCENES[sceneId];
  const navigate = useNavigate();
  const goHome = useCallback(() => navigate({ to: "/" }), [navigate]);
  const [dev] = useDevMode();
  const [lang, setLang, t] = useLang();
  const fetchConfig = useServerFn(getPublicConfig);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [caps, setCaps] = useState<Caps | null>(null);
  const [phase, setPhase] = useState<Phase>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("room") === "1") return "world";
    }
    // Tapping a feature opens the camera straight away (upload + 3D room buttons are on the camera screen).
    return "live";
  });
  const [facing, setFacing] = useState<"user" | "environment">(scene.camera.default);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [interaction, setInteraction] = useState<InteractionId>("selfie");
  const [help, setHelp] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [seg, setSeg] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<EngineHandle | null>(null);
  const interactionRef = useRef(interaction);
  interactionRef.current = interaction;

  const loadConfig = useCallback(() => {
    setConfigError(false);
    fetchConfig()
      .then((c) => {
        setConfig(c);
        const first = c.interactions.find((i) => i.enabled);
        if (first && !c.interactions.some((i) => i.enabled && i.id === interactionRef.current))
          setInteraction(first.id);
      })
      .catch(() => setConfigError(true));
  }, [fetchConfig]);

  const [boothMode, setBoothMode] = useState(false);

  useEffect(() => {
    setBoothMode(
      new URLSearchParams(window.location.search).get("mode") === "booth" ||
        localStorage.getItem("zuitar.deviceMode") === "booth",
    );
    detectCapabilities().then(setCaps);
    loadConfig();
  }, [loadConfig]);

  useIdleReset(KIOSK.idleTimeoutMs, goHome, phase !== "result");

  useEffect(() => {
    if (phase !== "live" || !config) return;
    let cancelled = false;
    setError(null);
    setStatus(null);
    setTorch(false);
    setTorchOk(false);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    startFrontEngine({
      video,
      canvas,
      scene,
      facing,
      ctx: { config, interaction: interactionRef.current },
      onStatus: (s) => {
        if (!cancelled) setStatus(s);
      },
    })
      .then((h) => {
        if (cancelled) return h.stop();
        engine.current = h;
        h.setSegmentation(seg);
        setTorchOk(h.torchSupported);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? t.errCamDenied
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? t.errCamMissing
              : t.errCam,
        );
      });
    return () => {
      cancelled = true;
      engine.current?.stop();
      engine.current = null;
    };
    // seg/t intentionally excluded: they must not restart the camera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, facing, scene, config]);

  const pick = (id: InteractionId) => {
    setInteraction(id);
    engine.current?.setInteraction(id);
  };

  const capture = () => {
    if (
      count > 0 ||
      !engine.current ||
      (engine.current.standIn && !dev) ||
      (!config?.ready[sceneId] && !dev)
    )
      return;
    let n = scene.capture.countdown;
    setCount(n);
    const tick = () => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        window.setTimeout(tick, 1000);
      } else {
        setCount(0);
        if (!engine.current || (engine.current.standIn && !dev)) return;
        engine.current
          ?.capture()
          .then((b) => {
            setPhoto(b);
            setPhase("result");
          })
          .catch(() => setError(t.errCapture));
      }
    };
    window.setTimeout(tick, 1000);
  };

  const flip = () => setFacing((f) => (f === "user" ? "environment" : "user"));
  const toggleTorch = async () => {
    if (!engine.current) return;
    const ok = await engine.current.setTorch(!torch);
    if (ok) setTorch(!torch);
  };
  const toggleSeg = () => {
    const v = !seg;
    setSeg(v);
    engine.current?.setSegmentation(v);
  };

  const handleUploadPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(lang === "hi" ? "कृपया image फ़ाइल चुनें।" : "Please choose an image file.");
      return;
    }
    setPhoto(file);
    setPhase("result");
  };

  const getInteractionLabel = (id: InteractionId, fallback: string) => {
    if (sceneId === "modi") {
      if (id === "selfie") return lang === "hi" ? "पीएम मोदी सेल्फ़ी" : "Selfie with PM Modi";
      if (id === "handshake")
        return lang === "hi" ? "मोदी जी से हाथ मिलाएँ" : "Handshake with Modi";
      if (id === "hug") return lang === "hi" ? "मोदी जी से गले मिलें" : "Hug with Modi";
      if (id === "meeting") return lang === "hi" ? "मोदी जी से मुलाक़ात" : "Meeting with Modi";
      if (id === "scarf") return lang === "hi" ? "अंगवस्त्र सम्मान" : "Scarf Honor";
    }
    if (sceneId === "yogi") {
      if (id === "selfie") return lang === "hi" ? "सीएम योगी सेल्फ़ी" : "Selfie with CM Yogi";
      if (id === "handshake")
        return lang === "hi" ? "योगी जी से हाथ मिलाएँ" : "Handshake with Yogi";
      if (id === "hug") return lang === "hi" ? "योगी जी से गले मिलें" : "Hug with Yogi";
      if (id === "meeting") return lang === "hi" ? "योगी जी से मुलाक़ात" : "Meeting with Yogi";
      if (id === "scarf") return lang === "hi" ? "अंगवस्त्र सम्मान" : "Scarf Honor";
    }
    if (sceneId === "bjp") {
      if (id === "selfie") return lang === "hi" ? "भाजपा कमल लुक" : "BJP Lotus Look";
      if (id === "scarf") return lang === "hi" ? "टोपी व पटका" : "Cap & Scarf";
      if (id === "event") return lang === "hi" ? "मंच व ध्वज" : "Stage & Flag";
    }
    return fallback;
  };

  if (phase === "world" && config) {
    const yogiCutout =
      config.characters.yogi.poses.walk || config.characters.yogi.poses.selfie || "/assets/yogi.png";
    const modiCutout =
      config.characters.modi.poses.walk || config.characters.modi.poses.selfie || "/assets/modi.png";
    return (
      <RoomARView
        initialCharacter={sceneId === "modi" ? "modi" : sceneId === "both" ? "both" : "yogi"}
        yogiAsset={yogiCutout}
        modiAsset={modiCutout}
        onCapture={(b) => {
          setPhoto(b);
          setPhase("result");
        }}
        onExit={() => setPhase("live")}
        onHome={goHome}
      />
    );
  }

  if (phase === "result" && photo) {
    return (
      <ResultView
        photo={photo}
        sceneId={sceneId}
        interaction={interaction}
        allowAi={!!config?.ai.imageReady || !!config?.ai.imageEnabled}
        allowVideo={!!config?.ai.videoReady}
        videoConfigured={!!config?.ai.videoEnabled}
        onRetake={() => {
          setPhoto(null);
          setPhase("live");
        }}
        onHome={goHome}
      />
    );
  }

  const title = t[sceneId];
  const subtitle = t[`${sceneId}Sub`];
  const ready = status?.engine && !error;
  const sceneReady = true;
  const assetMissing = false;
  const interactions = config?.interactions.filter((i) => i.enabled) ?? [];
  const on = (b?: boolean) => (b ? "on" : "off") as "on" | "off";
  const rows: DebugRow[] = status
    ? [
        {
          label: "AR ENGINE",
          value: status.engine ? "ON · MediaPipe" : "loading",
          state: on(status.engine),
        },
        { label: "CAMERA", value: status.camera ? "ON" : "OFF", state: on(status.camera) },
        { label: "FACING", value: status.facing === "user" ? "FRONT" : "BACK", state: "info" },
        {
          label: "FACE TRACKING",
          value: status.face ? "ON · 6DoF" : "no face",
          state: on(status.face),
        },
        {
          label: "BODY TRACKING",
          value: status.body ? "ON · pose" : "no body",
          state: on(status.body),
        },
        {
          label: "SEGMENTATION",
          value: status.segmentation ? "ON" : "OFF",
          state: on(status.segmentation),
        },
        {
          label: "WORLD TRACKING",
          value: caps?.worldAR ? "available (room mode)" : "not supported",
          state: caps?.worldAR ? "info" : "warn",
        },
        { label: "BODY STATE", value: status.bodyState },
        { label: "DISTANCE", value: status.distance },
        { label: "FPS", value: String(status.fps) },
        { label: "VIDEO", value: status.res },
        { label: "DELEGATE", value: status.delegate },
        { label: "SCENE", value: `${scene.id} · ${interaction}` },
        { label: "DEVICE", value: deviceLabel() },
        { label: "STAGE", value: status.stage, state: "info" },
      ]
    : [];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <video ref={videoRef} className="hidden" playsInline muted />
      {phase === "live" && <canvas ref={canvasRef} className="h-full w-full object-cover" />}

      {phase === "intro" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-stage px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">ZUITAR</p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">{title}</h1>
          <p className="text-lg text-muted-foreground">{subtitle}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {caps &&
              (
                [
                  ["Camera", caps.camera],
                  ["Face tracking", caps.faceTracking],
                  ["Body tracking", caps.bodyTracking],
                  ["Room AR", caps.worldAR],
                ] as const
              ).map(([l, ok]) => (
                <span
                  key={l}
                  className={`rounded-full border px-4 py-1.5 text-sm ${ok ? "border-primary/50 text-foreground" : "border-border text-muted-foreground"}`}
                >
                  {ok ? "✓" : "–"} {l}
                </span>
              ))}
          </div>
          {caps && !caps.camera ? (
            <p className="max-w-md text-warning">{t.noCamera}</p>
          ) : configError ? (
            <div className="flex flex-col items-center gap-3">
              <p className="max-w-md text-warning">{t.setupTitle}</p>
              <button onClick={loadConfig} className="zt-btn-primary min-w-64 text-xl">
                {t.retry}
              </button>
            </div>
          ) : config && !sceneReady ? (
            <div
              role="status"
              className="flex max-w-md flex-col items-center gap-2 rounded-2xl border border-warning/60 bg-card px-6 py-5"
            >
              <p className="text-xl font-bold text-warning">{t.setupTitle}</p>
              <p className="text-muted-foreground">
                {sceneId === "bjp" ? t.setupBjp : t.setupChar}
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setPhase("live")}
                disabled={!config}
                className="zt-btn-primary min-w-56 text-lg sm:text-xl disabled:opacity-50"
              >
                🤳 {config ? (boothMode ? t.clickSelfie : t.liveSelfie) : t.loading}
              </button>
              {!boothMode && (
                <label className="zt-btn-secondary min-w-56 text-lg sm:text-xl flex items-center justify-center gap-2 cursor-pointer border border-border">
                  <span>📁</span>
                  <span>{t.uploadPhoto}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      void handleUploadPhoto(e.currentTarget.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={goHome} className="zt-btn-ghost">
              ← {t.back}
            </button>
            <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className="zt-btn-ghost">
              {LangToggleLabel(lang)}
            </button>
          </div>
        </div>
      )}

      {phase === "live" && (
        <>
          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stage">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-lg text-muted-foreground">{t.loading}</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-stage px-6 text-center">
              <p className="max-w-md text-xl">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setError(null);
                    setPhase("intro");
                  }}
                  className="zt-btn-secondary"
                >
                  {t.retry}
                </button>
                <button onClick={goHome} className="zt-btn-primary">
                  {t.home}
                </button>
              </div>
            </div>
          )}

          {/* top bar */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-background/70 to-transparent px-3 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button onClick={goHome} aria-label={t.back} className="zt-btn-round">
              ←
            </button>
            {ready && assetMissing ? (
              <div
                role="status"
                className="pointer-events-none mt-1 max-w-[55%] rounded-2xl border border-warning/60 bg-overlay px-3 py-1.5 text-center text-xs font-semibold text-warning md:text-sm"
              >
                {t.setupTitle}
              </div>
            ) : ready && sceneId !== "bjp" ? (
              <div className="pointer-events-none mt-2 max-w-[50%] rounded-full bg-overlay px-3 py-1 text-center text-[10px] text-muted-foreground md:text-xs">
                {t.photoNote}
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => setLang(lang === "en" ? "hi" : "en")}
                className="zt-btn-round text-xs"
              >
                {lang === "en" ? "हिं" : "EN"}
              </button>
              <button onClick={() => setHelp(true)} aria-label={t.help} className="zt-btn-round">
                ?
              </button>
              <button
                onClick={() => engine.current?.resetPlacement()}
                disabled={!ready}
                aria-label={t.reset}
                className="zt-btn-round text-xs disabled:opacity-40"
              >
                ↺
              </button>
              {torchOk && (
                <button
                  onClick={toggleTorch}
                  aria-label={t.flash}
                  aria-pressed={torch}
                  className={`zt-btn-round ${torch ? "ring-2 ring-primary" : ""}`}
                >
                  ⚡
                </button>
              )}
              {scene.occlusion === "segmentation" && (
                <button
                  onClick={toggleSeg}
                  disabled={!ready}
                  aria-pressed={seg}
                  aria-label="Segmentation"
                  className={`zt-btn-round text-xs disabled:opacity-40 ${seg ? "ring-2 ring-primary" : ""}`}
                >
                  ◐
                </button>
              )}
            </div>
          </div>

          {count > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                key={count}
                className="zt-count text-[10rem] font-bold text-foreground drop-shadow-2xl md:text-[14rem]"
              >
                {count}
              </span>
            </div>
          )}
          {dev && status && (
            <div className="absolute left-3 top-20">
              <DebugPanel rows={rows} title="ZUITAR DEV MODE" />
            </div>
          )}

          {/* bottom bar */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-background/85 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
            {interactions.length > 1 && (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-muted-foreground">{t.pick}</p>
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {interactions.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => pick(i.id)}
                      aria-pressed={interaction === i.id}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold ${
                        interaction === i.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-overlay text-foreground"
                      }`}
                    >
                      <span className="text-base">{i.icon}</span>
                      <span>{getInteractionLabel(i.id, i.label[lang])}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 items-center">
              <div className="flex justify-start">
                <label
                  className="zt-btn-round flex items-center justify-center cursor-pointer"
                  title={lang === "hi" ? "फोटो अपलोड करें" : "Upload photo"}
                >
                  📁
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      void handleUploadPhoto(e.currentTarget.files?.[0]);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={capture}
                  disabled={!ready || count > 0 || assetMissing}
                  aria-label={t.capture}
                  className="h-24 w-24 rounded-full border-[6px] border-foreground bg-primary shadow-2xl transition-transform active:scale-90 disabled:opacity-40 md:h-28 md:w-28"
                />
              </div>
              <div className="flex justify-end gap-3">
                {sceneId !== "bjp" && (
                  <button
                    type="button"
                    onClick={() => setPhase("world")}
                    className="flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-300 shadow-md backdrop-blur-md transition-all hover:bg-amber-500/30 active:scale-95"
                    title={lang === "hi" ? "3D रूम में खड़े करें" : "Place in 3D Room"}
                  >
                    <span>🏛️</span>
                    <span>{lang === "hi" ? "3D रूम" : "3D Room"}</span>
                  </button>
                )}
                <button onClick={flip} aria-label={t.flip} className="zt-btn-round">
                  ⟲
                </button>
              </div>
            </div>
          </div>

          {help && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-background/70 p-6"
              onClick={() => setHelp(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-sm rounded-2xl bg-card p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="mb-3 text-xl font-bold">{t.helpTitle}</h2>
                <ol className="mb-5 list-decimal space-y-2 pl-5 text-base">
                  <li>{t.help1}</li>
                  <li>{t.help2}</li>
                  <li>{t.help3}</li>
                  <li>{t.help4}</li>
                </ol>
                <button onClick={() => setHelp(false)} className="zt-btn-primary w-full">
                  {t.close}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
