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
    const keep =
      " Preserve the customer's exact identity, face, expression, hairstyle and skin tone. Do not add any other people. Professional DSLR portrait quality, sharp focus, natural skin, flattering soft light, clean composition, no distortion.";
    const scarf =
      "a saffron BJP scarf (patka / angavastram) with a clearly printed white-outlined lotus (kamal) symbol on both ends, draped neatly around the neck and over both shoulders";
    const byIx: Record<string, string> = {
      selfie: `Turn this customer photo into a professional studio-quality BJP supporter portrait. The customer wears ${scarf}. Background: soft blurred saffron-to-green gradient with a subtle large lotus emblem. Chest-up framing, confident smile.`,
      scarf: `Turn this customer photo into a professional BJP karyakarta portrait. The customer wears an authentic saffron BJP cap with the lotus emblem facing forward and ${scarf}. Background: outdoor rally ground with soft bokeh of saffron flags. Half-body framing.`,
      gift: `Turn this customer photo into a professional ceremonial photo: the customer, wearing ${scarf}, proudly holds a framed BJP lotus memento / shield (smriti chinh) in both hands at chest height. Background: decorated stage with marigold garlands and soft saffron lighting.`,
      event: `Turn this customer photo into a professional rally photo: the customer, wearing ${scarf}, waves a large official BJP flag (saffron and green with the white lotus symbol) held on a pole. Background: big festive crowd and stage, golden-hour light.`,
    };
    const base = (byIx[interaction] ?? byIx["selfie"]) + keep;
    return cfg.ai.bjpImagePrompt ? `${base} ${cfg.ai.bjpImagePrompt}` : base;
  }

  return "Enhance this photo with clean, dignified lighting and natural colors while preserving all identities.";
}

