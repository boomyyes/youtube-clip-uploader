// Upload worker. Sends approved clips to YouTube.
//   npm run worker        keeps running on the owner's PC
//   --once                uploads what's approved, then exits (GitHub Actions runs this on a schedule)
//   npm run worker:fake   (--fake) skips YouTube entirely (no quota used) for local testing
import { createClient } from "@supabase/supabase-js";
import * as r2 from "../lib/r2.mjs";
import { YouTubeError, accessTokenFromDb, msUntilQuotaReset, myChannel, sendUpload, startUpload, videoMetadata } from "../lib/youtube.mjs";

const FAKE = process.argv.includes("--fake");
const ONCE = process.argv.includes("--once");
const STUCK_AFTER = 6 * 3_600_000; // an upload claimed this long ago is assumed dead
const SESSION_MAX_AGE = 6 * 86_400_000; // YouTube sessions last ~1 week; restart a bit before that
const MAX_ATTEMPTS = 5;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

/** Throws on a Supabase error so nothing fails silently. */
async function must(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function upload(clip) {
  const file = await r2.head(clip.storage_path);
  if (!file) throw new Error("Clip file is missing from storage");
  if (!clip.approved_etag || file.etag !== clip.approved_etag) throw new Error("Clip file changed after it was approved; not uploading it");
  // If-Match on every chunk: a swap mid-upload fails instead of mixing files.
  const read = (start, end) => r2.readRange(clip.storage_path, start, end, clip.approved_etag);
  if (FAKE) {
    await read(0, Math.min(file.size, 1024) - 1); // proves storage access without touching YouTube
    return `fake-${clip.id.slice(0, 8)}`;
  }
  const token = await accessTokenFromDb(db);
  const age = Date.now() - new Date(clip.upload_session_started_at ?? 0).getTime();
  if (clip.upload_session_url && age < SESSION_MAX_AGE) {
    const id = await sendUpload(token, clip.upload_session_url, file.size, read); // resume
    if (id) return id;
  }
  const url = await startUpload(token, videoMetadata(clip.title, clip.description), file.size, file.type || "video/mp4");
  // Saved before sending, so a crash mid-upload resumes instead of creating a second video.
  await must(db.from("clips").update({ upload_session_url: url, upload_session_started_at: new Date().toISOString() }).eq("id", clip.id));
  const id = await sendUpload(token, url, file.size, read);
  if (!id) throw new Error("Upload session expired right after it was created");
  return id;
}

async function main() {
  log(`worker started${FAKE ? " (fake: nothing is sent to YouTube)" : ""}${ONCE ? " (once)" : ""}`);
  // Uploads a crashed worker left behind go back to the queue and resume from their saved session URL.
  // Only stuck ones: a fresh claim may belong to the other worker (PC vs. GitHub Actions).
  const stuck = new Date(Date.now() - STUCK_AFTER).toISOString();
  await must(db.from("clips").update({ status: "approved" }).eq("status", "uploading").or(`claimed_at.is.null,claimed_at.lt."${stuck}"`));

  // Refresh the stored channel name each run (YouTube policy: refresh stored API data within 30 days).
  // This also confirms the token still works; a dead one deletes the connection.
  if (!FAKE) {
    try {
      const ch = await myChannel(await accessTokenFromDb(db));
      if (ch) await must(db.from("youtube_connection").update({ channel_id: ch.id, channel_title: ch.title, updated_at: new Date().toISOString() }).eq("id", 1));
    } catch (e) {
      log("channel refresh failed:", e instanceof Error ? e.message : e);
    }
  }

  // Upload records are kept 12 months (privacy policy), then pruned.
  await must(db.from("upload_log").delete().lt("uploaded_at", new Date(Date.now() - 365 * 86_400_000).toISOString()));

  // Abandoned uploads are removed by the R2 bucket's lifecycle rule (see CLAUDE.md), not here.
  for (;;) {
    const next = await must(db.from("clips").select("id").eq("status", "approved").order("approved_at").limit(1).maybeSingle());
    if (!next) {
      if (ONCE) return log("queue empty");
      await sleep(15_000);
      continue;
    }
    // Atomic claim: only succeeds if nobody else took it.
    const clip = await must(db.from("clips").update({ status: "uploading", claimed_at: new Date().toISOString() }).eq("id", next.id).eq("status", "approved").select().maybeSingle());
    if (!clip) continue;

    try {
      log(`uploading "${clip.title}"`);
      const videoId = await upload(clip);
      await must(db.from("clips").update({
        status: "on_youtube", youtube_video_id: videoId, uploaded_at: new Date().toISOString(),
        upload_session_url: null, upload_session_started_at: null, last_error: null,
      }).eq("id", clip.id));
      const uploader = await must(db.from("profiles").select("email").eq("id", clip.user_id).maybeSingle());
      await must(db.from("upload_log").insert({ clip_id: clip.id, uploader_id: clip.user_id, uploader_email: uploader?.email ?? null, youtube_video_id: videoId }));
      await r2.remove(clip.storage_path);
      log(`done: https://youtu.be/${videoId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof YouTubeError && e.isQuota) {
        await must(db.from("clips").update({ status: "approved", last_error: "Daily YouTube quota reached; waiting for reset" }).eq("id", clip.id));
        if (ONCE) return log("quota reached; the next scheduled run continues");
        const wait = msUntilQuotaReset();
        log(`quota reached, sleeping ${Math.round(wait / 60_000)} min until the Pacific-midnight reset`);
        await sleep(wait);
        continue;
      }
      if (e instanceof YouTubeError && e.reason === "invalid_grant") {
        await must(db.from("clips").update({ status: "approved", last_error: "YouTube disconnected; reconnect on the Admin page" }).eq("id", clip.id));
        if (ONCE) throw new Error("YouTube access revoked or expired. Reconnect on the Admin page.");
        log("YouTube access revoked or expired. Reconnect on the Admin page; checking every minute.");
        while (!(await must(db.from("youtube_connection").select("id").eq("id", 1).maybeSingle()))) await sleep(60_000);
        continue;
      }
      const attempts = clip.attempts + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await must(db.from("clips").update({ status: failed ? "failed" : "approved", attempts, last_error: message }).eq("id", clip.id));
      log(`error (attempt ${attempts}/${MAX_ATTEMPTS}): ${message}`);
      if (ONCE) return; // retry on the next scheduled run
      if (!failed) await sleep(30_000 * 2 ** attempts);
    }
  }
}

main().catch((e) => {
  log("worker crashed:", e);
  process.exit(1);
});
