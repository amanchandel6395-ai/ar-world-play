import { createFileRoute } from "@tanstack/react-router";
import { INTERACTIONS, type AppConfig } from "@/lib/config";
import { GoogleGenAI } from "@google/genai";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev";
const LOVABLE_MODEL = "openai/gpt-image-2.5-sunburst";
const GEMINI_MODEL = "gemini-3.1-flash-lite-image";
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
    return "From this customer photo, create a realistic, photorealistic, high quality photo of Prime Minister Narendra Modi standing beside the customer smiling and greeting with folded hands in namaste / posing together for a selfie. Keep the customer's exact face and identity preserved. Prime Minister Narendra Modi in his signature kurta jacket and spectacles. Warm natural lighting.";
  }

  if (scene === "yogi") {
    if (interaction === "meeting") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath seated in an official meeting and friendly discussion with the customer, styled after official state meeting reference photographs. Chief Minister Yogi Adityanath in his traditional saffron attire, warm respectful expression. Keep the customer's exact face, hair, and identity preserved.";
    }
    if (interaction === "scarf") {
      return "From this customer photo, create a realistic, photorealistic, high quality photo of Chief Minister Yogi Adityanath presenting a ceremonial saffron scarf / stole to the customer in honor and welcome. Chief Minister Yogi Adityanath in his traditional saffron robes, warm respectful expression. Keep the customer's exact identity and face preserved.";
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
    errorSummary?: string;
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

/** Call backup Google Gemini API provider. */
async function callGemini(
  key: string,
  imageBlob: Blob,
  prompt: string,
  refBlob: Blob | null,
): Promise<ProviderResult> {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const imageBytes = Buffer.from(await imageBlob.arrayBuffer());

    const parts: Array<{ inlineData?: { data: string; mimeType: string }; text?: string }> = [
      {
        inlineData: {
          data: imageBytes.toString("base64"),
          mimeType: imageBlob.type || "image/jpeg",
        },
      },
    ];

    if (refBlob) {
      const refBytes = Buffer.from(await refBlob.arrayBuffer());
      parts.push({
        inlineData: {
          data: refBytes.toString("base64"),
          mimeType: refBlob.type || "image/png",
        },
      });
    }

    parts.push({ text: prompt });

    const callPromise = ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout after 45s")), 45000);
    });

    const response = await Promise.race([callPromise, timeoutPromise]);

    let b64: string | null = null;
    const candidates = response.candidates ?? [];
    for (const cand of candidates) {
      for (const part of cand.content?.parts ?? []) {
        if (part.inlineData?.data) {
          b64 = part.inlineData.data;
          break;
        }
      }
      if (b64) break;
    }

    if (!b64) {
      return {
        success: false,
        category: "no_image_returned",
        status: 502,
        retryable: true,
        message: "No image inlineData in Gemini response",
      };
    }

    return { success: true, b64, category: "success", status: 200, retryable: false };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isQuota =
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("credit") ||
      msg.includes("BILLING");
    const isRateLimit = !isQuota && (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED"));
    const isAuth =
      msg.includes("API key not valid") || msg.includes("PERMISSION_DENIED") || msg.includes("401");
    const isTimeout = msg.includes("Timeout");

    const category = isQuota
      ? "quota"
      : isRateLimit
        ? "rate_limit"
        : isAuth
          ? "auth_error"
          : isTimeout
            ? "timeout"
            : "server_error";
    const status = isQuota ? 402 : isRateLimit ? 429 : isAuth ? 403 : isTimeout ? 504 : 502;
    const retryable = isRateLimit || isTimeout;

    return {
      success: false,
      category,
      status,
      retryable,
      message: msg.slice(0, 160),
    };
  }
}

export async function handleEnhanceRequest(request: Request): Promise<Response> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];

  if (!lovableKey && !geminiKey) {
    logAiEvent("warn", {
      event: "ai_not_configured",
      provider: "none",
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

  const prompt = getEnhancePrompt(scene, interaction, cfg);

  // Pass matching reference image when available
  let refUrl: string | null = null;
  if (scene === "yogi") {
    refUrl =
      "https://id-preview--c8145deb-25b6-47a7-b2da-36518fcf6dba.lovable.app/__l5e/assets-v1/d3114b63-feb9-44d2-af69-a176900950e9/dc5afdb0fe2b72a63ddddacca5ad7fc1.png";
  } else if (scene === "bjp") {
    refUrl =
      "https://id-preview--c8145deb-25b6-47a7-b2da-36518fcf6dba.lovable.app/__l5e/assets-v1/4434408b-2a36-4cc4-84a4-952d49ac2dd5/BJP-Logo-700x394.png";
  }

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

  // Determine provider order
  const primaryProvider = (process.env["AI_PRIMARY_PROVIDER"] || "lovable").toLowerCase();
  const providers: Array<"lovable" | "gemini"> =
    primaryProvider === "gemini" ? ["gemini", "lovable"] : ["lovable", "gemini"];

  let lastResult: ProviderResult | null = null;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isPrimary = i === 0;

    if (provider === "lovable") {
      if (!lovableKey) {
        lastResult = {
          success: false,
          category: "not_configured",
          status: 503,
          retryable: true,
          message: "LOVABLE_API_KEY missing",
        };
        continue;
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
      lastResult = res;
      logAiEvent(isPrimary && res.retryable ? "warn" : "error", {
        event: "ai_provider_error",
        provider: "lovable",
        scene,
        interaction,
        category: res.category,
        status: res.status,
        fallbackTriggered: isPrimary && res.retryable,
        errorSummary: res.message,
      });
      if (!res.retryable && res.category === "bad_request") break;
    } else if (provider === "gemini") {
      if (!geminiKey) {
        lastResult = {
          success: false,
          category: "not_configured",
          status: 503,
          retryable: true,
          message: "GEMINI_API_KEY missing",
        };
        continue;
      }
      const res = await callGemini(geminiKey, image, prompt, refBlob);
      if (res.success && res.b64) {
        logAiEvent("info", {
          event: "ai_generation_success",
          provider: "gemini",
          scene,
          interaction,
        });
        return Response.json({ b64: res.b64, provider: "gemini" });
      }
      lastResult = res;
      logAiEvent("error", {
        event: "ai_provider_error",
        provider: "gemini",
        scene,
        interaction,
        category: res.category,
        status: res.status,
        fallbackTriggered: false,
        errorSummary: res.message,
      });
      if (!res.retryable && res.category === "bad_request") break;
    }
  }

  // If all providers failed
  const finalCategory = lastResult?.category ?? "server_error";
  const finalStatus = lastResult?.status ?? 502;
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

  logAiEvent("error", {
    event: "ai_all_providers_failed",
    provider: "all",
    scene,
    interaction,
    category: finalCategory,
    status: finalStatus,
  });

  return Response.json({ code }, { status: finalStatus });
}

/**
 * Post-capture AI image generation and styling with reliable two-provider failover:
 * Primary: Lovable AI
 * Backup: Google Gemini API
 */
export const Route = createFileRoute("/api/enhance")({
  server: {
    handlers: {
      POST: ({ request }) => handleEnhanceRequest(request),
    },
  },
});
