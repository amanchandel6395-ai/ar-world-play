import { describe, expect, it } from "vitest";
import { getEnhancePrompt, SCENES } from "@/routes/api/enhance";
import { getInitialConfig, loadConfig, saveConfig, signPath } from "@/lib/config.server";
import { characterReady, bjpUsable, DEFAULT_CONFIG, mergeConfig } from "@/lib/config";
import { SCENES as AR_SCENES } from "@/ar/scenes";
import { REFERENCE_ASSETS, referenceUrl } from "@/lib/reference-assets";

describe("Workflow Tests: Complete Repository Repair & Features", () => {
  const baseCfg = getInitialConfig();

  it("A. Restores and validates Hug with Modi AI-generation workflow", () => {
    expect(SCENES).toContain("modi");
    const prompt = getEnhancePrompt("modi", "hug", baseCfg);
    expect(prompt).toContain("Prime Minister Narendra Modi");
    expect(prompt).toContain("hug");
    expect(prompt).toContain("embrace");
    expect(prompt).toContain("customer");
  });

  it("B. Restores and validates Handshake with Modi AI-generation workflow", () => {
    expect(SCENES).toContain("modi");
    const prompt = getEnhancePrompt("modi", "handshake", baseCfg);
    expect(prompt).toContain("Prime Minister Narendra Modi");
    expect(prompt).toContain("shaking hands");
    expect(prompt).toContain("handshake");
    expect(prompt).toContain("kurta");
  });

  it("C. Validates meeting scene using reference images", () => {
    const meetingPromptModi = getEnhancePrompt("modi", "meeting", baseCfg);
    expect(meetingPromptModi).toContain("formal meeting");
    expect(meetingPromptModi).toContain("Prime Minister Narendra Modi");

    const meetingPromptYogi = getEnhancePrompt("yogi", "meeting", baseCfg);
    expect(meetingPromptYogi).toContain("official meeting");
    expect(meetingPromptYogi).toContain("Chief Minister Yogi Adityanath");

    // Reference asset inventory check
    const meetingRef = REFERENCE_ASSETS.find((a) =>
      a.name.includes("dad172984729456a6c296ca94dc6c3cb"),
    );
    expect(meetingRef).toBeDefined();
    expect(meetingRef?.description).toContain("conversation");
  });

  it("D. Validates scarf-presentation scene using reference images", () => {
    const scarfPromptModi = getEnhancePrompt("modi", "scarf", baseCfg);
    expect(scarfPromptModi).toContain("saffron scarf");
    expect(scarfPromptModi).toContain("angavastram");

    const scarfPromptYogi = getEnhancePrompt("yogi", "scarf", baseCfg);
    expect(scarfPromptYogi).toContain("ceremonial saffron scarf");
    expect(scarfPromptYogi).toContain("Chief Minister Yogi Adityanath");

    // Reference assets check for scarf references
    const scarfRefs = REFERENCE_ASSETS.filter(
      (a) => a.name.includes("scarf") || a.description.includes("scarf"),
    );
    expect(scarfRefs.length).toBeGreaterThan(0);
  });

  it("E. Validates AI-generated BJP Look workflow with lotus and flag references", () => {
    expect(SCENES).toContain("bjp");
    const prompt = getEnhancePrompt("bjp", "selfie", baseCfg);
    expect(prompt).toContain("BJP");
    expect(prompt).toContain("lotus");
    expect(prompt).toContain("saffron and green");

    // Check BJP items in initial config
    expect(baseCfg.bjp.length).toBeGreaterThan(0);
    const hasLotus = baseCfg.bjp.some((b) => b.kind === "lotus" && b.approved && b.enabled);
    const hasFlag = baseCfg.bjp.some((b) => b.kind === "flag" && b.approved && b.enabled);
    expect(hasLotus).toBe(true);
    expect(hasFlag).toBe(true);
  });

  it("F. Validates Live camera selfie scene configuration & test asset readiness", () => {
    expect(AR_SCENES.yogi).toBeDefined();
    expect(AR_SCENES.modi).toBeDefined();
    expect(AR_SCENES.bjp).toBeDefined();

    // Yogi has authentic transparent cutout configured
    const yogiChar = baseCfg.characters.yogi;
    expect(characterReady(yogiChar)).toBe(true);
    expect(yogiChar.poses.selfie).toContain("dc5afdb0fe2b72a63ddddacca5ad7fc1.png");

    // BJP artwork is usable
    expect(baseCfg.bjp.every(bjpUsable)).toBe(true);
  });

  it("G. Validates reference asset URL resolution and signing", async () => {
    const yogiAsset = REFERENCE_ASSETS.find((a) => a.candidate === "yogi");
    if (!yogiAsset || !("url" in yogiAsset)) throw new Error("Missing yogi asset");
    const fullUrl = referenceUrl(yogiAsset.url);
    expect(fullUrl).toContain("dc5afdb0fe2b72a63ddddacca5ad7fc1.png");

    const signed = await signPath(fullUrl);
    expect(signed).toBe(fullUrl);
  });

  it("H. Validates Admin settings persistence and asset-readiness validation", async () => {
    const loaded = await loadConfig();
    expect(loaded).toBeDefined();
    expect(loaded.characters.yogi.enabled).toBe(true);

    // Save modified config and reload
    const modified = mergeConfig({
      ...loaded,
      ai: { ...loaded.ai, videoDuration: 8 },
    });
    await saveConfig(modified);

    const reloaded = await loadConfig();
    expect(reloaded.ai.videoDuration).toBe(8);
  });

  it("I. Validates Two-Provider AI generation integration (Lovable + Gemini)", async () => {
    const { handleEnhanceRequest, getEnhancePrompt, SCENES } = await import("@/routes/api/enhance");
    expect(handleEnhanceRequest).toBeDefined();
    expect(SCENES).toContain("modi");
    expect(SCENES).toContain("yogi");
    expect(SCENES).toContain("bjp");
    expect(SCENES).toContain("photo");
    expect(SCENES).toContain("demo");

    const cfg = await loadConfig();

    // Verify scene prompts contain expected identity-preserving guidelines and public figure styling
    const hugPrompt = getEnhancePrompt("modi", "hug", cfg);
    expect(hugPrompt).toContain("Narendra Modi");
    expect(hugPrompt).toContain("hug");

    const handshakePrompt = getEnhancePrompt("modi", "handshake", cfg);
    expect(handshakePrompt).toContain("handshake");

    const yogiMeetingPrompt = getEnhancePrompt("yogi", "meeting", cfg);
    expect(yogiMeetingPrompt).toContain("Yogi Adityanath");

    const bjpPrompt = getEnhancePrompt("bjp", "selfie", cfg);
    expect(bjpPrompt).toContain("BJP");

    // Verify 503 not_configured when neither key is provided
    const oldLovable = process.env["LOVABLE_API_KEY"];
    const oldGemini = process.env["GEMINI_API_KEY"];
    delete process.env["LOVABLE_API_KEY"];
    delete process.env["GEMINI_API_KEY"];

    try {
      const dummyReq = new Request("http://localhost/api/enhance", {
        method: "POST",
      });
      const res = await handleEnhanceRequest(dummyReq);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.code).toBe("not_configured");
    } finally {
      if (oldLovable) process.env["LOVABLE_API_KEY"] = oldLovable;
      if (oldGemini) process.env["GEMINI_API_KEY"] = oldGemini;
    }
  });

  it("J. Validates simulated Lovable retryable failure triggers fallback without infinite retries", async () => {
    const { handleEnhanceRequest } = await import("@/routes/api/enhance");
    const oldFetch = globalThis.fetch;
    const oldLovable = process.env["LOVABLE_API_KEY"];
    const oldGemini = process.env["GEMINI_API_KEY"];

    process.env["LOVABLE_API_KEY"] = "test-lovable-key";
    process.env["GEMINI_API_KEY"] = "test-gemini-key";

    let lovableCallCount = 0;

    // Simulate Lovable failing with retryable 429 rate limit
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : "url" in (input as { url?: string })
              ? String((input as { url?: string }).url)
              : String(input);
      if (url.includes("ai.gateway.lovable.dev")) {
        lovableCallCount++;
        return new Response("Rate limit exceeded", { status: 429 });
      }
      return oldFetch(input, init);
    };

    try {
      const form = new FormData();
      const dummyFile = new File([new Uint8Array([1, 2, 3, 4])], "selfie.jpg", {
        type: "image/jpeg",
      });
      form.append("image", dummyFile);
      form.append("scene", "photo");
      form.append("interaction", "selfie");

      const req = new Request("http://localhost/api/enhance", {
        method: "POST",
        body: form,
      });

      const res = await handleEnhanceRequest(req);
      // Lovable should be attempted exactly once (no infinite retry loop)
      expect(lovableCallCount).toBe(1);
      // Fallback triggers: response is structured failure code (403 denied, 429 busy, 502 failed, or 503)
      expect([403, 429, 502, 503]).toContain(res.status);
      const json = await res.json();
      expect(["denied", "busy", "failed", "credits"]).toContain(json.code);
    } finally {
      globalThis.fetch = oldFetch;
      if (oldLovable) process.env["LOVABLE_API_KEY"] = oldLovable;
      else delete process.env["LOVABLE_API_KEY"];
      if (oldGemini) process.env["GEMINI_API_KEY"] = oldGemini;
      else delete process.env["GEMINI_API_KEY"];
    }
  });
});
