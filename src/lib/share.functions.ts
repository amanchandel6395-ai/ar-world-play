import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SHARE_TTL_HOURS = 24;

export const createShare = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        imageBase64: z.string().min(100).max(12_000_000),
        aiGenerated: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
    // JPEG magic bytes check
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Only JPEG photos are accepted");
    const rand = new Uint8Array(24);
    crypto.getRandomValues(rand);
    const token = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");
    const path = `${new Date().toISOString().slice(0, 10)}/${token}.jpg`;
    const up = await supabaseAdmin.storage.from("captures").upload(path, bytes, { contentType: "image/jpeg" });
    if (up.error) throw new Error("Could not store photo");
    const expires = new Date(Date.now() + SHARE_TTL_HOURS * 3600_000).toISOString();
    const ins = await supabaseAdmin
      .from("shares")
      .insert({ token, path, kind: "photo", ai_generated: data.aiGenerated, expires_at: expires });
    if (ins.error) throw new Error("Could not create share link");
    return { token, expiresAt: expires };
  });

export const getShare = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("shares")
      .select("path, kind, ai_generated, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) return { status: "expired" as const };
    const signed = await supabaseAdmin.storage.from("captures").createSignedUrl(row.path, 3600);
    const dl = await supabaseAdmin.storage.from("captures").createSignedUrl(row.path, 3600, { download: "zuitar-photo.jpg" });
    if (!signed.data || !dl.data) return { status: "expired" as const };
    return {
      status: "ok" as const,
      kind: row.kind,
      aiGenerated: row.ai_generated,
      url: signed.data.signedUrl,
      downloadUrl: dl.data.signedUrl,
      expiresAt: row.expires_at,
    };
  });
