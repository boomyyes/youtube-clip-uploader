import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");
const { encrypt, decrypt } = await import("./crypto.mjs");

test("round trip", () => {
  const packed = encrypt("1//refresh-token");
  assert.notEqual(packed, "1//refresh-token");
  assert.equal(decrypt(packed), "1//refresh-token");
  assert.notEqual(encrypt("x"), encrypt("x")); // fresh IV each time
});

test("tampered ciphertext or truncated tag is rejected", () => {
  const [iv, tag, data] = encrypt("secret").split(".");
  const flipped = Buffer.from(data, "base64");
  flipped[0] ^= 1;
  assert.throws(() => decrypt([iv, tag, flipped.toString("base64")].join(".")));
  assert.throws(() => decrypt([iv, Buffer.from(tag, "base64").subarray(0, 4).toString("base64"), data].join(".")));
});

test("wrong key is rejected", () => {
  const packed = encrypt("secret");
  process.env.TOKEN_ENC_KEY = randomBytes(32).toString("base64");
  assert.throws(() => decrypt(packed));
});
