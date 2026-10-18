/* eslint-disable @typescript-eslint/no-explicit-any */
export type Caps = {
  camera: boolean;
  webgl: boolean;
  wasm: boolean;
  faceTracking: boolean;
  bodyTracking: boolean;
  segmentation: boolean;
  worldAR: boolean;
};

export async function detectCapabilities(): Promise<Caps> {
  const camera = !!navigator.mediaDevices?.getUserMedia;
  let webgl = false;
  try {
    webgl = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    /* none */
  }
  const wasm = typeof WebAssembly === "object";
  const ml = camera && webgl && wasm;
  let worldAR = false;
  try {
    worldAR = !!(await (navigator as any).xr?.isSessionSupported?.("immersive-ar"));
  } catch {
    worldAR = false;
  }
  return { camera, webgl, wasm, faceTracking: ml, bodyTracking: ml, segmentation: ml, worldAR };
}
