import * as THREE from "three";
import type { SceneContext, SceneLayers, SceneRuntime, TrackingFrame } from "./types";
import type { BjpItem, InteractionId, PublicConfig } from "@/lib/config";

type PubChar = PublicConfig["characters"]["yogi"];
const FIG_H = 175; // cm, natural adult height
const HEAD_FROM_TOP = 12; // cm, head centre below top of figure

function addLights(group: THREE.Group) {
  group.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 1.4);
  d.position.set(30, 80, 60);
  group.add(d);
}

const texLoader = new THREE.TextureLoader();
texLoader.setCrossOrigin("anonymous");
function loadTex(url: string) {
  return new Promise<THREE.Texture>((res, rej) =>
    texLoader.load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        res(t);
      },
      undefined,
      rej,
    ),
  );
}

function setOpacity(obj: THREE.Object3D, a: number) {
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) {
      mm.transparent = true;
      mm.opacity = a;
    }
  });
}

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    for (const mm of m ? (Array.isArray(m) ? m : [m]) : []) {
      (mm as THREE.MeshBasicMaterial).map?.dispose();
      mm.dispose();
    }
  });
}

/** Dynamic high-resolution Devanagari slogan banner on Three.js canvas texture */
export function createSloganBanner(initialText = "अबकी बार भाजपा सरकार") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 240;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  let currentText = initialText;
  const redraw = (text = currentText) => {
    currentText = text;
    ctx.clearRect(0, 0, 1024, 240);

    const x = 32,
      y = 20,
      w = 960,
      h = 196,
      r = 44;

    // Glowing drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;

    // Rich saffron-to-deep-amber gradient banner
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, "rgba(230, 81, 0, 0.95)");
    grad.addColorStop(0.35, "rgba(255, 122, 0, 0.98)");
    grad.addColorStop(0.65, "rgba(245, 124, 0, 0.98)");
    grad.addColorStop(1, "rgba(216, 67, 21, 0.95)");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.restore();

    // Golden metallic border
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#FFE082";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();

    // Inner subtle border
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.roundRect(x + 7, y + 7, w - 14, h - 14, r - 6);
    ctx.stroke();

    // Left badge: BJP Lotus Emoji
    ctx.font = "60px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🪷", x + 65, y + h / 2);

    // Right badge: Tricolor
    ctx.fillText("🇮🇳", x + w - 65, y + h / 2);

    // Bold Hindi Devanagari Slogan
    ctx.save();
    ctx.font = "bold 58px 'Noto Sans Devanagari', 'Mukta', 'Poppins', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.restore();

    tex.needsUpdate = true;
  };

  redraw(initialText);

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 999;

  return { mesh, tex, redraw };
}

/** Saffron Tilak mesh for forehead face tracking */
export function createTilakMesh() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#FF6F00");
  grad.addColorStop(0.5, "#FFD54F");
  grad.addColorStop(1, "#E65100");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(32, 64, 12, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  // Inner sacred red dot
  ctx.fillStyle = "#B71C1C";
  ctx.beginPath();
  ctx.arc(32, 72, 7, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), mat);
  return { mesh, tex };
}

/**
 * Approved 3D photo-booth standee or animated 3D video cutout with realistic
 * ground contact shadow, acrylic edge depth, and subtle lifelike breathing sway.
 */
