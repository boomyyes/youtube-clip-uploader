"use client";
import { useState } from "react";
import { GAMES, MAX_BYTES, VIDEO_TYPES } from "@/lib/games";

async function api(url: string, body: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

// XHR instead of fetch so we can show upload progress. Content-Type must match what the URL was signed for.
function putFile(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export default function UploadForm() {
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File;
    setMessage(null);
    if (!file?.size) return setMessage({ text: "Choose a video file.", error: true });
    if (!VIDEO_TYPES.includes(file.type)) return setMessage({ text: "Use an MP4, MOV, WebM or MKV video.", error: true });
    if (file.size > MAX_BYTES) return setMessage({ text: "Clips must be 2 GB or smaller.", error: true });
    try {
      setProgress(0);
      const { path, url } = await api("/api/clips/upload-url", { size: file.size, type: file.type });
      await putFile(url, file, setProgress);
      await api("/api/clips", { path, game: data.get("game"), note: data.get("note") });
      form.reset();
      setMessage({ text: "Uploaded. It will appear on YouTube after the owner approves it.", error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Upload failed.", error: true });
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  return (
    <form onSubmit={submit}>
      <label htmlFor="file">Video file</label>
      <input id="file" name="file" type="file" accept={VIDEO_TYPES.join(",")} required disabled={busy} />
      <label htmlFor="game">Game</label>
      <select id="game" name="game" required disabled={busy} defaultValue="">
        <option value="" disabled>Choose a game</option>
        {GAMES.map((g) => <option key={g}>{g}</option>)}
      </select>
      <label htmlFor="note">Note (optional, added to the description)</label>
      <textarea id="note" name="note" maxLength={500} rows={3} disabled={busy} />
      <p>
        <button type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      </p>
      {busy && (
        <>
          <label htmlFor="progress">Upload progress</label>
          <progress id="progress" max={100} value={progress} aria-valuetext={`${progress}%`} />
        </>
      )}
      <p role="status" aria-live="polite" className={message?.error ? "error" : undefined}>{message?.text}</p>
    </form>
  );
}
