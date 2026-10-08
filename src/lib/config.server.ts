import { mergeConfig, type AppConfig, type CharacterId, type InteractionId, type PublicConfig } from "./config";

/** Server-only helpers. Never import from client code. */
export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadConfig(): Promise<AppConfig> {
  const sb = await admin();
  const { data } = await sb.from("app_config").select("data").eq("id", "main").maybeSingle();
  return mergeConfig(data?.data);
}

export async function saveConfig(cfg: AppConfig) {
  const sb = await admin();
  const { error } = await sb
    .from("app_config")
    .upsert({ id: "main", data: cfg as never, updated_at: new Date().toISOString() });
  if (error) throw new Error("Could not save settings");
}

export async function signPath(path: string | null, ttl = 6 * 3600): Promise<string | null> {
  if (!path) return null;
  const sb = await admin();
  const { data } = await sb.storage.from("assets").createSignedUrl(path, ttl);
  return data?.signedUrl ?? null;
}

export async function downloadAsset(path: string): Promise<Blob | null> {
  const sb = await admin();
  const { data } = await sb.storage.from("assets").download(path);
  return data ?? null;
}

export function checkAdmin(password: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("ADMIN_NOT_CONFIGURED");
  if (password.length !== expected.length) throw new Error("WRONG_PASSWORD");
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ password.charCodeAt(i);
  if (diff) throw new Error("WRONG_PASSWORD");
}

export async function toPublic(cfg: AppConfig): Promise<PublicConfig> {
  const hasKey = !!process.env["LOVABLE_API_KEY"];
  const pubChar = async (id: CharacterId) => {
    const { reference, ...c } = cfg.characters[id];
    const poses: Partial<Record<InteractionId, string>> = {};
    for (const [k, v] of Object.entries(c.poses)) {
      const u = await signPath(v ?? null);
      if (u) poses[k as InteractionId] = u;
    }
    return { ...c, thumbnail: await signPath(c.thumbnail), glb: await signPath(c.glb), poses, hasReference: !!reference };
  };
  const bjp = await Promise.all(
    cfg.bjp.filter((b) => b.enabled).map(async (b) => ({ ...b, asset: await signPath(b.asset) })),
  );
  return {
    characters: { yogi: await pubChar("yogi"), modi: await pubChar("modi") },
    bjp: bjp.filter((b) => b.asset || b.id.startsWith("builtin")),
    interactions: cfg.interactions.map(({ imagePrompt: _a, videoPrompt: _b, action: _c, ...r }) => r),
    ai: { imageEnabled: cfg.ai.imageEnabled, videoEnabled: cfg.ai.videoEnabled, imageReady: hasKey && cfg.ai.imageEnabled, videoReady: hasKey && cfg.ai.videoEnabled },
    brand: cfg.brand,
  };
}

const IMG_DEFAULT = (action: string, hasRef: boolean) =>
  `Create a photorealistic vertical 9:16 photo of the customer from the first image ${action}${hasRef ? " together with the person shown in the second (authorized reference) image" : ""}. Keep the customer's face, skin tone, hair and clothing exactly recognizable. Natural lighting, sharp focus, respectful and dignified.`;
const VID_DEFAULT = (action: string, hasRef: boolean) =>
  `A short photorealistic vertical video: the customer from the photo <FIRST_FRAME> ${action}${hasRef ? " with the person from the reference image <IMAGE_REF_0>" : ""}, in a single continuous shot, gentle camera movement, warm natural light, soft ambient crowd sound. No dialogue. Keep faces exactly recognizable.`;
const BJP_IMG =
  "Enhance this vertical 9:16 photo with festive saffron and green stage lighting and a soft bokeh background. Keep the person, face, pose, cap and scarf exactly as they are.";
const BJP_VID =
  "The person in the photo <FIRST_FRAME> smiles and waves at a festive saffron and green rally, single continuous shot, gentle push-in, cheerful crowd ambience. No dialogue. Keep the face exactly recognizable.";

/** Resolves the internal preset instruction for a scene + interaction. Customer never sees or types it. */
export function presetPrompt(cfg: AppConfig, scene: string, interaction: string, kind: "image" | "video", hasRef: boolean) {
  if (scene === "bjp") return kind === "image" ? cfg.ai.bjpImagePrompt || BJP_IMG : cfg.ai.bjpVideoPrompt || BJP_VID;
  const ix = cfg.interactions.find((i) => i.id === interaction) ?? cfg.interactions[0]!;
  const custom = kind === "image" ? ix.imagePrompt : ix.videoPrompt;
  if (custom) return custom;
  return kind === "image" ? IMG_DEFAULT(ix.action, hasRef) : VID_DEFAULT(ix.action, hasRef);
}

/** Authorized reference image for a character scene, or null when not authorized / not uploaded. */
export async function referenceFor(cfg: AppConfig, scene: string): Promise<Blob | null> {
  if (scene !== "yogi" && scene !== "modi") return null;
  const c = cfg.characters[scene];
  if (!c.authorized || !c.reference) return null;
  return downloadAsset(c.reference);
}
