import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AppConfig } from "./config";

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { loadConfig, toPublic } = await import("./config.server");
  try {
    return await toPublic(await loadConfig());
  } catch {
    const { toPublicDefault } = await import("./config");
    return toPublicDefault();
  }
});

const pw = z.object({ password: z.string().min(1).max(200) });

/**
 * Validates admin credentials before returning full administration configuration.
 * Protected against unauthenticated retrieval.
 */
export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.parse(d))
  .handler(async ({ data }) => {
    const { checkAdmin, loadConfig } = await import("./config.server");
    checkAdmin(data.password);
    return {
      ok: true as const,
      config: await loadConfig(),
      aiKey: !!(process.env["LOVABLE_API_KEY"] || process.env["GEMINI_API_KEY"]),
    };
  });

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  let storage = false;
  let captures = false;
  let database = false;
  try {
    const { admin } = await import("./config.server");
    const sb = await admin();
    if (sb) {
      const { error } = await sb.storage.from("assets").list("", { limit: 1 });
      storage = !error;
      const captureCheck = await sb.storage.from("captures").list("", { limit: 1 });
      captures = !captureCheck.error;
      const configCheck = await sb.from("app_config").select("id").eq("id", "main").maybeSingle();
      database = !configCheck.error;
    }
  } catch {
    storage = false;
  }
  return {
    adminPassword: true,
    hasCustomPassword: !!process.env["ADMIN_PASSWORD"],
    aiKey: !!(process.env["LOVABLE_API_KEY"] || process.env["GEMINI_API_KEY"]),
    storage,
    captures,
    database,
  };
});

/**
 * Saves configuration with strict schema validation and protection against mass assignment.
 * Protected fields (authorized likeness timestamps, staff approvals, audit notes) are server-controlled.
 */
export const adminSave = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    pw
      .extend({
        config: z.object({
          characters: z.record(z.string(), z.unknown()).optional(),
          bjp: z.array(z.record(z.string(), z.unknown())).optional(),
          interactions: z.array(z.record(z.string(), z.unknown())).optional(),
          brand: z.record(z.string(), z.unknown()).optional(),
          candidates: z.array(z.record(z.string(), z.unknown())).optional(),
          demo: z.record(z.string(), z.unknown()).optional(),
          ai: z.record(z.string(), z.unknown()).optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { checkAdmin, saveConfig, loadConfig } = await import("./config.server");
    const { mergeConfig } = await import("./config");
    checkAdmin(data.password);
    const prev = await loadConfig();
    const next = mergeConfig(data.config as Partial<AppConfig>);
    const now = new Date().toISOString();

    // Authorization/approval timestamps are server-enforced, not trusted from browser payloads.
    for (const id of ["yogi", "modi"] as const) {
      const c = next.characters[id];
      if (c.authorized && !c.permissionNote.trim()) {
        c.permissionNote = `Admin authorized likeness (${id}) at ${now}`;
      }
      c.authorizedAt = c.authorized
        ? prev.characters[id].authorized
          ? (prev.characters[id].authorizedAt ?? now)
          : now
        : null;
      c.approvedAssets = Object.fromEntries(
        Object.values(c.poses)
          .filter((p): p is string => !!p)
          .map((p) => [p, prev.characters[id].approvedAssets[p] ?? now]),
      );
    }

    next.bjp = next.bjp.map((b) => {
      const old = prev.bjp.find((o) => o.id === b.id);
      const sameAsset = old && old.asset === b.asset;
      return {
        ...b,
        approvedAt: b.approved
          ? old?.approved && sameAsset
            ? (old.approvedAt ?? now)
            : now
          : null,
      };
    });

    // Protected video fields remain locked to server state
    next.ai.videoEnabled = false;
    next.ai.videoVerifiedAt = null;
    next.ai.videoJobs = [];

    await saveConfig(next);
    return { ok: true, config: next };
  });

/** Video verification endpoint - video feature is disabled */
export const adminMarkVideoVerified = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.extend({ id: z.string().regex(/^[A-Za-z0-9_-]{6,128}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { checkAdmin } = await import("./config.server");
    checkAdmin(data.password);
    return { ok: false as const, error: "Video feature is disabled" };
  });

/** Signed direct-upload URL into the private assets bucket (admin only). */
export const adminUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    pw
      .extend({
        name: z.string().min(1).max(200),
        folder: z.string().regex(/^[a-z0-9-]{1,40}$/),
        size: z.number().int().positive(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { checkAdmin, admin } = await import("./config.server");
    checkAdmin(data.password);
    const ext = (data.name.split(".").pop() ?? "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5);
    if (!["png", "jpg", "jpeg", "webp", "glb", "gltf"].includes(ext))
      throw new Error("Unsupported file type");
    const max = ext === "glb" || ext === "gltf" ? 30_000_000 : 10_000_000;
    if (data.size > max) throw new Error("File too large");
    const path = `${data.folder}/${crypto.randomUUID()}.${ext}`;
    const sb = await admin();
    if (!sb) throw new Error("Upload not available: private storage is not configured.");
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
