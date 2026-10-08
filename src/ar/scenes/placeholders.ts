import * as THREE from "three";
import type { SceneContext, SceneLayers, SceneRuntime, TrackingFrame } from "./types";
import type { BjpItem, InteractionId, PublicConfig } from "@/lib/config";

type PubChar = PublicConfig["characters"]["yogi"];
const STAND_IN = "DEV STAND-IN · ASSET PENDING";
const FIG_H = 175; // cm, natural adult height
const HEAD_FROM_TOP = 12; // cm, head centre below top of figure

function labelSprite(text: string, color = "#ffb347") {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(10,10,14,0.78)";
  g.beginPath();
  g.roundRect(4, 4, 632, 88, 44);
  g.fill();
  g.fillStyle = color;
  g.font = "600 34px 'Space Grotesk', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 320, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(40, 6, 1);
  s.renderOrder = 10;
  return s;
}

/** Neutral stand-in figure (cm). Head centre at origin, body below. Never represents a real person. */
export function buildFigure(color: number, label: string, unit = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, transparent: true });
  const head = new THREE.Mesh(new THREE.SphereGeometry(10 * unit, 32, 16), mat);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(4 * unit, 5 * unit, 8 * unit, 16), mat);
  neck.position.y = -13 * unit;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(17 * unit, 40 * unit, 8, 24), mat);
  torso.scale.z = 0.6;
  torso.position.y = -50 * unit;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(13 * unit, 70 * unit, 8, 16), mat);
  legs.scale.z = 0.6;
  legs.position.y = -115 * unit;
  g.add(head, neck, torso, legs);
  const tag = labelSprite(label);
  tag.name = "label";
  tag.position.y = 22 * unit;
  tag.scale.multiplyScalar(unit);
  g.add(tag);
  return g;
}

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

/** Loads authorized content: rigged GLB (with animation states) or transparent 2D poses. Head centre at origin, cm. */
function authorizedContent(ch: PubChar, onReady: (o: THREE.Object3D) => void, onFail: () => void) {
  const holder = new THREE.Group();
  let mixer: THREE.AnimationMixer | null = null;
  let clips: THREE.AnimationClip[] = [];
  let plane: THREE.Mesh | null = null;
  const texCache = new Map<string, Promise<THREE.Texture>>();
  let disposed = false;

  const playClip = (id: InteractionId) => {
    if (!mixer || !clips.length) return;
    const want = (ch.animations[id] ?? id).toLowerCase();
    const clip = clips.find((c) => c.name.toLowerCase() === want) ?? clips.find((c) => c.name.toLowerCase().includes(id)) ?? clips[0]!;
    mixer.stopAllAction();
    mixer.clipAction(clip).reset().fadeIn(0.3).play();
  };
  const showPose = (id: InteractionId) => {
    const url = ch.poses[id] ?? ch.poses.selfie ?? Object.values(ch.poses)[0];
    if (!url) return;
    if (!texCache.has(url)) texCache.set(url, loadTex(url));
    texCache.get(url)!.then((tex) => {
      if (disposed) return;
      const img = tex.image as { width: number; height: number };
      const h = FIG_H;
      const w = (h * img.width) / Math.max(1, img.height);
      if (!plane) {
        plane = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }),
        );
        holder.add(plane);
        onReady(holder);
      } else (plane.material as THREE.MeshBasicMaterial).map = tex;
      plane.scale.set(w, h, 1);
      plane.position.set(0, HEAD_FROM_TOP - h / 2, 0);
    }, onFail);
  };

  if (ch.glb) {
    import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(ch.glb!))
      .then((gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const s = FIG_H / Math.max(0.0001, size.y);
        model.scale.setScalar(s);
        model.position.set(-((box.min.x + box.max.x) / 2) * s, HEAD_FROM_TOP - box.max.y * s, -((box.min.z + box.max.z) / 2) * s);
        holder.add(model);
        clips = gltf.animations;
        if (clips.length) mixer = new THREE.AnimationMixer(model);
        playClip("selfie");
        onReady(holder);
      })
      .catch(onFail);
  } else showPose("selfie");

  return {
    holder,
    setInteraction(id: InteractionId) {
      if (mixer) playClip(id);
      else showPose(id);
    },
    tick(dt: number) {
      mixer?.update(dt);
    },
    dispose() {
      disposed = true;
      mixer?.stopAllAction();
      disposeTree(holder);
    },
  };
}

const hasAuthorizedAsset = (ch: PubChar) => ch.authorized && (!!ch.glb || Object.keys(ch.poses).length > 0);

/**
 * Companion that stands beside the tracked user. Placement uses normalized image coordinates and the
 * visible (cropped) viewport, so the figure is always framed at natural selfie scale and never off-screen.
 */
