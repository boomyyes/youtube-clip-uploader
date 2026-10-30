import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { authUrl } from "@/lib/youtube.mjs";

export async function GET(request: Request) {
  const p = await getProfile();
  if (p?.role !== "owner" || !p.approved) return new NextResponse("Forbidden", { status: 403 });
  const { origin } = new URL(request.url);
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authUrl(state, `${origin}/api/youtube/callback`));
  // CSRF guard: the callback must come back with this same value.
  res.cookies.set("yt_state", state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/api/youtube", maxAge: 600 });
  return res;
}
