import type { SceneConfig } from "./types";
import type { SceneRuntime } from "./types";
import { worldCompanion } from "./placeholders";

/**
 * Live camera shows only the plain camera picture: no leader cut-out, cap, scarf or flag is
 * drawn over the selfie. The chosen look is created afterwards by AI from the captured photo.
 */
const plainRuntime = (): SceneRuntime => ({ update() {} });

const companion = (id: "yogi" | "modi"): SceneConfig => ({
  id,
  tracking: "face+body",
  anchor: "beside-user",
  occlusion: "segmentation",
  camera: { default: "user", worldAR: true },
  effects: { backgroundTint: null },
  capture: { countdown: 3 },
  build: plainRuntime,
  buildWorld: (ctx) => worldCompanion(ctx, ctx.config.characters[id]),
});

export const YOGI_SCENE = companion("yogi");
export const MODI_SCENE = companion("modi");

export const BOTH_SCENE: SceneConfig = {
  id: "both",
  tracking: "face+body",
  anchor: "beside-user",
  occlusion: "segmentation",
  camera: { default: "user", worldAR: false },
  effects: { backgroundTint: null },
  capture: { countdown: 3 },
  build: plainRuntime,
};

export const BJP_LOOK_SCENE: SceneConfig = {
  id: "bjp",
  tracking: "face+body",
  anchor: "head",
  occlusion: "segmentation",
  camera: { default: "user", worldAR: false },
  effects: { backgroundTint: null },
  capture: { countdown: 3 },
  build: plainRuntime,
};

export const SCENES = {
  yogi: YOGI_SCENE,
  modi: MODI_SCENE,
  both: BOTH_SCENE,
  bjp: BJP_LOOK_SCENE,
} as const;
export type SceneId = keyof typeof SCENES;
export const isSceneId = (s: string): s is SceneId => s in SCENES;
