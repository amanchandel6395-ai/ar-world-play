import { createFileRoute } from "@tanstack/react-router";
import { SCENES, isSceneId } from "@/ar/scenes";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-image-2.5-sunburst";

/** Post-capture only AI enhancement. Never called on live frames. Key stays server-side. */
export const Route = createFileRoute("/api/enhance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI enhancement is not configured", { status: 503 });
        const form = await request.formData();
        const image = form.get("image");
        const scene = String(form.get("scene") ?? "");
        if (!(image instanceof File) || image.size > 10_000_000 || !isSceneId(scene)) {
          return new Response("Invalid request", { status: 400 });
        }
        const out = new FormData();
        out.append("model", MODEL);
        out.append("prompt", SCENES[scene].capture.aiPrompt);
        out.append("image", image, "capture.jpg");
        out.append("output_format", "jpeg");
        const res = await fetch(`${GATEWAY}/v1/images/edits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: out,
        });
        if (!res.ok) {
          const msg =
            res.status === 402
              ? "AI credits are used up for now."
              : res.status === 429
                ? "Too many requests, try again in a moment."
                : "AI enhancement failed.";
          return new Response(msg, { status: res.status });
        }
        const json = (await res.json()) as { data?: { b64_json?: string }[] };
        const b64 = json.data?.[0]?.b64_json;
        if (!b64) return new Response("AI returned no image.", { status: 502 });
        return Response.json({ b64 });
      },
    },
  },
});
