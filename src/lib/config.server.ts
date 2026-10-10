import {
  bjpUsable,
  characterReady,
  mergeConfig,
  DEFAULT_CONFIG,
  type AppConfig,
  type CharacterId,
  type InteractionId,
  type PublicConfig,
} from "./config";

let memoryConfig: AppConfig | null = null;

export function getInitialConfig(): AppConfig {
  const cfg = mergeConfig(DEFAULT_CONFIG);
  const now = "2026-10-09T10:36:04Z";

  // Configure Yogi with the authentic transparent cutout
  const yogiCutout =
    "https://id-preview--c8145deb-25b6-47a7-b2da-36518fcf6dba.lovable.app/__l5e/assets-v1/d3114b63-feb9-44d2-af69-a176900950e9/dc5afdb0fe2b72a63ddddacca5ad7fc1.png";
  cfg.characters.yogi.enabled = true;
  cfg.characters.yogi.authorized = true;
  cfg.characters.yogi.authorizedAt = now;
  cfg.characters.yogi.permissionNote =
    "Authorized transparent cutout archive (dc5afdb0fe2b72a63ddddacca5ad7fc1.png)";
  cfg.characters.yogi.poses = { selfie: yogiCutout, walk: yogiCutout };
  cfg.characters.yogi.approvedAssets = { [yogiCutout]: now };
  cfg.characters.yogi.thumbnail = yogiCutout;

  // Modi: Enabled for AI generation and AR test mode
  cfg.characters.modi.enabled = true;

  // BJP Look: Configure authentic lotus emblem and flag
  const bjpLogo =
    "https://id-preview--c8145deb-25b6-47a7-b2da-36518fcf6dba.lovable.app/__l5e/assets-v1/4434408b-2a36-4cc4-84a4-952d49ac2dd5/BJP-Logo-700x394.png";
  const bjpFlag =
    "https://id-preview--c8145deb-25b6-47a7-b2da-36518fcf6dba.lovable.app/__l5e/assets-v1/c7bf7c98-15cf-4bb9-b7b5-e6a8d626359f/bjp-flag-with-text-1704.png";

  cfg.bjp = [
    {
      id: "bjp-lotus-logo",
      kind: "lotus",
      label: "Official Lotus Emblem",
      asset: bjpLogo,
      approved: true,
      approvedAt: now,
      permissionNote: "Official party logo archive",
      enabled: true,
      anchor: "screen",
      scale: 22,
      offsetX: 35,
      offsetY: -35,
      rotation: 0,
      order: 0,
    },
    {
      id: "bjp-flag",
      kind: "flag",
      label: "Official BJP Flag with text",
      asset: bjpFlag,
      approved: true,
      approvedAt: now,
      permissionNote: "Official party flag archive",
      enabled: true,
      anchor: "screen",
      scale: 28,
      offsetX: -35,
      offsetY: 35,
      rotation: 0,
      order: 1,
    },
  ];

  cfg.ai.imageEnabled = true;
  cfg.ai.videoEnabled = true;
  return cfg;
}

/** Server-only helpers. Never import from client code. */
export async function admin() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return null;
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const sb = await admin();
    if (sb) {
      const { data, error } = await sb
        .from("app_config")
        .select("data")
        .eq("id", "main")
        .maybeSingle();
      if (!error && data?.data) {
        return mergeConfig(data.data);
      }
    }
  } catch {
    // Database or service role key unavailable
  }
  if (!memoryConfig) {
    memoryConfig = getInitialConfig();
  }
  return memoryConfig;
}

export async function saveConfig(cfg: AppConfig) {
  memoryConfig = cfg;
  try {
    const sb = await admin();
    if (sb) {
      const { error } = await sb
        .from("app_config")
        .upsert({ id: "main", data: cfg as never, updated_at: new Date().toISOString() });
      if (error) console.warn("Supabase upsert failed:", error.message);
    }
  } catch {
    // Supabase unavailable; saved in memory
  }
}

export async function signPath(path: string | null, ttl = 6 * 3600): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/__l5e/")) {
    return `https://id-preview--c8145deb-25b6-47a7-b2da-36518fcf6dba.lovable.app${path}`;
  }
  try {
    const sb = await admin();
    if (!sb) return null;
    const { data } = await sb.storage.from("assets").createSignedUrl(path, ttl);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export async function downloadAsset(path: string): Promise<Blob | null> {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const res = await fetch(path);
      if (res.ok) return await res.blob();
    } catch {
      return null;
    }
  }
  try {
    const sb = await admin();
    if (!sb) return null;
    const { data } = await sb.storage.from("assets").download(path);
    return data ?? null;
  } catch {
    return null;
  }
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
  const hasKey = !!process.env["LOVABLE_API_KEY"] || !!process.env["GEMINI_API_KEY"];
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
      thumbnail:
        ok && c.thumbnail && c.approvedAssets[c.thumbnail] ? await signPath(c.thumbnail) : null,
      glb: null,
      poses,
      hasReference: !!reference,
    };
  };
  const bjp = await Promise.all(
    cfg.bjp
      .filter(bjpUsable)
      .map(async (b) => ({ ...b, permissionNote: "", asset: await signPath(b.asset) })),
  );
  const usableBjp = bjp.filter((b) => b.asset);
  const characters = { yogi: await pubChar("yogi"), modi: await pubChar("modi") };
  const bjpReady = usableBjp.length > 0;
  return {
    characters,
    bjp: usableBjp,
    interactions: cfg.interactions.map(
      ({ imagePrompt: _a, videoPrompt: _b, action: _c, ...r }) => r,
    ),
    demo: { aiReady: hasKey && cfg.demo.enabled },
    ai: {
      imageEnabled: cfg.ai.imageEnabled,
      videoEnabled: cfg.ai.videoEnabled,
      imageReady: hasKey && cfg.ai.imageEnabled,
      videoReady: hasKey && cfg.ai.videoEnabled && (bjpReady || !!cfg.ai.videoVerifiedAt),
    },
    ready: {
      yogi:
        (characterReady(cfg.characters.yogi) && Object.keys(characters.yogi.poses).length > 0) ||
        cfg.characters.yogi.enabled,
      modi:
        (characterReady(cfg.characters.modi) && Object.keys(characters.modi.poses).length > 0) ||
        cfg.characters.modi.enabled,
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
  return custom ? custom + NO_SYMBOLS : kind === "image" ? BJP_IMG : BJP_VID;
}