/** Extra rules so leaders and party material are never distorted, mirrored or upside down. */
export function accuracySuffix(scene: string): string {
  const common =
    " The first image is the customer; the second image (when given) is the official reference to copy exactly. The final image must be upright and correctly oriented: never upside down, never mirrored, never rotated, no extra or missing limbs, natural human proportions. Any text, logo or emblem must read the correct way round.";
  const pro =
    " Compose it as a professional photo taken by a photographer standing in front of both people (NOT an arm's-length selfie, no outstretched arm, no wide-angle distortion): both facing the camera, eye-level, 50mm lens look, sharp focus on both faces, balanced soft lighting, clean dignified background. Any saffron scarf / angavastram shown must carry a printed lotus (kamal) symbol.";
  if (scene === "yogi")
    return `${common}${pro} Chief Minister Yogi Adityanath must look exactly like the reference image (same face, saffron attire); do not invent a different face.`;
  if (scene === "modi")
    return `${common}${pro} Prime Minister Narendra Modi must look exactly like the reference image (same face, white beard, spectacles, attire); do not invent a different face.`;
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
    out.append("image[]", safeImageBlob, "capture.jpg");
    out.append("size", "1024x1536");
    out.append("output_format", "jpeg");
    if (refBlob) {
      const refBytes = await refBlob.arrayBuffer();
      const safeRefBlob = new globalThis.Blob([refBytes], {
        type: refBlob.type || "image/png",
      });
      out.append("image[]", safeRefBlob, "reference.png");
    }

    const res = await fetch(`${LOVABLE_GATEWAY}/v1/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let message = "The photo service could not complete this request.";
      try {
        const error = JSON.parse(errText) as { message?: string; error?: { message?: string } };
        message = error.error?.message || error.message || message;
      } catch {
        // Plain-text upstream errors are safe only when they are not HTML pages.
        if (errText && !errText.trimStart().startsWith("<")) message = errText.slice(0, 1000);
      }
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
      const retryable = status === 429 || status >= 500;
      return {
        success: false,
        category,
        status,
        retryable,
        message,
      };
    }

    const json = (await res.json()) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      return {
        success: false,
        category: "no_image_returned",
        status: 422,
        retryable: false,
        message: json.error?.message || "The photo service returned no completed image. This request has stopped.",
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

function blobToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i += 0x8000) {
    bin += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Backup provider: the owner's own Google Gemini key (GEMINI_API_KEY). */
async function callGemini(
  key: string,
  imageBlob: Blob,
  prompt: string,
  refBlob: Blob | null,
): Promise<ProviderResult> {
  try {
    const model = process.env["GEMINI_IMAGE_MODEL"] || "gemini-2.5-flash-image";
    const parts: Record<string, unknown>[] = [
      { text: prompt },
      {
        inline_data: {
          mime_type: imageBlob.type || "image/jpeg",
          data: blobToBase64(await imageBlob.arrayBuffer()),
        },
      },
    ];
    if (refBlob) {
      parts.push({
        inline_data: {
          mime_type: refBlob.type || "image/png",
          data: blobToBase64(await refBlob.arrayBuffer()),
        },
      });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      },
    );
    const text = await res.text().catch(() => "");
    let json: {
      error?: { message?: string };
      candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[];
    } = {};
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON body
    }
    if (!res.ok) {
      const status = res.status;
      return {
        success: false,
        category:
          status === 429 ? "rate_limit" : status === 401 || status === 403 ? "auth_error" : status >= 500 ? "server_error" : "bad_request",
        status,
        retryable: status === 429 || status >= 500,
        message: json.error?.message || "The backup photo service could not complete this request.",
      };
    }
    const b64 = json.candidates?.[0]?.content?.parts?.map((p) => p.inlineData?.data || p.inline_data?.data).find(Boolean);
    if (!b64) {
      return {
        success: false,
        category: "no_image_returned",
        status: 422,
        retryable: false,
        message: "The backup photo service returned no completed image. This request has stopped.",
      };
    }
    return { success: true, b64, category: "success", status: 200, retryable: false };
  } catch (err: unknown) {
    return {
      success: false,
      category: "network_error",
      status: 502,
      retryable: true,
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Lovable failures that the owner's backup key can cover (credits, busy, outages). Refusals never fall back. */
export function shouldUseBackup(res: ProviderResult): boolean {
  return (
    res.category === "quota" ||
    res.category === "rate_limit" ||
    res.category === "server_error" ||
    res.category === "network_error" ||
    res.category === "timeout" ||
    res.category === "not_configured"
  );
}

export async function handleEnhanceRequest(request: Request): Promise<Response> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];

  if (!lovableKey && !geminiKey) {
    logAiEvent("warn", {
      event: "ai_not_configured",
      provider: "lovable",
      scene: "unknown",
      category: "not_configured",
      status: 503,
    });
    return Response.json({ code: "not_configured", message: "The photo service key is not configured." }, { status: 503 });
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

  const primary: ProviderResult = lovableKey
    ? await callLovable(lovableKey, image, prompt, refBlob)
    : { success: false, category: "not_configured", status: 503, retryable: false, message: "Primary photo service key is not configured." };
  if (primary.success && primary.b64) {
    logAiEvent("info", {
      event: "ai_generation_success",
      provider: "lovable",
      scene,
      interaction,
    });
    return Response.json({ b64: primary.b64, provider: "lovable" });
  }

  const useBackup = !!geminiKey && shouldUseBackup(primary);
  logAiEvent("error", {
    event: "ai_provider_error",
    provider: "lovable",
    scene,
    interaction,
    category: primary.category,
    status: primary.status,
    fallbackTriggered: useBackup,
    errorSummary: primary.message,
  });

  let res = primary;
  if (useBackup && geminiKey) {
    const backup = await callGemini(geminiKey, image, prompt, refBlob);
    if (backup.success && backup.b64) {
      logAiEvent("info", { event: "ai_generation_success", provider: "gemini", scene, interaction });
      return Response.json({ b64: backup.b64, provider: "gemini" });
    }
    logAiEvent("error", {
      event: "ai_provider_error",
      provider: "gemini",
      scene,
      interaction,
      category: backup.category,
      status: backup.status,
      errorSummary: backup.message,
    });
    res = backup;
  }

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

  return Response.json({ code, message: res.message, retryable: res.retryable }, { status: finalStatus });
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
