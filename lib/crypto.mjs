// AES-256-GCM for the YouTube refresh token. Shared by the site and the worker.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const k = Buffer.from(process.env.TOKEN_ENC_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64-encoded");
  return k;
}

/** @param {string} plain @returns {string} "iv.tag.ciphertext", each base64 */
export function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

/** @param {string} packed @returns {string} throws if tampered or wrong key */
export function decrypt(packed) {
  const [iv, tag, data] = packed.split(".").map((s) => Buffer.from(s, "base64"));
  // Fixed tag length: otherwise GCM accepts a truncated (forgeable) tag.
  const d = createDecipheriv("aes-256-gcm", key(), iv, { authTagLength: 16 });
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
