# YouTube Clip Uploader

## Goal
A website where multiple people log in and upload video clips. Clips are automatically given a title and description, then uploaded to ONE shared YouTube channel (owned by the project owner) through the YouTube Data API v3.

Background notes may be in `docs/conversations/` (local only, gitignored). Everything needed to build is in this file and `docs/plan-piece-*.md`.

## Planned architecture
1. **Site login system**: Sign in with Google only, via Supabase Auth. New accounts wait until the owner approves them (see Security).
2. **One-time YouTube OAuth 2.0 connection** for the owner's channel. Store the refresh token securely on the server only. Never expose the client secret or token to the browser.
3. **Upload flow**: the browser uploads the clip straight to Supabase Storage (temporary). A worker then sends it to YouTube with `videos.insert` using the resumable upload protocol.
4. **Auto title**: sequential template `{username}'s clip in {game} #{n}` (e.g. "Boomy's clip in Valorant #3"). The user picks the game at upload. `n` counts per user per game and is assigned in the DB under a unique constraint on (user, game, n), so two uploads can't get the same number. `n` is assigned at approval, so rejected clips leave no gaps. No AI: it adds cost and rate limits for no gain.
   **Description**: template `Uploaded by {username} on {date}`, plus the uploader's optional note.
5. **Approval queue**: the owner approves each clip before it is sent to YouTube (see Clip lifecycle).

## Stack (decided)
- Next.js (frontend + API routes)
- Supabase free plan: Auth (Google), Postgres (users, clips), Storage (temporary clips)
- Upload worker: a Node script run on the owner's PC (free hosting would kill long uploads). Uploads happen only while it runs.
- One shared YouTube channel (the owner's).
- Check Supabase free-plan limits (per-file size, total storage, pause after inactivity) before setting upload limits.

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
`uploaded → queued → approved → uploading → on_youtube → public`, plus `rejected` and `failed`.
- The owner approves **before** the YouTube upload (reviewing the file on our site). This saves quota on clips that get rejected. It replaces "upload private, then switch".
- While the audit is pending, `on_youtube` videos stay private. Tell users this in the UI.

## Upload job
- No jobs table and no queue service: the `clips` row is the job, so status lives in one place.
- The worker claims a clip with one atomic update (`UPDATE clips SET status='uploading' WHERE id=$1 AND status='approved'`), so two workers can never upload the same clip.
- Save the resumable session URL and the bytes sent on the clip row. On failure, resume with backoff. Give up and restart after the session expires (~1 week).
- `quotaExceeded`: hold the queue until the daily reset (midnight Pacific time). Do not mark clips failed.
- `invalid_grant` (token revoked): pause the queue and alert the owner.

## Security
- Encrypt the refresh token at rest with AES-256-GCM (`TOKEN_ENC_KEY`). Never store it in a plain DB column.
- New accounts are unapproved until the owner approves them. Strangers must not reach the channel's queue.

## Storage
- Browsers upload straight to Supabase Storage with signed upload URLs (short-lived upload links). Big files never pass through the app server.
- Limit file size and type before the upload starts.
- Delete the stored file once YouTube confirms the video. A daily cleanup in the worker deletes leftovers older than 7 days.

## UX and accessibility
- A "My clips" page: each clip's status, plus the reason when it is rejected.
- Labeled form fields, an upload progress bar that screen readers announce, and approve/reject buttons that work from the keyboard.
- Use a stock component library. No custom design in v1.

## Dev setup
- Commit `.env.example`. All other `.env*` files are gitignored.
- A fake YouTube client for local development, so it burns no quota.

## v1 scope cuts
- Sequential template titles only. No AI (Claude or Gemini).
- One login method.
- No queue service: the clips table drives the worker.

## Status
No code yet. Google Cloud (YouTube API, OAuth clients, quota) and Supabase (project, Google login) are set up. Piece 1 (setup, login, YouTube connection) is planned in `docs/plan-piece-1.md` (2026-10-28).
