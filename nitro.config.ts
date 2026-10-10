import { defineConfig } from "nitro";

export default defineConfig({
  preset: "node-server",
  output: {
    dir: "dist",
    serverDir: "dist/server",
    publicDir: "dist/public",
  },
});
