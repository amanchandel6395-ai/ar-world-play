import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AppConfig } from "./config";

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { loadConfig, toPublic } = await import("./config.server");
  try { return await toPublic(await loadConfig()); }
  catch {
    const { toPublicDefault } = await import("./config");
    return toPublicDefault();
  }
});

const pw = z.object({ password: z.string().min(1).max(200) });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.parse(d))
  .handler(async ({ data }) => {
    const { checkAdmin, loadConfig } = await import("./config.server");
    try {
      checkAdmin(data.password);
    } catch (e) {
      return { ok: false as const, reason: (e as Error).message };
    }
    return { ok: true as const, config: await loadConfig(), aiKey: !!process.env["LOVABLE_API_KEY"] };
  });

/** Public setup status: booleans only, never secret values. */
export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  let storage = false;
  let captures = false;
  let database = false;
  try {
    const { admin } = await import("./config.server");
    const sb = await admin();
    const { error } = await sb.storage.from("assets").list("", { limit: 1 });
    storage = !error;
    const captureCheck = await sb.storage.from("captures").list("", { limit: 1 });
    captures = !captureCheck.error;
    const configCheck = await sb.from("app_config").select("id").eq("id", "main").maybeSingle();
    database = !configCheck.error;
  } catch {
    storage = false;
  }
  return {
    adminPassword: !!process.env["ADMIN_PASSWORD"],
    aiKey: !!process.env["LOVABLE_API_KEY"],
    storage,
    captures,
    database,
  };
});

export const adminSave = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.extend({ config: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data }) => {
    const { checkAdmin, saveConfig, loadConfig } = await import("./config.server");
    const { mergeConfig } = await import("./config");
    checkAdmin(data.password);
    const prev = await loadConfig();
    const next = mergeConfig(data.config as Partial<AppConfig>);
    const now = new Date().toISOString();
    // Authorization/approval timestamps are recorded by the server, not trusted from the browser.
    for (const id of ["yogi", "modi"] as const) {
      const c = next.characters[id];
      if (c.authorized && !c.permissionNote.trim()) throw new Error("Record written permission before approving a likeness");
      c.authorizedAt = c.authorized ? (prev.characters[id].authorized ? prev.characters[id].authorizedAt ?? now : now) : null;
      c.approvedAssets = Object.fromEntries(Object.values(c.poses).filter((p): p is string => !!p && !!c.approvedAssets[p]).map((p) => {
        if (!/^[a-z0-9-]+\/[A-Za-z0-9_.-]+\.(png|webp)$/i.test(p)) throw new Error("Cutouts must be uploaded transparent PNG or WebP files");
        return [p, prev.characters[id].approvedAssets[p] ?? now];
      }));
    }
    next.bjp = next.bjp.map((b) => {
      const old = prev.bjp.find((o) => o.id === b.id);
      const sameAsset = old && old.asset === b.asset;
      if (b.approved && (!b.asset || !b.permissionNote.trim())) throw new Error("Record permission and upload the exact artwork before approving it");
      return { ...b, approvedAt: b.approved ? (old?.approved && sameAsset ? old.approvedAt ?? now : now) : null };
    });
    // Video verification is only set by adminMarkVideoVerified after a real end-to-end run.
    const unchangedArtwork = JSON.stringify(next.bjp.map((b) => [b.asset, b.approved, b.enabled])) === JSON.stringify(prev.bjp.map((b) => [b.asset, b.approved, b.enabled]));
    next.ai.videoVerifiedAt = next.ai.videoEnabled && unchangedArtwork && next.ai.bjpVideoPrompt === prev.ai.bjpVideoPrompt ? prev.ai.videoVerifiedAt : null;
    next.ai.videoJobs = prev.ai.videoJobs;
    await saveConfig(next);
    return { ok: true, config: next };
  });

/** Records a successful end-to-end video test: the finished MP4 must exist in private storage. */
export const adminMarkVideoVerified = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.extend({ id: z.string().regex(/^[A-Za-z0-9_-]{6,128}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { checkAdmin, admin, loadConfig, saveConfig } = await import("./config.server");
    checkAdmin(data.password);
    const sb = await admin();
    const cfg = await loadConfig();
    const { bjpReady } = await import("./config.server");
    if (!cfg.ai.videoEnabled || !bjpReady(cfg) || !cfg.ai.videoJobs.includes(data.id)) return { ok: false as const };
    const { data: f } = await sb.storage.from("captures").download(`videos/${data.id}.mp4`);
    if (!f || f.size < 12) return { ok: false as const };
    const header = new Uint8Array(await f.slice(0, 12).arrayBuffer());
    if (String.fromCharCode(...header.slice(4, 8)) !== "ftyp") return { ok: false as const };
    cfg.ai.videoVerifiedAt = new Date().toISOString();
    await saveConfig(cfg);
    return { ok: true as const, at: cfg.ai.videoVerifiedAt };
  });

/** Signed direct-upload URL into the private assets bucket (admin only). */
export const adminUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    pw
      .extend({ name: z.string().min(1).max(200), folder: z.string().regex(/^[a-z0-9-]{1,40}$/), size: z.number().int().positive() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { checkAdmin, admin } = await import("./config.server");
    checkAdmin(data.password);
    const ext = (data.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    if (!["png", "jpg", "jpeg", "webp", "glb", "gltf"].includes(ext)) throw new Error("Unsupported file type");
    const max = ext === "glb" || ext === "gltf" ? 30_000_000 : 10_000_000;
    if (data.size > max) throw new Error("File too large");
    const path = `${data.folder}/${crypto.randomUUID()}.${ext}`;
    const sb = await admin();
    const { data: up, error } = await sb.storage.from("assets").createSignedUploadUrl(path);
    if (error || !up) throw new Error("Upload not available");
    return { path, token: up.token, signedUrl: up.signedUrl };
  });

export const adminPreview = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.extend({ path: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { checkAdmin, signPath } = await import("./config.server");
    checkAdmin(data.password);
    return { url: await signPath(data.path, 600) };
  });
