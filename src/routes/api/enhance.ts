import { createFileRoute } from "@tanstack/react-router";
import { INTERACTIONS, type AppConfig } from "@/lib/config";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev";
const LOVABLE_MODEL = "openai/gpt-image-2.5-sunburst";
export const SCENES: string[] = ["yogi", "modi", "bjp", "photo", "demo"];

export function getEnhancePrompt(scene: string, interaction: string, cfg: AppConfig): string {
  if (scene === "demo") {
    return "Create a clearly AI-generated development test selfie from this customer-provided photo. Preserve the customer's identity, face, expression, pose, skin tone and clothing. Add exactly one fictional adult person with an original, ordinary appearance, standing beside the customer as if posing for a casual selfie. This fictional person must not resemble any real person, public figure, politician, celebrity, or recognizable character. Do not add political content, logos, flags, slogans, or text. Keep the customer recognizable and the result respectful.";
  }

  if (scene === "photo") {
    return "Make a subtle, faithful enhancement of this single customer photo. Improve exposure, white balance, contrast and detail. Preserve the person's exact identity, face shape, expression, pose, skin tone, clothing and all existing objects, symbols and text. Do not add or remove people or objects. Do not add political content, logos, flags or text. Do not reshape or beautify the face. Keep the result realistic and faithful to the original.";
  }

  if (scene === "modi") {
    if (interaction === "hug") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Prime Minister Narendra Modi sharing a warm, respectful friendly hug (gale milna / embrace) with the customer. Keep the customer's exact face, identity, hair, facial features, expression, skin tone, and clothing preserved. Prime Minister Narendra Modi is styled authentically with his neat white beard, spectacles, and traditional elegant kurta jacket, smiling warmly as they embrace. Professional warm stage lighting, clean dignified background, natural perspective.";
    }
    if (interaction === "handshake") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Prime Minister Narendra Modi shaking hands warmly and respectfully with the customer. Keep the customer's exact face, identity, hair, expression, skin tone, and clothing preserved. Prime Minister Narendra Modi is styled authentically in his classic kurta jacket and spectacles, greeting the customer with a respectful, warm smile and a firm handshake. Dignified professional lighting and natural background.";
    }
    if (interaction === "meeting") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of the customer seated in a friendly formal meeting with Prime Minister Narendra Modi, based on authentic meeting reference photographs. Keep the customer's exact face and identity preserved. Both seated in dignified chairs, conversing with warm professional expressions, elegant background with traditional decor.";
    }
    if (interaction === "scarf") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Prime Minister Narendra Modi presenting a traditional ceremonial saffron scarf (angavastram / uttariya) to the customer in a gesture of honor and respect. Keep the customer's exact face, expression, and identity preserved. Prime Minister Narendra Modi is smiling warmly, holding or draping the saffron stole. Dignified ceremonial lighting and background.";
    }
    if (interaction === "gift") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of the customer presenting a ceremonial gift or traditional flower bouquet / memento to Prime Minister Narendra Modi, with the Prime Minister accepting it with a warm welcoming smile. Keep the customer's exact face, expression, and identity preserved. Prime Minister Narendra Modi is styled authentically with neat white beard, spectacles, and traditional elegant kurta jacket. Dignified ceremonial event lighting and background.";
    }
    return "From this customer photo, create a realistic, photorealistic, high quality photo of Prime Minister Narendra Modi standing beside the customer smiling and greeting with folded hands in namaste / posing together for a selfie. Keep the customer's exact face and identity preserved. Prime Minister Narendra Modi in his signature kurta jacket and spectacles. Warm natural lighting.";
  }

  if (scene === "yogi") {
    if (interaction === "meeting") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath seated in an official meeting and friendly discussion with the customer, styled after official state meeting reference photographs. Chief Minister Yogi Adityanath in his traditional saffron attire, warm respectful expression. Keep the customer's exact face, hair, and identity preserved.";
    }
    if (interaction === "scarf") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath presenting a ceremonial saffron scarf / stole to the customer in honor and welcome. Chief Minister Yogi Adityanath in his traditional saffron robes, warm respectful expression. Keep the customer's exact identity and face preserved.";
    }
    if (interaction === "gift") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of the customer presenting a ceremonial gift, flower bouquet, or traditional memento to Chief Minister Yogi Adityanath, with the Chief Minister accepting it with a warm welcoming smile. Chief Minister Yogi Adityanath in his traditional saffron robes, warm respectful expression. Keep the customer's exact face and identity preserved.";
    }
    if (interaction === "handshake") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath shaking hands warmly with the customer. Chief Minister Yogi Adityanath in his traditional saffron attire. Keep the customer's exact face, hair, and identity preserved.";
    }
    if (interaction === "hug") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath sharing a warm respectful hug / friendly greeting with the customer. Chief Minister Yogi Adityanath in his traditional saffron attire. Keep the customer's exact face and identity preserved.";
    }
    return "From this customer photo, create a realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath standing with the customer in a friendly interaction. Chief Minister Yogi Adityanath in his traditional saffron robes. Keep the customer's exact face and identity preserved.";
  }

  if (scene === "bjp") {
    const base =
      "Enhance this vertical 9:16 customer photo with authentic BJP campaign and event styling. Drape a traditional BJP saffron and green scarf (angavastram / patka) with lotus symbol naturally over the customer's shoulders, a stylish BJP saffron cap with lotus emblem, and warm saffron and green festive stage lighting with a soft bokeh background featuring subtle saffron and green tones and the clean lotus emblem. Preserve the customer's exact identity, face, expression, and skin tone. Do not add any other people.";
    return cfg.ai.bjpImagePrompt ? `${base} ${cfg.ai.bjpImagePrompt}` : base;
  }

  return "Enhance this photo with clean, dignified lighting and natural colors while preserving all identities.";
}

