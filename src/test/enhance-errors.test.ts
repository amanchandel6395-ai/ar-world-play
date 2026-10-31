import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@/lib/config";
import { handleEnhanceRequest } from "@/routes/api/enhance";

vi.mock("@/lib/config.server", () => ({
  loadConfig: async () => ({ ...DEFAULT_CONFIG, ai: { ...DEFAULT_CONFIG.ai, imageEnabled: true } }),
}));

function photoRequest() {
  const body = new FormData();
  body.append("image", new Blob(["photo"], { type: "image/jpeg" }), "photo.jpg");
  body.append("scene", "photo");
  body.append("interaction", "selfie");
  return new Request("http://localhost/api/enhance", { method: "POST", body });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Photo generation error recovery", () => {
  it.each([402, 403])("preserves HTTP %s and the service remedy without replay", async (status) => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { message: "Owner action required." } }, { status }));
    vi.stubGlobal("fetch", fetch);
    const response = await handleEnhanceRequest(photoRequest());
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ message: "Owner action required.", retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("allows a generation to complete after 45 seconds", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.useFakeTimers();
    const fetch = vi.fn(async (_input: unknown, init?: RequestInit) => {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      if (init?.signal?.aborted) throw new Error("Generation was aborted");
      return Response.json({ data: [{ b64_json: "aW1hZ2U=" }] });
    });
    vi.stubGlobal("fetch", fetch);
    const pending = handleEnhanceRequest(photoRequest());
    await vi.advanceTimersByTimeAsync(60_001);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ b64: "aW1hZ2U=" });
    expect(fetch.mock.calls[0]?.[1]?.signal).toBeUndefined();
  });

  it("stops an empty or refused image response without replay", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { message: "Request refused." } }));
    vi.stubGlobal("fetch", fetch);
    const response = await handleEnhanceRequest(photoRequest());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ message: "Request refused.", retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("Backup Gemini key", () => {
  const geminiOk = () =>
    Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: "Z2VtaW5p" } }] } }] });

  it("uses the backup key when Lovable credits run out (402)", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_KEY", "backup-key");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ message: "Out of credits" }, { status: 402 }))
      .mockResolvedValueOnce(geminiOk());
    vi.stubGlobal("fetch", fetch);
    const response = await handleEnhanceRequest(photoRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ b64: "Z2VtaW5p", provider: "gemini" });
    expect(String(fetch.mock.calls[1]?.[0])).toContain("generativelanguage.googleapis.com");
  });

  it("does not send a refused photo to the backup key", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    vi.stubEnv("GEMINI_API_KEY", "backup-key");
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { message: "Request refused." } }));
    vi.stubGlobal("fetch", fetch);
    const response = await handleEnhanceRequest(photoRequest());
    expect(response.status).toBe(422);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("works with only the backup key set", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "backup-key");
    const fetch = vi.fn().mockResolvedValue(geminiOk());
    vi.stubGlobal("fetch", fetch);
    const response = await handleEnhanceRequest(photoRequest());
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});