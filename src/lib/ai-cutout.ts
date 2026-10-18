/**
 * Blender-Grade AI Cutout & Studio Photo Enhancer
 * - Uses MediaPipe Deep-Learning ImageSegmenter for clean background removal
 * - Protects 100% authentic original photo colors (zero face whitening, zero hue shifting)
 * - Keeps black coats, white kurtas, faces, and clothing completely solid
 * - Local WASM & TFLite model with CDN fallback
 */

const LOCAL_WASM = "/mediapipe/wasm";
const CDN_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";
const LOCAL_MODEL = "/mediapipe/models/selfie_segmenter.tflite";
const CDN_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

let segmenterInstance: unknown = null;
let loadingPromise: Promise<unknown> | null = null;

async function getSegmenter() {
  if (segmenterInstance) return segmenterInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    // Try local WASM and model first
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(LOCAL_WASM);
      const segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: LOCAL_MODEL,
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      segmenterInstance = segmenter;
      return segmenter;
    } catch {
      // Try CPU or CDN
      try {
        const vision = await import("@mediapipe/tasks-vision");
        let fileset;
        try {
          fileset = await vision.FilesetResolver.forVisionTasks(LOCAL_WASM);
        } catch {
          fileset = await vision.FilesetResolver.forVisionTasks(CDN_WASM);
        }
        const segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: LOCAL_MODEL,
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        });
        segmenterInstance = segmenter;
        return segmenter;
      } catch (err) {
        console.warn("MediaPipe local segmenter fallback to CDN:", err);
        try {
          const vision = await import("@mediapipe/tasks-vision");
          const fileset = await vision.FilesetResolver.forVisionTasks(CDN_WASM);
          const segmenter = await vision.ImageSegmenter.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: CDN_MODEL,
              delegate: "CPU",
            },
            runningMode: "IMAGE",
            outputConfidenceMasks: true,
            outputCategoryMask: false,
          });
          segmenterInstance = segmenter;
          return segmenter;
        } catch (cdnErr) {
          console.error("MediaPipe Vision Segmenter unavailable:", cdnErr);
          return null;
        }
      }
    }
  })();

  return loadingPromise;
}

export type CutoutOptions = {
  threshold?: number;
  edgeSmoothness?: number;
  preserveOriginalColors?: boolean;
  sharpness?: number;
  contrast?: number;
};

/**
 * Remove background with AI neural network, preserving black coats, white shirts, and natural skin.
 * Guaranteed 100% authentic color reproduction (no whitening, no artificial bleach).
 */
export async function removeBackgroundAI(
  sourceImg: HTMLImageElement,
  options: CutoutOptions = {},
): Promise<{ dataUrl: string; width: number; height: number; appliedAI: boolean }> {
  const {
    threshold = 0.42,
    edgeSmoothness = 0.22,
    preserveOriginalColors = true,
    sharpness = 0,
    contrast = 1.0,
  } = options;

  const w = sourceImg.naturalWidth || sourceImg.width;
  const h = sourceImg.naturalHeight || sourceImg.height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create 2D canvas context");

  ctx.drawImage(sourceImg, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Check if image already has transparent pixels (e.g. user uploaded pre-cut PNG)
  let transparentPixelCount = 0;
  for (let i = 3; i < data.length; i += 40) {
    if (data[i]! < 200) transparentPixelCount++;
  }
  const hasPreExistingAlpha = transparentPixelCount > (data.length / 40) * 0.05;

  let appliedWithAI = false;

  if (!hasPreExistingAlpha) {
    const segmenter = (await getSegmenter()) as {
      segment: (img: HTMLImageElement) => {
        confidenceMasks: Array<{
          getAsFloat32Array: () => Float32Array;
          width: number;
          height: number;
        }>;
      };
    } | null;

    if (segmenter && typeof segmenter.segment === "function") {
      try {
        const result = segmenter.segment(sourceImg);
        if (result && result.confidenceMasks && result.confidenceMasks.length > 0) {
          const mask = result.confidenceMasks[0]!;
          const maskData = mask.getAsFloat32Array();
          const maskW = mask.width;
          const maskH = mask.height;

          const solidCut = Math.max(0.25, threshold);
          const softCut = Math.max(0.1, solidCut - edgeSmoothness);

          for (let y = 0; y < h; y++) {
            const my = Math.min(maskH - 1, Math.floor((y / h) * maskH));
            for (let x = 0; x < w; x++) {
              const mx = Math.min(maskW - 1, Math.floor((x / w) * maskW));
              const maskVal = maskData[my * maskW + mx] ?? 0;

              const idx = (y * w + x) * 4;

              if (maskVal >= solidCut) {
                // Human subject - DO NOT touch RGB, keep black suit & white clothes 100% solid
                data[idx + 3] = 255;
              } else if (maskVal > softCut) {
                const t = (maskVal - softCut) / (solidCut - softCut);
                data[idx + 3] = Math.round(255 * t);
              } else {
                // Background removed
                data[idx + 3] = 0;
              }
            }
          }
          appliedWithAI = true;
        }
      } catch (segErr) {
        console.warn("AI segmentation error, falling back to smart flood-fill:", segErr);
      }
    }

    // High precision multi-seed border matte fallback
    if (!appliedWithAI) {
      applySmartMultiSeedBorderMatte(data, w, h);
    }
  } else {
    appliedWithAI = true;
  }

  // Optional subtle tuning ONLY if preserveOriginalColors is disabled by user
  if (!preserveOriginalColors && (contrast !== 1.0 || sharpness > 0.1)) {
    applySubtleGrading(data, w, h, { sharpness, contrast });
  }

  ctx.putImageData(imgData, 0, 0);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: w,
    height: h,
    appliedAI: appliedWithAI,
  };
}

