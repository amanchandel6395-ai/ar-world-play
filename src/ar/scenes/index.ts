import type { SceneConfig } from "./types";
import { companionRuntime, lookRuntime, worldCompanion } from "./placeholders";

const companion = (id: "yogi" | "modi", color: number): SceneConfig => ({
  id,
  tracking: "face+body",
  anchor: "beside-user",
  occlusion: "segmentation",
  camera: { default: "user", worldAR: true },
  effects: { backgroundTint: null },
  capture: { countdown: 3 },
  build: (layers, ctx) => companionRuntime(layers, ctx, ctx.config.characters[id], color),
  buildWorld: (ctx) => worldCompanion(ctx, ctx.config.characters[id], color),
});

export const YOGI_SCENE = companion("yogi", 0xe8792b);
export const MODI_SCENE = companion("modi", 0xd9d4c7);

export const BJP_LOOK_SCENE: SceneConfig = {
  id: "bjp",
  tracking: "face+body",
  anchor: "head",
  occlusion: "segmentation",
  camera: { default: "user", worldAR: false },
  effects: { backgroundTint: [1.0, 0.55, 0.12] },
  capture: { countdown: 3 },
  build: (layers, ctx) => lookRuntime(layers, ctx),
};

export const SCENES = { yogi: YOGI_SCENE, modi: MODI_SCENE, bjp: BJP_LOOK_SCENE } as const;
export type SceneId = keyof typeof SCENES;
export const isSceneId = (s: string): s is SceneId => s in SCENES;