function authorizedContent(ch: PubChar, onReady: (o: THREE.Object3D) => void, onFail: () => void) {
  const holder = new THREE.Group();
  let plane: THREE.Mesh | null = null;
  let shadowMesh: THREE.Mesh | null = null;
  let rimMesh: THREE.Mesh | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let videoTex: THREE.VideoTexture | null = null;
  let time = 0;
  let disposed = false;
  let request = 0;
  const fallbackUrl =
    ch.name?.en?.toLowerCase().includes("yogi") || ch.thumbnail?.includes("yogi")
      ? "/assets/yogi.png"
      : "/assets/modi.png";

  const setupDimensions = (w: number, h: number) => {
    const aspect = (w || 1) / Math.max(1, h || 1);
    // Torso crop (like modi.png, aspect > 0.62) vs full body (like yogi.png, aspect <= 0.62)
    const isTorso = aspect > 0.62;
    // For full body: 175cm. For torso: 68cm so head height is exactly 23cm (authentic 1:1 life size).
    const baseHeight = ch.heightCm ?? (isTorso ? 68 : FIG_H);
    const figHeight = baseHeight * (ch.scale || 1);
    const width = figHeight * aspect;
    const posY = isTorso
      ? (ch.offsetY || 0) - figHeight * 0.22
      : HEAD_FROM_TOP + (ch.offsetY || 0) - figHeight / 2;

    if (!plane) {
      // 1. Soft realistic ground drop-shadow for 3D floor grounding
      const sCanvas = document.createElement("canvas");
      sCanvas.width = 128;
      sCanvas.height = 64;
      const sctx = sCanvas.getContext("2d")!;
      const grad = sctx.createRadialGradient(64, 32, 2, 64, 32, 58);
      grad.addColorStop(0, "rgba(10, 8, 5, 0.55)");
      grad.addColorStop(0.4, "rgba(20, 15, 8, 0.25)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 64);
      const sTex = new THREE.CanvasTexture(sCanvas);
      shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.95, isTorso ? 16 : 26),
        new THREE.MeshBasicMaterial({ map: sTex, transparent: true, depthWrite: false }),
      );
      shadowMesh.rotation.x = -Math.PI / 2.3;
      shadowMesh.position.set(ch.offsetX || 0, posY - figHeight / 2 + 2, 4);
      holder.add(shadowMesh);

      // 2. Realistic 3D clear acrylic glass depth rim mesh behind figure
      const bevel = ch.depthBevel || 0.8;
      rimMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          alphaTest: 0.04,
        }),
      );
      rimMesh.scale.set(width, figHeight, 1);
      rimMesh.position.set(ch.offsetX || 0, posY, -bevel);
      holder.add(rimMesh);

      // 3. Main transparent 3D cutout / video standee
      plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }),
      );
      holder.add(plane);
    }

    plane.scale.set(width, figHeight, 1);
    plane.position.set(ch.offsetX || 0, posY, 0);
    if (rimMesh) {
      rimMesh.scale.set(width, figHeight, 1);
      rimMesh.position.set(ch.offsetX || 0, posY, -(ch.depthBevel || 0.8));
    }
    if (shadowMesh) {
      shadowMesh.scale.set(width * 0.95, isTorso ? 16 : 26, 1);
      shadowMesh.position.set(ch.offsetX || 0, posY - figHeight / 2 + 2, 4);
    }
  };

  const applyTexture = (tex: THREE.Texture) => {
    if (disposed) {
      tex.dispose();
      return;
    }
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const img = tex.image as { width: number; height: number };
    setupDimensions(img?.width || 1, img?.height || 1);

    const mat = plane!.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
    if (rimMesh) {
      const rMat = rimMesh.material as THREE.MeshBasicMaterial;
      rMat.map = tex;
      rMat.needsUpdate = true;
    }
    onReady(holder);
  };

  const setupVideoCutout = (
    videoSrc: string,
    chroma?: { enabled: boolean; color: string; similarity: number; smoothness: number },
  ) => {
    if (disposed) return;
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute("src");
      videoEl.load();
    }
    if (videoTex) {
      videoTex.dispose();
    }

    const v = document.createElement("video");
    v.src = videoSrc;
    v.crossOrigin = "anonymous";
    v.loop = ch.video?.loop ?? true;
    v.muted = ch.video?.muted ?? true;
    v.playsInline = true;
    v.autoplay = true;

    const vTex = new THREE.VideoTexture(v);
    vTex.minFilter = THREE.LinearFilter;
    vTex.magFilter = THREE.LinearFilter;
    vTex.format = THREE.RGBAFormat;

    videoEl = v;
    videoTex = vTex;

    v.onloadedmetadata = () => {
      if (disposed) return;
      setupDimensions(v.videoWidth || 640, v.videoHeight || 360);
      onReady(holder);
    };

    // If chroma key is requested, apply custom GLSL chroma-key shader material
    if (chroma?.enabled) {
      const chromaColor = new THREE.Color(chroma.color || "#00FF00");
      const chromaMat = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: vTex },
          keyColor: { value: chromaColor },
          similarity: { value: chroma.similarity ?? 0.4 },
          smoothness: { value: chroma.smoothness ?? 0.08 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform vec3 keyColor;
          uniform float similarity;
          uniform float smoothness;
          varying vec2 vUv;
          void main() {
            vec4 color = texture2D(map, vUv);
            float dist = distance(color.rgb, keyColor);
            float alpha = smoothstep(similarity, similarity + smoothness, dist);
            gl_FragColor = vec4(color.rgb, color.a * alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
      });

      if (!plane) {
        setupDimensions(640, 360);
      }
      plane!.material.dispose();
      plane!.material = chromaMat;
    } else {
      if (!plane) {
        setupDimensions(640, 360);
      }
      const bMat = new THREE.MeshBasicMaterial({
        map: vTex,
        transparent: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
      });
      plane!.material.dispose();
      plane!.material = bMat;
    }

    v.play().catch(() => {});
  };

  const showPose = (id: InteractionId) => {
    const current = ++request;
    const isVideo =
      (ch.video?.enabled && ch.video.url) || /\.(mp4|webm)$/i.test(ch.poses[id] || "");
    if (isVideo) {
      const videoUrl = ch.video?.enabled && ch.video.url ? ch.video.url : ch.poses[id]!;
      setupVideoCutout(videoUrl, ch.video?.chromaKey);
      return;
    }

    const url = ch.poses[id] ?? ch.poses.selfie ?? Object.values(ch.poses)[0] ?? fallbackUrl;
    loadTex(url).then(
      (tex) => {
        if (request !== current) {
          tex.dispose();
          return;
        }
        applyTexture(tex);
      },
      () => {
        if (url !== fallbackUrl) {
          loadTex(fallbackUrl).then((tex) => {
            if (request !== current) {
              tex.dispose();
              return;
            }
            applyTexture(tex);
          }, onFail);
        } else {
          onFail();
        }
      },
    );
  };

  showPose("selfie");

  return {
    holder,
    setInteraction: showPose,
    tick: (dt: number) => {
      time += dt;
      // Lifelike subtle breathing sway and dynamic presence
      if (holder) {
        holder.position.y += Math.sin(time * 2.0) * 0.02;
        holder.rotation.y = (ch.rotationY ?? 0) + Math.sin(time * 1.2) * 0.012;
      }
    },
    toggleAudio: () => {
      if (videoEl) {
        videoEl.muted = !videoEl.muted;
        return !videoEl.muted;
      }
      return false;
    },
    togglePlay: () => {
      if (videoEl) {
        if (videoEl.paused) videoEl.play().catch(() => {});
        else videoEl.pause();
        return !videoEl.paused;
      }
      return false;
    },
    dispose() {
      disposed = true;
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute("src");
        videoEl.load();
        videoEl = null;
      }
      if (videoTex) {
        videoTex.dispose();
        videoTex = null;
      }
      disposeTree(holder);
    },
  };
}
const hasAuthorizedAsset = (ch: PubChar) => !!ch;
const noop = () => undefined;

