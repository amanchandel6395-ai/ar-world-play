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
    texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej),
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

/** Approved flat photo-booth standee, tracked through the existing scene engine. */
function authorizedContent(ch: PubChar, onReady: (o: THREE.Object3D) => void, onFail: () => void) {
  const holder = new THREE.Group();
  let plane: THREE.Mesh | null = null;
  let disposed = false;
  let request = 0;
  const showPose = (id: InteractionId) => {
    const current = ++request;
    const url = ch.poses[id] ?? ch.poses.selfie ?? Object.values(ch.poses)[0];
    if (!url) { onFail(); return; }
    loadTex(url).then((tex) => {
      if (disposed || request !== current) { tex.dispose(); return; }
      const img = tex.image as { width: number; height: number };
      if (!plane) {
        plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }));
        holder.add(plane);
      } else {
        const mat = plane.material as THREE.MeshBasicMaterial;
        mat.map?.dispose(); mat.map = tex; mat.needsUpdate = true;
      }
      plane.scale.set(FIG_H * img.width / Math.max(1, img.height), FIG_H, 1);
      plane.position.set(0, HEAD_FROM_TOP - FIG_H / 2, 0);
      onReady(holder);
    }, onFail);
  };
  showPose("selfie");
  return { holder, setInteraction: showPose, tick: (_dt: number) => undefined, dispose() { disposed = true; disposeTree(holder); } };
}
const hasAuthorizedAsset = (ch: PubChar) => ch.enabled && ch.authorized && !!ch.authorizedAt && Object.keys(ch.poses).length > 0;
const noop = () => undefined;

/**
 * Companion that stands beside the tracked user. Placement uses normalized image coordinates and the
 * visible (cropped) viewport, so the figure is always framed at natural selfie scale and never off-screen.
 */
export function companionRuntime(layers: SceneLayers, _ctx: SceneContext, ch: PubChar): SceneRuntime {
  addLights(layers.back);
  const root = new THREE.Group();
  root.visible = false;
  layers.back.add(root);
  const content = new THREE.Group();
  root.add(content);

  // `standIn` = no approved asset is available. Nothing is rendered then; the UI shows a setup message
  // and disables capture. A fake/neutral figure is never shown to customers.
  let standIn = true;
  const showMissing = () => {
    standIn = true;
    content.clear();
  };
  let auth: ReturnType<typeof authorizedContent> | null = null;
  if (hasAuthorizedAsset(ch)) {
    auth = authorizedContent(
      ch,
      (o) => { content.clear(); content.add(o); standIn = false; },
      () => showMissing(),
    );
  }
  content.scale.setScalar(ch.scale || 1);
  content.rotation.y = THREE.MathUtils.degToRad(ch.rotationY || 0);

  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let side: 1 | -1 | 0 = 0;
  let alpha = 0;
  let lost = 99;
  let snap = true;
  const runtime: SceneRuntime = {
    get standIn() {
      return standIn;
    },
    setInteraction(id) {
      auth?.setInteraction(id);
    },
    reset() {
      side = 0;
      snap = true;
    },
    update(t: TrackingFrame) {
      auth?.tick(t.dt);
      // The shared canvas is unmirrored; artwork retains its original orientation.
      if (content.children[0]) content.scale.x = Math.abs(content.scale.y) * (t.mirrored ? -1 : 1);

      if (t.head) {
        lost = 0;
        const { uMin, uMax, vMin, vMax } = t.view;
        const hp = t.project(t.head);
        tmp.copy(t.head).x += 16;
        const headW = Math.abs(t.project(tmp).u - hp.u); // user's head width in normalized units
        // automatic side choice: the side with more free room (with hysteresis)
        const roomR = uMax - hp.u;
        const roomL = hp.u - uMin;
        if (side === 0) side = roomR >= roomL ? 1 : -1;
        else if (side === 1 && roomL > roomR * 1.6) side = -1;
        else if (side === -1 && roomR > roomL * 1.6) side = 1;
        const z = t.head.z * 1.08; // a little behind the user
        const gap = headW * 2.4;
        const margin = headW * 1.3;
        let u = hp.u + side * gap + (ch.offsetX || 0) / 100;
        u = THREE.MathUtils.clamp(u, uMin + margin, uMax - margin);
        let v = hp.v + (ch.offsetY || 0) / 100;
        v = THREE.MathUtils.clamp(v, vMin + headW, vMax - 0.2);
        target.copy(t.unproject(u, v, z));
        if (snap || !root.visible) root.position.copy(target);
        else root.position.lerp(target, Math.min(1, t.dt * 6));
        snap = false;
        root.lookAt(t.head.x * 0.3, root.position.y, 0);
        root.visible = true;
      } else lost += t.dt;
      const want = lost < 0.5 ? 1 : 0;
      alpha += (want - alpha) * Math.min(1, t.dt * 6);
      if (alpha < 0.02 && want === 0) {
        root.visible = false;
        snap = true;
      }
      setOpacity(content, alpha);
    },
    dispose() {
      auth?.dispose();
    },
  };
  return runtime;
}

