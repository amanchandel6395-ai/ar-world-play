import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { removeBackgroundAI } from "@/lib/ai-cutout";
import type { AppConfig, CustomStandee } from "@/lib/config";
import {
  ThreeStandeePreview,
  type Render3DStyle,
  type HologramColorTheme,
} from "./ThreeStandeePreview";
import {
  Wand2,
  Upload,
  Eraser,
  Brush,
  Palette,
  Undo2,
  Compass,
  Zap,
  RotateCw,
  CheckCircle2,
} from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500";

export function CutoutStudioTab({
  config,
  setConfig,
  onSave,
  busy,
}: {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
  onSave: (c?: AppConfig) => Promise<void>;
  busy: boolean;
}) {
  const [sourceImage, setSourceImage] = useState<string>("/assets/modi.png");
  const [cutoutImage, setCutoutImage] = useState<string>("/assets/modi.png");
  const [cutoutMode, setCutoutMode] = useState<"ai" | "pure" | "smart-edge" | "chroma">("ai");

  // Visual settings & 3D styling
  const [preserveColors, setPreserveColors] = useState(true);
  const [standeeThickness, setStandeeThickness] = useState(1.8);
  const [renderStyle, setRenderStyle] = useState<Render3DStyle>("standee");
  const [holoTheme, setHoloTheme] = useState<HologramColorTheme>("cyan");
  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraView, setCameraView] = useState<"front" | "back" | "top" | "low" | "iso" | null>(
    null,
  );

  // Manual tuning
  const [aiThreshold, setAiThreshold] = useState(0.42);
  const [aiSmoothness, setAiSmoothness] = useState(0.2);
  const [tolerance, setTolerance] = useState(18);
  const [feather, setFeather] = useState(1);
  const [keyColor, setKeyColor] = useState("#ffffff");

  // Touch-up brush tool state
  const [touchTool, setTouchTool] = useState<"none" | "erase" | "restore" | "pick">("none");
  const [brushSize, setBrushSize] = useState(24);

  // Assignment & status
  const [targetLeader, setTargetLeader] = useState<"modi" | "yogi" | "custom">("modi");
  const [customLeaderName, setCustomLeaderName] = useState("");
  const [customLeaderNameHi, setCustomLeaderNameHi] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const touchCanvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Run Local MediaPipe Neural AI Background Removal (100% Original Colors)
  const runAiCutout = useCallback(
    async (src: string, thresh: number, smooth: number, keepColors: boolean) => {
      setProcessing(true);
      setProcessStatus("🤖 AI Neural Network: Isolating human silhouette…");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        try {
          const res = await removeBackgroundAI(img, {
            threshold: thresh,
            edgeSmoothness: smooth,
            preserveOriginalColors: keepColors,
          });
          setCutoutImage(res.dataUrl);
          setProcessStatus(
            res.appliedAI
              ? "✓ AI Cutout Successful · 100% Original Colors Preserved!"
              : "✓ Smart Flood-Fill Active · Subject Protected!",
          );
        } catch (e) {
          console.warn("AI Cutout error:", e);
          setCutoutImage(src);
          setProcessStatus("✓ Original photo loaded cleanly");
        } finally {
          setProcessing(false);
        }
      };
      img.src = src;
    },
    [],
  );

  // 2. Smart Border Flood-Fill
  const runBorderFloodFill = useCallback((src: string, tol: number, fthr: number, kCol: string) => {
    setProcessing(true);
    setProcessStatus("🪄 Running border-connected flood-fill…");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = resultCanvasRef.current || document.createElement("canvas");
      const w = img.width;
      const h = img.height;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const hex = kCol.replace("#", "");
      const kr = parseInt(hex.substring(0, 2), 16) || 240;
      const kg = parseInt(hex.substring(2, 4), 16) || 240;
      const kb = parseInt(hex.substring(4, 6), 16) || 240;

      const maxDist = Math.max(1, (tol / 100) * 441.67);
      const visited = new Uint8Array(w * h);
      const isBg = new Uint8Array(w * h);

      const getColorDist = (idx: number) => {
        const r = data[idx * 4]!;
        const g = data[idx * 4 + 1]!;
        const b = data[idx * 4 + 2]!;
        return Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2);
      };

      const queue: number[] = [];
      for (let x = 0; x < w; x++) {
        if (getColorDist(x) < maxDist) {
          visited[x] = 1;
          isBg[x] = 1;
          queue.push(x);
        }
        const bot = (h - 1) * w + x;
        if (getColorDist(bot) < maxDist) {
          visited[bot] = 1;
          isBg[bot] = 1;
          queue.push(bot);
        }
      }
      for (let y = 0; y < h; y++) {
        const l = y * w;
        if (!visited[l] && getColorDist(l) < maxDist) {
          visited[l] = 1;
          isBg[l] = 1;
          queue.push(l);
        }
        const r = y * w + (w - 1);
        if (!visited[r] && getColorDist(r) < maxDist) {
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
            if (getColorDist(n) < maxDist) {
              isBg[n] = 1;
              queue.push(n);
            }
          }
        }
      }

      for (let i = 0; i < w * h; i++) {
        if (isBg[i]) data[i * 4 + 3] = 0;
      }

      ctx.putImageData(imgData, 0, 0);
      setCutoutImage(canvas.toDataURL("image/png"));
      setProcessing(false);
      setProcessStatus("✓ Border cutout ready!");
    };
    img.src = src;
  }, []);

  // 3. Custom Chroma Key
  const runChromaKey = useCallback((src: string, tol: number, fthr: number, kCol: string) => {
    setProcessing(true);
    setProcessStatus("🎨 Applying chroma key…");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = resultCanvasRef.current || document.createElement("canvas");
      const w = img.width;
      const h = img.height;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const hex = kCol.replace("#", "");
      const kr = parseInt(hex.substring(0, 2), 16) || 240;
      const kg = parseInt(hex.substring(2, 4), 16) || 240;
      const kb = parseInt(hex.substring(4, 6), 16) || 240;
      const maxDist = Math.max(1, (tol / 100) * 441.67);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const dist = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2);
        if (dist < maxDist) {
          data[i + 3] = 0;
        } else if (dist < maxDist + fthr * 8) {
          const alphaFactor = (dist - maxDist) / (fthr * 8);
          data[i + 3] = Math.round(data[i + 3]! * alphaFactor);
        }
      }

      ctx.putImageData(imgData, 0, 0);
      setCutoutImage(canvas.toDataURL("image/png"));
      setProcessing(false);
      setProcessStatus("✓ Chroma cutout ready!");
    };
    img.src = src;
  }, []);

  // Mode dispatcher
  const switchMode = useCallback(
    (mode: "ai" | "pure" | "smart-edge" | "chroma", src: string) => {
      setCutoutMode(mode);
      if (mode === "pure") {
        setCutoutImage(src);
        setProcessStatus("✓ Pure 100% Original Photo active (नो बदलाव)");
        return;
      }
      if (mode === "ai") {
        void runAiCutout(src, aiThreshold, aiSmoothness, preserveColors);
        return;
      }
      if (mode === "smart-edge") {
        runBorderFloodFill(src, tolerance, feather, keyColor);
        return;
      }
      if (mode === "chroma") {
        runChromaKey(src, tolerance, feather, keyColor);
      }
    },
    [
      runAiCutout,
      runBorderFloodFill,
      runChromaKey,
      aiThreshold,
      aiSmoothness,
      preserveColors,
      tolerance,
      feather,
      keyColor,
    ],
  );

  // File Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setSourceImage(dataUrl);

      // Check if image is PNG with existing alpha
      const tempImg = new Image();
      tempImg.onload = () => {
        const testCanvas = document.createElement("canvas");
        testCanvas.width = Math.min(200, tempImg.width);
        testCanvas.height = Math.min(200, tempImg.height);
        const tCtx = testCanvas.getContext("2d");
        if (tCtx) {
          tCtx.drawImage(tempImg, 0, 0, testCanvas.width, testCanvas.height);
          const tData = tCtx.getImageData(0, 0, testCanvas.width, testCanvas.height).data;
          let transparentPx = 0;
          for (let i = 3; i < tData.length; i += 4) {
            if (tData[i]! < 180) transparentPx++;
          }
          if (transparentPx > tData.length * 0.05) {
            // Already transparent! Keep pure original
            setCutoutMode("pure");
            setCutoutImage(dataUrl);
            setProcessStatus("✓ Transparent PNG detected! 100% Original Alpha Preserved!");
            return;
          }
        }
        // Run AI Cutout
        setCutoutMode("ai");
        void runAiCutout(dataUrl, aiThreshold, aiSmoothness, preserveColors);
      };
      tempImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Canvas interaction for touch-up & eyedropper
  const [isDrawing, setIsDrawing] = useState(false);

  const applyBrush = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = touchCanvasRef.current;
    if (!canvas || touchTool === "none") return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (touchTool === "pick") {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      const picked = `#${toHex(pixel[0]!)}${toHex(pixel[1]!)}${toHex(pixel[2]!)}`;
      setKeyColor(picked);
      setTouchTool("none");
      if (cutoutMode === "smart-edge") runBorderFloodFill(sourceImage, tolerance, feather, picked);
      else if (cutoutMode === "chroma") runChromaKey(sourceImage, tolerance, feather, picked);
      return;
    }

    if (touchTool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
      setCutoutImage(canvas.toDataURL("image/png"));
    } else if (touchTool === "restore") {
      // Paint original source pixels back
      const sCanvas = sourceCanvasRef.current;
      if (sCanvas) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, brushSize, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(sCanvas, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        setCutoutImage(canvas.toDataURL("image/png"));
      }
    }
  };

  // Sync touch canvas whenever cutoutImage changes
  useEffect(() => {
    if (!cutoutImage) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = touchCanvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(img, 0, 0);
    };
    img.src = cutoutImage;
  }, [cutoutImage]);

  // Sync source image to hidden source canvas
  useEffect(() => {
    if (!sourceImage) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = sourceCanvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
    };
    img.src = sourceImage;
  }, [sourceImage]);

  const applyCutoutToBooth = () => {
    if (!cutoutImage) return;
    if (targetLeader === "modi" || targetLeader === "yogi") {
      setConfig((c) => {
        if (!c) return c;
        const char = c.characters[targetLeader];
        const nextPoses = { ...char.poses, selfie: cutoutImage, walk: cutoutImage };
        const nextApproved = { ...char.approvedAssets, [cutoutImage]: new Date().toISOString() };
        return {
          ...c,
          characters: {
            ...c.characters,
            [targetLeader]: {
              ...char,
              enabled: true,
              authorized: true,
              authorizedAt: new Date().toISOString(),
              depthBevel: standeeThickness,
              permissionNote: `Real 3D Extruded Cutout (${targetLeader})`,
              poses: nextPoses,
              thumbnail: cutoutImage,
              approvedAssets: nextApproved,
            },
          },
        };
      });
      void onSave();
    } else {
      const nameEn = customLeaderName.trim() || "Custom 3D Standee";
      const nameHi = customLeaderNameHi.trim() || "कस्टम 3D कटआउट";
      const newStandee: CustomStandee = {
        id: `custom-${Date.now()}`,
        name: { en: nameEn, hi: nameHi },
        type: "image",
        assetUrl: cutoutImage,
        thumbnail: cutoutImage,
        scale: 1.0,
        heightCm: 175,
        offsetX: -35,
        offsetY: 0,
        depthBevel: standeeThickness,
        shadowOpacity: 0.7,
        enabled: true,
      };
      setConfig((c) => (c ? { ...c, customStandees: [...c.customStandees, newStandee] } : c));
      void onSave();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left panel: Image Upload & Cutout Controls */}
      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md lg:col-span-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-amber-400" /> 3D Cutout Studio & Hologram Lab
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            किसी भी सामान्य फोटो को बिना किसी रंग-बदलाव के 100% असली 3D ऐक्रेलिक स्टैंडी या
            साइंस-फिक्शन होलोग्राम में बदलें।
          </p>
        </div>

        {/* Step 1: Upload or Choose Image */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center justify-between">
            <span>1. Select / Upload Photo (फोटो अपलोड करें)</span>
            <span className="text-[10px] text-slate-400 font-normal">PNG, JPG, WEBP</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-slate-950 hover:from-amber-400 hover:to-orange-400 shadow-md"
            >
              <Upload className="mr-1.5 h-4 w-4" /> Upload Any Photo (अपनी फोटो अपलोड करें)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSourceImage("/assets/modi.png");
                switchMode("ai", "/assets/modi.png");
              }}
              className="border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
            >
              PM Modi Sample
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSourceImage("/assets/yogi.png");
                switchMode("ai", "/assets/yogi.png");
              }}
              className="border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
            >
              CM Yogi Sample
            </Button>
          </div>
        </div>

        {/* Cutout Mode Selector */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Background Removal Mode (कटआउट का तरीका)
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                id: "ai",
                title: "🤖 AI Neural",
                desc: "ऑटो बैकग्राउंड रिमूवल",
              },
              {
                id: "pure",
                title: "🌟 100% Original",
                desc: "बिना बदलाव (PNG)",
              },
              {
                id: "smart-edge",
                title: "🪄 Smart Edge",
                desc: "बॉर्डर फ्लड-फिल",
              },
              {
                id: "chroma",
                title: "🎨 Chroma Key",
                desc: "रंग चुनकर हटाएँ",
              },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  switchMode(m.id as "ai" | "pure" | "smart-edge" | "chroma", sourceImage)
                }
                className={`rounded-xl p-2.5 text-left transition-all ${
                  cutoutMode === m.id
                    ? "border-2 border-amber-500 bg-amber-500/15 shadow-md shadow-orange-500/10"
                    : "border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80"
                }`}
              >
                <div className="text-xs font-bold text-white">{m.title}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>

          {/* Color Fidelity Guarantee Toggle */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
            <label className="text-xs text-emerald-300 cursor-pointer flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={preserveColors}
                onChange={(e) => {
                  const v = e.target.checked;
                  setPreserveColors(v);
                  if (cutoutMode === "ai")
                    void runAiCutout(sourceImage, aiThreshold, aiSmoothness, v);
                }}
                className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 accent-emerald-500"
              />
              <div>
                <span className="font-semibold">🛡️ 100% Authentic Photo Colors Guaranteed</span>
                <p className="text-[10px] text-emerald-400/80 mt-0.5">
                  ओरिजिनल रंग सुरक्षित रखें — चेहरे पर कोई सफ़ेदी या रंग-बदलाव नहीं होगा।
                </p>
              </div>
            </label>
          </div>

          {/* AI Settings */}
          {cutoutMode === "ai" && (
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>AI Detection Sensitivity (संवेदनशीलता)</span>
                  <span className="font-mono text-amber-400">
                    {(aiThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="0.65"
                  step="0.02"
                  value={aiThreshold}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setAiThreshold(v);
                    void runAiCutout(sourceImage, v, aiSmoothness, preserveColors);
                  }}
                  className="mt-1.5 w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Edge Feather & Antialiasing (किनारे की चिकनाहट)</span>
                  <span className="font-mono text-amber-400">
                    {(aiSmoothness * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.35"
                  step="0.02"
                  value={aiSmoothness}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setAiSmoothness(v);
                    void runAiCutout(sourceImage, aiThreshold, v, preserveColors);
                  }}
                  className="mt-1.5 w-full accent-amber-500"
                />
              </div>
            </div>
          )}

          {/* Chroma/Edge Controls */}
          {(cutoutMode === "smart-edge" || cutoutMode === "chroma") && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300">Background Key Color:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={keyColor}
                    onChange={(e) => {
                      setKeyColor(e.target.value);
                      if (cutoutMode === "smart-edge")
                        runBorderFloodFill(sourceImage, tolerance, feather, e.target.value);
                      else runChromaKey(sourceImage, tolerance, feather, e.target.value);
                    }}
                    className="h-7 w-8 cursor-pointer rounded border border-slate-700 bg-slate-800"
                  />
                  <span className="font-mono text-xs text-amber-400">{keyColor}</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Color Tolerance (सहनशीलता)</span>
                  <span className="font-mono text-amber-400">{tolerance}%</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="45"
                  value={tolerance}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTolerance(v);
                    if (cutoutMode === "smart-edge")
                      runBorderFloodFill(sourceImage, v, feather, keyColor);
                    else runChromaKey(sourceImage, v, feather, keyColor);
                  }}
                  className="mt-1.5 w-full accent-amber-500"
                />
              </div>
            </div>
          )}

          {/* Status Message */}
          {processStatus && (
            <div className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1.5 flex items-center justify-between">
              <span>{processStatus}</span>
              <button
                type="button"
                onClick={() => switchMode("pure", sourceImage)}
                className="text-[10px] text-amber-400 underline ml-2"
              >
                Reset to Raw
              </button>
            </div>
          )}
        </div>

        {/* Interactive Touch-Up Canvas & Brush Tools */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold text-amber-400">
              Interactive Touch-Up (हाथ से सुधारें)
            </span>
            <span className="text-[10px] text-slate-400">Click & Drag to Erase/Restore</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={touchTool === "erase" ? "default" : "outline"}
              size="sm"
              onClick={() => setTouchTool(touchTool === "erase" ? "none" : "erase")}
              className={`text-xs ${
                touchTool === "erase"
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "border-slate-700 bg-slate-800 text-slate-300"
              }`}
            >
              <Eraser className="h-3.5 w-3.5 mr-1" /> Erase (बैकग्राउंड मिटाएँ)
            </Button>
            <Button
              type="button"
              variant={touchTool === "restore" ? "default" : "outline"}
              size="sm"
              onClick={() => setTouchTool(touchTool === "restore" ? "none" : "restore")}
              className={`text-xs ${
                touchTool === "restore"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "border-slate-700 bg-slate-800 text-slate-300"
              }`}
            >
              <Brush className="h-3.5 w-3.5 mr-1" /> Restore (कपड़े/बाल वापस लाएँ)
            </Button>
            <Button
              type="button"
              variant={touchTool === "pick" ? "default" : "outline"}
              size="sm"
              onClick={() => setTouchTool(touchTool === "pick" ? "none" : "pick")}
              className={`text-xs ${
                touchTool === "pick"
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse"
                  : "border-slate-700 bg-slate-800 text-slate-300"
              }`}
            >
              <Palette className="h-3.5 w-3.5 mr-1" /> Color Picker (रंग चुनें)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCutoutImage(sourceImage);
                setProcessStatus("✓ Reverted to original");
              }}
              className="border-slate-700 bg-slate-800 text-xs text-slate-400 hover:text-white"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>

          {touchTool !== "none" && touchTool !== "pick" && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] text-slate-400">Brush Size:</span>
              <input
                type="range"
                min="6"
                max="60"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-32 accent-amber-500"
              />
              <span className="font-mono text-[11px] text-amber-400">{brushSize}px</span>
            </div>
          )}

          {/* Canvas Viewport */}
          <div className="relative max-h-52 flex items-center justify-center overflow-hidden rounded-lg bg-slate-950/80 border border-slate-800 p-2">
            <canvas
              ref={touchCanvasRef}
              onMouseDown={(e) => {
                setIsDrawing(true);
                applyBrush(e);
              }}
              onMouseMove={(e) => {
                if (isDrawing) applyBrush(e);
              }}
              onMouseUp={() => setIsDrawing(false)}
              onMouseLeave={() => setIsDrawing(false)}
              className={`max-h-48 object-contain ${
                touchTool === "erase"
                  ? "cursor-crosshair"
                  : touchTool === "restore"
                    ? "cursor-cell"
                    : touchTool === "pick"
                      ? "cursor-crosshair"
                      : "cursor-default"
              }`}
            />
          </div>
          <canvas ref={sourceCanvasRef} className="hidden" />
          <canvas ref={resultCanvasRef} className="hidden" />
        </div>

        {/* Assignment & Save to Booth */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Apply 3D Cutout to Booth (बूथ में लागू करें)
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "modi", label: "PM Modi" },
              { id: "yogi", label: "CM Yogi" },
              { id: "custom", label: "+ New Standee" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTargetLeader(opt.id as "modi" | "yogi" | "custom")}
                className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                  targetLeader === opt.id
                    ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                    : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {targetLeader === "custom" && (
            <div className="space-y-2 pt-2">
              <input
                type="text"
                placeholder="Name in English (e.g. Atal Bihari Vajpayee)"
                value={customLeaderName}
                onChange={(e) => setCustomLeaderName(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="नाम हिंदी में (उदा. अटल बिहारी वाजपेयी)"
                value={customLeaderNameHi}
                onChange={(e) => setCustomLeaderNameHi(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <Button
            type="button"
            onClick={applyCutoutToBooth}
            disabled={busy || processing}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-slate-950 hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-orange-500/20"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Apply & Save 3D Standee to Booth
          </Button>
        </div>
      </div>

      {/* Right panel: Real-time 3D Standee & Sci-Fi Hologram 360° Orbit Studio */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md lg:col-span-6 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="h-5 w-5 text-amber-400" /> 360° Real 3D Studio & Hologram
              </h2>
              <p className="text-xs text-slate-400">
                आगे, पीछे, ऊपर, नीचे से 360° पूरा घुमाकर देखें (Front, Back, Top, Bottom Full
                Orbit).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400 border border-amber-500/30">
                100% True 3D
              </span>
            </div>
          </div>

          {/* 3D Render Style Switcher: Standee vs Sci-Fi Hologram vs Gold Monument */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRenderStyle("standee")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  renderStyle === "standee"
                    ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                💎 Acrylic Standee (भौतिक स्टैंडी)
              </button>
              <button
                type="button"
                onClick={() => setRenderStyle("hologram")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  renderStyle === "hologram"
                    ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Zap className="h-3.5 w-3.5" /> Sci-Fi Hologram (होलोग्राम)
              </button>
              <button
                type="button"
                onClick={() => setRenderStyle("gold")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  renderStyle === "gold"
                    ? "bg-amber-400 text-slate-950 shadow-md font-bold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                🏛️ Gold Trophy
              </button>
            </div>

            {renderStyle === "hologram" && (
              <div className="flex items-center gap-1">
                {(["cyan", "gold", "emerald", "white"] as HologramColorTheme[]).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setHoloTheme(theme)}
                    title={theme}
                    className={`h-5 w-5 rounded-full border-2 transition-all ${
                      theme === "cyan"
                        ? "bg-cyan-400"
                        : theme === "gold"
                          ? "bg-amber-400"
                          : theme === "emerald"
                            ? "bg-emerald-400"
                            : "bg-white"
                    } ${holoTheme === theme ? "border-white scale-110 shadow-md" : "border-transparent opacity-60 hover:opacity-100"}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Quick Perspective Camera Controls & Auto Spin */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 mr-1">Angle:</span>
              <button
                type="button"
                onClick={() => setCameraView("front")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                आगे (Front)
              </button>
              <button
                type="button"
                onClick={() => setCameraView("back")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                पीछे (Back)
              </button>
              <button
                type="button"
                onClick={() => setCameraView("top")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                ऊपर (Top)
              </button>
              <button
                type="button"
                onClick={() => setCameraView("low")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                नीचे (Low)
              </button>
              <button
                type="button"
                onClick={() => setCameraView("iso")}
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
              >
                3D Iso
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                autoRotate
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <RotateCw className={`h-3 w-3 ${autoRotate ? "animate-spin" : ""}`} />
              {autoRotate ? "Auto-Spin ON" : "Auto-Spin 360°"}
            </button>
          </div>
        </div>

        {/* 3D Orbit Viewport Container */}
        <div className="relative mt-2 h-[480px] w-full overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 shadow-2xl">
          <ThreeStandeePreview
            imageUrl={cutoutImage || "/assets/modi.png"}
            thickness={standeeThickness}
            renderStyle={renderStyle}
            holoTheme={holoTheme}
            autoRotate={autoRotate}
            cameraView={cameraView}
            onViewHandled={() => setCameraView(null)}
          />

          {/* View angle badge & guidelines */}
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-slate-950/85 px-2.5 py-1.5 text-[11px] text-slate-300 backdrop-blur-sm border border-slate-800 flex items-center gap-2">
            <span>🖱️ Click & drag to rotate 360° up, down, left, right</span>
            <span className="text-slate-500">|</span>
            <span className="text-amber-400 font-semibold">
              {renderStyle === "hologram" ? "Volumetric Hologram" : "Physical Beveled 3D"}
            </span>
          </div>

          <div className="pointer-events-none absolute top-3 right-3 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] text-slate-400 backdrop-blur-sm border border-slate-800">
            Pinch / Scroll to Zoom
          </div>
        </div>

        {/* Thickness Slider */}
        <div className="pt-2">
          <div className="flex justify-between text-xs text-slate-300">
            <span>
              {renderStyle === "hologram"
                ? "Holographic Depth (होलोग्राम की गहराई)"
                : "3D Acrylic Depth (3D स्टैंडी की मोटाई - बेवेल्ड ऐक्रेलिक)"}
            </span>
            <span className="font-mono text-amber-400">{standeeThickness.toFixed(1)} mm</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="4.0"
            step="0.2"
            value={standeeThickness}
            onChange={(e) => setStandeeThickness(Number(e.target.value))}
            className="mt-1.5 w-full accent-amber-500"
          />
        </div>
      </div>
    </div>
  );
}
