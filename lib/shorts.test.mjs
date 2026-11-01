import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEdits, ffmpegArgs, recommendFormat, transformFor } from "./shorts.mjs";

const e = (transform, more) => ({ transform, ...more });

const tall = { width: 1080, height: 1920, duration: 30 };
const wide = { width: 1920, height: 1080, duration: 30 };
const square = { width: 1080, height: 1080, duration: 30 };
const long = (d) => ({ ...d, duration: 181 });

test("recommends Short only for vertical/square clips of 3 minutes or less", () => {
  assert.equal(recommendFormat(tall), "short");
  assert.equal(recommendFormat(square), "short");
  assert.equal(recommendFormat(wide), "regular");
  assert.equal(recommendFormat(long(tall)), "regular");
  assert.equal(recommendFormat({ ...tall, duration: 180 }), "short");
});

test("reshapes only when the chosen format differs from what YouTube would do", () => {
  assert.equal(transformFor("short", tall), "none");
  assert.equal(transformFor("short", wide), "crop");
  assert.equal(transformFor("regular", tall), "pad");
  assert.equal(transformFor("regular", square), "pad");
  assert.equal(transformFor("regular", wide), "none");
  assert.equal(transformFor("regular", long(tall)), "none"); // long clips are never Shorts anyway
});

test("refuses a Short over 3 minutes", () => {
  assert.throws(() => transformFor("short", long(wide)));
});

test("ffmpeg args crop to 9:16 or pad over a blurred copy", () => {
  assert.ok(ffmpegArgs(e("crop"), "in", "out", "video/mp4").join(" ").includes("crop=trunc(ih*9/16/2)*2:ih"));
  assert.ok(ffmpegArgs(e("pad"), "in", "out", "video/webm").join(" ").includes("boxblur"));
  assert.equal(ffmpegArgs(e("crop"), "in", "out", "video/mp4").at(-1), "out");
  assert.throws(() => ffmpegArgs(e("none"), "in", "out", "video/mp4"));
});

test("ffmpeg never guesses the input format or opens anything but a local file", () => {
  const args = ffmpegArgs(e("crop"), "in", "out", "video/quicktime");
  const before = args.slice(0, args.indexOf("-i")).join(" ");
  assert.match(before, /-protocol_whitelist file/);
  assert.match(before, /-f mov/);
  assert.equal(ffmpegArgs(e("pad"), "in", "out", "video/x-matroska")[args.indexOf("-f") + 1], "matroska");
  assert.throws(() => ffmpegArgs(e("crop"), "in", "out", "application/vnd.apple.mpegurl")); // HLS playlist
  assert.throws(() => ffmpegArgs(e("crop"), "in", "out", undefined));
});

test("trim and crop position are checked and only stored when they change something", () => {
  assert.deepEqual(checkEdits({ trimStart: 0, trimEnd: 30 }, 30), { trim_start: null, trim_end: null, crop_x: null });
  assert.deepEqual(checkEdits({ trimStart: 2.345, trimEnd: 10, cropX: 0.25 }, 30), { trim_start: 2.35, trim_end: 10, crop_x: 0.25 });
  assert.throws(() => checkEdits({ trimStart: 5, trimEnd: 5.5 }, 30)); // under 1 second
  assert.throws(() => checkEdits({ trimStart: -1, trimEnd: 10 }, 30));
  assert.throws(() => checkEdits({ trimStart: 0, trimEnd: 31 }, 30));
  assert.throws(() => checkEdits({ trimStart: "x", trimEnd: 10 }, 30));
  assert.throws(() => checkEdits({ cropX: 2 }, 30));
});

test("ffmpeg trims before decoding and crops at the chosen position", () => {
  const args = ffmpegArgs(e("none", { trim_start: 5, trim_end: 20 }), "in", "out", "video/mp4");
  const before = args.slice(0, args.indexOf("-i")).join(" ");
  assert.match(before, /-ss 5 -t 15/);
  assert.ok(!args.includes("-vf"));
  assert.ok(ffmpegArgs(e("crop", { crop_x: 0 }), "in", "out", "video/mp4").join(" ").includes("(iw-ow)*0:0"));
  assert.ok(ffmpegArgs(e("crop"), "in", "out", "video/mp4").join(" ").includes("(iw-ow)*0.5:0")); // centre by default
});
