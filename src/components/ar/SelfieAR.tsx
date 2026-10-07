import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { DebugPanel, deviceLabel, type DebugRow } from "./DebugPanel";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SEG_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

type Dbg = {
  engine: boolean;
  camera: boolean;
  tracking: boolean;
  segmentation: boolean;
  fps: number;
  res: string;
  pos: string;
  delegate: string;
  error?: string | undefined;
  stage: string;
};

export function SelfieAR() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segOn = useRef(true);
  const [segEnabled, setSegEnabled] = useState(true);
  const [dbg, setDbg] = useState<Dbg>({
    engine: false,
    camera: false,
    tracking: false,
    segmentation: false,
    fps: 0,
    res: "-",
    pos: "-",
    delegate: "-",
    stage: "starting",
  });

  useEffect(() => {
    segOn.current = segEnabled;
  }, [segEnabled]);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let face: { close(): void } | null = null;
    let seg: { close(): void } | null = null;
    const state: Dbg = { ...dbg };
    const push = () => !stopped && setDbg({ ...state });

    (async () => {
      try {
        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        state.stage = "requesting camera";
        push();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        video.srcObject = stream;
        await video.play();
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        state.camera = true;
        state.res = `${vw}×${vh}`;
        state.stage = "loading tracking models";
        push();

        // ---- WebGL renderer (three.js) ----
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(1);
        renderer.setSize(vw, vh, false);
        renderer.autoClear = false;
        renderer.localClippingEnabled = true;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

        const vtex = new THREE.VideoTexture(video);
        const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const quad = new THREE.PlaneGeometry(2, 2);

        const bgScene = new THREE.Scene();
        bgScene.add(
          new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: vtex, depthTest: false, depthWrite: false })),
        );

        // Person layer: camera pixels with alpha = segmentation confidence (real occlusion).
        let maskTex = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
        const personMat = new THREE.ShaderMaterial({
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms: { uVideo: { value: vtex }, uMask: { value: maskTex }, uOn: { value: 0 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: `uniform sampler2D uVideo; uniform sampler2D uMask; uniform float uOn; varying vec2 vUv;
            void main(){ vec4 c = texture2D(uVideo, vUv); float m = texture2D(uMask, vec2(vUv.x, 1.0 - vUv.y)).r;
            m = smoothstep(0.35, 0.75, m); gl_FragColor = vec4(c.rgb, m * uOn); }`,
        });
        const personScene = new THREE.Scene();
        personScene.add(new THREE.Mesh(quad, personMat));

        // 3D camera matching MediaPipe's canonical face-geometry camera (vertical FOV 63°).
        const cam = new THREE.PerspectiveCamera(63, vw / vh, 1, 10000);
        const backScene = new THREE.Scene();
        const frontScene = new THREE.Scene();
        const anchorBack = new THREE.Group();
        const anchorFront = new THREE.Group();
        anchorBack.matrixAutoUpdate = false;
        anchorFront.matrixAutoUpdate = false;
        backScene.add(anchorBack);
        frontScene.add(anchorFront);

        // Neutral test asset: orbit ring around the head + marker cube + axes.
        const frontPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const backPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
        const ringGeo = new THREE.TorusGeometry(13, 0.9, 16, 120);
        ringGeo.rotateX(Math.PI / 2);
        ringGeo.translate(0, 2, 0);
        anchorBack.add(new THREE.Mesh(ringGeo, new THREE.MeshNormalMaterial({ clippingPlanes: [backPlane] })));
        anchorFront.add(new THREE.Mesh(ringGeo, new THREE.MeshNormalMaterial({ clippingPlanes: [frontPlane] })));
        const cube = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshNormalMaterial());
        cube.position.set(0, 16, 0);
        anchorFront.add(cube);
        anchorFront.add(new THREE.AxesHelper(8));
        anchorBack.visible = anchorFront.visible = false;

        // ---- MediaPipe tracking + segmentation ----
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
        const make = async <T,>(fn: (d: "GPU" | "CPU") => Promise<T>) => {
          try {
            state.delegate = "GPU";
            return await fn("GPU");
          } catch {
            state.delegate = "CPU";
            return await fn("CPU");
          }
        };
        const faceL = await make((delegate) =>
          vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFacialTransformationMatrixes: true,
          }),
        );
        face = faceL;
        const segL = await make((delegate) =>
          vision.ImageSegmenter.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: SEG_MODEL, delegate },
            runningMode: "VIDEO",
            outputConfidenceMasks: true,
            outputCategoryMask: false,
          }),
        );
        seg = segL;
        if (stopped) return;
        state.engine = true;
        state.stage = "running";
        push();

        const mat = new THREE.Matrix4();
        let maskBuf: Uint8Array | null = null;
        let lastVideoTime = -1;
        let frames = 0;
        let fpsT = performance.now();
        let lastPush = 0;

        const loop = () => {
          if (stopped) return;
          raf = requestAnimationFrame(loop);
          const now = performance.now();

          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const fr = faceL.detectForVideo(video, now);
            const m = fr.facialTransformationMatrixes?.[0];
            if (m) {
              mat.fromArray(m.data);
              anchorBack.matrix.copy(mat);
              anchorFront.matrix.copy(mat);
              anchorBack.matrixWorldNeedsUpdate = anchorFront.matrixWorldNeedsUpdate = true;
              anchorBack.visible = anchorFront.visible = true;
              const z = mat.elements[14];
              frontPlane.constant = -z;
              backPlane.constant = z;
              state.tracking = true;
              state.pos = `x ${mat.elements[12].toFixed(1)} y ${mat.elements[13].toFixed(1)} z ${z.toFixed(1)} cm`;
            } else {
              anchorBack.visible = anchorFront.visible = false;
              state.tracking = false;
              state.pos = "no face";
            }

            if (segOn.current) {
              segL.segmentForVideo(video, now, (res) => {
                const mk = res.confidenceMasks?.[0];
                if (!mk) return;
                const f = mk.getAsFloat32Array();
                const w = mk.width;
                const h = mk.height;
                if (!maskBuf || maskBuf.length !== w * h) {
                  maskBuf = new Uint8Array(w * h);
                  maskTex.dispose();
                  maskTex = new THREE.DataTexture(maskBuf, w, h, THREE.RedFormat, THREE.UnsignedByteType);
                  maskTex.minFilter = maskTex.magFilter = THREE.LinearFilter;
                  maskTex.unpackAlignment = 1;
                  personMat.uniforms["uMask"]!.value = maskTex;
                }
                for (let i = 0; i < f.length; i++) maskBuf[i] = f[i]! * 255;
                maskTex.needsUpdate = true;
              });
              personMat.uniforms["uOn"]!.value = 1;
              state.segmentation = true;
            } else {
              personMat.uniforms["uOn"]!.value = 0;
              state.segmentation = false;
            }
          }

          cube.rotation.y += 0.02;
          renderer!.clear();
          renderer!.render(bgScene, ortho);
          renderer!.render(backScene, cam);
          renderer!.clearDepth();
          renderer!.render(personScene, ortho);
          renderer!.render(frontScene, cam);

          frames++;
          if (now - fpsT >= 1000) {
            state.fps = Math.round((frames * 1000) / (now - fpsT));
            frames = 0;
            fpsT = now;
          }
          if (now - lastPush > 200) {
            lastPush = now;
            push();
          }
        };
        loop();
      } catch (e) {
        state.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        state.stage = "error";
        push();
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      face?.close();
      seg?.close();
      renderer?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: DebugRow[] = [
    { label: "AR ENGINE", value: dbg.engine ? "ON · MediaPipe" : "OFF", state: dbg.engine ? "on" : "off" },
    { label: "RENDERER", value: "three.js WebGL", state: "info" },
    { label: "CAMERA", value: dbg.camera ? "ON" : "OFF", state: dbg.camera ? "on" : "off" },
    { label: "FACING", value: "FRONT (user)", state: "info" },
    { label: "TRACKING", value: dbg.tracking ? "ON · face 6DoF" : "OFF", state: dbg.tracking ? "on" : "off" },
    { label: "SEGMENTATION", value: dbg.segmentation ? "ON" : "OFF", state: dbg.segmentation ? "on" : "off" },
    { label: "BODY POSE", value: "not in PoC", state: "warn" },
    { label: "FPS", value: String(dbg.fps) },
    { label: "VIDEO", value: dbg.res },
    { label: "DELEGATE", value: dbg.delegate },
    { label: "HEAD POS", value: dbg.pos },
    { label: "DEVICE", value: deviceLabel() },
    { label: "STAGE", value: dbg.stage, state: dbg.error ? "off" : "info" },
  ];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="mirror-x h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          <DebugPanel rows={rows} />
          <div className="pointer-events-auto flex flex-col gap-2">
            <a href="/" className="rounded-md border border-border bg-overlay px-3 py-1.5 font-mono text-xs text-foreground">
              ← back
            </a>
            <button
              onClick={() => setSegEnabled((v) => !v)}
              className="rounded-md border border-border bg-overlay px-3 py-1.5 font-mono text-xs text-foreground"
            >
              seg: {segEnabled ? "on" : "off"}
            </button>
          </div>
        </div>
        {dbg.error && (
          <div className="pointer-events-auto rounded-md border border-destructive bg-overlay p-3 font-mono text-xs text-destructive">
            {dbg.error}
          </div>
        )}
      </div>
    </div>
  );
}
