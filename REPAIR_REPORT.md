# ZUITAR focused repair report

## Implemented
- `/admin` uses the existing server-side password checks, signed uploads, private previews and save functions. Passwords stay in page memory; signing out clears them. Missing settings never bypass sign-in.
- Permission records and cutout-path approvals receive server timestamps. Legacy approvals without records are not customer-ready. Replacing a cutout does not approve its new path. Each BJP artwork needs a permission record, approval and explicit enablement.
- Yogi/Modi customer scenes use tracked flat Three.js standees only, not GLBs or CSS overlays. References are not rendered. Development figures are removed from the customer path.
- Capture is disabled while assets are missing, loading or failed. With missing backend settings, customers receive safe defaults and “Setup incomplete — ask booth staff,” not a false ready state.
- Live preview and saved capture use the same unmirrored canvas. Camera, language, help, placement reset, torch, segmentation and interaction controls remain.
- Both AI endpoints reject Yogi/Modi scenes with HTTP 400 `not_allowed`. BJP styling is post-capture only with approved enabled artwork and server configuration. Prompts prohibit adding or changing symbols, text or people.
- Video requires a completed BJP job from the existing flow, a downloaded MP4 signature check, and staff verification. Unverified test creation/polling requires the admin password. Customer video remains unavailable until verified. Artwork/prompt changes invalidate verification.
- Four exact owner-uploaded candidates are mapped via asset pointers and can be imported into private booth storage by the signed-in admin. Import alone does not approve or enable them.

## Exact uploaded-file inventory
| Filename | Observed content and treatment |
|---|---|
| `dc5afdb0fe2b72a63ddddacca5ad7fc1.png` | Yogi walking, 417×870 RGBA with genuine transparency. Mapped unapproved cutout candidate. |
| `BJP-Logo-700x394.png` | Lotus artwork, 700×394 RGBA with transparency. Mapped unapproved artwork candidate. |
| `Logo_of_the_Bharatiya_Janata_Party.svg.webp` | Large lotus artwork, 1280×1371 RGBA with transparency. Mapped unapproved artwork candidate. |
| `bjp-flag-with-text-1704.png` | BJP flag artwork with Hindi text, 2000×2000 RGBA with transparency. Mapped unapproved artwork candidate. |
| `Full Narendra Modi Png, Transparent Png - vhv.jpg` | Modi waving. RGB JPEG with flattened checkerboard; no real transparency. Reference only, not a cutout. |
| `AllPngFree - Download Free PNG Images.jpg` | Yogi waving. RGB JPEG with flattened checkerboard; no real transparency. Reference only. |
| `Yogi aditynath.jpg` | Opaque Yogi portrait; reference only. |
| `Yogi aditynath - Copy.jpg` | Duplicate opaque Yogi portrait; reference only. |
| `HT4QV3haoAAAmg-.webp` | Yogi and another person holding a document; event reference only. |
| `dad172984729456a6c296ca94dc6c3cb_original.webp` | Yogi and Modi seated in conversation; event reference only. |
| `images (7).jpg` | Yogi and Modi holding a gift; event reference only. |
| `images (6).jpg` | Yogi with two visitors; event reference only. |
| `images (5).jpg` | Yogi and visitors presenting a gift; event reference only. |
| `images (4).jpg` | Political promotion showing Amit Shah and Suvendu Adhikari; reference only. |
| `bjp-party-cap.jpg` | Paper campaign cap on a mannequin; opaque catalogue photograph, disabled. |
| `51nAqDoc1dL._SX679_.jpg` | Orange/green baseball cap; opaque catalogue photograph, disabled. |
| `61RqPhpPIPL._AC_UY1100_.jpg` | Man wearing BJP scarf; opaque catalogue photograph with person, disabled. |
| `product-jpeg-500x500.webp` | Woman wearing BJP scarf; opaque catalogue photograph with person, disabled. |
| `chunav-prachar-samagri.jpg` | Hanging BJP scarf; opaque catalogue photograph, disabled. |
| `pack-of-1-omg-enriched-2-original-imafx3w5sywmbhyc.webp` | Flag outdoors; opaque product photograph, disabled. |
| `pngtree-bjp-flag-with-pole-png-image_8330500.png` | Flag/pole with flattened checkerboard background. No transparency entry in the indexed image; reference only. |

All 21 filenames are mapped in the protected admin inventory. Only the four genuine transparent candidates have binary asset pointers. Event and catalogue photographs are not imported or rendered.

## Missing assets and permissions
- Genuine transparent Modi cutout. The uploaded JPEG is not usable as a transparent standee.
- Isolated exact cap/scarf artwork suitable for face/shoulder tracking. Existing files are product photographs, some with people.
- Written permission remains unconfirmed for every likeness and artwork. Staff must record permission and approve each asset before enabling it.

## Checks performed
- `bun install --frozen-lockfile`: exit 0; no dependency changes.
- `bun run build`: exit 0; client and server output produced. Existing inputValidator deprecation, tsconfig-paths and large-chunk warnings remain non-fatal.
- `bunx -p @typescript/native-preview tsgo --noEmit`: exit 0 after fixing two findings from the new code.
- `bunx vitest run`: exit 0; 2 test files, 6 tests passed (1 existing routing test and 5 new approval/readiness tests).
- `git diff --check`: exit 0.
- Chromium, 1280×1800 against an isolated local repository copy: admin sign-in disabled when ADMIN_PASSWORD is absent; all three scenes show setup-incomplete status; English/Hindi toggle works; no page errors were observed.
- Direct browser HTTP tests: `/api/enhance` and `/api/video` both return HTTP 400 `not_allowed` for Yogi and Modi (four checks).
- The standard `vite preview` command could not serve the built app because the existing preview plugin expects `dist/server/server.js` while this project's Nitro output is `index.mjs`. UI verification used isolated Vite development mode instead. Production hosting was not verified.

## Still unavailable / not verified
The isolated runtime reports ADMIN_PASSWORD missing and private assets/captures storage plus app_config unavailable. These are local runtime observations, not a hosted-settings audit. AI key presence is reported, but successful provider calls are unverified.

Authenticated admin save/upload/read-back, approved camera capture, real AI styling and completed video generation were not exercised because permission and target project settings are unavailable. No approvals, fabricated credentials or database changes were supplied. No physical-device, WebXR, torch or real-camera tests were performed. No deployment or publishing was performed.