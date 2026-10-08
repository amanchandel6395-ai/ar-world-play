import type * as THREE from "three";
import type { InteractionId, PublicConfig } from "@/lib/config";

export type AssetType = "placeholder-3d" | "transparent-2d" | "multi-pose-2d" | "rigged-3d";
export type TrackingMode = "face" | "body" | "face+body";
export type AnchorKind = "beside-user" | "head" | "shoulders" | "floor";
export type BodyState = "standing" | "sitting" | "partial" | "unknown";

/** Visible part of the video (normalized 0..1) after object-cover cropping to the viewport. */
export type ViewBounds = { uMin: number; uMax: number; vMin: number; vMax: number };

/** Live tracking data handed to scenes every frame. Units: cm, MediaPipe face-geometry camera space. */
export type TrackingFrame = {
  faceMatrix: THREE.Matrix4 | null;
  head: THREE.Vector3 | null;
  shoulders: { left: THREE.Vector3; right: THREE.Vector3 } | null;
  bodyState: BodyState;
  distanceCm: number | null;
  dt: number;
  view: ViewBounds;
  /** true when the canvas is displayed mirrored (front camera) */
  mirrored: boolean;
  /** normalized image point → camera-space point at depth z (cm, negative) */
  unproject(u: number, v: number, z: number): THREE.Vector3;
  /** camera-space point → normalized image point */
  project(p: THREE.Vector3): { u: number; v: number };
};

export type SceneLayers = {
  /** Rendered behind the segmented person (gets occluded by the user). */
  back: THREE.Group;
  /** Rendered in front of the segmented person. */
  front: THREE.Group;
};

export type SceneContext = { config: PublicConfig; interaction: InteractionId };

export type SceneRuntime = {
  update(t: TrackingFrame): void;
  setInteraction?(id: InteractionId): void;
  reset?(): void;
  dispose?(): void;
  /** true when the scene currently shows a development stand-in instead of an authorized asset */
  standIn?: boolean;
};

export type SceneConfig = {
  id: "yogi" | "modi" | "bjp";
  tracking: TrackingMode;
  anchor: AnchorKind;
  occlusion: "segmentation" | "none";
  camera: { default: "user" | "environment"; worldAR: boolean };
  effects: { backgroundTint?: [number, number, number] | null };
  capture: { countdown: number };
  /** Builds 3D content into the shared engine layers. Never duplicates camera/tracking. */
  build(layers: SceneLayers, ctx: SceneContext): SceneRuntime;
  /** Builds a metre-scale object for world AR placement (optional). */
  buildWorld?(ctx: SceneContext): THREE.Object3D;
};
