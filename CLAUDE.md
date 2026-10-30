# YouTube Clip Uploader

## Goal
A website where multiple people log in and upload video clips. Clips are automatically given a title and description, then uploaded to ONE shared YouTube channel (owned by the project owner) through the YouTube Data API v3.

Background notes may be in `docs/conversations/` (local only, gitignored). Everything needed to build is in this file and `docs/plan-piece-*.md`.

## Planned architecture
1. **Site login system**: Sign in with Google only, via Supabase Auth. New accounts wait until the owner approves them (see Security).
2. **One-time YouTube OAuth 2.0 connection** for the owner's channel. Store the refresh token securely on the server only. Never expose the client secret or token to the browser.
3. **Upload flow**: the browser uploads the clip straight to R2 (temporary). A worker then sends it to YouTube with `videos.insert` using the resumable upload protocol.
4. **Auto title**: sequential template `{username}'s clip in {game} #{n}` (e.g. "Boomy's clip in Valorant #3"). The user picks the game at upload. `n` counts per user per game and is assigned in the DB under a unique constraint on (user, game, n), so two uploads can't get the same number. `n` is assigned at approval, so rejected clips leave no gaps. No AI: it adds cost and rate limits for no gain.
   **Description**: template `Uploaded by {username} on {date}`, plus the uploader's optional note.
5. **Approval queue**: the owner approves each clip before it is sent to YouTube (see Clip lifecycle).

## Stack (decided)
- Next.js (frontend + API routes)
- Supabase free plan: Auth (Google), Postgres (users, clips)
- Cloudflare R2 free tier (10 GB, no egress fees): temporary clip storage, up to 2 GB per clip
- Upload worker (`worker/index.mjs`): GitHub Actions runs it with `--once` every 6 hours (`.github/workflows/upload.yml`, secrets in the repo settings). `npm run worker` on the owner's PC still works for an instant upload. Free web hosts can't run it (function time limits).
- One shared YouTube channel (the owner's).
- Supabase free projects pause after a week of inactivity; open the dashboard to resume.

## Budget
Must run at $0. Use only free tiers and design around their limits.

## Critical constraints (YouTube API)
- **Audit required for public videos.** Since July 28, 2020, videos uploaded through an unaudited Google Cloud project are forced to private, and this cannot be appealed per video. The project must pass the YouTube API Compliance Audit. Form: https://support.google.com/youtube/contact/yt_api_form (choose "Quota Extension Request" to also raise quota). Expect at least a few days, likely weeks. The audit needs a working app, a privacy policy, terms of service, and a screencast of API usage.
- **Make sure the audited Cloud project is the one the app uses.**
- **Quota (confirmed in Cloud Console, 2026-10-28):** 100 video uploads/day and 100/minute, in their own bucket, plus 10,000 query units/day for other calls (status checks, setting videos public). On `quotaExceeded`, hold the queue until midnight Pacific time.
- **Content liability.** Everything lands on the owner's channel, so copyright or abuse strikes hit that channel. Needs moderation, an approval queue, and user terms.
- Every upload sets `status.selfDeclaredMadeForKids: false` (gaming clips for adults), `snippet.categoryId: "20"` (Gaming) and `status.privacyStatus`.
- Log every upload (video ID, timestamp, uploader identity) for audit trails.

## Development plan
- Build and test with private-only uploads while the audit is pending. This is fine for development.
- Submit the audit early, in parallel with development.
- Include a privacy policy and terms of service pages (required for the audit).

## Clip lifecycle
One `status` field with fixed values:
`queued → approved → uploading → on_youtube`, plus `rejected` and `failed`. (`public` is still allowed by the DB check but unused.) A clip row is created only after its file is in Storage, so it starts at `queued`.
- The owner approves **before** the YouTube upload (reviewing the file on our site). This saves quota on clips that get rejected. It replaces "upload private, then switch".
- Clips upload as public (already approved). `youtube.upload` cannot edit videos, so there is no publish step; adding one needs the broader `youtube.force-ssl` scope. While the audit is pending YouTube forces uploads to private; the owner flips them in Studio.

## Upload job
- No jobs table and no queue service: the `clips` row is the job, so status lives in one place.
- The worker claims a clip with one atomic update (`UPDATE clips SET status='uploading', claimed_at=now() WHERE id=$1 AND status='approved'`), so two workers can never upload the same clip. On start, a worker only takes back uploads claimed over 6 hours ago, never one the other worker is still sending.
- Save the resumable session URL and the bytes sent on the clip row. On failure, resume with backoff. Give up and restart after the session expires (~1 week).
- `quotaExceeded`: hold the queue until the daily reset (midnight Pacific time). Do not mark clips failed.
- `invalid_grant` (token revoked): pause the queue and alert the owner.

## Security
- Encrypt the refresh token at rest with AES-256-GCM (`TOKEN_ENC_KEY`). Never store it in a plain DB column.
- New accounts are unapproved until the owner approves them. Strangers must not reach the channel's queue.
- Storage keys must match `<user uuid>/<uuid>.<ext>` exactly (`KEY_RE` in `lib/r2.mjs`); never build an R2 URL from unchecked input.
- Upload URLs expire after 15 minutes. Approval stores the reviewed file's ETag (`approved_etag`); the worker reads every chunk with `If-Match`, so a file swapped after review is never uploaded.
- Uploaders can read only display columns of their own clips (column grants in `0004_harden_clips.sql`). `upload_session_url` is a live YouTube credential: server/worker only.

## Storage (Cloudflare R2)
- Browsers upload straight to R2 with presigned PUT URLs that pin the exact Content-Type and Content-Length. Big files never pass through the app server. The server re-checks size and type with a HEAD before recording the clip.
- Limit: 2 GB per clip, MP4/MOV/WebM/MKV (`lib/games.ts`).
- The worker reads clips from R2 in 8 MB ranges and sends them to YouTube in matching chunks, so memory use stays flat.
- Delete the file once YouTube has the video, or when the clip is rejected.
- Abandoned uploads (file sent, clip never recorded) are removed by an R2 lifecycle rule: delete objects older than 30 days. Clips still waiting for review after 30 days lose their file too, so review within a month.
- The R2 bucket needs a CORS rule allowing PUT from the site's origin (and GET for previews).

## UX and accessibility
- A "My clips" page: each clip's status, plus the reason when it is rejected.
- Labeled form fields, an upload progress bar that screen readers announce, and approve/reject buttons that work from the keyboard.
- Use a stock component library. No custom design in v1.

## Dev setup
- Commit `.env.example`. All other `.env*` files are gitignored.
- `npm run dev` (site), `npm run worker` (uploads, keeps running), `npm run worker:once` (what Actions runs), `npm run worker:fake` (no YouTube calls), `npm test`.
- API approval steps: `docs/api-audit-checklist.md`.
- Next.js 16: middleware is `proxy.ts`; read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- DB schema: `supabase/migrations/0001_init.sql`, run in the Supabase SQL editor.

## v1 scope cuts
- Sequential template titles only. No AI (Claude or Gemini).
- One login method.
- No queue service: the clips table drives the worker.

## Status
Functional v1 built (2026-10-30): login + approval, YouTube connection, clip upload, My clips, admin review queue, upload worker, privacy/terms drafts. No design yet. Before the audit: fill `CONTACT_EMAIL` in `lib/games.ts` and have the privacy/terms text reviewed.
