import { createFileRoute } from "@tanstack/react-router";
import { INTERACTIONS } from "@/lib/config";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-image-2.5-sunburst";
const SCENES = ["yogi", "modi", "bjp"];

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
          return Response.json({ code: "invalid" }, { status: 400 });
        }
        const { loadConfig, presetPrompt, referenceFor } = await import("@/lib/config.server");
        const cfg = await loadConfig();
        if (!cfg.ai.imageEnabled) return Response.json({ code: "not_configured" }, { status: 503 });
        const ref = await referenceFor(cfg, scene);
        const out = new FormData();
        out.append("model", MODEL);
        out.append("prompt", presetPrompt(cfg, scene, interaction, "image", !!ref));
        if (ref) {
          out.append("image[]", image, "capture.jpg");
          out.append("image[]", ref, "reference.png");
        } else out.append("image", image, "capture.jpg");
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
