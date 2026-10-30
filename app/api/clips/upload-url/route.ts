import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { presignPut } from "@/lib/r2.mjs";
import { MAX_BYTES, VIDEO_TYPES } from "@/lib/games";

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-matroska": "mkv" };

/** Step 1 of an upload: a presigned URL so the browser sends the file straight to R2. */
export async function POST(request: Request) {
  const p = await getProfile();
  if (!p?.approved) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { size, type } = await request.json().catch(() => ({}));
  if (!VIDEO_TYPES.includes(type)) return NextResponse.json({ error: "Use an MP4, MOV, WebM or MKV video." }, { status: 400 });
  if (typeof size !== "number" || size <= 0 || size > MAX_BYTES) {
    return NextResponse.json({ error: "Clips must be 2 GB or smaller." }, { status: 400 });
  }
  const path = `${p.id}/${randomUUID()}.${EXT[type]}`;
  // Signed for this exact type and size, so the browser can't send anything else.
  return NextResponse.json({ path, url: await presignPut(path, type, size) });
}