function buildStandInSilhouette(): THREE.Object3D {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe58e26,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 24), mat);
  head.position.set(0, HEAD_FROM_TOP - 5, 0);
  head.scale.set(0.9, 1.15, 0.9);
  group.add(head);
  // Torso / shoulders
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(15, 19, 65, 24), mat);
  torso.position.set(0, HEAD_FROM_TOP - 45, 0);
  group.add(torso);
  // Lower body
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(19, 25, 80, 24), mat);
  robe.position.set(0, HEAD_FROM_TOP - 110, 0);
  group.add(robe);
  return group;
}

/** Snapchat-style BJP Lotus flower stickers on both cheeks */
export function createCheekLotusStickers() {
  const group = new THREE.Group();
  const leftCheek = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, depthTest: false }),
  );
  const rightCheek = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, depthTest: false }),
  );

  loadTex("/assets/lotus_badge.png").then(
    (tex) => {
      (leftCheek.material as THREE.MeshBasicMaterial).map = tex;
      (leftCheek.material as THREE.MeshBasicMaterial).needsUpdate = true;
      (rightCheek.material as THREE.MeshBasicMaterial).map = tex;
      (rightCheek.material as THREE.MeshBasicMaterial).needsUpdate = true;
    },
    () => {
      loadTex("/assets/bjp.png").then((tex) => {
        (leftCheek.material as THREE.MeshBasicMaterial).map = tex;
        (leftCheek.material as THREE.MeshBasicMaterial).needsUpdate = true;
        (rightCheek.material as THREE.MeshBasicMaterial).map = tex;
        (rightCheek.material as THREE.MeshBasicMaterial).needsUpdate = true;
      });
    },
  );

  // Left cheek placement in face coordinate space (cm)
  leftCheek.scale.set(6.8, 6.8, 1);
  leftCheek.position.set(-4.8, -1.2, 3.8);
  leftCheek.rotation.z = THREE.MathUtils.degToRad(-8);

  // Right cheek placement in face coordinate space (cm)
  rightCheek.scale.set(6.8, 6.8, 1);
  rightCheek.position.set(4.8, -1.2, 3.8);
  rightCheek.rotation.z = THREE.MathUtils.degToRad(8);

  group.add(leftCheek);
  group.add(rightCheek);

  return {
    group,
    leftCheek,
    rightCheek,
    dispose() {
      leftCheek.geometry.dispose();
      (leftCheek.material as THREE.MeshBasicMaterial).dispose();
      rightCheek.geometry.dispose();
      (rightCheek.material as THREE.MeshBasicMaterial).dispose();
    },
  };
}

