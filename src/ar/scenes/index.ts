import type { SceneConfig } from "./types";
import { companionRuntime, lookRuntime, worldFigure } from "./placeholders";

const PENDING = "AUTHORIZED ASSET PENDING";

export const YOGI_SCENE: SceneConfig = {
  id: "yogi",
  title: "Selfie with CM Yogi Adityanath",
  subtitle: "Stand side by side in live AR",
  asset: { type: "placeholder-3d", url: null, authorized: false, label: PENDING },
  tracking: "face+body",
  anchor: "beside-user",
  scale: 1,
  position: { x: 48, y: 2, z: -10 },
  occlusion: "segmentation",
  camera: { default: "user", worldAR: true },
  effects: { backgroundTint: null },
  capture: {
    countdown: 3,
    aiEnhance: true,
    aiPrompt: "Enhance this photo: professional portrait lighting, crisp detail, warm cinematic tones. Keep every person, pose and face exactly as they are.",
  },
  build(layers) {
    return companionRuntime(layers, { color: 0xe8792b, label: PENDING, offset: this.position, scale: this.scale });
  },
  buildWorld: () => worldFigure(0xe8792b, PENDING),
};

export const MODI_SCENE: SceneConfig = {
  ...YOGI_SCENE,
  id: "modi",
  title: "Selfie with PM Narendra Modi",
  subtitle: "Stand side by side in live AR",
  build(layers) {
    return companionRuntime(layers, { color: 0xd9d4c7, label: PENDING, offset: this.position, scale: this.scale });
  },
  buildWorld: () => worldFigure(0xd9d4c7, PENDING),
};

export const BJP_LOOK_SCENE: SceneConfig = {
  id: "bjp",
  title: "BJP Look",
  subtitle: "Cap and scarf that move with you",
  asset: { type: "placeholder-3d", url: null, authorized: false, label: "Stand-in styling assets" },
  tracking: "face+body",
  anchor: "head",
  scale: 1,
  position: { x: 0, y: 0, z: 0 },
  occlusion: "segmentation",
  camera: { default: "user", worldAR: false },
  effects: { backgroundTint: [1.0, 0.55, 0.12] },
  capture: {
    countdown: 3,
    aiEnhance: true,
    aiPrompt: "Enhance this photo with festive saffron and green stage lighting and soft bokeh background. Keep the person, face, pose, cap and scarf exactly as they are.",
  },
  build: (layers) => lookRuntime(layers),
};

export const SCENES = { yogi: YOGI_SCENE, modi: MODI_SCENE, bjp: BJP_LOOK_SCENE } as const;
export type SceneId = keyof typeof SCENES;
export const isSceneId = (s: string): s is SceneId => s in SCENES;
