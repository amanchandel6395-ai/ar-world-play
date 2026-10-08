/** Shared (browser-safe) app configuration types + defaults. Internal prompts are NOT part of the public config. */

export const INTERACTIONS = ["selfie", "namaste", "handshake", "hug", "walk", "meeting", "event"] as const;
export type InteractionId = (typeof INTERACTIONS)[number];
export type CharacterId = "yogi" | "modi";
export type Bilingual = { en: string; hi: string };

export type Character = {
  enabled: boolean;
  /** Admin confirms they hold written authorization for this likeness. Without it, only the stand-in is shown. */
  authorized: boolean;
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
  /** storage path; null = built-in 3D stand-in (cap/scarf only) */
  asset: string | null;
  approved: boolean;
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
};

export type AppConfig = {
  characters: Record<CharacterId, Character>;
  bjp: BjpItem[];
  interactions: Interaction[];
  ai: { imageEnabled: boolean; videoEnabled: boolean; videoDuration: number; bjpImagePrompt: string; bjpVideoPrompt: string };
  brand: { title: string; tagline: Bilingual; idleTimeoutSec: number; resultTimeoutSec: number };
};

/** What customers receive: prompts stripped, asset paths swapped for short-lived signed URLs. */
export type PublicConfig = {
  characters: Record<CharacterId, Omit<Character, "reference"> & { hasReference: boolean }>;
  bjp: BjpItem[];
  interactions: Omit<Interaction, "imagePrompt" | "videoPrompt">[];
  ai: { imageEnabled: boolean; videoEnabled: boolean; imageReady: boolean; videoReady: boolean };
  brand: AppConfig["brand"];
};

const char = (en: string, hi: string): Character => ({
  enabled: true,
  authorized: false,
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
  imagePrompt: `Create a photorealistic vertical 9:16 photo of the customer from the captured photo ${action} together with the person shown in the authorized reference image. Keep the customer's face, skin tone, hair and clothing exactly recognizable. Natural lighting, sharp focus, respectful and dignified.`,
  videoPrompt: `A short photorealistic vertical video: the customer from the photo ${action} with the person from the reference image, in a single continuous shot, gentle camera movement, warm natural light, soft ambient crowd sound. No dialogue. Keep both faces exactly recognizable.`,
});

export const DEFAULT_CONFIG: AppConfig = {
  characters: { yogi: char("CM Yogi Adityanath", "मुख्यमंत्री योगी आदित्यनाथ"), modi: char("PM Narendra Modi", "प्रधानमंत्री नरेंद्र मोदी") },
  bjp: [
    { id: "builtin-cap", kind: "cap", label: "Stand-in cap", asset: null, approved: true, enabled: true, anchor: "head", scale: 1, offsetX: 0, offsetY: 0, rotation: 0, order: 1 },
    { id: "builtin-scarf", kind: "scarf", label: "Stand-in scarf", asset: null, approved: true, enabled: true, anchor: "shoulders", scale: 1, offsetX: 0, offsetY: 0, rotation: 0, order: 2 },
  ],
  interactions: [
    ix("selfie", "🤳", "Selfie", "सेल्फ़ी", "standing side by side taking a selfie"),
    ix("namaste", "🙏", "Namaste", "नमस्ते", "greeting each other with folded hands in namaste"),
    ix("handshake", "🤝", "Handshake", "हाथ मिलाना", "shaking hands warmly"),
    ix("hug", "🫂", "Hug", "गले मिलना", "sharing a respectful friendly hug"),
    ix("walk", "🚶", "Walk", "साथ चलना", "walking together side by side"),
    ix("meeting", "💬", "Meeting", "मुलाक़ात", "seated in a friendly formal meeting"),
    ix("event", "🎉", "Event", "कार्यक्रम", "on stage at a public event with a festive crowd behind"),
  ],
  ai: {
    imageEnabled: true,
    videoEnabled: true,
    videoDuration: 6,
    bjpImagePrompt:
      "Enhance this vertical 9:16 photo with festive saffron and green stage lighting and a soft bokeh background. Keep the person, face, pose, cap and scarf exactly as they are.",
    bjpVideoPrompt:
      "The person in the photo smiles and waves at a festive saffron and green rally, single continuous shot, gentle push-in, cheerful crowd ambience. No dialogue. Keep the face exactly recognizable.",
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
      yogi: { ...d.characters.yogi, ...(s.characters?.yogi ?? {}) },
      modi: { ...d.characters.modi, ...(s.characters?.modi ?? {}) },
    },
    bjp: Array.isArray(s.bjp) ? s.bjp : d.bjp,
    interactions: d.interactions.map((di) => ({ ...di, ...(s.interactions?.find((x) => x.id === di.id) ?? {}) })),
    ai: { ...d.ai, ...(s.ai ?? {}) },
    brand: { ...d.brand, ...(s.brand ?? {}), tagline: { ...d.brand.tagline, ...(s.brand?.tagline ?? {}) } },
  };
}

export function toPublicDefault(): PublicConfig {
  const c = DEFAULT_CONFIG;
  const pc = (x: Character) => ({ ...x, reference: undefined, hasReference: false });
  return {
    characters: { yogi: pc(c.characters.yogi), modi: pc(c.characters.modi) },
    bjp: c.bjp,
    interactions: c.interactions.map(({ imagePrompt: _a, videoPrompt: _b, ...r }) => r),
    ai: { imageEnabled: false, videoEnabled: false, imageReady: false, videoReady: false },
    brand: c.brand,
  };
}
