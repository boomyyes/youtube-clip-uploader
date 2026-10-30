// Cloudflare R2 (S3 API) for temporary clip storage. Shared by the site and the worker. Server-side only:
// it holds the R2 secret. Browsers only ever get short-lived presigned URLs.
import { AwsClient } from "aws4fetch";

const client = () =>
  new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    service: "s3",
    region: "auto",
  });

// Keys are always "<user uuid>/<uuid>.<ext>"; anything else is refused before it reaches a URL.
export const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|mov|webm|mkv)$/;

function objectUrl(key) {
  if (!KEY_RE.test(key)) throw new Error(`Bad storage key: ${key}`);
  return new URL(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`);
}

async function presign(key, method, headers, expires) {
  const url = objectUrl(key);
  url.searchParams.set("X-Amz-Expires", String(expires));
  // allHeaders signs Content-Length too, so R2 refuses a body of any other size.
  const req = await client().sign(url, { method, headers, aws: { signQuery: true, allHeaders: true } });
  return req.url;
}

// Upload URLs can overwrite the file until they expire, so a clip is only reviewable after this.
export const PUT_TTL_SECONDS = 300; // only has to outlive the gap before the upload starts
/** Clips created before this time can no longer be overwritten. @returns {number} epoch ms */
export const reviewableBefore = () => Date.now() - PUT_TTL_SECONDS * 1000;

/** Browser upload URL locked to this exact type and size. */
export const presignPut = (key, type, size, expires = PUT_TTL_SECONDS) =>
  presign(key, "PUT", { "Content-Type": type, "Content-Length": String(size) }, expires);

/** Temporary read URL (admin preview). */
export const presignGet = (key, expires = 3600) => presign(key, "GET", {}, expires);

async function call(key, init) {
  const res = await client().fetch(objectUrl(key), init);
  if (!res.ok && res.status !== 404) throw new Error(`R2 ${init.method ?? "GET"} ${key}: HTTP ${res.status}`);
  return res;
}

/** @returns {Promise<{size: number, type: string, etag: string} | null>} null if missing */
export async function head(key) {
  const res = await call(key, { method: "HEAD" });
  if (res.status === 404) return null;
  return {
    size: Number(res.headers.get("content-length")),
    type: res.headers.get("content-type") ?? "",
    etag: res.headers.get("etag") ?? "",
  };
}

/** Bytes start..end (inclusive), only if the file is still the version with this ETag. */
export async function readRange(key, start, end, etag) {
  const res = await client().fetch(objectUrl(key), { headers: { Range: `bytes=${start}-${end}`, "If-Match": etag } });
  if (res.status === 412) throw new Error("Clip file changed after it was approved; not uploading it");
  if (!res.ok) throw new Error(`R2 GET ${key}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

export async function remove(key) {
  await call(key, { method: "DELETE" });
}
