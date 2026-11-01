import { test } from "node:test";
import assert from "node:assert/strict";
import { ffmpegArgs, recommendFormat, transformFor } from "./shorts.mjs";

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
  assert.ok(ffmpegArgs("crop", "in", "out").join(" ").includes("crop=trunc(ih*9/16/2)*2:ih"));
  assert.ok(ffmpegArgs("pad", "in", "out").join(" ").includes("boxblur"));
  assert.equal(ffmpegArgs("crop", "in", "out").at(-1), "out");
  assert.throws(() => ffmpegArgs("none", "in", "out"));
});
