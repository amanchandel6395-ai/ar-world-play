/** Shared (browser-safe) app configuration types + defaults. Internal prompts are NOT part of the public config. */

export const INTERACTIONS = [
  "selfie",
  "namaste",
  "handshake",
  "hug",
  "walk",
  "meeting",
  "scarf",
  "gift",
  "event",
  "flag",
] as const;
export type InteractionId = (typeof INTERACTIONS)[number];
export type CharacterId = "yogi" | "modi";
export type Bilingual = { en: string; hi: string };

export type ChromaKeyConfig = {
  enabled: boolean;
  color: string; // e.g. "#00FF00"
  similarity: number; // 0.05 to 0.95
  smoothness: number; // 0.01 to 0.5
};

export type VideoCutoutConfig = {
  enabled: boolean;
  url: string; // MP4 or WebM video path or base64/blob URL
  chromaKey: ChromaKeyConfig;
  muted: boolean;
  loop: boolean;
};

export type CustomStandee = {
  id: string;
  name: Bilingual;
  type: "image" | "video";
  assetUrl: string; // image cutout or video url
  thumbnail?: string;
  scale: number;
  heightCm: number; // e.g. 175cm (full body) or 95cm (bust)
  offsetX: number; // cm relative to user
  offsetY: number; // cm
  depthBevel: number; // acrylic thickness (0.5 to 3.0cm)
  shadowOpacity: number; // 0.0 to 1.0
  enabled: boolean;
  chromaKey?: ChromaKeyConfig;
};

export type SloganItem = {
  id: string;
  text: string;
  sub: string;
  icon: string;
  enabled: boolean;
};

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
  video?: VideoCutoutConfig;
  heightCm?: number;
  depthBevel?: number;
};

export type BjpKind =
  "cap" | "scarf" | "flag" | "lotus" | "art" | "background" | "frame" | "sticker";
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
  customStandees: CustomStandee[];
  slogans: SloganItem[];
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
    customGuidePrompt: string;
    referenceImages: string[];
    styleGuidance: string;
    primaryProvider: "gemini" | "lovable";
  };
  brand: { title: string; tagline: Bilingual; idleTimeoutSec: number; resultTimeoutSec: number };
};

export const HINDI_SLOGANS: SloganItem[] = [
  {
    id: "sarkar",
    text: "अबकी बार भाजपा सरकार",
    sub: "Abki Baar Bhajpa Sarkar",
    icon: "🗳️",
    enabled: true,
  },
  {
    id: "yogi",
    text: "मैं सीएम योगी जी के साथ हूँ",
    sub: "Main CM Yogi Ji Ke Sath Hoon",
    icon: "🚩",
    enabled: true,
  },
  {
    id: "modi",
    text: "मोदी है तो मुमकिन है",
    sub: "Modi Hai Toh Mumkin Hai",
    icon: "🇮🇳",
    enabled: true,
  },
  {
    id: "phir_ek_baar",
    text: "फिर एक बार मोदी सरकार",
    sub: "Phir Ek Baar Modi Sarkar",
    icon: "✨",
    enabled: true,
  },
  {
    id: "ek_bharat",
    text: "एक भारत, श्रेष्ठ भारत",
    sub: "Ek Bharat, Shreshtha Bharat",
    icon: "🏛️",
    enabled: true,
  },
  {
    id: "rashtra_pratham",
    text: "राष्ट्र प्रथम, सदैव प्रथम",
    sub: "Rashtra Pratham, Sadaiv Pratham",
    icon: "🛡️",
    enabled: true,
  },
  {
    id: "vikas_virasat",
    text: "विकास भी, विरासत भी",
    sub: "Vikas Bhi, Virasat Bhi",
    icon: "🌸",
    enabled: true,
  },
  { id: "jai_shri_ram", text: "जय श्री राम", sub: "Jai Shri Ram", icon: "🛕", enabled: true },
];

export type HindiSlogan = SloganItem;

