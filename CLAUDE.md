# YouTube Clip Uploader

## Goal
A website where multiple people log in and upload video clips. Clips are automatically given a title and description, then uploaded to ONE shared YouTube channel (owned by the project owner) through the YouTube Data API v3.

Full background and research are in `docs/conversations/conversation.md` (local only, gitignored). Read it before starting.

## Planned architecture
1. **Site login system**: each user has an account (email/password or "Sign in with Google"). Options: Auth.js, Firebase Auth, Supabase Auth, or Clerk.
2. **One-time YouTube OAuth 2.0 connection** for the owner's channel. Store the refresh token securely on the server only. Never expose the client secret or token to the browser.
3. **Upload flow**: user uploads a clip to the site, which stores it temporarily (S3 or similar). A background job then sends it to YouTube with `videos.insert` using the resumable upload protocol.
4. **Auto title and description**: generated from a template (e.g. "Clip by {username} - {date}") or from user input. Optionally use the Claude API to write them from user input or a transcript.
5. **Approval queue**: the owner approves each clip before it is sent to YouTube (see Clip lifecycle).

## Suggested stack (not yet decided; confirm with the owner)
- Frontend: Next.js / React
- Backend: Node.js or Python (FastAPI/Flask)
- Database: Postgres or Supabase (users, clip status, metadata)
- Storage: S3-compatible temporary storage
- Queue: a background job queue for uploads

## Critical constraints (YouTube API)
- **Audit required for public videos.** Since July 28, 2020, videos uploaded through an unaudited Google Cloud project are forced to private, and this cannot be appealed per video. The project must pass the YouTube API Compliance Audit. Form: https://support.google.com/youtube/contact/yt_api_form (choose "Quota Extension Request" to also raise quota). Expect at least a few days, likely weeks. The audit needs a working app, a privacy policy, terms of service, and a screencast of API usage.
- **Make sure the audited Cloud project is the one the app uses.**
- **Quota is tight.** Sources conflict: YouTube's current guide says the default is 100 `videos.insert` calls per day plus 10,000 units/day for other endpoints. Older material says about 1,600 units per upload. Check the Quotas page in the Cloud Console and do not assume a number.
- **Content liability.** Everything lands on the owner's channel, so copyright or abuse strikes hit that channel. Needs moderation, an approval queue, and user terms.
- **Set `selfDeclaredMadeForKids` correctly** and require `snippet.categoryId` and `status.privacyStatus` on every upload.
- Resumable upload session URIs expire after about 1 week. Do not cache them across days.
- Log every upload (video ID, timestamp, uploader identity) for audit trails.

## Development plan
- Build and test with private-only uploads while the audit is pending. This is fine for development.
- Submit the audit early, in parallel with development.
- Include a privacy policy and terms of service pages (required for the audit).

## Open questions for the owner
- Which stack to use?
- Shared channel (current plan) or per-user YouTube accounts? The per-user option avoids shared-channel moderation risk but is a different product.
- Auto-generated metadata: templates only, or Claude API?
- Approval step before publishing: yes (recommended) or no?

## Clip lifecycle
One `status` field with fixed values:
`uploaded → queued → approved → uploading → on_youtube → public`, plus `rejected` and `failed`.
- The owner approves **before** the YouTube upload (reviewing the file on our site). This saves quota on clips that get rejected. It replaces "upload private, then switch".
- While the audit is pending, `on_youtube` videos stay private. Tell users this in the UI.

## Upload job
- A Postgres `jobs` table plus one worker. No separate queue service in v1.
- Claim a job with one atomic update (`UPDATE ... SET status='uploading' WHERE id=$1 AND status='approved'`), so two workers can never upload the same clip.
- Save the resumable session URL and the bytes sent. On failure, resume with backoff. Give up and restart after the session expires (~1 week).
- `quotaExceeded`: hold the queue until the daily reset (midnight Pacific time). Do not mark clips failed.
- `invalid_grant` (token revoked): pause the queue and alert the owner.

## Security
- Encrypt the refresh token at rest, or keep it in a secrets manager. Never store it in a plain DB column.
- Signups are invite-only, or new accounts need owner approval. Strangers must not reach the channel's queue.

## Storage
- Browsers upload straight to S3 with presigned URLs (short-lived upload links). Big files never pass through the app server.
- Limit file size and type before the upload starts.
- Delete the S3 file once YouTube confirms the video. Add an S3 lifecycle rule that deletes leftovers after 7 days.

## UX and accessibility
- A "My clips" page: each clip's status, plus the reason when it is rejected.
- Labeled form fields, an upload progress bar that screen readers announce, and approve/reject buttons that work from the keyboard.
- Use a stock component library. No custom design in v1.

## Dev setup
- Commit `.env.example`. Keep `.env` in `.gitignore`.
- A fake YouTube client for local development, so it burns no quota.

## v1 scope cuts
- Templates for titles and descriptions. The Claude API comes later.
- One login method.
- A Postgres jobs table instead of a queue service.

## Status
Planning only. No code written yet. The plan was audited and the fixes are folded in above (2026-10-28).
