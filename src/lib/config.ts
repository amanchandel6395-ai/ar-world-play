/** Shared (browser-safe) app configuration types + defaults. Internal prompts are NOT part of the public config. */

export const INTERACTIONS = ["selfie", "namaste", "handshake", "hug", "walk", "meeting", "event"] as const;
export type InteractionId = (typeof INTERACTIONS)[number];
export type CharacterId = "yogi" | "modi";
export type Bilingual = { en: string; hi: string };

export type Character = {
  enabled: boolean;
  /** Admin confirms they hold written authorization for this likeness. Without it the scene stays disabled. */
  authorized: boolean;
  /** ISO timestamp when the admin recorded the authorization (audit trail). */
  authorizedAt: string | null;
  permissionNote: string;
  /** Exact uploaded cutout paths explicitly approved by staff; legacy approvals are not trusted. */
  approvedAssets: Record<string, string>;
  name: Bilingual;
  /** storage paths inside the private `assets` bucket (public config carries signed URLs instead) */
  reference: string | null;
  thumbnail: string | null;
  glb: string | null;
  poses: Partial<Record<InteractionId, string>>;
  animations: Partial<Record<InteractionId, string>>;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotationY: number;
};

export type BjpKind = "cap" | "scarf" | "flag" | "lotus" | "art" | "background" | "frame" | "sticker";
export type BjpAnchor = "head" | "shoulders" | "screen" | "background";
export type BjpItem = {
  id: string;
  kind: BjpKind;
  label: string;
  /** storage path of the exact uploaded artwork */
  asset: string | null;
  approved: boolean;
  /** ISO timestamp when the admin approved this artwork. */
  approvedAt: string | null;
  permissionNote: string;
  enabled: boolean;
  anchor: BjpAnchor;
  /** width in cm (head/shoulders: relative to shoulder width x100) or % of screen width (screen) */
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  order: number;
};

export type Interaction = {
  id: InteractionId;
  enabled: boolean;
  label: Bilingual;
  icon: string;
  /** internal, server only */
  imagePrompt: string;
  videoPrompt: string;
  /** short internal action phrase used by default prompts */
  action: string;
};

export type AppConfig = {
  characters: Record<CharacterId, Character>;
  bjp: BjpItem[];
  interactions: Interaction[];
  /** Independent switch for the fictional, post-capture test experience. */
  demo: { enabled: boolean };
  ai: {
    /** BJP Look post-capture styling only. AI is never used for Yogi/Modi scenes. */
    imageEnabled: boolean;
    videoEnabled: boolean;
    /** ISO timestamp of the last successful end-to-end video test run from the admin page. */
    videoVerifiedAt: string | null;
    videoJobs: string[];
    videoDuration: number;
    bjpImagePrompt: string;
    bjpVideoPrompt: string;
  };
  brand: { title: string; tagline: Bilingual; idleTimeoutSec: number; resultTimeoutSec: number };
};

/** What customers receive: prompts stripped, asset paths swapped for short-lived signed URLs. */
export type PublicConfig = {
  characters: Record<CharacterId, Omit<Character, "reference"> & { hasReference: boolean }>;
  bjp: BjpItem[];
  interactions: Omit<Interaction, "imagePrompt" | "videoPrompt" | "action">[];
  ai: { imageEnabled: boolean; videoEnabled: boolean; imageReady: boolean; videoReady: boolean };
  demo: { aiReady: boolean };
  /** Per-scene readiness: true only when an authorized/approved asset is configured. */
  ready: Record<CharacterId | "bjp", boolean>;
  brand: AppConfig["brand"];
};

const char = (en: string, hi: string): Character => ({
  enabled: true,
  authorized: false,
  authorizedAt: null,
  permissionNote: "",
  approvedAssets: {},
  name: { en, hi },
  reference: null,
  thumbnail: null,
  glb: null,
  poses: {},
  animations: {},
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotationY: 0,
});

const ix = (id: InteractionId, icon: string, en: string, hi: string, action: string): Interaction => ({
  id,
  enabled: true,
  icon,
  label: { en, hi },
  imagePrompt: "",
  videoPrompt: "",
  action,
});