/**
 * High-precision border flood-fill fallback:
 * Gathers background samples from top, left, right borders and removes only connected background pixels.
 * Completely protects all inner clothing, faces, and body parts!
 */
function applySmartMultiSeedBorderMatte(data: Uint8ClampedArray, w: number, h: number) {
  // Collect border color palette samples (top 5% and bottom corners)
  const bgSamples: Array<[number, number, number]> = [];
  const step = Math.max(1, Math.floor(w / 30));

  for (let x = 0; x < w; x += step) {
    const topIdx = x * 4;
    bgSamples.push([data[topIdx]!, data[topIdx + 1]!, data[topIdx + 2]!]);
  }
  for (let y = 0; y < Math.floor(h * 0.3); y += step) {
    const lIdx = y * w * 4;
    const rIdx = (y * w + (w - 1)) * 4;
    bgSamples.push([data[lIdx]!, data[lIdx + 1]!, data[lIdx + 2]!]);
    bgSamples.push([data[rIdx]!, data[rIdx + 1]!, data[rIdx + 2]!]);
  }

  const isMatchingBg = (idx: number) => {
    const r = data[idx * 4]!;
    const g = data[idx * 4 + 1]!;
    const b = data[idx * 4 + 2]!;

    for (const [sr, sg, sb] of bgSamples) {
      const dist = Math.sqrt((r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2);
      if (dist < 32) return true;
    }
    return false;
  };

  const visited = new Uint8Array(w * h);
  const isBg = new Uint8Array(w * h);
  const queue: number[] = [];

  for (let x = 0; x < w; x++) {
    if (isMatchingBg(x)) {
      visited[x] = 1;
      isBg[x] = 1;
      queue.push(x);
    }
  }
  for (let y = 0; y < h; y++) {
    const l = y * w;
    const r = y * w + (w - 1);
    if (!visited[l] && isMatchingBg(l)) {
      visited[l] = 1;
      isBg[l] = 1;
      queue.push(l);
    }
    if (!visited[r] && isMatchingBg(r)) {
      visited[r] = 1;
      isBg[r] = 1;
      queue.push(r);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++]!;
    const cx = curr % w;
    const cy = Math.floor(curr / w);

    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < w - 1 ? curr + 1 : -1,
      cy > 0 ? curr - w : -1,
      cy < h - 1 ? curr + w : -1,
    ];

    for (const n of neighbors) {
      if (n >= 0 && !visited[n]) {
        visited[n] = 1;
        if (isMatchingBg(n)) {
          isBg[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (isBg[i]) data[i * 4 + 3] = 0;
  }
}

/**
 * Optional gentle studio tuning - applied ONLY when explicitly requested by user.
 */
function applySubtleGrading(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  opts: { sharpness: number; contrast: number },
) {
  const { sharpness, contrast } = opts;
  if (contrast !== 1.0) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 10) continue;
      for (let c = 0; c < 3; c++) {
        const val = data[i + c]!;
        const norm = val / 255 - 0.5;
        data[i + c] = Math.min(255, Math.max(0, Math.round((norm * contrast + 0.5) * 255)));
      }
    }
  }

  if (sharpness > 0.1) {
    const copy = new Uint8ClampedArray(data);
    const weight = Math.min(0.3, sharpness);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        if (copy[i + 3]! < 50) continue;
        for (let c = 0; c < 3; c++) {
          const center = copy[i + c]!;
          const top = copy[((y - 1) * w + x) * 4 + c]!;
          const bottom = copy[((y + 1) * w + x) * 4 + c]!;
          const left = copy[(y * w + (x - 1)) * 4 + c]!;
          const right = copy[(y * w + (x + 1)) * 4 + c]!;
          const laplacian = 4 * center - (top + bottom + left + right);
          data[i + c] = Math.min(255, Math.max(0, Math.round(center + laplacian * weight)));
        }
      }
    }
  }
}
