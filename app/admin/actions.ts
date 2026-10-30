"use server";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { accessTokenFromDb, setPublic } from "@/lib/youtube.mjs";
import { remove } from "@/lib/r2.mjs";

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
  const { error } = await db.rpc("approve_clip", { p_clip: id(f) });
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

export async function publishClip(f: FormData) {
  const db = await owner();
  const { data: clip } = await db.from("clips").select("youtube_video_id").eq("id", id(f)).eq("status", "on_youtube").maybeSingle();
  if (!clip?.youtube_video_id) done("Clip is not on YouTube yet.");
  try {
    await setPublic(await accessTokenFromDb(db), clip.youtube_video_id);
  } catch (e) {
    done(`Publish failed: ${e instanceof Error ? e.message : "unknown error"}`);
  }
  const { error } = await db.from("clips").update({ status: "public" }).eq("id", id(f));
  done(error?.message);
}