/** What customers receive: prompts stripped, asset paths swapped for short-lived signed URLs. */
export type PublicConfig = {
  characters: Record<CharacterId, Omit<Character, "reference"> & { hasReference: boolean }>;
  customStandees: CustomStandee[];
  slogans: SloganItem[];
  bjp: BjpItem[];
  interactions: Omit<Interaction, "imagePrompt" | "videoPrompt" | "action">[];
  ai: {
    imageEnabled: boolean;
    videoEnabled: boolean;
    imageReady: boolean;
    videoReady: boolean;
    customGuidePrompt?: string;
    styleGuidance?: string;
  };
  demo: { aiReady: boolean };
  /** Per-scene readiness: true only when an authorized/approved asset is configured. */
  ready: Record<CharacterId | "bjp" | "both", boolean>;
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

const defaultCutout = (en: string, hi: string, img: string): Character => ({
  enabled: true,
  authorized: true,
  authorizedAt: "2026-10-09T10:36:04Z",
  permissionNote: `Authorized portrait cutout archive (${img})`,
  approvedAssets: { [img]: "2026-10-09T10:36:04Z" },
  name: { en, hi },
  reference: null,
  thumbnail: img,
  glb: null,
  poses: {
    selfie: img,
    walk: img,
    namaste: img,
    handshake: img,
    hug: img,
    meeting: img,
    scarf: img,
    event: img,
  },
  animations: {},
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotationY: 0,
});

const ix = (
  id: InteractionId,
  icon: string,
  en: string,
  hi: string,
  action: string,
): Interaction => ({
  id,
  enabled: true,
  icon,
  label: { en, hi },
  imagePrompt: "",
  videoPrompt: "",
  action,
});

export const DEFAULT_CONFIG: AppConfig = {
  characters: {
    yogi: defaultCutout("CM Yogi Adityanath", "मुख्यमंत्री योगी आदित्यनाथ", "/assets/yogi.png"),
    modi: defaultCutout("PM Narendra Modi", "प्रधानमंत्री नरेंद्र मोदी", "/assets/modi.png"),
  },
  bjp: [
    {
      id: "bjp-cheek-lotus-left",
      kind: "sticker",
      label: "कमल चीक्स (बायाँ) / Left Cheek Lotus",
      asset: "/assets/lotus_badge.png",
      approved: true,
      approvedAt: "2026-10-09T10:36:04Z",
      permissionNote: "Official 3D Lotus Emblem badge (/assets/lotus_badge.png)",
      enabled: true,
      anchor: "head",
      scale: 0.35,
      offsetX: -4.8,
      offsetY: -1.2,
      rotation: -8,
      order: 1,
    },
    {
      id: "bjp-cheek-lotus-right",
      kind: "sticker",
      label: "कमल चीक्स (दायाँ) / Right Cheek Lotus",
      asset: "/assets/lotus_badge.png",
      approved: true,
      approvedAt: "2026-10-09T10:36:04Z",
      permissionNote: "Official 3D Lotus Emblem badge (/assets/lotus_badge.png)",
      enabled: true,
      anchor: "head",
      scale: 0.35,
      offsetX: 4.8,
      offsetY: -1.2,
      rotation: 8,
      order: 2,
    },
    {
      id: "bjp-flag",
      kind: "flag",
      label: "भाजपा लहराता ध्वज / BJP Waving Flag",
      asset: "/assets/bjp.png",
      approved: true,
      approvedAt: "2026-10-09T10:36:04Z",
      permissionNote: "Official BJP flag archive (/assets/bjp.png)",
      enabled: true,
      anchor: "screen",
      scale: 26,
      offsetX: 32,
      offsetY: 32,
      rotation: 0,
      order: 3,
    },
    {
      id: "bjp-stole",
      kind: "scarf",
      label: "भगवा अंगवस्त्र / Saffron Stole",
      asset: "/assets/bjp.png",
      approved: true,
      approvedAt: "2026-10-09T10:36:04Z",
      permissionNote: "Official party sash archive (/assets/bjp.png)",
      enabled: true,
      anchor: "shoulders",
      scale: 1.1,
      offsetX: 0,
      offsetY: 2,
      rotation: 0,
      order: 4,
    },
  ],
  interactions: [
    ix("selfie", "🤳", "Selfie", "सेल्फ़ी", "standing side by side taking a selfie"),
    ix("namaste", "🙏", "Namaste", "नमस्ते", "greeting each other with folded hands in namaste"),
    ix("handshake", "🤝", "Handshake", "हाथ मिलाना", "shaking hands warmly"),
    ix("hug", "🫂", "Hug", "गले मिलना", "sharing a respectful friendly hug"),
    ix("walk", "🚶", "Walk", "साथ चलना", "walking together side by side"),
    ix("meeting", "💬", "Meeting", "मुलाक़ात", "seated in a friendly formal meeting"),
    ix(
      "scarf",
      "🧣",
      "Scarf Presentation",
      "अंगवस्त्र भेंट",
      "ceremonially presenting and draping a traditional saffron scarf",
    ),
    ix(
      "event",
      "🎉",
      "Event",
      "कार्यक्रम",
      "on stage at a public event with a festive crowd behind",
    ),
  ],
  demo: { enabled: true },
  customStandees: [],
  slogans: HINDI_SLOGANS,
  ai: {
    imageEnabled: false,
    videoEnabled: false,
    videoVerifiedAt: null,
    videoJobs: [],
    videoDuration: 6,
    bjpImagePrompt: "",
    bjpVideoPrompt: "",
    customGuidePrompt: "",
    referenceImages: [],
    styleGuidance:
      "High fidelity, dignified professional lighting, perfectly preserving customer facial features and identity.",
    primaryProvider: "gemini",
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
      yogi: {
        ...d.characters.yogi,
        ...(s.characters?.yogi ?? {}),
        approvedAssets: s.characters?.yogi?.approvedAssets ?? {},
      },
      modi: {
        ...d.characters.modi,
        ...(s.characters?.modi ?? {}),
        approvedAssets: s.characters?.modi?.approvedAssets ?? {},
      },
    },
    customStandees: Array.isArray(s.customStandees) ? s.customStandees : [],
    slogans: Array.isArray(s.slogans) && s.slogans.length > 0 ? s.slogans : d.slogans,
    // Built-in stand-in items are retired; only uploaded artwork can be used.
    bjp: (Array.isArray(s.bjp) ? s.bjp : d.bjp)
      .filter((b) => b && !String(b.id).startsWith("builtin"))
      .map((b) => ({
        ...b,
        approvedAt: b.approvedAt ?? null,
        permissionNote: b.permissionNote ?? "",
      })),
    interactions: d.interactions.map((di) => ({
      ...di,
      ...(s.interactions?.find((x) => x.id === di.id) ?? {}),
    })),
    demo: { enabled: typeof s.demo?.enabled === "boolean" ? s.demo.enabled : d.demo.enabled },
    ai: { ...d.ai, ...(s.ai ?? {}) },
    brand: {
      ...d.brand,
      ...(s.brand ?? {}),
      tagline: { ...d.brand.tagline, ...(s.brand?.tagline ?? {}) },
    },
  };
}

