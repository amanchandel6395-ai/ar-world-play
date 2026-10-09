import { bjpUsable, characterReady, mergeConfig, type AppConfig, type CharacterId, type InteractionId, type PublicConfig } from "./config";

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
    const ok = characterReady(cfg.characters[id]);
    // Unauthorized likeness assets are never signed or sent to customers.
    const poses: Partial<Record<InteractionId, string>> = {};
    if (ok) {
      for (const [k, v] of Object.entries(c.poses)) {
        if (!v || !c.approvedAssets[v]) continue;
        const u = await signPath(v);
        if (u) poses[k as InteractionId] = u;
      }
    }
    return {
      ...c,
      permissionNote: "",
      approvedAssets: {},
      animations: {},
      thumbnail: ok && c.thumbnail && c.approvedAssets[c.thumbnail] ? await signPath(c.thumbnail) : null,
      glb: null,
      poses,
      hasReference: !!reference,
    };
  };
  const bjp = await Promise.all(cfg.bjp.filter(bjpUsable).map(async (b) => ({ ...b, permissionNote: "", asset: await signPath(b.asset) })));
  const usableBjp = bjp.filter((b) => b.asset);
  const characters = { yogi: await pubChar("yogi"), modi: await pubChar("modi") };
  const bjpReady = usableBjp.length > 0;
  return {
    characters,
    bjp: usableBjp,
    interactions: cfg.interactions.map(({ imagePrompt: _a, videoPrompt: _b, action: _c, ...r }) => r),
    demo: { aiReady: hasKey && cfg.demo.enabled },
    ai: {
      imageEnabled: cfg.ai.imageEnabled,
      videoEnabled: cfg.ai.videoEnabled,
      imageReady: hasKey && cfg.ai.imageEnabled && bjpReady,
      videoReady: hasKey && cfg.ai.videoEnabled && bjpReady && !!cfg.ai.videoVerifiedAt,
    },
    ready: {
      yogi: characterReady(cfg.characters.yogi) && Object.keys(characters.yogi.poses).length > 0,
      modi: characterReady(cfg.characters.modi) && Object.keys(characters.modi.poses).length > 0,
      bjp: bjpReady,
    },
    brand: cfg.brand,
  };
}

/** True when the BJP Look has at least one uploaded, approved, enabled artwork item. */
export const bjpReady = (cfg: AppConfig) => cfg.bjp.some(bjpUsable);

const NO_SYMBOLS =
  " Do not add, draw, alter or invent any logo, party symbol, flag, text or person. Do not add any other people. Keep every existing item exactly as it appears.";
const BJP_IMG =
  "Enhance this vertical 9:16 photo with warm saffron and green stage lighting and a soft, plain bokeh background. Keep the person, face, pose and the cap/scarf/artwork they wear exactly as they are." +
  NO_SYMBOLS;
const BJP_VID =
  "The person in the photo <FIRST_FRAME> smiles and waves, single continuous shot, gentle push-in, warm saffron and green lighting, soft plain background. No dialogue. Keep the face and everything they wear exactly as in the photo." +
  NO_SYMBOLS;

/**
 * Internal preset for the BJP Look. Generic customer-photo enhancement uses a separate
 * constrained prompt in the API route. Yogi/Modi scenes have no AI preset by design.
 */
export function presetPrompt(cfg: AppConfig, kind: "image" | "video") {
  const custom = kind === "image" ? cfg.ai.bjpImagePrompt : cfg.ai.bjpVideoPrompt;
  return (custom ? custom + NO_SYMBOLS : kind === "image" ? BJP_IMG : BJP_VID);
}
