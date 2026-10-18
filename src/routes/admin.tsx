import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import {
  adminLogin,
  adminStatus,
  adminSave,
  adminUploadUrl,
  adminPreview,
} from "@/lib/config.functions";
import {
  HINDI_SLOGANS,
  DEFAULT_CONFIG,
  mergeConfig,
  type AppConfig,
  type CharacterId,
  type CustomStandee,
  type SloganItem,
  type VideoCutoutConfig,
} from "@/lib/config";
import { CutoutStudioTab } from "@/components/admin/CutoutStudioTab";
import {
  Sparkles,
  Video,
  Image as ImageIcon,
  Sliders,
  Type,
  UserPlus,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  Play,
  Volume2,
  VolumeX,
  Layers,
  Wand2,
  Eye,
  ShieldCheck,
  Settings,
  RotateCw,
  Compass,
  Zap,
  Palette,
  Eraser,
  Brush,
  Undo2,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ZUITAR Studio Admin · 3D Cutouts & Materials" },
      {
        name: "description",
        content:
          "Studio administration: 3D photo cutouts, animated video standees, AI references, and dynamic slogans.",
      },
      { property: "og:title", content: "ZUITAR Studio Admin" },
      {
        property: "og:description",
        content: "3D Cutout Studio, Video Standees & Material Management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500";

type AdminTab = "cutouts" | "videos" | "characters" | "slogans" | "ai" | "backup";

export function AdminPage() {
  const login = useServerFn(adminLogin);
  const statusFn = useServerFn(adminStatus);
  const save = useServerFn(adminSave);

  const [status, setStatus] = useState<Awaited<ReturnType<typeof adminStatus>> | null>(null);
  const [password, setPassword] = useState("admin123");
  const [config, setConfig] = useState<AppConfig>(() => DEFAULT_CONFIG);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("cutouts");

  // Local storage persistence fallback
  const syncLocal = (cfg: AppConfig) => {
    try {
      localStorage.setItem("zuitar.adminConfig", JSON.stringify(cfg));
    } catch {
      // Local storage may be restricted in sandboxed iframes
    }
  };

  useEffect(() => {
    statusFn()
      .then(setStatus)
      .catch(() => {});

    // Auto-load latest config from server
    login({ data: { password: "admin123" } })
      .then((res) => {
        if (res.ok && res.config) {
          setConfig(mergeConfig(res.config));
        }
      })
      .catch(() => {
        try {
          const cached = localStorage.getItem("zuitar.adminConfig");
          if (cached) {
            setConfig(mergeConfig(JSON.parse(cached)));
          }
        } catch {
          // Local storage unavailable
        }
      });
  }, [statusFn, login]);

  const handleSave = async (cfgToSave?: AppConfig) => {
    const target = cfgToSave || config;
    if (!target) return;
    setBusy(true);
    setMessage("");
    try {
      syncLocal(target);
      await save({ data: { password: password || "admin123", config: target as never } });
      setMessage("✓ Configuration saved and updated live across booth!");
    } catch (e) {
      // Local fallback succeeds even if server storage is offline
      syncLocal(target);
      setMessage("✓ Saved to local booth memory (active immediately in browser)!");
    } finally {
      setBusy(false);
    }
  };

  const handleDemoSignIn = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await login({ data: { password: password || "admin123" } });
      if (res.ok && res.config) {
        setConfig(mergeConfig(res.config));
        syncLocal(mergeConfig(res.config));
        setMessage("Signed in successfully to ZUITAR Studio Admin.");
      } else {
        // Fallback to local default config
        setConfig(DEFAULT_CONFIG);
        syncLocal(DEFAULT_CONFIG);
        setMessage("Demo access active with default booth materials.");
      }
    } catch {
      setConfig(DEFAULT_CONFIG);
      syncLocal(DEFAULT_CONFIG);
      setMessage("Local offline mode active with standard materials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-950 shadow-lg shadow-orange-500/20">
              <Layers className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">ZUITAR Studio Admin</h1>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30">
                  सामग्री प्रबंधक
                </span>
              </div>
              <p className="text-xs text-slate-400">
                3D Cutouts, Animated Video Standees, AI Guidance & Dynamic Material Studio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            >
              <Link to="/" search={{ mode: "booth" }}>
                <Eye className="mr-1.5 h-4 w-4" /> Live Booth Screen
              </Link>
            </Button>
            {config && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={() => {
                  setConfig(null);
                  setMessage("");
                }}
              >
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Banner Messages */}
        {message && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span>{message}</span>
            <button
              onClick={() => setMessage("")}
              className="text-xs text-amber-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {!config ? (
          /* Login Card */
          <div className="mx-auto mt-12 max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 shadow-xl shadow-orange-500/20">
                <ShieldCheck className="h-8 w-8 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Studio Admin Access</h2>
              <p className="mt-1 text-xs text-slate-400">
                Enter admin password or use the 1-click demo access to manage materials.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleDemoSignIn();
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Default demo password: <code className="text-amber-400">admin123</code>
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-slate-950 hover:from-amber-400 hover:to-orange-400"
                >
                  {busy ? "Signing in…" : "Sign In to Studio"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setPassword("admin123");
                    void handleDemoSignIn();
                  }}
                  className="w-full border-slate-700 bg-slate-800/60 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  ⚡ Instant 1-Click Demo Login
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Main Admin Studio */
          <div className="space-y-6">
            {/* Navigation Tabs */}
            <nav className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1.5 backdrop-blur-md">
              {[
                { id: "cutouts", label: "3D Cutout Studio", icon: Wand2, sub: "इमेज से 3D कटआउट" },
                { id: "videos", label: "Video Cutouts", icon: Video, sub: "एनिमेटेड 3D वीडियो" },
                {
                  id: "characters",
                  label: "Characters & Standees",
                  icon: UserPlus,
                  sub: "पात्र प्रबंधन",
                },
                { id: "slogans", label: "Dynamic Slogans", icon: Type, sub: "नारे एवं स्लोगन" },
                {
                  id: "ai",
                  label: "AI Guidance & Prompts",
                  icon: Sparkles,
                  sub: "AI निर्देश व संदर्भ",
                },
                { id: "backup", label: "Backup & Export", icon: Settings, sub: "कॉन्फ़िग बैकअप" },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as AdminTab)}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                      active
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-orange-500/20"
                        : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] ${active ? "text-slate-900/80" : "text-slate-500"}`}
                    >
                      ({tab.sub})
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Tab 1: 3D Cutout Studio (Convert any normal image into realistic 3D standee) */}
            {activeTab === "cutouts" && (
              <CutoutStudioTab
                config={config}
                setConfig={setConfig}
                onSave={handleSave}
                busy={busy}
              />
            )}

            {/* Tab 2: 3D Video Cutouts */}
            {activeTab === "videos" && (
              <VideoCutoutTab
                config={config}
                setConfig={setConfig}
                onSave={handleSave}
                busy={busy}
              />
            )}

            {/* Tab 3: Characters & Standees Manager */}
            {activeTab === "characters" && (
              <CharactersTab
                config={config}
                setConfig={setConfig}
                onSave={handleSave}
                busy={busy}
              />
            )}

            {/* Tab 4: Dynamic Slogans */}
            {activeTab === "slogans" && (
              <SlogansTab config={config} setConfig={setConfig} onSave={handleSave} busy={busy} />
            )}

            {/* Tab 5: AI Guidance & References */}
            {activeTab === "ai" && (
              <AiGuidanceTab
                config={config}
                setConfig={setConfig}
                onSave={handleSave}
                busy={busy}
              />
            )}

            {/* Tab 6: Backup & Export */}
            {activeTab === "backup" && (
              <BackupTab config={config} setConfig={setConfig} onSave={handleSave} busy={busy} />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/** -------------------------------------------------------------------------
 * TAB 1: 3D CUTOUT STUDIO & HOLOGRAM LAB (Modular component)
 * ------------------------------------------------------------------------- */

/** -------------------------------------------------------------------------
 * TAB 2: 3D VIDEO CUTOUTS
 * Upload or enter MP4/WebM video cutouts with real-time Chroma Keying in AR!
 * ------------------------------------------------------------------------ */
function VideoCutoutTab({
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
  const [videoUrl, setVideoUrl] = useState(
    config.characters.modi.video?.url ||
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  );
  const [chromaEnabled, setChromaEnabled] = useState(
    config.characters.modi.video?.chromaKey.enabled ?? true,
  );
  const [chromaColor, setChromaColor] = useState(
    config.characters.modi.video?.chromaKey.color || "#00FF00",
  );
  const [similarity, setSimilarity] = useState(
    config.characters.modi.video?.chromaKey.similarity ?? 0.4,
  );
  const [smoothness, setSmoothness] = useState(
    config.characters.modi.video?.chromaKey.smoothness ?? 0.08,
  );
  const [muted, setMuted] = useState(true);
  const [targetChar, setTargetChar] = useState<"modi" | "yogi" | "custom">("modi");

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  const applyVideoToBooth = () => {
    const videoConfig: VideoCutoutConfig = {
      enabled: true,
      url: videoUrl,
      chromaKey: {
        enabled: chromaEnabled,
        color: chromaColor,
        similarity,
        smoothness,
      },
      muted,
      loop: true,
    };

    if (targetChar === "modi" || targetChar === "yogi") {
      setConfig((c) => {
        if (!c) return c;
        const char = c.characters[targetChar];
        return {
          ...c,
          characters: {
            ...c.characters,
            [targetChar]: {
              ...char,
              enabled: true,
              authorized: true,
              authorizedAt: new Date().toISOString(),
              permissionNote: `Admin assigned animated 3D video cutout (${targetChar})`,
              video: videoConfig,
            },
          },
        };
      });
      void onSave();
    } else {
      // Add custom video standee
      const newStandee: CustomStandee = {
        id: `video-standee-${Date.now()}`,
        name: { en: "Animated 3D Video Standee", hi: "एनिमेटेड 3D वीडियो स्टैन्डी" },
        type: "video",
        assetUrl: videoUrl,
        scale: 1.0,
        heightCm: 175,
        offsetX: -35,
        offsetY: 0,
        depthBevel: 1.2,
        shadowOpacity: 0.7,
        enabled: true,
        chromaKey: {
          enabled: chromaEnabled,
          color: chromaColor,
          similarity,
          smoothness,
        },
      };
      setConfig((c) => (c ? { ...c, customStandees: [...c.customStandees, newStandee] } : c));
      void onSave();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md lg:col-span-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Video className="h-5 w-5 text-amber-400" /> Animated 3D Video Cutout (वीडियो स्टैन्डी)
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Upload MP4 or WebM video (green-screen or transparent). The engine plays it in real-time
            AR beside the user as a moving 3D figure with audio and 3D contact shadow!
          </p>
        </div>

        {/* Video Source input */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">Video Source / File</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste Video URL (MP4 / WebM)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className={inputClass}
            />
            <input
              type="file"
              accept="video/*"
              ref={fileInputRef}
              onChange={handleVideoUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
            >
              <Upload className="mr-1 h-3.5 w-3.5" /> Upload MP4
            </Button>
          </div>
        </div>

        {/* Chroma Keying Settings */}
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Chroma Keying (हरा/नीला पर्दा हटाना)
            </span>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={chromaEnabled}
                onChange={(e) => setChromaEnabled(e.target.checked)}
                className="rounded accent-amber-500"
              />
              Enable Chroma Key
            </label>
          </div>

          {chromaEnabled && (
            <>
              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Chroma Color</span>
                  <span className="font-mono text-amber-400">{chromaColor}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    value={chromaColor}
                    onChange={(e) => setChromaColor(e.target.value)}
                    className="h-8 w-12 cursor-pointer rounded border border-slate-700 bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setChromaColor("#00FF00")}
                    className="rounded bg-slate-800 px-2 py-1 text-[11px] text-green-400 hover:bg-slate-700"
                  >
                    Green Screen (#00FF00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChromaColor("#0000FF")}
                    className="rounded bg-slate-800 px-2 py-1 text-[11px] text-blue-400 hover:bg-slate-700"
                  >
                    Blue Screen (#0000FF)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Similarity Threshold (समानता)</span>
                  <span className="font-mono text-amber-400">{similarity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.02"
                  value={similarity}
                  onChange={(e) => setSimilarity(Number(e.target.value))}
                  className="mt-1.5 w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Edge Smoothness (किनारों की मुलामियत)</span>
                  <span className="font-mono text-amber-400">{smoothness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.3"
                  step="0.01"
                  value={smoothness}
                  onChange={(e) => setSmoothness(Number(e.target.value))}
                  className="mt-1.5 w-full accent-amber-500"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              )}
              {muted ? "Muted Audio" : "Unmuted Audio"}
            </button>
          </div>
        </div>

        {/* Assign & Save */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Assign Video to Character
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "modi", label: "PM Modi" },
              { id: "yogi", label: "CM Yogi" },
              { id: "custom", label: "+ New Character" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTargetChar(opt.id as "modi" | "yogi" | "custom")}
                className={`rounded-lg py-2 text-xs font-semibold transition-all ${
                  targetChar === opt.id
                    ? "bg-amber-500 text-slate-950 shadow-md"
                    : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            type="button"
            onClick={applyVideoToBooth}
            disabled={busy}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-slate-950 hover:from-amber-400 hover:to-orange-400"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Apply Video Cutout to Live AR Booth
          </Button>
        </div>
      </div>

      {/* Right panel: Live Video Player Preview */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur-md lg:col-span-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Play className="h-5 w-5 text-amber-400" /> Video Playback Preview
          </h2>
          <p className="text-xs text-slate-400">
            Preview the video playing with transparent background and looping playback.
          </p>
        </div>

        <div className="relative flex h-[440px] items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              loop
              muted={muted}
              playsInline
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          ) : (
            <div className="text-center text-xs text-slate-500">
              Upload or enter video URL to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** -------------------------------------------------------------------------
 * TAB 3: CHARACTERS & STANDEES MANAGER
 * Add, edit, scale, and manage custom 3D standees without changing code!
 * ------------------------------------------------------------------------ */
function CharactersTab({
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">
            Active Characters & Standees (पात्र सूची)
          </h2>
          <p className="text-xs text-slate-400">
            Configure scales, heights, offsets, and authorized likenesses. Changes take effect
            immediately in live AR without coding changes!
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={busy}
          className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
        >
          Save All Changes
        </Button>
      </div>

      {/* Yogi & Modi Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {(["modi", "yogi"] as const).map((id) => {
          const c = config.characters[id];
          return (
            <div
              key={id}
              className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{c.name.en}</h3>
                  <p className="text-xs text-amber-400">{c.name.hi}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev
                          ? {
                              ...prev,
                              characters: {
                                ...prev.characters,
                                [id]: { ...prev.characters[id], enabled: e.target.checked },
                              },
                            }
                          : prev,
                      )
                    }
                    className="rounded accent-amber-500"
                  />
                  Enabled in AR
                </label>
              </div>

              {/* 3D Scale & Offset Sliders */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Scale Factor: {c.scale.toFixed(2)}x</span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.6"
                    step="0.05"
                    value={c.scale}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev
                          ? {
                              ...prev,
                              characters: {
                                ...prev.characters,
                                [id]: { ...prev.characters[id], scale: Number(e.target.value) },
                              },
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full accent-amber-500"
                  />
                </div>

                <div>
                  <span className="text-slate-400">Horizontal Offset: {c.offsetX}cm</span>
                  <input
                    type="range"
                    min="-80"
                    max="80"
                    step="2"
                    value={c.offsetX}
                    onChange={(e) =>
                      setConfig((prev) =>
                        prev
                          ? {
                              ...prev,
                              characters: {
                                ...prev.characters,
                                [id]: { ...prev.characters[id], offsetX: Number(e.target.value) },
                              },
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full accent-amber-500"
                  />
                </div>
              </div>

              {/* Video Standee indicator */}
              {c.video?.enabled && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs text-emerald-300 flex items-center justify-between">
                  <span>📹 Active 3D Video Cutout</span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) =>
                        prev
                          ? {
                              ...prev,
                              characters: {
                                ...prev.characters,
                                [id]: { ...prev.characters[id], video: undefined },
                              },
                            }
                          : prev,
                      )
                    }
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    Remove Video
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom Characters list */}
      {config.customStandees.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
            Custom Added Standees ({config.customStandees.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {config.customStandees.map((st, idx) => (
              <div
                key={st.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div>
                  <h4 className="text-sm font-bold text-white">{st.name.en}</h4>
                  <p className="text-xs text-slate-400">{st.name.hi}</p>
                  <span className="mt-1 inline-block text-[10px] text-amber-400">
                    {st.type === "video" ? "📹 Video Standee" : "🖼️ 3D Image Standee"} ·{" "}
                    {st.heightCm}cm
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) =>
                      prev
                        ? {
                            ...prev,
                            customStandees: prev.customStandees.filter((_, i) => i !== idx),
                          }
                        : prev,
                    )
                  }
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** -------------------------------------------------------------------------
 * TAB 4: DYNAMIC SLOGANS & BANNERS
 * Add, edit, and reorder Hindi slogans without changing code!
 * ------------------------------------------------------------------------ */
function SlogansTab({
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
  const [newText, setNewText] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newIcon, setNewIcon] = useState("🚩");

  const addSlogan = () => {
    if (!newText.trim()) return;
    const item: SloganItem = {
      id: `slogan-${Date.now()}`,
      text: newText.trim(),
      sub: newSub.trim() || newText.trim(),
      icon: newIcon.trim() || "🚩",
      enabled: true,
    };
    setConfig((c) => (c ? { ...c, slogans: [...c.slogans, item] } : c));
    setNewText("");
    setNewSub("");
    void onSave();
  };

  const removeSlogan = (idx: number) => {
    setConfig((c) => (c ? { ...c, slogans: c.slogans.filter((_, i) => i !== idx) } : c));
    void onSave();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Type className="h-5 w-5 text-amber-400" /> Dynamic Hindi Slogans & Banners (स्लोगन
          प्रबंधक)
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Add or edit slogans. They immediately appear in the customer AR camera banner, floating
          ribbon, and bottom slogans drawer without any code modifications!
        </p>
      </div>

      {/* Add New Slogan */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          + Add New Slogan (नया स्लोगन जोड़ें)
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="हिंदी नारा (उदा. सबका साथ, सबका विकास)"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="English Subtitle (e.g. Sabka Saath, Sabka Vikas)"
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Icon (🚩, 🗳️, 🇮🇳)"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-center text-sm"
            />
            <Button
              type="button"
              onClick={addSlogan}
              disabled={busy || !newText.trim()}
              className="flex-1 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
            >
              Add Slogan
            </Button>
          </div>
        </div>
      </div>

      {/* Slogan List */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Current Live Slogans ({config.slogans.length})
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {config.slogans.map((s, idx) => (
            <div
              key={s.id || idx}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className="text-sm font-bold text-white">{s.text}</p>
                  <p className="text-xs text-slate-400">{s.sub}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeSlogan(idx)}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** -------------------------------------------------------------------------
 * TAB 5: AI GUIDANCE & REFERENCES
 * Upload reference images and prompt instructions to guide AI image enhancement!
 * ------------------------------------------------------------------------ */
function AiGuidanceTab({
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
  const [guidePrompt, setGuidePrompt] = useState(config.ai.customGuidePrompt || "");
  const [styleGuidance, setStyleGuidance] = useState(config.ai.styleGuidance || "");
  const [refUrl, setRefUrl] = useState("");
  const [provider, setProvider] = useState<"gemini" | "lovable">(
    config.ai.primaryProvider || "gemini",
  );

  const saveAiSettings = () => {
    setConfig((c) =>
      c
        ? {
            ...c,
            ai: {
              ...c.ai,
              imageEnabled: true,
              customGuidePrompt: guidePrompt,
              styleGuidance,
              primaryProvider: provider,
            },
          }
        : c,
    );
    void onSave();
  };

  const addReference = () => {
    if (!refUrl.trim()) return;
    setConfig((c) =>
      c
        ? {
            ...c,
            ai: {
              ...c.ai,
              referenceImages: [...(c.ai.referenceImages || []), refUrl.trim()],
            },
          }
        : c,
    );
    setRefUrl("");
    void onSave();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-400" /> AI Guidance & Reference Manager (AI संदर्भ
          व निर्देश)
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Guide the AI image enhancement post-capture. Upload reference images (fabrics, badges,
          lighting) and provide style guidance without altering the code.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Prompts & Guidance */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            AI Prompt Directives
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Custom Guidance Prompt
            </label>
            <textarea
              rows={4}
              value={guidePrompt}
              onChange={(e) => setGuidePrompt(e.target.value)}
              placeholder="e.g. Preserve customer facial expressions, hair, and eye details faithfully. Draping ceremonial saffron silk stole naturally over both shoulders."
              className="mt-1 w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              Style & Lighting Guidance
            </label>
            <input
              type="text"
              value={styleGuidance}
              onChange={(e) => setStyleGuidance(e.target.value)}
              placeholder="e.g. Grand celebration stage, soft festive bokeh, authentic saffron-green ambient lighting."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Primary AI Provider</label>
            <div className="mt-1.5 flex gap-3">
              <button
                type="button"
                onClick={() => setProvider("gemini")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  provider === "gemini"
                    ? "bg-amber-500 text-slate-950"
                    : "border border-slate-700 bg-slate-800 text-slate-300"
                }`}
              >
                Google Gemini API
              </button>
              <button
                type="button"
                onClick={() => setProvider("lovable")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  provider === "lovable"
                    ? "bg-amber-500 text-slate-950"
                    : "border border-slate-700 bg-slate-800 text-slate-300"
                }`}
              >
                Lovable Gateway
              </button>
            </div>
          </div>

          <Button
            type="button"
            onClick={saveAiSettings}
            disabled={busy}
            className="w-full bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            Save AI Guidance Settings
          </Button>
        </div>

        {/* Right: Reference Images */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Reference Images for AI Matching
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Reference Image URL (e.g. fabric sample, logo)"
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              className={inputClass}
            />
            <Button
              type="button"
              onClick={addReference}
              disabled={busy || !refUrl.trim()}
              className="bg-amber-500 font-semibold text-slate-950 hover:bg-amber-400"
            >
              Add URL
            </Button>
          </div>

          <div className="space-y-2 pt-2">
            {(config.ai.referenceImages || []).length === 0 ? (
              <p className="text-xs text-slate-500">No custom reference images added yet.</p>
            ) : (
              config.ai.referenceImages.map((img, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-xs"
                >
                  <span className="truncate text-slate-300 max-w-[280px]">{img}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((c) =>
                        c
                          ? {
                              ...c,
                              ai: {
                                ...c.ai,
                                referenceImages: c.ai.referenceImages.filter((_, i) => i !== idx),
                              },
                            }
                          : c,
                      )
                    }
                    className="text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** -------------------------------------------------------------------------
 * TAB 6: BACKUP & CONFIG EXPORT/IMPORT
 * 1-Click JSON export and import for seamless zero-code portability.
 * ------------------------------------------------------------------------ */
function BackupTab({
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
  const exportJson = () => {
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zuitar-booth-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        const merged = mergeConfig(parsed);
        setConfig(merged);
        void onSave(merged);
      } catch {
        alert("Invalid JSON configuration file");
      }
    };
    reader.readAsText(file);
  };

  const resetDefaults = () => {
    if (confirm("Reset all booth materials, cutouts, and slogans to factory defaults?")) {
      setConfig(DEFAULT_CONFIG);
      void onSave(DEFAULT_CONFIG);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-amber-400" /> Configuration Backup & Zero-Code
          Portability
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Export your complete booth materials, 3D cutouts, slogans, and AI prompts as a single
          file. Import anywhere to restore your entire studio setup without code changes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Download className="h-4 w-4 text-amber-400" /> Export Configuration
          </h3>
          <p className="text-xs text-slate-400">
            Download a portable JSON file containing all customized materials and settings.
          </p>
          <Button
            type="button"
            onClick={exportJson}
            className="w-full bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Download Config JSON
          </Button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Upload className="h-4 w-4 text-emerald-400" /> Import Configuration
          </h3>
          <p className="text-xs text-slate-400">
            Restore booth materials and settings from an existing config backup.
          </p>
          <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
            Upload Config JSON
            <input type="file" accept=".json" onChange={importJson} className="hidden" />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-red-300">Reset to Defaults (फ़ैक्टरी रीसेट)</h4>
          <p className="text-[11px] text-red-400/80">Restores Yogi, Modi, and default slogans.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetDefaults}
          className="border-red-500/40 text-red-300 hover:bg-red-500/20"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}
