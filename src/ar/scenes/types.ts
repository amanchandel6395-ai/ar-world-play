import type * as THREE from "three";

export type AssetType = "placeholder-3d" | "transparent-2d" | "multi-pose-2d" | "rigged-3d";
export type TrackingMode = "face" | "body" | "face+body";
export type AnchorKind = "beside-user" | "head" | "shoulders" | "floor";
export type BodyState = "standing" | "sitting" | "partial" | "unknown";

/** Live tracking data handed to scenes every frame. Units: cm, MediaPipe face-geometry camera space. */
export type TrackingFrame = {
  faceMatrix: THREE.Matrix4 | null;
  head: THREE.Vector3 | null;
  shoulders: { left: THREE.Vector3; right: THREE.Vector3 } | null;
  bodyState: BodyState;
  distanceCm: number | null;
  dt: number;
};

export type SceneLayers = {
  /** Rendered behind the segmented person (gets occluded by the user). */
  back: THREE.Group;
  /** Rendered in front of the segmented person. */
  front: THREE.Group;
};

export type SceneRuntime = { update(t: TrackingFrame): void; dispose?(): void };

export type SceneConfig = {
  id: "yogi" | "modi" | "bjp";
  title: string;
  subtitle: string;
  asset: {
    type: AssetType;
    /** URL of the authorized asset (GLB / PNG set). null until a licensed asset is connected. */
    url: string | null;
    authorized: boolean;
    label: string;
  };
  tracking: TrackingMode;
  anchor: AnchorKind;
  scale: number;
  /** Offset from anchor, cm. x is user-relative side. */
  position: { x: number; y: number; z: number };
  occlusion: "segmentation" | "none";
  camera: { default: "user" | "environment"; worldAR: boolean };
  effects: { backgroundTint?: [number, number, number] | null };
  capture: { countdown: number; aiEnhance: boolean; aiPrompt: string };
  /** Builds 3D content into the shared engine layers. Never duplicates camera/tracking. */
  build(layers: SceneLayers): SceneRuntime;
  /** Builds a metre-scale object for world AR placement (optional). */
  buildWorld?(): THREE.Object3D;
};
