import * as THREE from "three";
import type { SceneLayers, SceneRuntime, TrackingFrame } from "./types";

function labelSprite(text: string, color = "#ffb347") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(10,10,14,0.72)";
  g.beginPath();
  g.roundRect(4, 4, 504, 88, 44);
  g.fill();
  g.fillStyle = color;
  g.font = "600 34px 'Space Grotesk', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(32, 6, 1);
  return s;
}

/** Neutral stand-in figure (cm). Head centre at origin, body below. Replaced by authorized asset later. */
export function buildFigure(color: number, label: string, unit = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 });
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

/** Companion that stands beside the tracked user, following head position, distance and height (sit/stand). */
export function companionRuntime(
  layers: SceneLayers,
  opts: { color: number; label: string; offset: { x: number; y: number; z: number }; scale: number },
): SceneRuntime {
  addLights(layers.back);
  const fig = buildFigure(opts.color, opts.label);
  fig.scale.setScalar(opts.scale);
  fig.visible = false;
  layers.back.add(fig);
  const target = new THREE.Vector3();
  let lost = 0;
  let side = 1;
  return {
    update(t: TrackingFrame) {
      if (t.head) {
        lost = 0;
        // Pick the side with more free room in frame (camera space x: + is image right, unmirrored).
        side = t.head.x > 4 ? -1 : t.head.x < -4 ? 1 : side;
        const depthScale = Math.abs(t.head.z) / 60; // keep spacing proportional with distance
        target.set(
          t.head.x + side * opts.offset.x * Math.max(0.6, depthScale),
          t.head.y + opts.offset.y,
          t.head.z + opts.offset.z,
        );
        if (!fig.visible) fig.position.copy(target);
        fig.position.lerp(target, Math.min(1, t.dt * 8));
        fig.lookAt(t.head.x * 0.3, fig.position.y, 0);
        fig.visible = true;
      } else {
        lost += t.dt;
        if (lost > 1.2) fig.visible = false;
      }
    },
  };
}

/** BJP Look: cap anchored to head (face 6DoF), scarf anchored to shoulders (body pose). */
export function lookRuntime(layers: SceneLayers): SceneRuntime {
  addLights(layers.front);
  const saffron = new THREE.MeshStandardMaterial({ color: 0xff8a1f, roughness: 0.6 });
  const green = new THREE.MeshStandardMaterial({ color: 0x138a3d, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.6 });

  const headAnchor = new THREE.Group();
  headAnchor.matrixAutoUpdate = false;
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
  cap.position.set(0, 5.5, -1.5);
  cap.rotation.x = -0.12;
  headAnchor.add(cap);
  headAnchor.visible = false;
  layers.front.add(headAnchor);

  // Scarf: draped tube built in unit space (shoulder-to-shoulder = 1), scaled per frame.
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
  scarf.visible = false;
  layers.front.add(scarf);

  const mid = new THREE.Vector3();
  let lostH = 0;
  let lostS = 0;
  return {
    update(t) {
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
        scarf.position.lerp(mid, scarf.visible ? Math.min(1, t.dt * 12) : 1);
        scarf.scale.setScalar(w);
        scarf.rotation.z = Math.atan2(right.y - left.y, right.x - left.x) + (right.x < left.x ? Math.PI : 0);
        scarf.visible = true;
        lostS = 0;
      } else if ((lostS += t.dt) > 0.4) scarf.visible = false;
    },
  };
}

/** Metre-scale world AR stand-in (1.7 m) for floor placement. */
export function worldFigure(color: number, label: string) {
  const g = new THREE.Group();
  const fig = buildFigure(color, label, 0.01);
  fig.position.y = 1.6;
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
  );
  disc.position.y = 0.002;
  g.add(fig, disc);
  return g;
}
