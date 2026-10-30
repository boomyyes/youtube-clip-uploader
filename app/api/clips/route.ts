import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { GAMES, MAX_BYTES, VIDEO_TYPES } from "@/lib/games";
import { head, remove } from "@/lib/r2.mjs";

/** Step 2 of an upload: after the file is in R2, record the clip so the owner can review it. */
export async function POST(request: Request) {
  const p = await getProfile();
  if (!p?.approved) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { path, game, note } = await request.json().catch(() => ({}));
  if (!(GAMES as readonly string[]).includes(game)) return NextResponse.json({ error: "Pick a game from the list." }, { status: 400 });
  if (note != null && (typeof note !== "string" || note.length > 500)) {
    return NextResponse.json({ error: "Note must be 500 characters or fewer." }, { status: 400 });
  }
  // The path must be one this user was issued (their own folder) and the file must really be there.
  if (typeof path !== "string" || !path.startsWith(`${p.id}/`) || path.includes("..")) {
    return NextResponse.json({ error: "Bad file path." }, { status: 400 });
  }
  const file = await head(path);
  if (!file) return NextResponse.json({ error: "Upload not found. Try again." }, { status: 400 });
  // Defense in depth: the presigned URL already pins type and size.
  if (file.size > MAX_BYTES || !VIDEO_TYPES.includes(file.type)) {
    await remove(path);
    return NextResponse.json({ error: "That file isn't an allowed video." }, { status: 400 });
  }

  const { error } = await admin().from("clips").insert({ user_id: p.id, game, note: note?.trim() || null, storage_path: path });
  if (error) {
    const msg = error.code === "23505" ? "This file was already submitted." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
