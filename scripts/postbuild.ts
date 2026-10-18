import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const clientDir = path.join(distDir, "client");
const publicDir = path.join(rootDir, "public");
const outputPublicDir = path.join(rootDir, ".output", "public");

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy from .output/public if dist is missing files
if (fs.existsSync(outputPublicDir)) {
  fs.cpSync(outputPublicDir, distDir, { recursive: true });
}

// Ensure public files exist in dist
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, distDir, { recursive: true });
}

// Ensure client subdirectory also has mirror of assets
if (!fs.existsSync(clientDir)) {
  fs.mkdirSync(clientDir, { recursive: true });
}
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, clientDir, { recursive: true });
}

// Find main assets
const assetsDir = path.join(distDir, "assets");
let cssFileName = "";
let jsFileName = "";

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  for (const file of files) {
    if (file.endsWith(".css") && !cssFileName) {
      cssFileName = file;
    }
    if (file.startsWith("index-") && file.endsWith(".js") && !jsFileName) {
      jsFileName = file;
    }
  }

  // Also mirror assets into dist/client/assets
  const clientAssetsDir = path.join(clientDir, "assets");
  if (!fs.existsSync(clientAssetsDir)) {
    fs.mkdirSync(clientAssetsDir, { recursive: true });
  }
  fs.cpSync(assetsDir, clientAssetsDir, { recursive: true });
}

// Generate valid index.html
const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ZUITAR - AR World Play</title>
    <meta
      name="description"
      content="ZUITAR AI camera and AR experiences with real-time tracking, stage lighting, and custom standees."
    />
    <meta property="og:title" content="ZUITAR - AR World Play" />
    <meta
      property="og:description"
      content="ZUITAR AI camera and AR experiences with real-time tracking, stage lighting, and custom standees."
    />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap"
    />
    ${cssFileName ? `<link rel="stylesheet" href="/assets/${cssFileName}" />` : ""}
  </head>
  <body class="bg-background text-foreground antialiased">
    <div id="root"></div>
    ${jsFileName ? `<script type="module" src="/assets/${jsFileName}"></script>` : ""}
  </body>
</html>
`;

fs.writeFileSync(path.join(distDir, "index.html"), htmlContent, "utf8");
fs.writeFileSync(path.join(clientDir, "index.html"), htmlContent, "utf8");

// Also ensure root index.html exists for standard Vite/deployment detection
fs.writeFileSync(path.join(rootDir, "index.html"), htmlContent, "utf8");

const artifactCount = fs.readdirSync(distDir).length;
console.log(
  `[postbuild] Generated valid build output in dist/ (${artifactCount} top-level entries, index.html created).`,
);
