# YouTube API approval checklist

Two separate Google reviews stand between this app and public videos:

1. **OAuth app verification.** The app asks for sensitive YouTube scopes (`youtube.upload`, `youtube.readonly`). Moving the consent screen from Testing to In production triggers Google's verification of the consent screen.
2. **YouTube API Services audit.** Until it passes, every video uploaded through this Cloud project is locked to private. Locked videos can't be unlocked later, only re-uploaded.

Neither review has a status page. Google replies by email, so watch the inbox (and spam) of the address on the forms and answer follow-ups quickly; reviews stall until you do.

Google changes these forms often. Read each form's own instructions when you fill it in, and treat this list as a guide.

## 1. The app must be reachable

- [ ] Host the website on a public HTTPS address, using a free host (the worker stays on GitHub Actions).
- [ ] Optional: a custom domain. A free `*.vercel.app`-style address may work, but OAuth verification may ask you to prove domain ownership, and you can't verify a domain you don't own. A cheap domain removes that risk; it's the only likely cost.
- [ ] Add the production URL everywhere localhost is configured today:
  - Supabase → Authentication → URL Configuration (Site URL + Redirect URLs)
  - Google Cloud → Clients → "YouTube connection" → redirect URI `https://<site>/api/youtube/callback`
  - R2 bucket CORS → `AllowedOrigins`
- [ ] Set every `.env.local` variable on the host (never `SUPABASE_DB_PASSWORD`; the site doesn't use it).

## 2. Public pages

- [ ] `/privacy` and `/terms` load without signing in. (They already do.)
- [ ] Replace `CONTACT_EMAIL` in `lib/games.ts` with a real address.
- [ ] Have the privacy policy and terms read by someone qualified; the current text is a draft.
- [ ] The privacy policy states: what data is collected, how it is used, that the app uses YouTube API Services, links to the YouTube ToS and Google Privacy Policy, and how to revoke access. (The draft covers these.)
- [ ] A home page that explains what the app does. Reviewers may open `/` signed out and only see a login page. Consider a short public description on `/login`.

## 3. Google consent screen (Google Cloud → Google Auth Platform)

- [ ] **Branding:** app name, support email, logo (optional, but adding one triggers brand review), home page URL, privacy policy URL, terms URL.
- [ ] **Authorized domains:** the site's domain.
- [ ] **Data Access:** only the scopes the app uses: `youtube.upload` and `youtube.readonly`. Be ready to justify each:
  - `youtube.upload`: uploads approved clips to the owner's channel.
  - `youtube.readonly`: shows which channel is connected, so the owner can confirm it's the right one.
- [ ] **Audience:** switch from Testing to **In production**. This also stops the YouTube connection expiring every 7 days.
- [ ] If verification is required, prepare a demo video showing the consent screen and each scope in use (the screencast below can double as this).

## 4. Screencast (unlisted YouTube video)

Record in one take, on the production site, with the browser address bar visible:

- [ ] Signing in with Google on the site.
- [ ] A new account landing on "Waiting for approval", then the owner approving it.
- [ ] Uploading a clip (game, note, progress bar).
- [ ] The owner previewing the clip and approving it; the generated title.
- [ ] The owner clicking Connect YouTube, the full Google consent screen with both scopes visible, and returning to "Connected: <channel>".
- [ ] The worker uploading (GitHub Actions "Run workflow", or `npm run worker`), then the video in YouTube Studio as private, category Gaming, not made for kids.
- [ ] Rejecting a clip and the uploader seeing the reason in My clips.
- [ ] "Make public" (explain it works after the audit).
- [ ] Mention that clips are deleted from storage after upload and that every upload is logged.

## 5. Audit form

Form: https://support.google.com/youtube/contact/yt_api_form

- [ ] Reason: **YouTube API Services Audit and Quota Extension**. The current quota (100 uploads/day) is plenty, so ask only for the audit unless the form requires a quota number.
- [ ] Google Cloud **project number** (Cloud dashboard → Project info). It must be the project this app uses.
- [ ] Organization/developer details and contact email.
- [ ] Client type: public web app; YouTube API services used: Data API v3 (`videos.insert`, `videos.update`, `channels.list`).
- [ ] Use case, in plain words: "A small private community submits gameplay clips. The channel owner reviews every clip before it is uploaded to their own channel. Users never get YouTube access; only the owner's channel is used."
- [ ] Moderation: owner approval of every account and every clip, terms forbidding copyrighted and harmful content, rejection with reasons, upload audit log.
- [ ] Links: site URL, privacy policy, terms, screencast.

## 6. After you submit

- [ ] Keep the site running and unchanged until the review ends; reviewers may test it.
- [ ] Answer emails from the YouTube API Services team quickly.
- [ ] Once approved: upload a test clip and confirm "Make public" works.
- [ ] Earlier clips that were uploaded while locked stay private. To make one public, delete it in YouTube Studio and have it submitted again (the site has no re-upload button).
- [ ] Expect periodic re-audits; keep the privacy policy, terms and moderation in place.
