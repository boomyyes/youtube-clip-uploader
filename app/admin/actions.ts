"use server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { head, remove, reviewableBefore } from "@/lib/r2.mjs";
import { decrypt } from "@/lib/crypto.mjs";
import { revokeToken } from "@/lib/youtube.mjs";

// Server actions are public POST endpoints: every one re-checks the owner.
async function owner() {
  const p = await getProfile();
  if (p?.role !== "owner" || !p.approved) throw new Error("Forbidden");
  return admin();
}

function done(msg?: string): never {
  redirect(msg ? `/admin?msg=${encodeURIComponent(msg)}` : "/admin");
}

const id = (f: FormData) => String(f.get("id") ?? "");

export async function approveUser(f: FormData) {
  const db = await owner();
  const { error } = await db.from("profiles").update({ approved: true }).eq("id", id(f));
  done(error?.message);
}

export async function approveClip(f: FormData) {
  const db = await owner();
  const { data: clip } = await db.from("clips").select("storage_path, created_at").eq("id", id(f)).maybeSingle();
  // Until the upload URL expires the uploader could still replace the file (even after the preview).
  if (clip && Date.parse(clip.created_at) > reviewableBefore()) done("Wait until the clip is 5 minutes old, then review it.");
  const file = clip && (await head(clip.storage_path));
  // Refuse if the file changed since the page was shown (uploader re-sent it with a still-valid URL).
  if (!file?.etag || file.etag !== f.get("etag")) done("The file changed or is missing. Reload and review it again.");
  const { error } = await db.rpc("approve_clip", { p_clip: id(f), p_etag: file.etag });
  done(error?.message);
}

export async function rejectClip(f: FormData) {
  const db = await owner();
  const reason = String(f.get("reason") ?? "").trim().slice(0, 300) || null;
  const { data, error } = await db
    .from("clips")
    .update({ status: "rejected", reject_reason: reason })
    .eq("id", id(f))
    .eq("status", "queued")
    .select("storage_path")
    .maybeSingle();
  if (error || !data) done(error?.message ?? "Clip is no longer waiting for review.");
  await remove(data.storage_path); // rejected files aren't kept
  done();
}

export async function retryClip(f: FormData) {
  const db = await owner();
  const { error } = await db.from("clips").update({ status: "approved", attempts: 0, last_error: null }).eq("id", id(f)).eq("status", "failed");
  done(error?.message);
}

/** Revokes the token with Google and deletes everything stored about the connection. */
export async function disconnectYouTube() {
  const db = await owner();
  const { data } = await db.from("youtube_connection").select("refresh_token_enc").eq("id", 1).maybeSingle();
  if (data) await revokeToken(decrypt(data.refresh_token_enc));
  const { error } = await db.from("youtube_connection").delete().eq("id", 1);
  done(error?.message ?? "YouTube disconnected. The token was revoked and deleted.");
}
