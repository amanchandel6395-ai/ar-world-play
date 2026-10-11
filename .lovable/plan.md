# ZUITAR secrets & environment-variable audit

No code changes needed. This is an audit plus one optional one-line config recommendation.

## Current state (verified)

Cloud Secrets currently contains exactly four secrets, all present:
- `ADMIN_PASSWORD`
- `GEMINI_API_KEY`
- `LOVABLE_API_KEY` (managed by Lovable; values stay hidden)
- `LOVABLE_CRON_SECRET`

The connected backend project already auto-populates these in `.env` (no action needed):
- `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`
- `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`

## Variable-by-variable answer

**Already populated safely from the connected backend (nothing to do):**
- `SUPABASE_URL`, `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY` and their `VITE_*` twins — injected automatically by Lovable Cloud. Used by `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`.

**Already set in Cloud Secrets (nothing to do, values stay hidden):**
- `LOVABLE_API_KEY` — powers AI photo (`/api/enhance`) and AI video (`/api/video`).
- `GEMINI_API_KEY` — used by `/api/enhance` as the alternate provider.
- `ADMIN_PASSWORD` — gates the admin settings area.
- `LOVABLE_CRON_SECRET` — used by `cron-auth.ts` for scheduled jobs.

**Optional (safe defaults exist, only set to override):**
- `AI_PRIMARY_PROVIDER` — defaults to `lovable` in `src/routes/api/enhance.ts`. Set to `gemini` to prefer the existing Gemini key.
- `VITE_RESULT_TIMEOUT_MS` (default 60s) and `VITE_IDLE_TIMEOUT_MS` (default 120s) — kiosk auto-reset timings in `src/lib/kiosk.ts`.
- `LOVABLE_CRON_SECRET_PREVIOUS` — only needed during a cron-secret rotation window.

**Must come from the owner/provider dashboard (never paste in chat):**
- `SUPABASE_SERVICE_ROLE_KEY` — listed in `.env.example` and read by `client.server.ts`. On Lovable Cloud this key is managed internally and is not available to copy; the server client already works through the platform, so no manual entry is needed or possible.
- If the owner ever wants to rotate `LOVABLE_API_KEY`, that is done through the platform's rotate action, not by pasting a value.

## Recommended change (optional, one setting)

Set `AI_PRIMARY_PROVIDER=gemini` so the existing Gemini key is preferred for AI photo generation, with the Lovable key as fallback.

Exact UI steps (no code edit required):
1. Open the project in Lovable.
2. Go to **Project Settings → Secrets**.
3. Click **Add secret**.
4. Name: `AI_PRIMARY_PROVIDER`, Value: `gemini`.
5. Save. The running app picks it up on the next request — no republish needed for the preview; republish for the live site.

## What I will do on approval

- Nothing in code. The audit above is the deliverable.
- If you want, I can set `AI_PRIMARY_PROVIDER=gemini` via the secrets tool instead of the manual steps — confirm and I'll do it in the build turn.
