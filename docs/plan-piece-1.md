# Piece 1: setup, Google login, YouTube connection

## Context
The plan and all accounts are ready (Google Cloud project + YouTube OAuth client, Supabase project with Google login, quota confirmed: 100 uploads/day). The user wants the plan now and the code later. This piece proves the hard part: the owner signs in, connects the channel once, and the refresh token is stored encrypted on the server. Budget is $0: only free tiers, no paid APIs.

## Step 0 (on approval): commit
Commit the uncommitted `CLAUDE.md` changes (stack decisions, quota) as the user, with no Claude trailer, then push. Also save this plan as `docs/plan-piece-1.md` in the repo so it survives until coding starts.

## Build (later)
1. **Set up the project**: `create-next-app` (TypeScript, App Router, no Tailwind config beyond the default) in the repo root. Add `@supabase/supabase-js` and `@supabase/ssr`. No googleapis package; the OAuth token exchange is two `fetch` calls.
2. **`.env.example`** lists every variable with no values: Supabase URL and keys, `YOUTUBE_CLIENT_ID/SECRET`, `TOKEN_ENC_KEY` (32 random bytes, base64), `OWNER_EMAIL`.
3. **DB migration** `supabase/migrations/0001_init.sql`:
   - `profiles(id → auth.users, email, display_name, role 'owner'|'member', approved bool default false)`, plus a trigger that creates a row on signup. RLS: users read only their own row.
   - `youtube_connection(id int primary key check (id=1), refresh_token_enc, channel_id, channel_title, updated_at)`. RLS on with **no policies**, so only the server's secret key can touch it.
   - Run it in the Supabase SQL editor (no CLI needed).
4. **Supabase clients**: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts` (secret key, server only), following the official `@supabase/ssr` Next.js pattern.
5. **Login**: `app/login/page.tsx` (a "Sign in with Google" button) → `app/auth/callback/route.ts` (exchanges the code for a session). `middleware.ts` refreshes the session and sends signed-out users to `/login` and unapproved users to `/pending`. The account matching `OWNER_EMAIL` is auto-approved as owner.
6. **Owner page** `app/admin/page.tsx`: shows the connected channel (or "not connected") and a **Connect YouTube** button. Owner only, checked on the server.
7. **YouTube OAuth**:
   - `app/api/youtube/connect/route.ts`: owner only; makes a random `state`, stores it in an httpOnly cookie, and redirects to Google with scopes `youtube.upload` + `youtube.readonly`, `access_type=offline`, `prompt=consent`.
   - `app/api/youtube/callback/route.ts`: checks `state` against the cookie and that the user is the owner; exchanges the code; fetches the channel (`channels.list?mine=true`); encrypts the refresh token and upserts row 1.
   - **Manual step for the user**: add the `youtube.readonly` scope in Google Cloud → Data Access (used to show which channel got connected).
8. **Encryption** `lib/crypto.ts`: AES-256-GCM with Node `crypto`, key from `TOKEN_ENC_KEY`, output `iv.tag.ciphertext` (base64). Test: `lib/crypto.test.ts` with `node:test` (round trip, and a tampered value must throw).

## Not in this piece
Clip upload, jobs, worker, approval queue, the privacy/terms pages. Those are pieces 2-4.

## Verification
- `npm run build` passes; `node --test` passes the crypto test.
- `npm run dev`: sign in with Google as the owner → `/admin`; sign in with another Google test account → `/pending`.
- Connect YouTube → `/admin` shows your channel name; in Supabase, the `youtube_connection` row holds unreadable ciphertext, not a token.
- A signed-in non-owner calling `/api/youtube/connect` gets a 403.
- Known limit: while the consent screen is in Testing mode, the refresh token expires after 7 days. Reconnect, or publish the consent screen later.
