import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { MAX_BYTES, VIDEO_TYPES } from "@/lib/games";
import { KEY_RE, head, remove } from "@/lib/r2.mjs";
import { checkEdits, transformFor } from "@/lib/shorts.mjs";

/** Step 2 of an upload: after the file is in R2, record the clip so the owner can review it. */
export async function POST(request: Request) {
  const p = await getProfile();
  if (!p?.approved) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { path, game: rawGame, note, format, width, height, duration, trimStart, trimEnd, cropX } = await request.json().catch(() => ({}));
  // Same rules as the games table (migration 0008). A name not on the list is added for everyone after the file checks pass.
  const typed = typeof rawGame === "string" ? rawGame.trim().replace(/\s+/g, " ") : "";
  if (typed.length < 1 || typed.length > 40 || /[<>]/.test(typed)) {
    return NextResponse.json({ error: "Game names must be 1 to 40 characters, without < or >." }, { status: 400 });
  }
  if (note != null && (typeof note !== "string" || note.length > 500)) {
    return NextResponse.json({ error: "Note must be 500 characters or fewer." }, { status: 400 });
  }
  // Shape and length come from the browser. A user who lies only misshapes their own clip, and the owner sees it before approving.
  const dims = { width: Number(width), height: Number(height), duration: Number(duration) };
  if (format !== "short" && format !== "regular") return NextResponse.json({ error: "Choose Short or Regular video." }, { status: 400 });
  const dimsKnown = Object.values(dims).every((v) => Number.isFinite(v) && v > 0);
  // Browsers can't read some files (often MKV): those upload unchanged as regular videos.
  if (!dimsKnown && format === "short") return NextResponse.json({ error: "Couldn't read this video's shape, so it can't be made a Short." }, { status: 400 });
  let transform = "none";
  let edits = { trim_start: null as number | null, trim_end: null as number | null, crop_x: null as number | null };
  try {
    if (dimsKnown) {
      edits = checkEdits({ trimStart, trimEnd, cropX }, dims.duration);
      // The kept part decides the format: a long clip trimmed to 3 minutes or less can be a Short.
      const kept = edits.trim_start != null ? edits.trim_end! - edits.trim_start : dims.duration;
      transform = transformFor(format, { ...dims, duration: kept });
      if (transform !== "crop") edits.crop_x = null;
    } else if (trimStart != null || cropX != null) throw new Error("Couldn't read this video, so it can't be trimmed or cropped.");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // The path must be one this user was issued (their own folder) and the file must really be there.
  if (typeof path !== "string" || !KEY_RE.test(path) || !path.startsWith(`${p.id}/`)) {
    return NextResponse.json({ error: "Bad file path." }, { status: 400 });
  }
  const file = await head(path);
  if (!file) return NextResponse.json({ error: "Upload not found. Try again." }, { status: 400 });
  // Defense in depth: the presigned URL already pins type and size.
  if (file.size > MAX_BYTES || !VIDEO_TYPES.includes(file.type)) {
    await remove(path);
    return NextResponse.json({ error: "That file isn't an allowed video." }, { status: 400 });
  }

  // Reuse the listed spelling ("valorant" -> "Valorant") so clips share one game and numbering.
  const findGame = async () => (await admin().from("games").select("name")).data?.find((g) => g.name.toLowerCase() === typed.toLowerCase())?.name;
  let gameName = await findGame();
  if (!gameName) {
    const { error: addError } = await admin().from("games").insert({ name: typed });
    gameName = !addError ? typed : addError.code === "23505" ? await findGame() : undefined; // 23505: added by someone else just now
    if (!gameName) return NextResponse.json({ error: addError?.message ?? "Couldn't add that game." }, { status: 400 });
  }
  const game = gameName;
  const { error } = await admin().from("clips").insert({ user_id: p.id, game, note: note?.trim() || null, storage_path: path, format, transform, ...edits });
  if (error) {
    const msg = error.code === "23505" ? "This file was already submitted." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