/** 3D fluttering party flag in top corner */
export function createWavingCornerFlag() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, depthTest: false }),
  );
  mesh.visible = false;
  loadTex("/assets/bjp.png").then((tex) => {
    (mesh.material as THREE.MeshBasicMaterial).map = tex;
    (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    mesh.visible = true;
  });

  return {
    mesh,
    update(t: TrackingFrame, elapsed: number, enabled: boolean) {
      if (!enabled) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const Z = -100;
      const { uMin, uMax, vMin, vMax } = t.view;
      const tl = t.unproject(uMin, vMin, Z);
      const br = t.unproject(uMax, vMax, Z);
      const vw = br.x - tl.x;
      const w = vw * 0.28;
      const h = w * (394 / 700);
      mesh.scale.set(w * (t.mirrored ? -1 : 1), h, 1);
      // Realistic waving flutter
      mesh.rotation.z = Math.sin(elapsed * 2.8) * 0.06;
      // Position top-right corner
      const cx = 0.82;
      const cy = 0.86;
      const uc = t.mirrored ? 1 - cx : cx;
      mesh.position.copy(t.unproject(uMin + (uMax - uMin) * uc, vMin + (vMax - vMin) * cy, Z));
    },
    dispose() {
      mesh.geometry.dispose();
      (mesh.material as THREE.MeshBasicMaterial).dispose();
    },
  };
}

/**
 * Companion that stands beside the tracked user. Placement uses normalized image coordinates and the
 * visible (cropped) viewport, so the figure is always framed at natural selfie scale and never off-screen.
 */
export function companionRuntime(
  layers: SceneLayers,
  _ctx: SceneContext,
  ch: PubChar,
): SceneRuntime {
  addLights(layers.back);
  const root = new THREE.Group();
  root.visible = true;
  layers.back.add(root);
  const content = new THREE.Group();
  root.add(content);

  // Live face tracking for Snapchat-style Cheek Lotus stickers & Forehead Tilak
  const headAnchor = new THREE.Group();
  headAnchor.matrixAutoUpdate = false;
  headAnchor.visible = false;
  layers.front.add(headAnchor);

  const tilak = createTilakMesh();
  headAnchor.add(tilak.mesh);

  const cheekStickers = createCheekLotusStickers();
  headAnchor.add(cheekStickers.group);

  // Live fluttering 3D party flag in corner
  const cornerFlag = createWavingCornerFlag();
  layers.front.add(cornerFlag.mesh);

  const defaultSlogan =
    ch.name?.en?.toLowerCase().includes("yogi") || ch.thumbnail?.includes("yogi")
      ? "मैं योगी जी के साथ हूँ"
      : ch.name?.en?.toLowerCase().includes("modi") || ch.thumbnail?.includes("modi")
        ? "मोदी है तो मुमकिन है"
        : "अबकी बार भाजपा सरकार";

  const sloganBanner = createSloganBanner(defaultSlogan);
  layers.front.add(sloganBanner.mesh);

  let standIn = false;
  const showMissing = () => {
    content.clear();
    const mesh = buildStandInSilhouette();
    content.add(mesh);
    standIn = false;
  };
  let auth: ReturnType<typeof authorizedContent> | null = null;
  if (hasAuthorizedAsset(ch)) {
    auth = authorizedContent(
      ch,
      (o) => {
        content.clear();
        content.add(o);
        standIn = false;
      },
      () => showMissing(),
    );
  } else {
    showMissing();
  }
  content.scale.setScalar(ch.scale || 1);
  content.rotation.y = THREE.MathUtils.degToRad(ch.rotationY || 0);

  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let side: 1 | -1 | 0 = 1;
  let alpha = 1;
  let lost = 0;
  let snap = true;
  const showSlogan = false;
  let showCheekArt = false;
  let showFlag = false;
  let showTilak = false;
  let elapsed = 0;

  const runtime: SceneRuntime = {
    get standIn() {
      return standIn;
    },
    setInteraction(id) {
      auth?.setInteraction(id);
    },
    setSlogan(text) {
      sloganBanner.redraw(text);
    },
    setFilterOptions(opts) {
      if (typeof opts.slogan === "string") {
        sloganBanner.redraw(opts.slogan);
      }
      if (typeof opts.cheekArt === "boolean") {
        showCheekArt = opts.cheekArt;
        cheekStickers.group.visible = showCheekArt;
      }
      if (typeof opts.flag === "boolean") {
        showFlag = opts.flag;
      }
      if (typeof opts.tilak === "boolean") {
        showTilak = opts.tilak;
        tilak.mesh.visible = showTilak;
      }
    },
    reset() {
      side = 0;
      snap = true;
    },
    update(t: TrackingFrame) {
      auth?.tick(t.dt);
      elapsed += t.dt;

      // Artwork retains its authentic upright orientation
      if (content.children[0]) content.scale.x = Math.abs(content.scale.y);

      // Face tracking for Cheek stickers and Forehead Tilak
      if (t.faceMatrix && (showCheekArt || showTilak)) {
        headAnchor.matrix.copy(t.faceMatrix);
        headAnchor.matrixWorldNeedsUpdate = true;
        headAnchor.visible = true;
      } else {
        headAnchor.visible = false;
      }

      // Live animated party flag
      cornerFlag.update(t, elapsed, showFlag);

      const { uMin, uMax, vMin, vMax } = t.view;

      if (t.head) {
        lost = 0;
        const hp = t.project(t.head);
        tmp.copy(t.head).x += 16;
        const headW = Math.abs(t.project(tmp).u - hp.u); // user's head width in normalized units
        const headU = t.mirrored ? 1.0 - hp.u : hp.u;
        const z = t.head.z * 1.05; // slightly behind shoulder
        const gap = Math.max(0.24, headW * 1.8);
        const margin = Math.max(0.08, headW * 0.8);
        let u = headU + gap + (ch.offsetX || 0) / 100;
        if (u > uMax - margin) u = headU - gap + (ch.offsetX || 0) / 100;
        u = THREE.MathUtils.clamp(u, uMin + margin, uMax - margin);
        let v = hp.v + 0.05 + (ch.offsetY || 0) / 100;
        v = THREE.MathUtils.clamp(v, vMin + 0.08, vMax - 0.12);
        target.copy(t.unproject(u, v, z));
        if (snap || !root.visible) root.position.copy(target);
        else root.position.lerp(target, Math.min(1, t.dt * 6));
        snap = false;
        // Keep upright facing straight toward the camera
        root.rotation.set(0, 0, 0);
        root.visible = true;
      } else {
        lost += t.dt;
        // Natural default position standing beside user at comfortable selfie distance
        const defaultU = THREE.MathUtils.lerp(0.5, uMax, 0.45);
        const defaultV = THREE.MathUtils.lerp(vMin, vMax, 0.42);
        const defaultZ = -75;
        target.copy(
          t.unproject(
            defaultU + (ch.offsetX || 0) / 100,
            defaultV + (ch.offsetY || 0) / 100,
            defaultZ,
          ),
        );
        if (snap || !root.visible) root.position.copy(target);
        else root.position.lerp(target, Math.min(1, t.dt * 4));
        snap = false;
        root.rotation.set(0, 0, 0);
        root.visible = true;
      }
      alpha = 1;
      setOpacity(content, 1);

      // Slogan banner at bottom of camera screen
      if (showSlogan) {
        const Z = -100;
        const tl = t.unproject(uMin, vMin, Z);
        const br = t.unproject(uMax, vMax, Z);
        const vw = br.x - tl.x;
        const w = (vw * 84) / 100;
        const h = w * (240 / 1024);
        sloganBanner.mesh.scale.set(w * (t.mirrored ? -1 : 1), h, 1);
        const cx = 0.5;
        const cy = 0.18; // elevated so it sits proudly above bottom dock
        const uc = t.mirrored ? 1 - cx : cx;
        sloganBanner.mesh.position.copy(
          t.unproject(uMin + (uMax - uMin) * uc, vMin + (vMax - vMin) * cy, Z),
        );
        sloganBanner.mesh.visible = true;
      }
    },
    dispose() {
      auth?.dispose();
      headAnchor.clear();
      cheekStickers.dispose();
      tilak.mesh.geometry.dispose();
      (tilak.mesh.material as THREE.Material).dispose();
      tilak.tex.dispose();
      cornerFlag.dispose();
      sloganBanner.mesh.geometry.dispose();
      (sloganBanner.mesh.material as THREE.Material).dispose();
      sloganBanner.tex.dispose();
    },
  };
  return runtime;
}

