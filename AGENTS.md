<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- One shared AR engine (`src/ar/engine/frontEngine.ts`) powers every front/rear camera experience; scenes plug in via `SceneConfig` in `src/ar/scenes/` — never duplicate camera/tracking per scene.
- AR objects are rendered in three.js from tracking data only; never position AR content with CSS. Why: product requirement for real AR.
- World AR uses `WorldAR` (WebXR) with capability detection; unsupported devices get an honest fallback, never a faked one.
- AI image generation runs post-capture only via the `/api/enhance` server route; keys stay server-side.
- Shared photos live in the private `captures` bucket; `shares` table is service-role only and accessed via server functions with expiring random tokens.
- `/selfie` and `/world` are kept as raw engine test pages (linked only in dev mode).
- Admin settings use the existing password-protected server functions and private signed uploads; passwords remain in React memory only so sign-out removes them.
- Customer likeness scenes render only approved flat texture standees; asset-path approvals and permission records are server-timestamped so replacement uploads cannot inherit approval.
- Preview and exported capture use the same unmirrored canvas so printed text and artwork retain their original orientation.