/** Extra rules so leaders and party material are never distorted, mirrored or upside down. */
export function accuracySuffix(scene: string): string {
  const common =
    " The final image must be upright and correctly oriented: never upside down, never mirrored, never rotated, no extra or missing limbs, natural human proportions. Any text, logo or emblem must read the correct way round.";
  if (scene === "yogi")
    return `${common} Chief Minister Yogi Adityanath must look exactly like the reference image (same face, saffron attire); do not invent a different face.`;
  if (scene === "modi")
    return `${common} Prime Minister Narendra Modi must look exactly like the reference image (same face, white beard, spectacles, attire); do not invent a different face.`;
  if (scene === "bjp")
    return `${common} Copy the BJP cap, saffron-green scarf, lotus emblem and flag exactly as in the reference image: same colours, same lotus symbol, same design. The cap sits correctly on the head with the lotus emblem facing forward.`;
  return common;
}

/** Structured server-side logger that prevents leaking sensitive keys or private URLs. */
function logAiEvent(
  level: "info" | "warn" | "error",
  data: {
    event: string;
    provider: string;
    scene: string;
    interaction?: string;
    category?: string;
    status?: number;
    fallbackTriggered?: boolean;
    errorSummary?: string | undefined;
  },
) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data,
  });
  if (level === "error") {
    console.error(`[AI Enhance] ${payload}`);
  } else if (level === "warn") {
    console.warn(`[AI Enhance] ${payload}`);
  } else {
    console.log(`[AI Enhance] ${payload}`);
  }
}

interface ProviderResult {
  success: boolean;
  b64?: string;
  category:
    | "success"
    | "quota"
    | "rate_limit"
    | "auth_error"
    | "server_error"
    | "timeout"
    | "network_error"
    | "no_image_returned"
    | "not_configured"
    | "bad_request";
  status: number;
  retryable: boolean;
  message?: string;
}

