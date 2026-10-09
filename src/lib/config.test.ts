import { describe, expect, it } from "vitest";
import { bjpUsable, characterReady, mergeConfig, toPublicDefault } from "./config";

describe("permission and asset readiness", () => {
  it("starts every customer scene and AI mode disabled", () => {
    const c = toPublicDefault();
    expect(c.ready).toEqual({ yogi: false, modi: false, bjp: false });
    expect(c.bjp).toEqual([]);
    expect(c.ai.imageReady).toBe(false); expect(c.ai.videoReady).toBe(false);
    expect(c.demo.aiReady).toBe(false);
  });
  it("keeps fictional demo configuration independent of leader approvals", () => {
    const enabled = mergeConfig({ demo: { enabled: true } });
    expect(enabled.demo.enabled).toBe(true);
    expect(characterReady(enabled.characters.yogi)).toBe(false);
    expect(characterReady(enabled.characters.modi)).toBe(false);
    expect(mergeConfig({ demo: { enabled: false } }).demo.enabled).toBe(false);
  });
  it("does not trust legacy authorization or models", () => {
    const c = mergeConfig({ characters: { yogi: { authorized: true, glb: "model.glb", poses: { selfie: "old.png" } } } });
    expect(characterReady(c.characters.yogi)).toBe(false);
  });
  it("requires written permission and approval of the exact cutout path", () => {
    const c = mergeConfig({}); const p = "yogi-cutout/example.png";
    Object.assign(c.characters.yogi, { authorized: true, authorizedAt: "2026-10-09", permissionNote: "Written grant", poses: { selfie: p }, approvedAssets: { [p]: "2026-10-09" } });
    expect(characterReady(c.characters.yogi)).toBe(true);
    c.characters.yogi.poses.selfie = "yogi-cutout/replacement.png";
    expect(characterReady(c.characters.yogi)).toBe(false);
    c.characters.yogi.poses.selfie = p; c.characters.yogi.enabled = false;
    expect(characterReady(c.characters.yogi)).toBe(false);
  });
  it("retires built-in substitutes and rejects unstamped catalogue approvals", () => {
    const cfg = mergeConfig({ bjp: [{ id: "builtin-cap", approved: true, enabled: true, asset: "fake.png" }, { id: "catalogue", asset: "shop.jpg", enabled: true, approved: true }] });
    expect(cfg.bjp).toHaveLength(1);
    const b = cfg.bjp[0]; if (!b) throw new Error("Missing fixture");
    expect(bjpUsable(b)).toBe(false);
  });
  it("requires all artwork approval conditions", () => {
    const cfg = mergeConfig({ bjp: [{ id: "uploaded", asset: "bjp-art/exact.png", enabled: true, approved: true, approvedAt: "2026-10-09", permissionNote: "Written grant" }] });
    const b = cfg.bjp[0]; if (!b) throw new Error("Missing fixture");
    expect(bjpUsable(b)).toBe(true); b.enabled = false; expect(bjpUsable(b)).toBe(false);
  });
});