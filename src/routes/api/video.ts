import { createFileRoute } from "@tanstack/react-router";
import { INTERACTIONS } from "@/lib/config";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "google/gemini-omni-1.1-flash";
/** AI runs only for the BJP Look. Yogi/Modi scenes never get AI images or videos of the leaders. */
const SCENES = ["modi", "yogi", "bjp", "photo", "demo"];
const ID_RE = /^[A-Za-z0-9_-]{6,128}$/;

const LEADER: Record<string, string> = {
  yogi: "Chief Minister Yogi Adityanath in his saffron attire, looking exactly like the second image",
  modi: "Prime Minister Narendra Modi with white beard and spectacles, looking exactly like the second image",
};
const SAFE =
  " Keep everyone's face, body and clothing exactly as in the photos, upright and correctly oriented, never mirrored or distorted. Audio: crowd ambience and soft festive music, no dialogue. No on-screen text.";

function getVideoPrompt(scene: string, interaction: string, style: string): string {
  const leader = LEADER[scene];
  if (leader && style === "walk") {
    return `The person from the photo walks side by side with ${leader} along a decorated road at a public rally, both smiling and waving to supporters, slow tracking shot from the front, single continuous vertical shot, no scene cuts.${SAFE}`;
  }
  if (leader && style === "car") {
    return `${leader} steps out of a white official convoy SUV, greets the person from the photo with folded hands, and then the two sit together in the back seat of the SUV smiling at the camera, gentle handheld camera, single continuous vertical shot, no scene cuts.${SAFE}`;
  }
  if (interaction === "flag") {
    return "The person in the photo smiles and waves proudly beside the official celebration flag wearing the ceremonial saffron stole, single continuous vertical shot, gentle push-in, celebratory festive lighting with lotus motifs, authentic natural motion.";
  }
  if (scene === "modi") {
    return `The person in the photo smiles warmly and greets Prime Minister Narendra Modi in a friendly ${interaction} moment, single continuous vertical shot, gentle subtle camera push-in, warm dignified celebration lighting, authentic natural motion.`;
  }
  if (scene === "yogi") {
    return `The person in the photo smiles warmly and greets Chief Minister Yogi Adityanath in a respectful ${interaction} gesture, single continuous vertical shot, gentle subtle camera push-in, warm celebratory lighting, authentic natural motion.`;
  }
  return "The person in the photo smiles and waves proudly wearing the ceremonial saffron stole, single continuous vertical shot, gentle push-in, celebratory festive lighting with lotus motifs, authentic natural motion.";
}

async function b64(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

const errCode = (status: number) =>
  status === 402 ? "credits" : status === 429 ? "busy" : status === 403 ? "denied" : "failed";

/**
 * Post-capture AI video. POST creates one job per explicit tap (preset instruction, no customer prompt).
 * GET ?id= polls; on completion the MP4 is stored in private storage and a signed URL is returned.
 */
export const Route = createFileRoute("/api/video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ code: "not_configured" }, { status: 503 });
        const form = await request.formData();
        const image = form.get("image");
        const scene = String(form.get("scene") ?? "");
        const interaction = String(form.get("interaction") ?? "selfie");
        const style = String(form.get("style") ?? "plain");
        if (
          !(image instanceof File) ||
          image.size > 10_000_000 ||
          !SCENES.includes(scene) ||
          !(INTERACTIONS as readonly string[]).includes(interaction)
        ) {
          return Response.json({ code: "invalid" }, { status: 400 });
        }
        const { loadConfig, saveConfig } = await import("@/lib/config.server");
        const cfg = await loadConfig();
        if (!cfg.ai.videoEnabled) {
          return Response.json({ code: "not_configured" }, { status: 503 });
        }
        const input: unknown[] = [
          { type: "text", text: getVideoPrompt(scene, interaction, style) },
          { type: "image", data: await b64(image), mime_type: image.type || "image/jpeg" },
        ];
        if (LEADER[scene] && (style === "walk" || style === "car")) {
          try {
            const ref = await fetch(`${new URL(request.url).origin}/assets/${scene}.png`);
            if (ref.ok) {
              const blob = await ref.blob();
              input.push({ type: "image", data: await b64(blob), mime_type: "image/png" });
            }
          } catch {
            // reference is optional; prompt still describes the leader
          }
        }
        const dur =
          style === "walk" || style === "car"
            ? 8
            : Math.min(10, Math.max(3, Math.round(cfg.ai.videoDuration || 6)));
        const res = await fetch(`${GATEWAY}/v1/videos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            input,
            response_format: {
              type: "video",
              resolution: "720p",
              duration: `${dur}s`,
              aspect_ratio: "9:16",
            },
          }),
        });
        if (!res.ok) {
          console.error("video create failed", res.status, (await res.text()).slice(0, 300));
          return Response.json({ code: errCode(res.status) }, { status: res.status });
        }
        const job = (await res.json()) as { id?: string };
        if (!job.id) return Response.json({ code: "failed" }, { status: 502 });
        const latest = await loadConfig();
        latest.ai.videoJobs = [...latest.ai.videoJobs.slice(-99), job.id];
        await saveConfig(latest);
        return Response.json({ id: job.id });
      },
      GET: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ code: "not_configured" }, { status: 503 });
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!ID_RE.test(id)) return Response.json({ code: "invalid" }, { status: 400 });
        const { admin, loadConfig } = await import("@/lib/config.server");
        const cfg = await loadConfig();
        if (!cfg.ai.videoEnabled || !cfg.ai.videoJobs.includes(id))
          return Response.json({ code: "not_configured" }, { status: 503 });
        const sb = await admin();
        if (!sb) return Response.json({ code: "not_configured" }, { status: 503 });
        const path = `videos/${id}.mp4`;
        const signed = () => sb.storage.from("captures").createSignedUrl(path, 3600);
        // Idempotent: already stored?
        const existing = await signed();
        if (existing.data)
          return Response.json({ status: "completed", url: existing.data.signedUrl, id });

        const res = await fetch(`${GATEWAY}/v1/videos/${id}`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!res.ok) return Response.json({ code: errCode(res.status) }, { status: res.status });
        const job = (await res.json()) as {
          status: string;
          progress?: number;
          error?: { code?: string; message?: string };
        };
        if (job.status === "failed") {
          return Response.json({
            status: "failed",
            code: job.error?.code ?? "failed",
            message: job.error?.message ?? "",
          });
        }
        if (job.status !== "completed")
          return Response.json({ status: "in_progress", progress: job.progress ?? null });
        const content = await fetch(`${GATEWAY}/v1/videos/${id}/content`, {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!content.ok) return Response.json({ code: "failed" }, { status: 502 });
        const bytes = new Uint8Array(await content.arrayBuffer());
        const up = await sb.storage
          .from("captures")
          .upload(path, bytes, { contentType: "video/mp4", upsert: true });
        if (up.error) return Response.json({ code: "failed" }, { status: 500 });
        const s = await signed();
        return Response.json({ status: "completed", url: s.data?.signedUrl ?? null, id });
      },
    },
  },
});
