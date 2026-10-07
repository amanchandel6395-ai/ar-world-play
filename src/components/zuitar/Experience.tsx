import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SCENES, type SceneId } from "@/ar/scenes";
import { startFrontEngine, type EngineHandle, type EngineStatus } from "@/ar/engine/frontEngine";
import { detectCapabilities, type Caps } from "@/ar/capabilities";
import { DebugPanel, deviceLabel, type DebugRow } from "@/components/ar/DebugPanel";
import { WorldAR } from "@/components/ar/WorldAR";
import { KIOSK, useDevMode, useIdleReset } from "@/lib/kiosk";
import { ResultView } from "./ResultView";

type Phase = "intro" | "live" | "result" | "world";

export function Experience({ sceneId }: { sceneId: SceneId }) {
  const scene = SCENES[sceneId];
  const navigate = useNavigate();
  const goHome = useCallback(() => navigate({ to: "/" }), [navigate]);
  const [dev] = useDevMode();
  const [caps, setCaps] = useState<Caps | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [facing, setFacing] = useState<"user" | "environment">(scene.camera.default);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<EngineHandle | null>(null);

  useEffect(() => {
    detectCapabilities().then(setCaps);
  }, []);

  useIdleReset(KIOSK.idleTimeoutMs, goHome, phase !== "result");

  useEffect(() => {
    if (phase !== "live") return;
    let cancelled = false;
    setError(null);
    setStatus(null);
    startFrontEngine({
      video: videoRef.current!,
      canvas: canvasRef.current!,
      scene,
      facing,
      onStatus: (s) => !cancelled && setStatus(s),
    })
      .then((h) => {
        if (cancelled) h.stop();
        else engine.current = h;
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow the camera in your browser settings and try again."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No suitable camera was found on this device."
              : "The camera could not start on this device.",
        );
      });
    return () => {
      cancelled = true;
      engine.current?.stop();
      engine.current = null;
    };
  }, [phase, facing, scene]);

  const capture = () => {
    if (count > 0 || !engine.current) return;
    let n = scene.capture.countdown;
    setCount(n);
    const tick = () => {
      n -= 1;
      if (n > 0) {
        setCount(n);
        window.setTimeout(tick, 1000);
      } else {
        setCount(0);
        engine.current
          ?.capture()
          .then((b) => {
            setPhoto(b);
            setPhase("result");
          })
          .catch(() => setError("Capture failed, please try again."));
      }
    };
    window.setTimeout(tick, 1000);
  };

  const flip = () => setFacing((f) => (f === "user" ? "environment" : "user"));

  if (phase === "world") {
    return <WorldAR buildSubject={scene.buildWorld} onExit={() => setPhase("live")} showDebug={dev} />;
  }

  if (phase === "result" && photo) {
    return (
      <ResultView
        photo={photo}
        sceneId={sceneId}
        allowAi={scene.capture.aiEnhance}
        onRetake={() => {
          setPhoto(null);
          setPhase("live");
        }}
        onHome={goHome}
      />
    );
  }

  const ready = status?.engine && !error;
  const on = (b?: boolean) => (b ? "on" : "off") as "on" | "off";
  const rows: DebugRow[] = status
    ? [
        { label: "AR ENGINE", value: status.engine ? "ON · MediaPipe" : "loading", state: on(status.engine) },
        { label: "CAMERA", value: status.camera ? "ON" : "OFF", state: on(status.camera) },
        { label: "FACING", value: status.facing === "user" ? "FRONT" : "BACK", state: "info" },
        { label: "FACE TRACKING", value: status.face ? "ON · 6DoF" : "no face", state: on(status.face) },
        { label: "BODY TRACKING", value: status.body ? "ON · pose" : "no body", state: on(status.body) },
        { label: "SEGMENTATION", value: status.segmentation ? "ON" : "OFF", state: on(status.segmentation) },
        { label: "WORLD TRACKING", value: caps?.worldAR ? "available (room mode)" : "not supported", state: caps?.worldAR ? "info" : "warn" },
        { label: "FLOOR DETECT", value: caps?.worldAR ? "room mode only" : "not supported", state: caps?.worldAR ? "info" : "warn" },
        { label: "BODY STATE", value: status.bodyState },
        { label: "DISTANCE", value: status.distance },
        { label: "FPS", value: String(status.fps) },
        { label: "VIDEO", value: status.res },
        { label: "DELEGATE", value: status.delegate },
        { label: "SCENE", value: `${scene.id} · ${scene.asset.type}` },
        { label: "DEVICE", value: deviceLabel() },
        { label: "STAGE", value: status.stage, state: "info" },
      ]
    : [];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <video ref={videoRef} className="hidden" playsInline muted />
      {phase === "live" && (
        <canvas
          ref={canvasRef}
          className={`h-full w-full object-cover ${facing === "user" ? "mirror-x" : ""}`}
        />
      )}

      {phase === "intro" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-stage px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">ZUITAR</p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">{scene.title}</h1>
          <p className="text-lg text-muted-foreground">{scene.subtitle}</p>
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
            <p className="max-w-md text-warning">This device has no camera access in the browser.</p>
          ) : (
            <button onClick={() => setPhase("live")} className="zt-btn-primary min-w-64 text-xl">
              Start camera
            </button>
          )}
          <button onClick={goHome} className="zt-btn-ghost">
            ← Back
          </button>
        </div>
      )}

      {phase === "live" && (
        <>
          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stage">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-lg text-muted-foreground">Getting the camera ready…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-stage px-6 text-center">
              <p className="max-w-md text-xl">{error}</p>
              <button onClick={goHome} className="zt-btn-primary">
                Home
              </button>
            </div>
          )}
          {ready && !scene.asset.authorized && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-overlay px-4 py-1.5 text-xs text-muted-foreground">
              Preview with stand-in — authorized asset not yet connected
            </div>
          )}
          {count > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span key={count} className="zt-count text-[10rem] font-bold text-foreground drop-shadow-2xl md:text-[14rem]">
                {count}
              </span>
            </div>
          )}
          {dev && status && (
            <div className="absolute left-3 top-14">
              <DebugPanel rows={rows} title="ZUITAR DEV MODE" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 items-center bg-gradient-to-t from-background/80 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10">
            <div className="flex justify-start">
              <button onClick={goHome} aria-label="Back" className="zt-btn-round">
                ←
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={capture}
                disabled={!ready || count > 0}
                aria-label="Capture"
                className="h-24 w-24 rounded-full border-[6px] border-foreground bg-primary shadow-2xl transition-transform active:scale-90 disabled:opacity-40 md:h-28 md:w-28"
              />
            </div>
            <div className="flex justify-end gap-3">
              {scene.camera.worldAR && caps?.worldAR && facing === "environment" && (
                <button onClick={() => setPhase("world")} className="zt-btn-round text-sm">
                  Room
                </button>
              )}
              <button onClick={flip} aria-label="Flip camera" className="zt-btn-round">
                ⟲
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
