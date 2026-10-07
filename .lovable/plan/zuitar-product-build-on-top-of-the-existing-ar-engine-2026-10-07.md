# ZUITAR product build (on top of the existing AR engine)

## What stays untouched
The camera, face tracking, segmentation, three.js renderer, World AR (WebXR hit-test, floor, anchors) and debug panel are kept and refactored into a shared engine — not rewritten.

## What gets built
1. **Home** — cinematic dark screen: "ZUITAR / Choose Your Experience", three large touch cards: Selfie with CM Yogi Adityanath, Selfie with PM Narendra Modi, BJP Look. No login, no hover dependence.
2. **One camera screen for all scenes** — `/experience/$scene`. Large Back, Flip, Capture buttons, 3-2-1 countdown, capture from the WebGL canvas.
3. **Scene configs** — `YOGI_SCENE`, `MODI_SCENE`, `BJP_LOOK_SCENE` each declare asset, asset type (2D / multi-pose 2D / rigged 3D), tracking mode (face / body / world), scale, offset, anchor, occlusion, camera mode, effects, capture behaviour.
4. **Body pose tracking** — add MediaPipe Pose Landmarker; drives side-by-side placement (left/right, distance, standing/sitting, partly out of frame) and shoulder anchoring for the scarf.
5. **Placeholder assets** — until authorized likeness/BJP artwork is supplied, scenes render clearly labelled neutral stand-ins (3D silhouette figure, generic cap/scarf shapes in saffron/green, lotus-free). Real assets plug in via config only.
6. **World AR** — rear camera / flip on supported Android places the scene's figure on the floor; unsupported devices get a clear message and fall back to front camera.
7. **Development mode** — toggle (hidden long-press on logo + `?dev=1`), shows extended debug panel (body tracking, body state, distance, world tracking, floor). Off by default.
8. **Result screen** — Download, Scan QR, Retake, Home. Optional "AI enhance" button (post-capture only) labelled AI GENERATED; "Video coming soon".
9. **Real QR sharing** — enable Lovable Cloud: upload photo to private storage, create a random expiring token (24 h), QR points to `/r/$token` mobile page with view + download.
10. **Auto reset** — configurable inactivity timeout (default 60 s on result, 120 s idle) returns home.
11. **Capability check** — before opening a scene, show front camera / face / body / world AR support.

## Technical details
- `src/ar/engine/` (camera, trackers, renderer, compositor), `src/ar/scenes/*.ts`, `src/ar/capabilities.ts`.
- AI generation via server function using Lovable AI Gateway image model (key server-side only); Gemini swap possible later.
- Share table `shares(token, path, expires_at)` with service-role access only; public read goes through a server function that validates expiry and returns a short-lived signed URL.

## Needs from you later
Authorized Yogi / Modi / BJP assets (transparent PNG poses or GLB 3D models).