/** Double Companion: Both CM Yogi and PM Modi in the same AR selfie (Yogi on Left, Modi on Right) */
export function doubleCompanionRuntime(
  layers: SceneLayers,
  _ctx: SceneContext,
  yogiChar: PubChar,
  modiChar: PubChar,
): SceneRuntime {
  addLights(layers.back);
  const root = new THREE.Group();
  root.visible = true;
  layers.back.add(root);

  const yogiGroup = new THREE.Group();
  const modiGroup = new THREE.Group();
  root.add(yogiGroup);
  root.add(modiGroup);

  // Live face tracking for Snapchat-style Cheek Lotus stickers & Forehead Tilak
  const headAnchor = new THREE.Group();
  headAnchor.matrixAutoUpdate = false;
  headAnchor.visible = false;
  layers.front.add(headAnchor);

  const tilak = createTilakMesh();
  headAnchor.add(tilak.mesh);

  const cheekStickers = createCheekLotusStickers();
  headAnchor.add(cheekStickers.group);

  // Live fluttering 3D party flag in corner
  const cornerFlag = createWavingCornerFlag();
  layers.front.add(cornerFlag.mesh);

  const sloganBanner = createSloganBanner("अबकी बार भाजपा सरकार");
  layers.front.add(sloganBanner.mesh);

  let authYogi: ReturnType<typeof authorizedContent> | null = null;
  let authModi: ReturnType<typeof authorizedContent> | null = null;

  if (hasAuthorizedAsset(yogiChar)) {
    authYogi = authorizedContent(yogiChar, (o) => yogiGroup.add(o), noop);
  }
  if (hasAuthorizedAsset(modiChar)) {
    authModi = authorizedContent(modiChar, (o) => modiGroup.add(o), noop);
  }

  yogiGroup.scale.setScalar(yogiChar.scale || 1);
  modiGroup.scale.setScalar(modiChar.scale || 1);

  const targetYogi = new THREE.Vector3();
  const targetModi = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let snap = true;
  let showCheekArt = false;
  let showFlag = false;
  let showTilak = false;
  let elapsed = 0;

  return {
    get standIn() {
      return false;
    },
    setInteraction(id) {
      authYogi?.setInteraction(id);
      authModi?.setInteraction(id);
    },
    setSlogan(text) {
      sloganBanner.redraw(text);
    },
    setFilterOptions(opts) {
      if (typeof opts.slogan === "string") {
        sloganBanner.redraw(opts.slogan);
      }
      if (typeof opts.cheekArt === "boolean") {
        showCheekArt = opts.cheekArt;
        cheekStickers.group.visible = showCheekArt;
      }
      if (typeof opts.flag === "boolean") {
        showFlag = opts.flag;
      }
      if (typeof opts.tilak === "boolean") {
        showTilak = opts.tilak;
        tilak.mesh.visible = showTilak;
      }
    },
    reset() {
      snap = true;
    },
    update(t: TrackingFrame) {
      authYogi?.tick(t.dt);
      authModi?.tick(t.dt);
      elapsed += t.dt;

      // Face tracking for Cheek stickers and Forehead Tilak
      if (t.faceMatrix && (showCheekArt || showTilak)) {
        headAnchor.matrix.copy(t.faceMatrix);
        headAnchor.matrixWorldNeedsUpdate = true;
        headAnchor.visible = true;
      } else {
        headAnchor.visible = false;
      }

      cornerFlag.update(t, elapsed, showFlag);

      if (yogiGroup.children[0]) yogiGroup.scale.x = Math.abs(yogiGroup.scale.y);
      if (modiGroup.children[0]) modiGroup.scale.x = Math.abs(modiGroup.scale.y);

      const { uMin, uMax, vMin, vMax } = t.view;

      if (t.head) {
        const hp = t.project(t.head);
        tmp.copy(t.head).x += 16;
        const headW = Math.abs(t.project(tmp).u - hp.u);
        const headU = t.mirrored ? 1.0 - hp.u : hp.u;
        const gap = Math.max(0.24, headW * 2.0);
        const z = t.head.z * 1.05;

        // Yogi on Left (-1)
        const uL = THREE.MathUtils.clamp(headU - gap, uMin + 0.08, uMax - 0.08);
        const vL = THREE.MathUtils.clamp(hp.v + 0.05, vMin + 0.08, vMax - 0.12);
        targetYogi.copy(t.unproject(uL, vL, z));

        // Modi on Right (+1)
        const uR = THREE.MathUtils.clamp(headU + gap, uMin + 0.08, uMax - 0.08);
        const vR = THREE.MathUtils.clamp(hp.v + 0.05, vMin + 0.08, vMax - 0.12);
        targetModi.copy(t.unproject(uR, vR, z));

        if (snap || !root.visible) {
          yogiGroup.position.copy(targetYogi);
          modiGroup.position.copy(targetModi);
        } else {
          yogiGroup.position.lerp(targetYogi, Math.min(1, t.dt * 7));
          modiGroup.position.lerp(targetModi, Math.min(1, t.dt * 7));
        }
        snap = false;
        yogiGroup.rotation.set(0, 0, 0);
        modiGroup.rotation.set(0, 0, 0);
      } else {
        const uL = THREE.MathUtils.lerp(uMin, 0.5, 0.35);
        const uR = THREE.MathUtils.lerp(0.5, uMax, 0.65);
        const v = THREE.MathUtils.lerp(vMin, vMax, 0.38);
        const z = -70;
        targetYogi.copy(t.unproject(uL, v, z));
        targetModi.copy(t.unproject(uR, v, z));
        yogiGroup.position.copy(targetYogi);
        modiGroup.position.copy(targetModi);
        snap = false;
      }

      // Slogan banner at bottom
      const Z = -100;
      const tl = t.unproject(uMin, vMin, Z);
      const br = t.unproject(uMax, vMax, Z);
      const vw = br.x - tl.x;
      const w = (vw * 84) / 100;
      const h = w * (240 / 1024);
      sloganBanner.mesh.scale.set(w * sx, h, 1);
      const cx = 0.5;
      const cy = 0.18;
      const uc = t.mirrored ? 1 - cx : cx;
      sloganBanner.mesh.position.copy(
        t.unproject(uMin + (uMax - uMin) * uc, vMin + (vMax - vMin) * cy, Z),
      );
    },
    dispose() {
      authYogi?.dispose();
      authModi?.dispose();
      headAnchor.clear();
      cheekStickers.dispose();
      tilak.mesh.geometry.dispose();
      (tilak.mesh.material as THREE.Material).dispose();
      tilak.tex.dispose();
      cornerFlag.dispose();
      sloganBanner.mesh.geometry.dispose();
      (sloganBanner.mesh.material as THREE.Material).dispose();
      sloganBanner.tex.dispose();
    },
  };
}

