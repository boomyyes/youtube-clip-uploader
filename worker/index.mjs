// Upload worker. Sends approved clips to YouTube.
//   npm run worker        keeps running on the owner's PC
//   --once                uploads what's approved, then exits (GitHub Actions runs this on a schedule)
//   npm run worker:fake   (--fake) skips YouTube entirely (no quota used) for local testing
import { spawn } from "node:child_process";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { ffmpegArgs, needsEncode } from "../lib/shorts.mjs";
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

/** Can't be fixed by retrying: fail the clip at once. */
class FatalError extends Error {}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    // Only PATH in its environment: ffmpeg handles untrusted files and must not be able to see the worker's secrets.
    const p = spawn("ffmpeg", ["-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"], env: { PATH: process.env.PATH } });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(e.code === "ENOENT" ? new FatalError("ffmpeg not installed: install it or let GitHub Actions upload this clip") : e));
    // Raw ffmpeg output stays in the run log only, never in the clip row.
    p.on("close", (code) => (code ? (log("ffmpeg error:", err.slice(-1000)), reject(new FatalError("Couldn't convert this video (ffmpeg failed); see the worker log"))) : resolve()));
  });
}

const PIECE = 8 * 1024 * 1024;

/** Downloads the approved file (If-Match on every piece) and trims/crops/pads it (lib/shorts.mjs). Returns a local source. */
async function reshape(clip, size, type) {
  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  try {
    const input = join(dir, "in"), output = join(dir, "out.mp4");
    const fh = await open(input, "w");
    try {
      for (let s = 0; s < size; s += PIECE) await fh.write(new Uint8Array(await r2.readRange(clip.storage_path, s, Math.min(s + PIECE, size) - 1, clip.approved_etag)));
    } finally {
      await fh.close();
    }
    await ffmpeg(ffmpegArgs(clip, input, output, type));
    const out = await open(output, "r");
    const { size: outSize } = await out.stat();
    const read = async (start, end) => {
      const buf = Buffer.alloc(end - start + 1);
      await out.read(buf, 0, buf.length, start);
      return buf;
    };
    return { size: outSize, type: "video/mp4", read, done: async () => { await out.close(); await rm(dir, { recursive: true, force: true }); } };
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
}

async function upload(clip) {
  const file = await r2.head(clip.storage_path);
  if (!file) throw new Error("Clip file is missing from storage");
  if (!clip.approved_etag || file.etag !== clip.approved_etag) throw new Error("Clip file changed after it was approved; not uploading it");
  const reshaped = needsEncode(clip);
  // If-Match on every chunk: a swap mid-upload fails instead of mixing files.
  const src = reshaped
    ? await reshape(clip, file.size, file.type)
    : { size: file.size, type: file.type || "video/mp4", read: (start, end) => r2.readRange(clip.storage_path, start, end, clip.approved_etag), done: async () => {} };
  try {
    if (FAKE) {
      await src.read(0, Math.min(src.size, 1024) - 1); // proves storage access without touching YouTube
      log(reshaped ? `fake: re-encoded (${clip.transform}, trim ${clip.trim_start ?? "-"}) to ${src.size} bytes` : "fake: storage readable");
      return `fake-${clip.id.slice(0, 8)}`;
    }
    const token = await accessTokenFromDb(db);
    const age = Date.now() - new Date(clip.upload_session_started_at ?? 0).getTime();
    // A reshaped file isn't byte-identical across runs, so it never resumes an old session.
    if (!reshaped && clip.upload_session_url && age < SESSION_MAX_AGE) {
      const id = await sendUpload(token, clip.upload_session_url, src.size, src.read); // resume
      if (id) return id;
    }
    const url = await startUpload(token, videoMetadata(clip.title, clip.description), src.size, src.type);
    // Saved before sending, so a crash mid-upload resumes instead of creating a second video.
    await must(db.from("clips").update({ upload_session_url: url, upload_session_started_at: new Date().toISOString() }).eq("id", clip.id));
    const id = await sendUpload(token, url, src.size, src.read);
    if (!id) throw new Error("Upload session expired right after it was created");
    return id;
  } finally {
    await src.done();
  }
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
      const failed = e instanceof FatalError || attempts >= MAX_ATTEMPTS;
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
