import * as THREE from "three";
import type { BodyState, SceneConfig, SceneContext, TrackingFrame, ViewBounds } from "../scenes/types";
import type { InteractionId } from "@/lib/config";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SEG_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FOV = 63;

export type EngineStatus = {
  stage: string;
  engine: boolean;
  camera: boolean;
  facing: "user" | "environment";
  face: boolean;
  body: boolean;
  segmentation: boolean;
  bodyState: BodyState;
  distance: string;
  fps: number;
  res: string;
  delegate: string;
  error?: string;
};

export type EngineHandle = {
  stop(): void;
  capture(): Promise<Blob>;
  setSegmentation(on: boolean): void;
  /** Re-runs automatic side choice / snaps the companion back into frame. */
  resetPlacement(): void;
  setInteraction(id: InteractionId): void;
  /** Rear-camera torch where the browser exposes it. */
  torchSupported: boolean;
  setTorch(on: boolean): Promise<boolean>;
  standIn: boolean;
};

/**
 * Shared front/rear camera AR engine:
 * CAMERA → FACE TRACKING → BODY POSE → SEGMENTATION → three.js RENDERER → SCENE.
 * Scenes plug in via SceneConfig.build(); nothing here is scene-specific.
 */
export async function startFrontEngine(opts: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  scene: SceneConfig;
  facing: "user" | "environment";
  ctx: SceneContext;
  onStatus(s: EngineStatus): void;
}): Promise<EngineHandle> {
  const { video, canvas, scene, facing } = opts;
  let stopped = false;
  let raf = 0;
  let segOn = true;
  const st: EngineStatus = {
    stage: "requesting camera",
    engine: false,
    camera: false,
    facing,
    face: false,
    body: false,
    segmentation: false,
    bodyState: "unknown",
    distance: "-",
    fps: 0,
    res: "-",
    delegate: "-",
  };
  const push = () => !stopped && opts.onStatus({ ...st });
  push();

  const portrait = window.innerHeight > window.innerWidth;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: facing,
      width: { ideal: portrait ? 720 : 1280 },
      height: { ideal: portrait ? 1280 : 720 },
    },
    audio: false,
  });
  const cleanupStream = () => {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  try {
    return await run(stream, cleanupStream);
  } catch (e) {
    cleanupStream();
    if (e instanceof Error && e.name === "Error") e.name = "EngineError";
    throw e;
  }

  async function run(stream: MediaStream, cleanupStream: () => void): Promise<EngineHandle> {
  video.srcObject = stream;
  await video.play();
  const track = stream.getVideoTracks()[0];
  const trackCaps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  st.camera = true;
  st.res = `${vw}×${vh}`;
  st.stage = "loading tracking";
  push();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(vw, vh, false);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const vtex = new THREE.VideoTexture(video);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.PlaneGeometry(2, 2);
  const tint = scene.effects.backgroundTint;

  let maskTex = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
  const bgMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uVideo: { value: vtex },
      uTint: { value: new THREE.Vector3(...(tint ?? [0, 0, 0])) },
      uAmt: { value: tint ? 0.42 : 0 },
      uMask: { value: maskTex },
      uBg: { value: null as THREE.Texture | null },
      uBgOn: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D uVideo; uniform sampler2D uMask; uniform sampler2D uBg; uniform float uBgOn;
      uniform vec3 uTint; uniform float uAmt; varying vec2 vUv;
      void main(){ vec3 c = texture2D(uVideo, vUv).rgb; float g = smoothstep(0.0, 1.0, vUv.y);
      vec3 t = mix(uTint, vec3(0.07,0.54,0.24), 1.0 - g); c = mix(c, c*0.5 + t*0.6, uAmt);
      if (uBgOn > 0.5) { float m = smoothstep(0.35, 0.75, texture2D(uMask, vec2(vUv.x, 1.0 - vUv.y)).r);
        c = mix(texture2D(uBg, vUv).rgb, c, m); }
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const bgScene = new THREE.Scene();
  bgScene.add(new THREE.Mesh(quad, bgMat));

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

  const cam = new THREE.PerspectiveCamera(FOV, vw / vh, 1, 10000);
  const backScene = new THREE.Scene();
  const frontScene = new THREE.Scene();
  const back = new THREE.Group();
  const front = new THREE.Group();
  backScene.add(back);
  frontScene.add(front);
  const runtime = scene.build({ back, front }, opts.ctx) as ReturnType<SceneConfig["build"]> & { backgroundUrl?: string | undefined };
  if (runtime.backgroundUrl) {
    new THREE.TextureLoader().setCrossOrigin("anonymous").load(runtime.backgroundUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      bgMat.uniforms["uBg"]!.value = t;
      bgMat.uniforms["uBgOn"]!.value = 1;
    });
  }

  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
  const make = async <T,>(fn: (d: "GPU" | "CPU") => Promise<T>) => {
    try {
      st.delegate = "GPU";
      return await fn("GPU");
    } catch {
      st.delegate = "CPU";
      return await fn("CPU");
    }
  };
  st.stage = "loading models";
  push();
  const faceL = await make((delegate) =>
    vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
    }),
  );
  const poseL = await make((delegate) =>
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
    }),
  );
  const segL = await make((delegate) =>
    vision.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: SEG_MODEL, delegate },
      runningMode: "VIDEO",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }),
  );
  if (stopped) {
    faceL.close();
    poseL.close();
    segL.close();
  }
  st.engine = true;
  st.stage = "running";
  push();

  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const aspect = vw / vh;
  /** Normalized image point → camera-space point at depth z (cm, z negative). */
  const unproject = (u: number, v: number, z: number) =>
    new THREE.Vector3((u - 0.5) * 2 * tanHalf * aspect * -z, -(v - 0.5) * 2 * tanHalf * -z, z);

  const project = (p: THREE.Vector3) => {
    const d = Math.max(1, -p.z);
    return { u: p.x / (2 * tanHalf * aspect * d) + 0.5, v: 0.5 - p.y / (2 * tanHalf * d) };
  };
  /** Visible region of the video after object-cover cropping into the on-screen canvas. */
  const view: ViewBounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
  const updateView = () => {
    const cw = canvas.clientWidth || vw;
    const ch = canvas.clientHeight || vh;
    const A = cw / ch;
    if (A < aspect) {
      const f = A / aspect;
      Object.assign(view, { uMin: 0.5 - f / 2, uMax: 0.5 + f / 2, vMin: 0, vMax: 1 });
    } else {
      const f = aspect / A;
      Object.assign(view, { uMin: 0, uMax: 1, vMin: 0.5 - f / 2, vMax: 0.5 + f / 2 });
    }
  };

  const faceMat = new THREE.Matrix4();
  let lastZ = -60;
  let maskBuf: Uint8Array | null = null;
  let lastVideoTime = -1;
  let frames = 0;
  let fpsT = performance.now();
  let lastPush = 0;
  let lastT = performance.now();
  const frame: TrackingFrame = {
    faceMatrix: null,
    head: null,
    shoulders: null,
    bodyState: "unknown",
    distanceCm: null,
    dt: 0,
    view,
    mirrored: false,
    unproject,
    project,
  };

  const loop = () => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    frame.dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    updateView();

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const fr = faceL.detectForVideo(video, now);
      const m = fr.facialTransformationMatrixes?.[0];
      if (m) {
        faceMat.fromArray(m.data);
        frame.faceMatrix = faceMat;
        frame.head = new THREE.Vector3().setFromMatrixPosition(faceMat);
        lastZ = frame.head.z;
        frame.distanceCm = Math.abs(lastZ);
        st.face = true;
        st.distance = `${(Math.abs(lastZ) / 100).toFixed(2)} m`;
      } else {
        frame.faceMatrix = null;
        frame.head = null;
        st.face = false;
      }

      const pr = poseL.detectForVideo(video, now);
      const lm = pr.landmarks?.[0];
      if (lm) {
        const vis = (i: number) => (lm[i]?.visibility ?? 0) > 0.5 && lm[i]!.y < 1.02;
        st.body = true;
        if (vis(11) && vis(12)) {
          const z = lastZ - 4;
          frame.shoulders = {
            left: unproject(lm[11]!.x, lm[11]!.y, z),
            right: unproject(lm[12]!.x, lm[12]!.y, z),
          };
        } else frame.shoulders = null;
        const hips = vis(23) && vis(24);
        const knees = vis(25) && vis(26);
        if (hips && knees) {
          const hipY = (lm[23]!.y + lm[24]!.y) / 2;
          const kneeY = (lm[25]!.y + lm[26]!.y) / 2;
          const shY = (lm[11]!.y + lm[12]!.y) / 2;
          frame.bodyState = (kneeY - hipY) / Math.max(0.01, hipY - shY) < 0.45 ? "sitting" : "standing";
        } else frame.bodyState = "partial";
        // Head lost but body visible: estimate head from nose for continuity.
        if (!frame.head && vis(0)) frame.head = unproject(lm[0]!.x, lm[0]!.y, lastZ);
      } else {
        frame.shoulders = null;
        frame.bodyState = "unknown";
        st.body = false;
      }
      st.bodyState = frame.bodyState;

      if (segOn) {
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
            bgMat.uniforms["uMask"]!.value = maskTex;
          }
          for (let i = 0; i < f.length; i++) maskBuf[i] = f[i]! * 255;
          maskTex.needsUpdate = true;
        });
        personMat.uniforms["uOn"]!.value = scene.occlusion === "segmentation" || tint ? 1 : 0;
        st.segmentation = true;
      } else {
        personMat.uniforms["uOn"]!.value = 0;
        st.segmentation = false;
      }
      bgMat.uniforms["uAmt"]!.value = tint && segOn ? 0.42 : 0;
    }

    runtime.update(frame);

    renderer.clear();
    renderer.render(bgScene, ortho);
    renderer.render(backScene, cam);
    renderer.clearDepth();
    renderer.render(personScene, ortho);
    renderer.render(frontScene, cam);

    frames++;
    if (now - fpsT >= 1000) {
      st.fps = Math.round((frames * 1000) / (now - fpsT));
      frames = 0;
      fpsT = now;
    }
    if (now - lastPush > 250) {
      lastPush = now;
      push();
    }
  };
  loop();

  return {
    setSegmentation(on) {
      segOn = on;
    },
    resetPlacement() {
      runtime.reset?.();
    },
    setInteraction(id) {
      runtime.setInteraction?.(id);
    },
    get standIn() {
      return !!runtime.standIn;
    },
    torchSupported: facing === "environment" && !!trackCaps.torch,
    async setTorch(on) {
      try {
        await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
        return true;
      } catch {
        return false;
      }
    },
    capture() {
      // Capture the same unmirrored, cropped canvas shown in the preview.
      if (runtime.standIn) return Promise.reject(new Error("Setup incomplete"));
      updateView();
      const sx = view.uMin * canvas.width;
      const sy = view.vMin * canvas.height;
      const sw = (view.uMax - view.uMin) * canvas.width;
      const sh = (view.vMax - view.vMin) * canvas.height;
      const out = document.createElement("canvas");
      out.width = Math.round(sw);
      out.height = Math.round(sh);
      const g = out.getContext("2d");
      if (!g) return Promise.reject(new Error("Capture unavailable"));
      g.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
      return new Promise((resolve, reject) =>
        out.toBlob((b) => (b ? resolve(b) : reject(new Error("capture failed"))), "image/jpeg", 0.92),
      );
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      cleanupStream();
      faceL.close();
      poseL.close();
      segL.close();
      runtime.dispose?.();
      vtex.dispose();
      maskTex.dispose();
      (bgMat.uniforms["uBg"]!.value as THREE.Texture | null)?.dispose();
      bgMat.dispose();
      personMat.dispose();
      quad.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  }
}