export function toPublicDefault(): PublicConfig {
  const c = DEFAULT_CONFIG;
  const pc = ({ reference: _r, ...x }: Character) => ({ ...x, hasReference: false });
  return {
    characters: { yogi: pc(c.characters.yogi), modi: pc(c.characters.modi) },
    customStandees: c.customStandees,
    slogans: c.slogans,
    bjp: c.bjp,
    interactions: c.interactions.map(({ imagePrompt: _a, videoPrompt: _b, action: _c, ...r }) => r),
    ai: {
      imageEnabled: false,
      videoEnabled: false,
      imageReady: false,
      videoReady: false,
      customGuidePrompt: c.ai.customGuidePrompt,
      styleGuidance: c.ai.styleGuidance,
    },
    demo: { aiReady: false },
    ready: { yogi: true, modi: true, bjp: true, both: true },
    brand: c.brand,
  };
}

/** Only explicitly approved flat cutouts are customer-ready; models and references never count. */
export const characterReady = (c: Character) =>
  c.enabled &&
  c.authorized &&
  !!c.authorizedAt &&
  !!c.permissionNote.trim() &&
  Object.values(c.poses).some((p) => p && c.approvedAssets[p]);

/** BJP artwork is usable only when uploaded, approved and enabled. */
export const bjpUsable = (b: BjpItem) =>
  !!b.asset && b.approved && !!b.approvedAt && !!b.permissionNote.trim() && b.enabled;