export function companionRuntime(layers: SceneLayers, ctx: SceneContext, ch: PubChar, color: number): SceneRuntime {
  addLights(layers.back);
  const root = new THREE.Group();
  root.visible = false;
  layers.back.add(root);
  const content = new THREE.Group();
  root.add(content);

  let standIn = !hasAuthorizedAsset(ch);
  const fig = buildFigure(color, STAND_IN);
  const showStandIn = () => {
    standIn = true;
    content.clear();
    content.add(fig);
  };
  let auth: ReturnType<typeof authorizedContent> | null = null;
  if (standIn) showStandIn();
  else {
    auth = authorizedContent(
      ch,
      (o) => { content.clear(); content.add(o); },
      () => showStandIn(),
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
      const label = fig.getObjectByName("label");
      if (label) label.scale.x = Math.abs(label.scale.x) * (t.mirrored ? -1 : 1);
      if (content.children[0] && content.children[0] !== fig) content.scale.x = Math.abs(content.scale.y) * (t.mirrored ? -1 : 1);

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
      disposeTree(fig);
    },
  };
  return runtime;
}

function imagePlane(url: string, item: BjpItem, onAspect: (a: number) => void) {
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
  }, () => undefined);
  return mesh;
}

/** BJP Look: configurable items on head (face 6DoF), shoulders (body pose) and screen frame layer. */
export function lookRuntime(layers: SceneLayers, ctx: SceneContext): SceneRuntime & { backgroundUrl?: string } {
  addLights(layers.front);
  const items = [...ctx.config.bjp].filter((b) => b.enabled).sort((a, b) => a.order - b.order);
  const saffron = new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.6 });
  const green = new THREE.MeshStandardMaterial({ color: 0x138a3d, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.6 });

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

  for (const it of items) {
    if (it.id === "builtin-cap" && !it.asset) {
      const cap = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(9.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), saffron);
      dome.scale.set(1, 0.7, 1.1);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.5, 32, 1, false, -Math.PI / 2, Math.PI), saffron);
      brim.scale.set(1, 1, 1.3);
      brim.position.set(0, 0, 8);
      const band = new THREE.Mesh(new THREE.TorusGeometry(9.6, 0.5, 8, 48), green);
      band.rotation.x = Math.PI / 2;
      band.scale.set(1, 1.1, 1);
      cap.add(dome, brim, band);
      cap.position.set(it.offsetX, 5.5 + it.offsetY, -1.5);
      cap.rotation.x = -0.12;
      cap.rotation.z = THREE.MathUtils.degToRad(it.rotation);
      cap.scale.setScalar(it.scale || 1);
      headAnchor.add(cap);
      continue;
    }
    if (it.id === "builtin-scarf" && !it.asset) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.55, 0.05, -0.1),
        new THREE.Vector3(-0.35, -0.25, 0.15),
        new THREE.Vector3(0, -0.4, 0.22),
        new THREE.Vector3(0.35, -0.25, 0.15),
        new THREE.Vector3(0.55, 0.05, -0.1),
      ]);
      const scarf = new THREE.Group();
      const s1 = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.07, 12), saffron);
      const s2 = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.02, 8), white);
      s2.position.y = -0.07;
      const s3 = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.035, 8), green);
      s3.position.y = -0.11;
      for (const x of [-0.42, 0.42]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.03), saffron);
        tail.position.set(x, -0.42, 0.18);
        scarf.add(tail);
      }
      scarf.add(s1, s2, s3);
      scarf.scale.setScalar(it.scale || 1);
      scarf.position.set(it.offsetX / 100, it.offsetY / 100, 0);
      shoulderAnchor.add(scarf);
      continue;
    }
    if (!it.asset) continue;
    if (it.anchor === "background") {
      backgroundUrl = it.asset;
      continue;
    }
    const rot = THREE.MathUtils.degToRad(it.rotation);
    if (it.anchor === "head") {
      const w = 20 * (it.scale || 1);
      const m = imagePlane(it.asset, it, (a) => m.scale.set(w, w * a, 1));
      m.position.set(it.offsetX, 9 + it.offsetY, 4);
      m.rotation.z = rot;
      headAnchor.add(m);
      mirrorables.push(m);
    } else if (it.anchor === "shoulders") {
      const w = it.scale || 1;
      const m = imagePlane(it.asset, it, (a) => m.scale.set(w, w * a, 1));
      m.position.set(it.offsetX / 100, -0.25 + it.offsetY / 100, 0.25);
      m.rotation.z = rot;
      shoulderAnchor.add(m);
      mirrorables.push(m);
    } else {
      const entry = { mesh: null as unknown as THREE.Mesh, item: it, aspect: 1 };
      entry.mesh = imagePlane(it.asset, it, (a) => (entry.aspect = a));
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
    standIn: items.some((i) => i.id.startsWith("builtin")),
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

/** Metre-scale world AR companion for floor placement (authorized asset when configured, else labelled stand-in). */
export function worldCompanion(ctx: SceneContext, ch: PubChar, color: number) {
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
  const standIn = () => {
    holder.clear();
    holder.add(buildFigure(color, STAND_IN));
  };
  if (!hasAuthorizedAsset(ch)) standIn();
  else {
    const a = authorizedContent(ch, (o) => { holder.clear(); holder.add(o); }, standIn);
    a.setInteraction(ctx.interaction);
    g.onBeforeRender = () => a.tick(1 / 60);
  }
  return g;
}