function imagePlane(url: string, item: BjpItem, onAspect: (a: number) => void, onReady: () => void = noop) {
  const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.renderOrder = 20 + item.order;
  mesh.visible = false;
  loadTex(url).then((t) => {
    mat.map = t;
    mat.needsUpdate = true;
    const img = t.image as { width: number; height: number };
    onAspect(img.height / Math.max(1, img.width));
    mesh.visible = true;
    onReady();
  }, () => undefined);
  return mesh;
}

/** BJP Look: configurable items on head (face 6DoF), shoulders (body pose) and screen frame layer. */
export function lookRuntime(layers: SceneLayers, ctx: SceneContext): SceneRuntime & { backgroundUrl?: string | undefined } {
  addLights(layers.front);
  // Only the exact uploaded artwork that an admin approved is rendered. No built-in/substitute symbols.
  const items = [...ctx.config.bjp].filter((b) => b.enabled && b.approved && b.asset).sort((a, b) => a.order - b.order);

  const headAnchor = new THREE.Group();
  headAnchor.matrixAutoUpdate = false;
  headAnchor.visible = false;
  layers.front.add(headAnchor);
  const shoulderAnchor = new THREE.Group();
  shoulderAnchor.visible = false;
  layers.front.add(shoulderAnchor);
  const screenAnchor = new THREE.Group();
  layers.front.add(screenAnchor);
  const mirrorables: THREE.Object3D[] = [];
  const screenItems: { mesh: THREE.Mesh; item: BjpItem; aspect: number }[] = [];
  let backgroundUrl: string | undefined;
  let loaded = 0;

  for (const it of items) {
    if (!it.asset) continue;
    if (it.anchor === "background") {
      // Preflight background too; capture remains disabled until the asset loads.
      loadTex(it.asset).then((t) => { loaded++; t.dispose(); }, noop);
      backgroundUrl = it.asset;
      continue;
    }
    const rot = THREE.MathUtils.degToRad(it.rotation);
    if (it.anchor === "head") {
      const w = 20 * (it.scale || 1);
      const m = imagePlane(it.asset, it, (a) => m.scale.set(w, w * a, 1), () => { loaded++; });
      m.position.set(it.offsetX, 9 + it.offsetY, 4);
      m.rotation.z = rot;
      headAnchor.add(m);
      mirrorables.push(m);
    } else if (it.anchor === "shoulders") {
      const w = it.scale || 1;
      const m = imagePlane(it.asset, it, (a) => m.scale.set(w, w * a, 1), () => { loaded++; });
      m.position.set(it.offsetX / 100, -0.25 + it.offsetY / 100, 0.25);
      m.rotation.z = rot;
      shoulderAnchor.add(m);
      mirrorables.push(m);
    } else {
      const entry = { mesh: null as unknown as THREE.Mesh, item: it, aspect: 1 };
      entry.mesh = imagePlane(it.asset, it, (a) => (entry.aspect = a), () => { loaded++; });
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
    get standIn() { return items.length === 0 || loaded < items.length; },
    reset() {
      headAnchor.visible = false;
      shoulderAnchor.visible = false;
    },
    update(t) {
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
        shoulderAnchor.rotation.z = Math.atan2(right.y - left.y, right.x - left.x) + (right.x < left.x ? Math.PI : 0);
        shoulderAnchor.visible = true;
        lostS = 0;
      } else if ((lostS += t.dt) > 0.4) shoulderAnchor.visible = false;

      // Screen-layer items (frames/stickers/flags) at fixed depth, sized to the visible viewport.
      const Z = -100;
      const { uMin, uMax, vMin, vMax } = t.view;
      const tl = t.unproject(uMin, vMin, Z);
      const br = t.unproject(uMax, vMax, Z);
      const vw = br.x - tl.x;
      const vh = tl.y - br.y;
      for (const s of screenItems) {
        const isFrame = s.item.kind === "frame";
        const w = isFrame ? vw : (vw * (s.item.scale || 20)) / 100;
        const h = isFrame ? vh : w * s.aspect;
        s.mesh.scale.set(w * sx, h, 1);
        const cx = isFrame ? 0.5 : 0.5 + s.item.offsetX / 100;
        const cy = isFrame ? 0.5 : 0.5 + s.item.offsetY / 100;
        const uc = t.mirrored ? 1 - cx : cx;
        s.mesh.position.copy(t.unproject(uMin + (uMax - uMin) * uc, vMin + (vMax - vMin) * cy, Z));
      }
    },
    dispose() {
      disposeTree(headAnchor);
      disposeTree(shoulderAnchor);
      disposeTree(screenAnchor);
    },
  };
}

/** Metre-scale world AR companion for floor placement (authorized asset only; empty when not configured). */
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
    const a = authorizedContent(ch, (o) => { holder.clear(); holder.add(o); }, noop);
    a.setInteraction(ctx.interaction);
    disc.onBeforeRender = () => a.tick(1 / 60);
  }
  return g;
}
