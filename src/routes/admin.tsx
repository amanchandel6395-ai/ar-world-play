import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  adminLogin,
  adminStatus,
  adminSave,
  adminUploadUrl,
  adminPreview,
  adminMarkVideoVerified,
} from "@/lib/config.functions";
import {
  INTERACTIONS,
  type AppConfig,
  type CharacterId,
  type BjpKind,
  type BjpAnchor,
} from "@/lib/config";
import { REFERENCE_ASSETS, referenceUrl } from "@/lib/reference-assets";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Booth asset approvals · ZUITAR Admin" },
      {
        name: "description",
        content: "Private booth setup, written permission records and asset approvals for ZUITAR.",
      },
      { property: "og:title", content: "ZUITAR booth administration" },
      { property: "og:description", content: "Protected booth setup and permission records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminPage,
});

const inputClass = "w-full rounded-md border border-input bg-background p-2 text-foreground";
function AdminPage() {
  const login = useServerFn(adminLogin);
  const statusFn = useServerFn(adminStatus);
  const save = useServerFn(adminSave);
  const uploadFn = useServerFn(adminUploadUrl);
  const previewFn = useServerFn(adminPreview);
  const verifyFn = useServerFn(adminMarkVideoVerified);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof adminStatus>> | null>(null);
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [videoId, setVideoId] = useState("");
  const [testVideoUrl, setTestVideoUrl] = useState("");
  useEffect(() => {
    statusFn()
      .then(setStatus)
      .catch(() => setMessage("Setup status unavailable. Check the project settings."));
  }, [statusFn]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      const text = e instanceof Error ? e.message : "Request failed";
      setMessage(
        text.includes("WRONG_PASSWORD")
          ? "Incorrect admin password."
          : text.includes("ADMIN_NOT_CONFIGURED")
            ? "Set ADMIN_PASSWORD in project secrets before signing in."
            : text,
      );
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File, folder: string, cutout: boolean): Promise<string> => {
    if (cutout) {
      if (!/\.(png|webp)$/i.test(file.name))
        throw new Error("Use a transparent PNG or WebP cutout. JPG references cannot be cutouts.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const g = canvas.getContext("2d");
      if (!g) {
        bitmap.close();
        throw new Error("Transparency check unavailable.");
      }
      g.drawImage(bitmap, 0, 0);
      bitmap.close();
      const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = false;
      for (let i = 3; i < data.length; i += 4) {
        if ((data[i] ?? 255) < 250) {
          transparent = true;
          break;
        }
      }
      if (!transparent)
        throw new Error("This file has no real transparency. Upload a genuine cutout.");
    }
    const up = await uploadFn({ data: { password, folder, name: file.name, size: file.size } });
    const response = await fetch(up.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!response.ok) throw new Error("Upload failed. Check the private assets bucket.");
    const p = await previewFn({ data: { password, path: up.path } });
    if (p.url) setPreviews((old) => ({ ...old, [up.path]: p.url as string }));
    return up.path;
  };
  const patchChar = (id: CharacterId, value: Partial<AppConfig["characters"]["yogi"]>) =>
    setConfig((c) =>
      c ? { ...c, characters: { ...c.characters, [id]: { ...c.characters[id], ...value } } } : c,
    );
  const patchItem = (id: string, value: Partial<AppConfig["bjp"][number]>) =>
    setConfig((c) =>
      c ? { ...c, bjp: c.bjp.map((b) => (b.id === id ? { ...b, ...value } : b)) } : c,
    );
  const preview = (path: string) =>
    run(async () => {
      const p = await previewFn({ data: { password, path } });
      if (!p.url) throw new Error("Asset missing from storage.");
      setPreviews((old) => ({ ...old, [path]: p.url as string }));
    });
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">ZUITAR · Booth administration</h1>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/">Customer screen</Link>
            </Button>
            {config && (
              <Button
                variant="outline"
                onClick={() => {
                  setConfig(null);
                  setPassword("");
                  setPreviews({});
                  setMessage("");
                }}
              >
                Sign out
              </Button>
            )}
          </div>
        </header>
        <section className="border-b border-border pb-6">
          <h2 className="mb-3 text-xl font-semibold">Project setup</h2>
          {!status ? (
            <p>Checking setup…</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <li>
                Admin password:{" "}
                {status.adminPassword
                  ? "Configured"
                  : "Missing — set ADMIN_PASSWORD in project secrets. Never paste it in chat."}
              </li>
              <li>
                Private assets bucket:{" "}
                {status.storage
                  ? "Available"
                  : "Missing — configure the private assets storage bucket."}
              </li>
              <li>
                Private captures bucket:{" "}
                {status.captures
                  ? "Available"
                  : "Missing — configure the private captures storage bucket for sharing and video."}
              </li>
              <li>
                Settings table:{" "}
                {status.database
                  ? "Available"
                  : "Unavailable — apply the existing app_config migration and check service access."}
              </li>
              <li>
                AI service:{" "}
                {status.aiKey
                  ? "Key configured; availability still requires approved artwork"
                  : "Missing — configure LOVABLE_API_KEY in project settings. AI remains unavailable."}
              </li>
            </ul>
          )}
        </section>
        {message && (
          <p role="status" className="break-words border-l-4 border-warning pl-4 text-warning">
            {message}
          </p>
        )}
        {!config ? (
          <form
            className="max-w-md space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await login({ data: { password } });
                if (!result.ok) throw new Error(result.reason);
                setConfig(result.config);
              });
            }}
          >
            <label className="block space-y-2">
              <span>Admin password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <Button type="submit" disabled={busy || !status?.adminPassword}>
              Sign in
            </Button>
          </form>
        ) : (
          <>
            <section className="space-y-4 border-b border-border pb-8">
              <h2 className="text-2xl font-semibold">Uploaded reference inventory</h2>
              <p className="text-warning">
                Missing: a genuine transparent Modi cutout and isolated cap/scarf artwork. All
                existing references remain unapproved.
              </p>
              <ul className="space-y-3">
                {REFERENCE_ASSETS.map((a) => (
                  <li key={a.name} className="border-t border-border pt-3">
                    <p className="break-all font-semibold">{a.name}</p>
                    <p className="text-sm text-muted-foreground">{a.description}</p>
                    {"candidate" in a && (
                      <Button
                        className="mt-2"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const response = await fetch(referenceUrl(a.url));
                            if (!response.ok)
                              throw new Error(
                                "Mapped reference download unavailable. Use the original file shown above.",
                              );
                            const blob = await response.blob();
                            const file = new File([blob], a.name, { type: blob.type });
                            const path = await upload(
                              file,
                              a.candidate === "yogi" ? "yogi-cutout" : "bjp-art",
                              a.candidate === "yogi",
                            );
                            if (a.candidate === "yogi")
                              patchChar("yogi", {
                                poses: { ...config.characters.yogi.poses, selfie: path },
                              });
                            else
                              setConfig((c) =>
                                c
                                  ? {
                                      ...c,
                                      bjp: [
                                        ...c.bjp,
                                        {
                                          id: crypto.randomUUID(),
                                          kind: "art",
                                          label: a.name,
                                          asset: path,
                                          approved: false,
                                          approvedAt: null,
                                          permissionNote: "",
                                          enabled: false,
                                          anchor: "screen",
                                          scale: 25,
                                          offsetX: 0,
                                          offsetY: 0,
                                          rotation: 0,
                                          order: c.bjp.length,
                                        },
                                      ],
                                    }
                                  : c,
                              );
                            setMessage(
                              "Mapped reference uploaded privately; permission and approval are still required.",
                            );
                          })
                        }
                      >
                        Import unapproved candidate
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-6 border-b border-border pb-8">
              <h2 className="text-2xl font-semibold">Leader cutouts</h2>
              <p className="text-sm text-muted-foreground">
                Event photographs are references only. Each cutout needs its own approval and a
                written permission record. Models are not used in customer scenes.
              </p>
              {(["yogi", "modi"] as const).map((id) => {
                const c = config.characters[id];
                return (
                  <div key={id} className="space-y-4 border-t border-border pt-5">
                    <h3 className="text-xl font-semibold">{c.name.en}</h3>
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) => patchChar(id, { enabled: e.target.checked })}
                      />
                      Scene enabled
                    </label>
                    <label className="block space-y-2">
                      <span>
                        Written permission record (document reference, owner and approval date)
                      </span>
                      <textarea
                        className={inputClass}
                        value={c.permissionNote}
                        onChange={(e) =>
                          patchChar(id, {
                            permissionNote: e.target.value,
                            authorized: false,
                            authorizedAt: null,
                          })
                        }
                      />
                    </label>
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={c.authorized}
                        disabled={!c.permissionNote.trim()}
                        onChange={(e) => patchChar(id, { authorized: e.target.checked })}
                      />
                      I confirm written permission to use this likeness.
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Permission recorded: {c.authorizedAt ?? "Not recorded"}
                    </p>
                    <label className="block space-y-2">
                      <span>Reference photo (not rendered)</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f)
                            void run(async () =>
                              patchChar(id, {
                                reference: await upload(f, `${id}-reference`, false),
                              }),
                            );
                        }}
                      />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      {INTERACTIONS.map((pose) => {
                        const path = c.poses[pose];
                        return (
                          <div key={pose} className="space-y-2 rounded-md border border-border p-4">
                            <label className="block space-y-2">
                              <span className="font-semibold">{pose} cutout</span>
                              <input
                                type="file"
                                accept="image/png,image/webp"
                                disabled={busy}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f)
                                    void run(async () => {
                                      const newPath = await upload(f, `${id}-cutout`, true);
                                      patchChar(id, { poses: { ...c.poses, [pose]: newPath } });
                                    });
                                }}
                              />
                            </label>
                            {path ? (
                              <>
                                <p className="break-all text-xs text-muted-foreground">{path}</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void preview(path)}
                                >
                                  Inspect asset
                                </Button>
                                {previews[path] && (
                                  <img
                                    src={previews[path]}
                                    alt={`${id} ${pose} approval preview`}
                                    className="h-40 w-full object-contain"
                                  />
                                )}
                                <label className="flex gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={!!c.approvedAssets[path]}
                                    disabled={!c.authorized}
                                    onChange={(e) => {
                                      const approvedAssets = { ...c.approvedAssets };
                                      if (e.target.checked) approvedAssets[path] = "pending";
                                      else delete approvedAssets[path];
                                      patchChar(id, { approvedAssets });
                                    }}
                                  />
                                  Approve this exact cutout
                                </label>
                              </>
                            ) : (
                              <p className="text-sm text-warning">No cutout configured</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {(["scale", "offsetX", "offsetY", "rotationY"] as const).map((key) => (
                        <label key={key} className="space-y-1">
                          <span>{key}</span>
                          <input
                            type="number"
                            step="0.1"
                            value={c[key]}
                            className={inputClass}
                            onChange={(e) => patchChar(id, { [key]: Number(e.target.value) })}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
            <section className="space-y-4 border-b border-border pb-8">
              <h2 className="text-2xl font-semibold">Exact BJP artwork</h2>
              <p className="text-sm text-muted-foreground">
                No artwork is enabled by default, including catalogue photographs. Upload only the
                exact authorized artwork.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  setConfig({
                    ...config,
                    bjp: [
                      ...config.bjp,
                      {
                        id: crypto.randomUUID(),
                        kind: "art",
                        label: "New artwork",
                        asset: null,
                        approved: false,
                        approvedAt: null,
                        permissionNote: "",
                        enabled: false,
                        anchor: "screen",
                        scale: 25,
                        offsetX: 0,
                        offsetY: 0,
                        rotation: 0,
                        order: config.bjp.length,
                      },
                    ],
                  })
                }
              >
                Add artwork
              </Button>
              {config.bjp.map((b) => (
                <div key={b.id} className="space-y-3 rounded-md border border-border p-4">
                  <label className="block">
                    Label
                    <input
                      className={inputClass}
                      value={b.label}
                      onChange={(e) => patchItem(b.id, { label: e.target.value })}
                    />
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label>
                      Kind
                      <select
                        className={inputClass}
                        value={b.kind}
                        onChange={(e) => patchItem(b.id, { kind: e.target.value as BjpKind })}
                      >
                        {[
                          "cap",
                          "scarf",
                          "flag",
                          "lotus",
                          "art",
                          "background",
                          "frame",
                          "sticker",
                        ].map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Anchor
                      <select
                        className={inputClass}
                        value={b.anchor}
                        onChange={(e) => patchItem(b.id, { anchor: e.target.value as BjpAnchor })}
                      >
                        {["head", "shoulders", "screen", "background"].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    Exact artwork file
                    <input
                      className="block"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f)
                          void run(async () =>
                            patchItem(b.id, {
                              asset: await upload(f, "bjp-art", false),
                              approved: false,
                              approvedAt: null,
                              enabled: false,
                            }),
                          );
                      }}
                    />
                  </label>
                  {b.asset && (
                    <>
                      <p className="break-all text-xs text-muted-foreground">{b.asset}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (b.asset) void preview(b.asset);
                        }}
                      >
                        Inspect artwork
                      </Button>
                      {previews[b.asset] && (
                        <img
                          src={previews[b.asset]}
                          alt={b.label}
                          className="h-40 w-full object-contain"
                        />
                      )}
                    </>
                  )}
                  <label className="block">
                    Written permission record
                    <textarea
                      className={inputClass}
                      value={b.permissionNote}
                      onChange={(e) =>
                        patchItem(b.id, {
                          permissionNote: e.target.value,
                          approved: false,
                          approvedAt: null,
                          enabled: false,
                        })
                      }
                    />
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={b.approved}
                      disabled={!b.asset || !b.permissionNote.trim()}
                      onChange={(e) =>
                        patchItem(b.id, { approved: e.target.checked, enabled: false })
                      }
                    />
                    I confirm permission and approve this exact artwork.
                  </label>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={b.enabled}
                      disabled={!b.approved}
                      onChange={(e) => patchItem(b.id, { enabled: e.target.checked })}
                    />
                    Enable approved artwork
                  </label>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    {(["scale", "offsetX", "offsetY", "rotation", "order"] as const).map((key) => (
                      <label key={key}>
                        {key}
                        <input
                          type="number"
                          step="0.1"
                          className={inputClass}
                          value={b[key]}
                          onChange={(e) => patchItem(b.id, { [key]: Number(e.target.value) })}
                        />
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      setConfig({ ...config, bjp: config.bjp.filter((i) => i.id !== b.id) })
                    }
                  >
                    Remove item
                  </Button>
                </div>
              ))}
            </section>
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Post-capture styling and video</h2>
              <p className="text-sm text-muted-foreground">
                AI can enhance the customer’s own photo after capture. BJP Look additionally needs
                approved artwork. Leader scenes never get AI photos or videos. Video stays
                unavailable until a completed booth test is recorded.
              </p>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={config.demo.enabled}
                  disabled={busy}
                  onChange={(e) =>
                    setConfig({ ...config, demo: { ...config.demo, enabled: e.target.checked } })
                  }
                />
                Enable fictional AI selfie test mode (separate from real-person permissions)
              </label>
              <p className="text-sm text-muted-foreground">
                This development-only test uses the existing AI service after an explicit choice in
                the hidden developer mode. It never uses leader artwork or approval records.{" "}
                {status?.aiKey
                  ? "AI service key is configured."
                  : "Configure LOVABLE_API_KEY to make it available."}
              </p>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={config.ai.imageEnabled}
                  disabled={!status?.aiKey}
                  onChange={(e) =>
                    setConfig({ ...config, ai: { ...config.ai, imageEnabled: e.target.checked } })
                  }
                />
                Enable post-capture AI photo enhancement (BJP Look additionally needs approved
                artwork)
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={config.ai.videoEnabled}
                  disabled={!status?.aiKey || !status?.captures}
                  onChange={(e) =>
                    setConfig({ ...config, ai: { ...config.ai, videoEnabled: e.target.checked } })
                  }
                />
                Enable BJP video after verification
              </label>
              <p>
                Video verification:{" "}
                {config.ai.videoVerifiedAt ?? "Not verified — unavailable to customers"}
              </p>
              <label className="block">
                Run existing BJP video test from an approved booth capture
                <input
                  className="mt-2 block"
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={busy || !config.ai.videoEnabled}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void run(async () => {
                      const form = new FormData();
                      form.append("image", f);
                      form.append("scene", "bjp");
                      form.append("interaction", "selfie");
                      const r = await fetch("/api/video", {
                        method: "POST",
                        headers: { "X-Booth-Admin": password },
                        body: form,
                      });
                      const job = (await r.json()) as { id?: string; code?: string };
                      if (!r.ok || !job.id)
                        throw new Error(
                          `Video test unavailable: ${job.code ?? "check settings and approved artwork"}. Save settings first.`,
                        );
                      setVideoId(job.id);
                      setTestVideoUrl("");
                      setMessage(
                        "Video test started. Check completion, inspect the result, then record verification.",
                      );
                    });
                  }}
                />
              </label>
              <Button
                variant="outline"
                disabled={busy || !videoId}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch(`/api/video?id=${encodeURIComponent(videoId)}`, {
                      headers: { "X-Booth-Admin": password },
                    });
                    const result = (await response.json()) as {
                      status?: string;
                      url?: string;
                      code?: string;
                    };
                    if (!response.ok)
                      throw new Error(`Video test unavailable: ${result.code ?? "check settings"}`);
                    if (result.status === "completed" && result.url) {
                      setTestVideoUrl(result.url);
                      setMessage("Video completed. Inspect it before recording verification.");
                    } else
                      setMessage(
                        result.status === "failed"
                          ? "Video test failed; it remains unavailable."
                          : "Video still processing. Check completion again shortly.",
                      );
                  })
                }
              >
                Check test completion
              </Button>
              {testVideoUrl && <video controls src={testVideoUrl} className="max-h-96 w-full" />}
              <label className="block max-w-lg">
                Completed existing BJP test video ID
                <input
                  className={inputClass}
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                />
              </label>
              <Button
                variant="outline"
                disabled={busy || !videoId}
                onClick={() =>
                  void run(async () => {
                    const r = await verifyFn({ data: { password, id: videoId } });
                    if (!r.ok)
                      throw new Error(
                        "No valid completed MP4 found. Run and inspect the existing BJP video test first.",
                      );
                    setConfig({ ...config, ai: { ...config.ai, videoVerifiedAt: r.at } });
                    setMessage("Completed video test recorded.");
                  })
                }
              >
                Record inspected test video
              </Button>
            </section>
            <footer className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-border bg-background py-4">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await save({
                      data: { password, config: config as unknown as Record<string, unknown> },
                    });
                    setConfig(result.config);
                    setMessage("Settings and approval records saved.");
                  })
                }
              >
                {busy ? "Working…" : "Save settings and approvals"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Uploads alone do not enable assets. Save explicit approvals.
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
