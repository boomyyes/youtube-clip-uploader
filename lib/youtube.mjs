// YouTube Data API v3 over plain fetch. Shared by the site and the worker.
import { decrypt } from "./crypto.mjs";

export const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export class YouTubeError extends Error {
  /** @param {string} message @param {number} status @param {string} reason */
  constructor(message, status, reason) {
    super(message);
    this.status = status;
    this.reason = reason; // e.g. quotaExceeded, uploadLimitExceeded, invalid_grant
  }
  get isQuota() {
    return ["quotaExceeded", "uploadLimitExceeded", "rateLimitExceeded", "dailyLimitExceeded"].includes(this.reason);
  }
}

async function fail(res) {
  const body = await res.json().catch(() => ({}));
  const reason = body.error?.errors?.[0]?.reason ?? (typeof body.error === "string" ? body.error : "") ?? "";
  const message = body.error?.message ?? body.error_description ?? `HTTP ${res.status}`;
  return new YouTubeError(message, res.status, reason);
}

/** @param {string} state @param {string} redirectUri */
export function authUrl(state, redirectUri) {
  const q = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function token(params) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID ?? "",
      client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
      ...params,
    }),
  });
  if (!res.ok) throw await fail(res);
  return res.json();
}

/** @returns {Promise<{access_token: string, refresh_token?: string, scope: string}>} */
export function exchangeCode(code, redirectUri) {
  return token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

/** @returns {Promise<string>} access token; throws YouTubeError reason "invalid_grant" if revoked */
export async function refreshAccessToken(refreshToken) {
  return (await token({ refresh_token: refreshToken, grant_type: "refresh_token" })).access_token;
}

/**
 * Access token from the stored connection. Marks the connection revoked on invalid_grant.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin secret-key client
 */
export async function accessTokenFromDb(admin) {
  const { data, error } = await admin.from("youtube_connection").select("refresh_token_enc, revoked").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data || data.revoked) throw new YouTubeError("YouTube is not connected", 401, "invalid_grant");
  try {
    return await refreshAccessToken(decrypt(data.refresh_token_enc));
  } catch (e) {
    if (e instanceof YouTubeError && e.reason === "invalid_grant") {
      await admin.from("youtube_connection").update({ revoked: true }).eq("id", 1);
    }
    throw e;
  }
}

/** @returns {Promise<{id: string, title: string} | null>} */
export async function myChannel(accessToken) {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw await fail(res);
  const ch = (await res.json()).items?.[0];
  return ch ? { id: ch.id, title: ch.snippet.title } : null;
}

/** Makes a video public. selfDeclaredMadeForKids is resent because part=status replaces the whole status. */
export async function setPublic(accessToken, videoId) {
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: videoId, status: { privacyStatus: "public", selfDeclaredMadeForKids: false } }),
  });
  if (!res.ok) throw await fail(res);
}

/** Video resource for videos.insert. Always private: the owner publishes after upload. */
export function videoMetadata(title, description) {
  return {
    snippet: { title, description, categoryId: "20" }, // 20 = Gaming
    status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
  };
}

/** Starts a resumable upload session. @returns {Promise<string>} session URL */
export async function startUpload(accessToken, metadata, size, type) {
  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(size),
        "X-Upload-Content-Type": type,
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!res.ok) throw await fail(res);
  const url = res.headers.get("location");
  if (!url) throw new YouTubeError("No upload session URL returned", res.status, "");
  return url;
}

export const CHUNK = 8 * 1024 * 1024; // YouTube needs chunks in multiples of 256 KiB

/**
 * Sends the file to a session in chunks, resuming from what YouTube already has.
 * Only one chunk is in memory at a time, so clip size doesn't matter.
 * @param {number} size total bytes
 * @param {(start: number, end: number) => Promise<ArrayBuffer | Blob>} read bytes start..end inclusive
 * @returns {Promise<string | null>} video id, or null if the session expired (start a new one)
 */
export async function sendUpload(accessToken, sessionUrl, size, read, chunk = CHUNK) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  // Ask how many bytes the session already holds.
  let res = await fetch(sessionUrl, { method: "PUT", headers: { ...auth, "Content-Range": `bytes */${size}` } });
  for (;;) {
    if (res.status === 200 || res.status === 201) return (await res.json()).id;
    if (res.status === 404 || res.status === 410) return null;
    if (res.status !== 308) throw await fail(res);
    const range = res.headers.get("range"); // "bytes=0-N", absent if nothing stored yet
    const from = range ? Number(range.split("-")[1]) + 1 : 0;
    if (from >= size) throw new YouTubeError("YouTube has every byte but did not finish the upload", 308, "");
    const end = Math.min(from + chunk, size) - 1;
    res = await fetch(sessionUrl, {
      method: "PUT",
      headers: { ...auth, "Content-Range": `bytes ${from}-${end}/${size}` },
      body: await read(from, end),
    });
  }
}

/**
 * Milliseconds until YouTube's daily quota resets (midnight Pacific), plus a 1-minute margin.
 * shortcut: assumes a 24-hour day, so it is off by an hour on the two DST-change days; fine for a retry wait.
 */
export function msUntilQuotaReset(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000;
  return 86_400_000 - elapsed + 60_000;
}
