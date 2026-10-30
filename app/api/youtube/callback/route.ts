import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto.mjs";
import { exchangeCode, myChannel } from "@/lib/youtube.mjs";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const back = (msg: string) => {
    const res = NextResponse.redirect(`${origin}/admin?yt=${encodeURIComponent(msg)}`);
    res.cookies.delete({ name: "yt_state", path: "/api/youtube" });
    return res;
  };

  const p = await getProfile();
  if (p?.role !== "owner" || !p.approved) return new NextResponse("Forbidden", { status: 403 });
  const state = request.cookies.get("yt_state")?.value;
  if (!state || state !== searchParams.get("state")) return back("Connection expired, try again.");
  const code = searchParams.get("code");
  if (!code) return back(searchParams.get("error") ?? "Google sent no code.");

  try {
    const tokens = await exchangeCode(code, `${origin}/api/youtube/callback`);
    if (!tokens.refresh_token) return back("Google sent no refresh token. Remove the app's access in your Google account and connect again.");
    if (!tokens.scope.includes("youtube.upload")) return back("Upload permission was not granted. Tick every box on Google's screen.");
    const channel = await myChannel(tokens.access_token);
    if (!channel) return back("That Google account has no YouTube channel.");
    const { error } = await admin().from("youtube_connection").upsert({
      id: 1,
      refresh_token_enc: encrypt(tokens.refresh_token),
      channel_id: channel.id,
      channel_title: channel.title,
      revoked: false,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return back(`Connected: ${channel.title}`);
  } catch (e) {
    return back(`Connection failed: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}