/** Call primary Lovable AI provider. */
async function callLovable(
  key: string,
  imageBlob: Blob,
  prompt: string,
  refBlob: Blob | null,
): Promise<ProviderResult> {
  try {
    const out = new FormData();
    out.append("model", LOVABLE_MODEL);
    out.append("prompt", prompt);
    // Ensure blob is native to the runtime's global FormData context
    const imageBytes = await imageBlob.arrayBuffer();
    const safeImageBlob = new globalThis.Blob([imageBytes], {
      type: imageBlob.type || "image/jpeg",
    });
    out.append("image", safeImageBlob, "capture.jpg");
    out.append("size", "1024x1536");
    out.append("output_format", "jpeg");
    if (refBlob) {
      const refBytes = await refBlob.arrayBuffer();
      const safeRefBlob = new globalThis.Blob([refBytes], {
        type: refBlob.type || "image/png",
      });
      out.append("reference_image", safeRefBlob, "reference.png");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const res = await fetch(`${LOVABLE_GATEWAY}/v1/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const status = res.status;
      const category =
        status === 402
          ? "quota"
          : status === 429
            ? "rate_limit"
            : status === 401 || status === 403
              ? "auth_error"
              : status >= 500
                ? "server_error"
                : "bad_request";
      const retryable = status === 429 || status === 402 || status >= 500;
      return {
        success: false,
        category,
        status,
        retryable,
        message: errText.slice(0, 160),
      };
    }

    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      return {
        success: false,
        category: "no_image_returned",
        status: 502,
        retryable: true,
        message: "Empty image data in response",
      };
    }
    return { success: true, b64, category: "success", status: 200, retryable: false };
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    return {
      success: false,
      category: isTimeout ? "timeout" : "network_error",
      status: isTimeout ? 504 : 502,
      retryable: true,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function handleEnhanceRequest(request: Request): Promise<Response> {
  const lovableKey = process.env["LOVABLE_API_KEY"];

  if (!lovableKey) {
    logAiEvent("warn", {
      event: "ai_not_configured",
      provider: "lovable",
      scene: "unknown",
      category: "not_configured",
      status: 503,
    });
    return Response.json({ code: "not_configured" }, { status: 503 });
  }

  const form = await request.formData();
  const image = form.get("image");
  const scene = String(form.get("scene") ?? "");
  const interaction = String(form.get("interaction") ?? "selfie");

  const isImageBlob =
    (typeof File !== "undefined" && image instanceof File) ||
    (typeof Blob !== "undefined" && image instanceof Blob) ||
    (typeof image === "object" &&
      image !== null &&
      "size" in image &&
      "arrayBuffer" in image &&
      typeof (image as { arrayBuffer: unknown }).arrayBuffer === "function");

  if (
    !image ||
    !isImageBlob ||
    image.size > 10_000_000 ||
    !SCENES.includes(scene) ||
    !(INTERACTIONS as readonly string[]).includes(interaction)
  ) {
    return Response.json({ code: "invalid" }, { status: 400 });
  }

  const { loadConfig } = await import("@/lib/config.server");
  const cfg = await loadConfig();
  if (scene === "demo" ? !cfg.demo.enabled : !cfg.ai.imageEnabled) {
    return Response.json({ code: "not_configured" }, { status: 503 });
  }

  const prompt = `${getEnhancePrompt(scene, interaction, cfg)}${accuracySuffix(scene)}`;

  // Reference image from the repo's own approved assets, so the leader's face, cap, scarf
  // and the BJP flag/lotus match the real material exactly.
  const origin = new URL(request.url).origin;
  const refPath =
    scene === "yogi"
      ? "/assets/yogi.png"
      : scene === "modi"
        ? "/assets/modi.png"
        : scene === "bjp"
          ? "/assets/bjp.png"
          : null;
  const refUrl: string | null = refPath ? `${origin}${refPath}` : null;

  let refBlob: Blob | null = null;
  if (refUrl) {
    try {
      const refRes = await fetch(refUrl, { signal: AbortSignal.timeout(3500) });
      if (refRes.ok) {
        refBlob = await refRes.blob();
      }
    } catch {
      // Non-fatal if reference asset fetch times out; prompt conditioning applies
    }
  }

  const res = await callLovable(lovableKey, image, prompt, refBlob);
  if (res.success && res.b64) {
    logAiEvent("info", {
      event: "ai_generation_success",
      provider: "lovable",
      scene,
      interaction,
    });
    return Response.json({ b64: res.b64, provider: "lovable" });
  }

  logAiEvent("error", {
    event: "ai_provider_error",
    provider: "lovable",
    scene,
    interaction,
    category: res.category,
    status: res.status,
    fallbackTriggered: false,
    errorSummary: res.message,
  });

  const finalCategory = res.category;
  const finalStatus = res.status;
  const code =
    finalCategory === "quota"
      ? "credits"
      : finalCategory === "rate_limit"
        ? "busy"
        : finalCategory === "auth_error"
          ? "denied"
          : finalCategory === "not_configured"
            ? "not_configured"
            : "failed";

  return Response.json({ code }, { status: finalStatus });
}

/**
 * Post-capture AI image generation and styling using Lovable AI key.
 */
export const Route = createFileRoute("/api/enhance")({
  server: {
    handlers: {
      POST: ({ request }) => handleEnhanceRequest(request),
    },
  },
});
