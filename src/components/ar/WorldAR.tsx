/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DebugPanel, deviceLabel, type DebugRow } from "./DebugPanel";

type Dbg = {
  supported: "checking" | "yes" | "no";
  session: boolean;
  tracking: boolean;
  hit: boolean;
  placed: boolean;
  anchors: string;
  planes: string;
  depth: string;
  fps: number;
  distance: string;
  error?: string | undefined;
};

export function WorldAR({
  buildSubject,
  onExit,
  showDebug = true,
}: { buildSubject?: (() => THREE.Object3D) | undefined; onExit?: () => void; showDebug?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<any>(null);
  const [dbg, setDbg] = useState<Dbg>({
    supported: "checking",
    session: false,
    tracking: false,
    hit: false,
    placed: false,
    anchors: "-",
    planes: "-",
    depth: "-",
    fps: 0,
    distance: "-",
  });

  useEffect(() => {
    const xr = (navigator as any).xr;
    if (!xr) return setDbg((d) => ({ ...d, supported: "no" }));
    xr.isSessionSupported("immersive-ar")
      .then((ok: boolean) => setDbg((d) => ({ ...d, supported: ok ? "yes" : "no" })))
      .catch(() => setDbg((d) => ({ ...d, supported: "no" })));
    return () => {
      sessionRef.current?.end().catch(() => {});
    };
  }, []);

  async function start() {
    const state: Dbg = { ...dbg, error: undefined };
    const push = () => setDbg({ ...state });
    try {
      const xr = (navigator as any).xr;
      const session = await xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "anchors", "plane-detection", "depth-sensing", "local-floor"],
        domOverlay: { root: overlayRef.current },
        depthSensing: {
          usagePreference: ["cpu-optimized", "gpu-optimized"],
          dataFormatPreference: ["luminance-alpha", "float32"],
        },
      });
      sessionRef.current = session;
      state.session = true;
      state.depth = session.depthUsage ? `ON (${session.depthUsage})` : "not granted";
      push();

      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current!, alpha: true, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);

      const viewerSpace = await session.requestReferenceSpace("viewer");
      const hitSource = await session.requestHitTestSource({ space: viewerSpace });

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
      const sun = new THREE.DirectionalLight(0xffffff, 1.5);
      sun.position.set(1, 3, 1);
      scene.add(sun);

      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.16, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x9be15d }),
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      // Neutral test subject: 1.7 m tall pillar figure + floor disc, authored in metres.
      const subject = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x5fb3d9, roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.1, 8, 24), mat);
      body.position.y = 0.73;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 16), mat);
      head.position.y = 1.57;
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
      );
      disc.position.y = 0.002;
      if (buildSubject) subject.add(buildSubject());
      else subject.add(body, head, disc, new THREE.AxesHelper(0.5));
      subject.matrixAutoUpdate = false;
      subject.visible = false;
      scene.add(subject);

      let lastHit: any = null;
      let anchor: any = null;
      const subjectPos = new THREE.Vector3();

      session.addEventListener("select", () => {
        if (!lastHit) return;
        const refSpace = renderer.xr.getReferenceSpace();
        const pose = lastHit.getPose(refSpace);
        if (pose) subject.matrix.fromArray(pose.transform.matrix);
        subject.visible = true;
        state.placed = true;
        if (typeof lastHit.createAnchor === "function") {
          lastHit
            .createAnchor()
            .then((a: any) => {
              anchor?.delete?.();
              anchor = a;
              state.anchors = "ON (XRAnchor)";
            })
            .catch(() => (state.anchors = "failed → static world pose"));
        } else {
          state.anchors = "unsupported → static world pose";
        }
      });

      session.addEventListener("end", () => {
        renderer.setAnimationLoop(null);
        hitSource.cancel?.();
        renderer.dispose();
        sessionRef.current = null;
        state.session = false;
        state.tracking = false;
        push();
      });

      let frames = 0;
      let fpsT = performance.now();
      let lastPush = 0;

      renderer.setAnimationLoop((_t: number, frame: any) => {
        if (!frame) return;
        const refSpace = renderer.xr.getReferenceSpace();
        const viewer = frame.getViewerPose(refSpace);
        state.tracking = !!viewer && !viewer.emulatedPosition;

        const hits = frame.getHitTestResults(hitSource);
        if (hits.length) {
          lastHit = hits[0];
          const p = lastHit.getPose(refSpace);
          reticle.visible = !!p;
          if (p) reticle.matrix.fromArray(p.transform.matrix);
          state.hit = true;
        } else {
          reticle.visible = false;
          lastHit = null;
          state.hit = false;
        }

        if (anchor && frame.trackedAnchors?.has(anchor)) {
          const ap = frame.getPose(anchor.anchorSpace, refSpace);
          if (ap) subject.matrix.fromArray(ap.transform.matrix);
        }
        if (frame.detectedPlanes) state.planes = `ON (${frame.detectedPlanes.size})`;
        else state.planes = "not granted";

        if (subject.visible && viewer) {
          subjectPos.setFromMatrixPosition(subject.matrix);
          const v = viewer.transform.position;
          state.distance = `${subjectPos.distanceTo(new THREE.Vector3(v.x, v.y, v.z)).toFixed(2)} m`;
        }

        renderer.render(scene, camera);
        frames++;
        const now = performance.now();
        if (now - fpsT >= 1000) {
          state.fps = Math.round((frames * 1000) / (now - fpsT));
          frames = 0;
          fpsT = now;
        }
        if (now - lastPush > 250) {
          lastPush = now;
          push();
        }
      });
    } catch (e) {
      state.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      push();
    }
  }

  const on = (b: boolean) => (b ? "on" : "off") as "on" | "off";
  const rows: DebugRow[] = [
    { label: "AR ENGINE", value: dbg.session ? "ON · WebXR" : "OFF", state: on(dbg.session) },
    { label: "WEBXR AR", value: dbg.supported.toUpperCase(), state: dbg.supported === "yes" ? "on" : dbg.supported === "no" ? "off" : "warn" },
    { label: "CAMERA", value: dbg.session ? "ON" : "OFF", state: on(dbg.session) },
    { label: "FACING", value: "BACK (environment)", state: "info" },
    { label: "WORLD TRACKING", value: dbg.tracking ? "ON · 6DoF" : "OFF", state: on(dbg.tracking) },
    { label: "HIT TEST", value: dbg.hit ? "surface found" : "searching", state: dbg.hit ? "on" : "warn" },
    { label: "ANCHORS", value: dbg.anchors },
    { label: "PLANES", value: dbg.planes },
    { label: "DEPTH", value: dbg.depth },
    { label: "SEGMENTATION", value: "n/a in WebXR", state: "warn" },
    { label: "SUBJECT", value: dbg.placed ? "placed" : "tap to place" },
    { label: "DISTANCE", value: dbg.distance },
    { label: "FPS", value: String(dbg.fps) },
    { label: "DEVICE", value: deviceLabel() },
  ];

  return (
    <div className="relative min-h-dvh w-full bg-background grid-bg">
      <canvas ref={canvasRef} className="fixed inset-0 h-full w-full" />
      <div ref={overlayRef} className="pointer-events-none relative z-10 flex min-h-dvh flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          {showDebug ? <DebugPanel rows={rows} title="WORLD AR DEBUG" /> : <span />}
          <div className="pointer-events-auto flex flex-col gap-2">
            {dbg.session ? (
              <button
                onClick={() => sessionRef.current?.end()}
                className="rounded-md border border-border bg-overlay px-3 py-1.5 font-mono text-xs text-foreground"
              >
                exit AR
              </button>
            ) : (
              onExit ? (
                <button onClick={onExit} className="rounded-full border border-border bg-overlay px-5 py-3 text-sm font-semibold text-foreground">
                  ← Back
                </button>
              ) : (
                <a href="/" className="rounded-md border border-border bg-overlay px-3 py-1.5 font-mono text-xs text-foreground">
                  ← back
                </a>
              )
            )}
          </div>
        </div>

        {!dbg.session && (
          <div className="pointer-events-auto mx-auto w-full max-w-md rounded-md border border-border bg-card p-5 font-mono text-xs leading-5">
            {dbg.supported === "yes" && (
              <>
                <p className="mb-3 text-muted-foreground">
                  Point the back camera at the floor, move slowly until the green ring appears, then tap to place the
                  test subject. Walk toward / around it — it stays fixed in the room.
                </p>
                <button onClick={start} className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground">
                  START WORLD AR
                </button>
              </>
            )}
            {dbg.supported === "no" && (
              <p className="text-warning">
                This browser does not support WebXR immersive-ar, so real world tracking cannot run here. Supported:
                Android Chrome on ARCore devices. Not supported: iPhone/iPad Safari, desktop browsers. No fallback is
                faked.
              </p>
            )}
            {dbg.supported === "checking" && <p className="text-muted-foreground">checking WebXR support…</p>}
            {dbg.error && <p className="mt-3 text-destructive">{dbg.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
