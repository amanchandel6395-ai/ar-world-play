import { createServerFn } from "@tanstack/react-start";

/**
 * Public configuration endpoint.
 * Returns browser-safe public assets, scene configs, and enabled options.
 * Does not expose any administration controls or secret keys.
 */
export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { loadConfig, toPublic } = await import("./config.server");
  try {
    return await toPublic(await loadConfig());
  } catch {
    const { toPublicDefault } = await import("./config");
    return toPublicDefault();
  }
});
