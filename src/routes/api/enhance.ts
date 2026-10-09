import { createFileRoute } from "@tanstack/react-router";
import { INTERACTIONS } from "@/lib/config";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-image-2.5-sunburst";
/** Fictional demo and faithful photo enhancement are separate from authorized asset styling. */
const SCENES: string[] = ["bjp", "photo", "demo"];

/**
 * Post-capture AI image. Never called on live frames. The customer never types a prompt:
 * scene + interaction select a preset instruction on the server. Key stays server-side.
 */
export const Route = createFileRoute("/api/enhance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ code: "not_configured" }, { status: 503 });
        const form = await request.formData();
        const image = form.get("image");
        const scene = String(form.get("scene") ?? "");
        const interaction = String(form.get("interaction") ?? "selfie");
        if (
          !(image instanceof File) ||
          image.size > 10_000_000 ||
          !SCENES.includes(scene) ||
          !(INTERACTIONS as readonly string[]).includes(interaction)
        ) {
          return Response.json({ code: scene === "yogi" || scene === "modi" ? "not_allowed" : "invalid" }, { status: 400 });
        }
        const { loadConfig, presetPrompt, bjpReady } = await import("@/lib/config.server");
        const cfg = await loadConfig();
        if (scene === "demo" ? !cfg.demo.enabled : !cfg.ai.imageEnabled || (scene === "bjp" && !bjpReady(cfg))) {
          return Response.json({ code: "not_configured" }, { status: 503 });
        }
        const out = new FormData();
        out.append("model", MODEL);
        const prompt = scene === "demo"
          ? "Create a clearly AI-generated demo selfie from this single customer photo. Preserve the customer's identity, face, expression, pose, skin tone and clothing. Add exactly one friendly, clearly fictional non-human orange robot companion with a simple original design, standing beside the customer as if posing for a casual selfie. The robot must not resemble any real person or recognizable character. Do not add any other people, public figures, political content, logos, flags, slogans or text. Keep the customer recognizable and the result respectful."
          : scene === "photo"
            ? "Make a subtle, faithful enhancement of this single customer photo. Improve exposure, white balance, contrast and detail. Preserve the person’s exact identity, face shape, expression, pose, skin tone, clothing and all existing objects, symbols and text. Do not add or remove people or objects. Do not add political content, logos, flags or text. Do not reshape or beautify the face. Keep the result realistic and faithful to the original."
            : presetPrompt(cfg, "image");
        out.append("prompt", prompt);
        out.append("image", image, "capture.jpg");
        out.append("size", "1024x1536");
        out.append("output_format", "jpeg");
        const res = await fetch(`${GATEWAY}/v1/images/edits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: out,
        });
        if (!res.ok) {
          const code = res.status === 402 ? "credits" : res.status === 429 ? "busy" : res.status === 403 ? "denied" : "failed";
          console.error("enhance failed", res.status, (await res.text()).slice(0, 300));
          return Response.json({ code }, { status: res.status });
        }
        const json = (await res.json()) as { data?: { b64_json?: string }[] };
        const b64 = json.data?.[0]?.b64_json;
        if (!b64) return Response.json({ code: "failed" }, { status: 502 });
        return Response.json({ b64 });
      },
    },
  },
});
