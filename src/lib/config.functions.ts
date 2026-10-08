import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AppConfig } from "./config";

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { loadConfig, toPublic } = await import("./config.server");
  return toPublic(await loadConfig());
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

export const adminSave = createServerFn({ method: "POST" })
  .inputValidator((d) => pw.extend({ config: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data }) => {
    const { checkAdmin, saveConfig } = await import("./config.server");
    const { mergeConfig } = await import("./config");
    checkAdmin(data.password);
    await saveConfig(mergeConfig(data.config as Partial<AppConfig>));
    return { ok: true };
  });

/** Signed direct-upload URL into the private assets bucket (admin only). */
export const adminUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    pw.extend({ name: z.string().min(1).max(200), folder: z.string().regex(/^[a-z0-9-]{1,40}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { checkAdmin, admin } = await import("./config.server");
    checkAdmin(data.password);
    const ext = (data.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    if (!["png", "jpg", "jpeg", "webp", "glb", "gltf"].includes(ext)) throw new Error("Unsupported file type");
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