function imagePlane(
  url: string,
  item: BjpItem,
  onAspect: (a: number) => void,
  onReady: () => void = noop,
) {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 20 + item.order;
  mesh.visible = false;
  loadTex(url).then(
    (t) => {
      mat.map = t;
      mat.needsUpdate = true;
      const img = t.image as { width: number; height: number };
      onAspect(img.height / Math.max(1, img.width));
      mesh.visible = true;
      onReady();
    },
    () => {
      onReady();
    },
  );
  return mesh;
}

/** BJP Look: Snapchat-style AR filter with cheek lotus art, forehead tilak, waving flag, stole and live slogans */
export function lookRuntime(
  layers: SceneLayers,
  ctx: SceneContext,
): SceneRuntime & { backgroundUrl?: string | undefined } {
  addLights(layers.front);
  const items = [...ctx.config.bjp]
    .filter((b) => b.enabled && b.approved && b.asset)
    .sort((a, b) => a.order - b.order);

  const headAnchor = new THREE.Group();
  headAnchor.matrixAutoUpdate = false;
  headAnchor.visible = false;
  layers.front.add(headAnchor);

  // Forehead Saffron Tilak: delicate, positioned high on forehead away from eyes
  const tilak = createTilakMesh();
  tilak.mesh.position.set(0, 5.2, 2.2);
  tilak.mesh.scale.set(0.5, 0.5, 1);
  headAnchor.add(tilak.mesh);

  const shoulderAnchor = new THREE.Group();
  shoulderAnchor.visible = false;
  layers.front.add(shoulderAnchor);

  const screenAnchor = new THREE.Group();
  layers.front.add(screenAnchor);

  const mirrorables: THREE.Object3D[] = [];
  const screenItems: { mesh: THREE.Mesh; item: BjpItem; aspect: number }[] = [];
  let backgroundUrl: string | undefined;
  let loaded = 0;
  let elapsed = 0;

  // Live Hindi Slogan banner
  const sloganBanner = createSloganBanner("अबकी बार भाजपा सरकार");
  screenAnchor.add(sloganBanner.mesh);

  for (const it of items) {
    if (!it.asset) continue;
    if (it.anchor === "background") {
      loadTex(it.asset).then((t) => {
        loaded++;
        t.dispose();
      }, noop);
      backgroundUrl = it.asset;
      continue;
    }
    const rot = THREE.MathUtils.degToRad(it.rotation);
    if (it.anchor === "head") {
      // Cheeks lotus sticker: tasteful subtle badge placed on outer cheek
      const isCheek = it.kind === "sticker" || it.id.includes("cheek");
      const w = isCheek ? 4.5 * (it.scale || 1) : 6 * (it.scale || 1);
      const m = imagePlane(
        it.asset,
        it,
        (a) => m.scale.set(w, w * a, 1),
        () => {
          loaded++;
        },
      );
      const posX = it.offsetX < 0 ? -4.2 : 4.2;
      m.position.set(posX, -1.6 + (it.offsetY || 0), 2.5);
      m.rotation.z = rot;
      headAnchor.add(m);
      mirrorables.push(m);
    } else if (it.anchor === "shoulders") {
      const w = 14 * (it.scale || 1);
      const m = imagePlane(
        it.asset,
        it,
        (a) => m.scale.set(w, w * a, 1),
        () => {
          loaded++;
        },
      );
      m.position.set(it.offsetX / 10, -1.2 + it.offsetY / 10, 0.25);
      m.rotation.z = rot;
      shoulderAnchor.add(m);
      mirrorables.push(m);
    } else {
      const entry = { mesh: null as unknown as THREE.Mesh, item: it, aspect: 1 };
      entry.mesh = imagePlane(
        it.asset,
        it,
        (a) => (entry.aspect = a),
        () => {
          loaded++;
        },
      );
      entry.mesh.rotation.z = rot;
      screenAnchor.add(entry.mesh);
      screenItems.push(entry);
    }
  }

  const mid = new THREE.Vector3();
  let lostH = 0;
  let lostS = 0;
  return {
    backgroundUrl,
    get standIn() {
      return items.length > 0 && loaded < items.length;
    },
    setSlogan(text) {
      sloganBanner.redraw(text);
    },
    setFilterOptions(opts) {
      if (typeof opts.slogan === "string") {
        sloganBanner.redraw(opts.slogan);
      }
      if (typeof opts.cheekArt === "boolean") {
        for (const m of mirrorables) {
          if (m !== tilak.mesh) m.visible = opts.cheekArt;
        }
      }
      if (typeof opts.flag === "boolean") {
        for (const s of screenItems) {
          if (s.item.kind === "flag" || s.item.id.includes("flag")) {
            s.mesh.visible = opts.flag;
          }
        }
      }
      if (typeof opts.tilak === "boolean") {
        tilak.mesh.visible = opts.tilak;
      }
      if (typeof opts.stole === "boolean") {
        shoulderAnchor.visible = opts.stole;
      }
    },
    reset() {
      headAnchor.visible = false;
      shoulderAnchor.visible = false;
    },
    update(t) {
      elapsed += t.dt;
      const sx = t.mirrored ? -1 : 1;
      for (const m of mirrorables) m.scale.x = Math.abs(m.scale.x) * sx;

      if (t.faceMatrix) {
        headAnchor.matrix.copy(t.faceMatrix);
        headAnchor.matrixWorldNeedsUpdate = true;
        headAnchor.visible = true;
        lostH = 0;
      } else if ((lostH += t.dt) > 0.4) headAnchor.visible = false;

      if (t.shoulders) {
        const { left, right } = t.shoulders;
        mid.addVectors(left, right).multiplyScalar(0.5);
        const w = left.distanceTo(right);
        shoulderAnchor.position.lerp(mid, shoulderAnchor.visible ? Math.min(1, t.dt * 12) : 1);
        shoulderAnchor.scale.setScalar(w);
        shoulderAnchor.rotation.z =
          Math.atan2(right.y - left.y, right.x - left.x) + (right.x < left.x ? Math.PI : 0);
        shoulderAnchor.visible = true;
        lostS = 0;
      } else if ((lostS += t.dt) > 0.4) shoulderAnchor.visible = false;

      // Screen-layer items (frames/stickers/flags/slogan) at fixed depth, sized to viewport
      const Z = -100;
      const { uMin, uMax, vMin, vMax } = t.view;
      const tl = t.unproject(uMin, vMin, Z);
      const br = t.unproject(uMax, vMax, Z);
      const vw = br.x - tl.x;
      const vh = tl.y - br.y;

      for (const s of screenItems) {
        const isFrame = s.item.kind === "frame";
        const isFlag = s.item.kind === "flag" || s.item.id.includes("flag");
        const w = isFrame ? vw : (vw * (s.item.scale || 20)) / 100;
        const h = isFrame ? vh : w * s.aspect;
        s.mesh.scale.set(w * sx, h, 1);

        // Realistic waving motion for flag
        if (isFlag) {
          s.mesh.rotation.z = Math.sin(elapsed * 2.8) * 0.05;
        }

        const cx = isFrame ? 0.5 : 0.5 + s.item.offsetX / 100;
        const cy = isFrame ? 0.5 : 0.5 + s.item.offsetY / 100;
        const uc = t.mirrored ? 1 - cx : cx;
        s.mesh.position.copy(t.unproject(uMin + (uMax - uMin) * uc, vMin + (vMax - vMin) * cy, Z));
      }

      // Slogan banner at bottom
      const sloganW = (vw * 84) / 100;
      const sloganH = sloganW * (240 / 1024);
      sloganBanner.mesh.scale.set(sloganW * sx, sloganH, 1);
      const sloganCy = 0.18;
      const sloganUc = t.mirrored ? 0.5 : 0.5;
      sloganBanner.mesh.position.copy(
        t.unproject(uMin + (uMax - uMin) * sloganUc, vMin + (vMax - vMin) * sloganCy, Z),
      );
    },
    dispose() {
      disposeTree(headAnchor);
      disposeTree(shoulderAnchor);
      disposeTree(screenAnchor);
      sloganBanner.mesh.geometry.dispose();
      (sloganBanner.mesh.material as THREE.Material).dispose();
      sloganBanner.tex.dispose();
      tilak.mesh.geometry.dispose();
      (tilak.mesh.material as THREE.Material).dispose();
      tilak.tex.dispose();
    },
  };
}

/** Metre-scale world AR companion for floor placement */
export function worldCompanion(ctx: SceneContext, ch: PubChar) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  );
  disc.position.y = 0.002;
  g.add(disc);
  const holder = new THREE.Group();
  holder.scale.setScalar(0.01 * (ch.scale || 1));
  holder.position.y = (FIG_H - HEAD_FROM_TOP) * 0.01 * (ch.scale || 1);
  g.add(holder);
  if (hasAuthorizedAsset(ch)) {
    const a = authorizedContent(
      ch,
      (o) => {
        holder.clear();
        holder.add(o);
      },
      noop,
    );
    a.setInteraction(ctx.interaction);
    disc.onBeforeRender = () => a.tick(1 / 60);
  }
  return g;
}
