import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { YouTubeError, msUntilQuotaReset, sendUpload } from "./youtube.mjs";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Replies with the queued responses in order and records each request. */
function mockFetch(...responses) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, ...init });
    return responses.shift();
  };
  return calls;
}

test("quota reset: 23:00 PDT is 1h (+1 min margin) away", () => {
  // 2026-07-01 23:00 PDT = 2026-07-02 06:00 UTC
  assert.equal(msUntilQuotaReset(new Date("2026-07-02T06:00:00Z")), 3_600_000 + 60_000);
  // exactly midnight PST (UTC-8) -> a full day away
  assert.equal(msUntilQuotaReset(new Date("2026-01-15T08:00:00Z")), 86_400_000 + 60_000);
});

/** read() over an in-memory buffer, recording each requested range. */
function reader(size) {
  const bytes = new Uint8Array(size).map((_, i) => i);
  const reads = [];
  const read = async (s, e) => { reads.push([s, e]); return bytes.slice(s, e + 1).buffer; };
  return { read, reads };
}

test("resume sends only the bytes YouTube is missing", async () => {
  const { read, reads } = reader(10);
  const calls = mockFetch(
    new Response(null, { status: 308, headers: { Range: "bytes=0-3" } }),
    Response.json({ id: "vid123" }, { status: 201 }),
  );
  assert.equal(await sendUpload("tok", "https://up/session", 10, read), "vid123");
  assert.equal(calls[0].headers["Content-Range"], "bytes */10");
  assert.equal(calls[1].headers["Content-Range"], "bytes 4-9/10");
  assert.deepEqual(reads, [[4, 9]]);
  assert.equal(calls[1].body.byteLength, 6);
});

test("large file goes in chunks, following YouTube's Range each time", async () => {
  const { read, reads } = reader(10);
  const calls = mockFetch(
    new Response(null, { status: 308 }), // probe: nothing stored
    new Response(null, { status: 308, headers: { Range: "bytes=0-3" } }),
    new Response(null, { status: 308, headers: { Range: "bytes=0-5" } }), // YouTube kept only part of chunk 2
    new Response(null, { status: 308, headers: { Range: "bytes=0-9" } }),
    Response.json({ id: "big" }, { status: 200 }),
  );
  // Last 308 says all bytes stored but no final response: must not loop forever.
  const err = await sendUpload("tok", "https://up/s", 10, read, 4).catch((e) => e);
  assert.ok(err instanceof YouTubeError);
  assert.deepEqual(reads, [[0, 3], [4, 7], [6, 9]]);
  assert.deepEqual(calls.slice(1).map((c) => c.headers["Content-Range"]), ["bytes 0-3/10", "bytes 4-7/10", "bytes 6-9/10"]);
});

test("final chunk returns the video id", async () => {
  const { read } = reader(8);
  mockFetch(
    new Response(null, { status: 308 }),
    new Response(null, { status: 308, headers: { Range: "bytes=0-3" } }),
    Response.json({ id: "ok" }, { status: 201 }),
  );
  assert.equal(await sendUpload("tok", "https://up/s", 8, read, 4), "ok");
});

test("already-finished session returns the id without re-sending", async () => {
  const { read, reads } = reader(3);
  const calls = mockFetch(Response.json({ id: "done1" }, { status: 200 }));
  assert.equal(await sendUpload("tok", "https://up/s", 3, read), "done1");
  assert.equal(calls.length, 1);
  assert.equal(reads.length, 0);
});

test("expired session returns null so the caller starts a new one", async () => {
  mockFetch(new Response(null, { status: 404 }));
  assert.equal(await sendUpload("tok", "https://up/s", 3, reader(3).read), null);
});

test("quota errors are recognised", async () => {
  mockFetch(
    new Response(null, { status: 308 }),
    Response.json({ error: { message: "quota", errors: [{ reason: "quotaExceeded" }] } }, { status: 403 }),
  );
  const err = await sendUpload("tok", "https://up/s", 3, reader(3).read).catch((e) => e);
  assert.ok(err instanceof YouTubeError);
  assert.equal(err.isQuota, true);
});

test("revoked refresh token surfaces as invalid_grant", async () => {
  const { refreshAccessToken } = await import("./youtube.mjs");
  mockFetch(Response.json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, { status: 400 }));
  const err = await refreshAccessToken("old").catch((e) => e);
  assert.equal(err.reason, "invalid_grant");
  assert.equal(err.message, "Token has been expired or revoked.");
});