export const DEFAULT_CONFIG: AppConfig = {
  characters: { yogi: char("CM Yogi Adityanath", "मुख्यमंत्री योगी आदित्यनाथ"), modi: char("PM Narendra Modi", "प्रधानमंत्री नरेंद्र मोदी") },
  bjp: [],
  interactions: [
    ix("selfie", "🤳", "Selfie", "सेल्फ़ी", "standing side by side taking a selfie"),
    ix("namaste", "🙏", "Namaste", "नमस्ते", "greeting each other with folded hands in namaste"),
    ix("handshake", "🤝", "Handshake", "हाथ मिलाना", "shaking hands warmly"),
    ix("hug", "🫂", "Hug", "गले मिलना", "sharing a respectful friendly hug"),
    ix("walk", "🚶", "Walk", "साथ चलना", "walking together side by side"),
    ix("meeting", "💬", "Meeting", "मुलाक़ात", "seated in a friendly formal meeting"),
    ix("event", "🎉", "Event", "कार्यक्रम", "on stage at a public event with a festive crowd behind"),
  ],
  demo: { enabled: true },
  ai: {
    imageEnabled: false,
    videoEnabled: false,
    videoVerifiedAt: null,
    videoJobs: [],
    videoDuration: 6,
    bjpImagePrompt: "",
    bjpVideoPrompt: "",
  },
  brand: {
    title: "ZUITAR",
    tagline: { en: "Choose Your Experience", hi: "अपना अनुभव चुनें" },
    idleTimeoutSec: 120,
    resultTimeoutSec: 90,
  },
};

/** Deep-merge a stored partial config over defaults so new fields always exist. */
export function mergeConfig(stored: unknown): AppConfig {
  const s = (stored && typeof stored === "object" ? stored : {}) as Partial<AppConfig>;
  const d = DEFAULT_CONFIG;
  return {
    characters: {
      yogi: { ...d.characters.yogi, ...(s.characters?.yogi ?? {}), approvedAssets: s.characters?.yogi?.approvedAssets ?? {} },
      modi: { ...d.characters.modi, ...(s.characters?.modi ?? {}), approvedAssets: s.characters?.modi?.approvedAssets ?? {} },
    },
    // Built-in stand-in items are retired; only uploaded artwork can be used.
    bjp: (Array.isArray(s.bjp) ? s.bjp : d.bjp)
      .filter((b) => b && !String(b.id).startsWith("builtin"))
      .map((b) => ({ ...b, approvedAt: b.approvedAt ?? null, permissionNote: b.permissionNote ?? "" })),
    interactions: d.interactions.map((di) => ({ ...di, ...(s.interactions?.find((x) => x.id === di.id) ?? {}) })),
    demo: { enabled: typeof s.demo?.enabled === "boolean" ? s.demo.enabled : d.demo.enabled },
    ai: { ...d.ai, ...(s.ai ?? {}) },
    brand: { ...d.brand, ...(s.brand ?? {}), tagline: { ...d.brand.tagline, ...(s.brand?.tagline ?? {}) } },
  };
}

export function toPublicDefault(): PublicConfig {
  const c = DEFAULT_CONFIG;
  const pc = ({ reference: _r, ...x }: Character) => ({ ...x, hasReference: false });
  return {
    characters: { yogi: pc(c.characters.yogi), modi: pc(c.characters.modi) },
    bjp: c.bjp,
    interactions: c.interactions.map(({ imagePrompt: _a, videoPrompt: _b, action: _c, ...r }) => r),
    ai: { imageEnabled: false, videoEnabled: false, imageReady: false, videoReady: false },
    demo: { aiReady: false },
    ready: { yogi: false, modi: false, bjp: false },
    brand: c.brand,
  };
}

/** Only explicitly approved flat cutouts are customer-ready; models and references never count. */
export const characterReady = (c: Character) =>
  c.enabled && c.authorized && !!c.authorizedAt && !!c.permissionNote.trim() && Object.values(c.poses).some((p) => p && c.approvedAssets[p]);

/** BJP artwork is usable only when uploaded, approved and enabled. */
export const bjpUsable = (b: BjpItem) => !!b.asset && b.approved && !!b.approvedAt && !!b.permissionNote.trim() && b.enabled;
