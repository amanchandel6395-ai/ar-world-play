import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_CONFIG } from "@/lib/config";
import { adminConfigInputSchema } from "@/lib/config.functions";
import { loadAdminConfigForPassword } from "@/lib/config.server";
import { handleVideoGet, handleVideoPost } from "@/routes/api/video";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("selected security fixes", () => {
  it("keeps app configuration private to the server database role", () => {
    const migration = readFileSync(
      "drizzle/migrations/0003_restrict_app_config_access.sql",
      "utf8",
    );
    expect(migration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.app_config FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain(
      "GRANT ALL PRIVILEGES ON TABLE public.app_config TO service_role;",
    );
  });

  it("requires the booth password before video job creation or polling", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "booth-test-password");
    vi.stubEnv("LOVABLE_API_KEY", "");
    const post = await handleVideoPost(
      new Request("http://localhost/api/video", { method: "POST" }),
    );
    const get = await handleVideoGet(new Request("http://localhost/api/video?id=video123"));

    expect(post.status).toBe(401);
    expect(get.status).toBe(401);
    expect(await post.json()).toEqual({ code: "unauthorized" });
    expect(await get.json()).toEqual({ code: "unauthorized" });
  });

  it("checks the password before returning booth administration settings", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "booth-test-password");
    await expect(loadAdminConfigForPassword("incorrect-password")).rejects.toThrow(
      "WRONG_PASSWORD",
    );
    await expect(loadAdminConfigForPassword("booth-test-password")).resolves.toMatchObject({
      ok: true,
      config: expect.any(Object),
    });
  });

  it("accepts valid settings but rejects unlisted fields at every config level", () => {
    expect(adminConfigInputSchema.safeParse(DEFAULT_CONFIG).success).toBe(true);
    expect(
      adminConfigInputSchema.safeParse({
        ...DEFAULT_CONFIG,
        unlistedSetting: true,
      }).success,
    ).toBe(false);

    const malicious = structuredClone(DEFAULT_CONFIG);
    Object.assign(malicious.characters.yogi, { adminInjected: true });
    expect(adminConfigInputSchema.safeParse(malicious).success).toBe(false);

    const withCustomStandee = structuredClone(DEFAULT_CONFIG);
    withCustomStandee.customStandees = [
      {
        id: "custom-test",
        name: { en: "Test standee", hi: "टेस्ट कटआउट" },
        type: "image",
        assetUrl: "/assets/test.png",
        thumbnail: "/assets/test.png",
        scale: 1,
        heightCm: 175,
        offsetX: 0,
        offsetY: 0,
        depthBevel: 0.8,
        shadowOpacity: 0.7,
        enabled: true,
      },
    ];
    expect(adminConfigInputSchema.safeParse(withCustomStandee).success).toBe(true);
  });
});