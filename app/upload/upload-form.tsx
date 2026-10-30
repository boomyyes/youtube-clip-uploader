"use client";
import { useState } from "react";
import { GAMES, MAX_BYTES, VIDEO_TYPES } from "@/lib/games";
import Icon from "../pixel-icon";
import { Notice } from "../ui";

function lowestFree(taken: number[] = []) {
  let n = 1;
  while (taken.includes(n)) n++;
  return n;
}

async function api(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

// used: clip numbers already taken per game; a new clip gets the lowest free one (migration 0007).
export default function UploadForm({ name, used: initialUsed }: { name: string; used: Record<string, number[]> }) {
  const [game, setGame] = useState("");
  const [used, setUsed] = useState(initialUsed);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [noteLength, setNoteLength] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File;
    setMessage(null);
    if (!file?.size)
      return setMessage({ text: "Choose a video file.", error: true });
    if (!VIDEO_TYPES.includes(file.type))
      return setMessage({
        text: "Use an MP4, MOV, WebM or MKV video.",
        error: true,
      });
    if (file.size > MAX_BYTES)
      return setMessage({
        text: "Clips must be 2 GB or smaller.",
        error: true,
      });
    try {
      setProgress(0);
      const { path, url } = await api("/api/clips/upload-url", {
        size: file.size,
        type: file.type,
      });
      await putFile(url, file, setProgress);
      await api("/api/clips", {
        path,
        game: data.get("game"),
        note: data.get("note"),
      });
      form.reset();
      const sent = String(data.get("game"));
      setUsed((u) => ({ ...u, [sent]: [...(u[sent] ?? []), lowestFree(u[sent])] })); // that number is now taken
      setGame("");
      setFileName(null);
      setNoteLength(0);
      setMessage({
        text: "Uploaded. It will appear on YouTube after the owner approves it.",
        error: false,
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Upload failed.",
        error: true,
      });
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  return (
    <>
      <form className="panel upload-panel" onSubmit={submit}>
        <div className="panel-header">
          <div>
            <span className="panel-kicker">NEW CLIP</span>
            <h2>Send it to the queue</h2>
          </div>
          <span className="panel-header-icon">
            <Icon name="film" size={22} />
          </span>
        </div>
        {message && (
          <Notice tone={message.error ? "error" : "success"}>
            {message.text}
          </Notice>
        )}
        <fieldset disabled={busy}>
          <label className="field-label" htmlFor="file">
            Video file <span className="required">Required</span>
          </label>
          <div className={`file-drop ${fileName ? "has-file" : ""}`}>
            <input
              id="file"
              name="file"
              type="file"
              accept={VIDEO_TYPES.join(",")}
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <div className="file-drop-icon">
              <Icon name="upload" size={23} />
            </div>
            <div>
              <strong>{fileName ?? "Choose a video file"}</strong>
              <span>MP4, MOV, WebM or MKV · max 2 GB</span>
            </div>
            <span className="file-browse" aria-hidden="true">
              Browse
            </span>
          </div>
          <p className="field-help">
            <Icon name="info" size={14} /> Files can be large, so uploads may
            take a few minutes. Keep this tab open.
          </p>
          <label className="field-label" htmlFor="game">
            Game <span className="required">Required</span>
          </label>
          <div className="select-wrap">
            <select
              id="game"
              name="game"
              required
              value={game}
              onChange={(e) => setGame(e.target.value)}
            >
              <option value="" disabled>
                Choose a game
              </option>
              {GAMES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="field-label-row">
            <label className="field-label" htmlFor="note">
              Note <span className="optional">Optional</span>
            </label>
            <span className="char-count">{noteLength} / 500</span>
          </div>
          <textarea
            id="note"
            name="note"
            maxLength={500}
            rows={5}
            onChange={(e) => setNoteLength(e.target.value.length)}
            placeholder="Add context for the owner. This will be included in the YouTube description."
          />
        </fieldset>
        {busy && (
          <div className="progress-block">
            <div className="progress-top">
              <label htmlFor="progress">Uploading {fileName}</label>
              <strong>{progress}%</strong>
            </div>
            <progress
              id="progress"
              className="sr-only"
              max={100}
              value={progress}
              aria-valuetext={`${progress}%`}
            />
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="field-help">
              Your form is locked while the file is uploading.
            </p>
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {busy ? `Uploading, ${progress}%` : ""}
        </p>
        <div className="form-actions">
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            <Icon name="upload" />
            {busy ? "Uploading…" : "Upload clip"}
          </button>
          <span className="form-safe">
            <Icon name="check" size={14} /> Private until approved
          </span>
        </div>
      </form>
      <aside className="upload-aside">
        <div className="aside-card accent-card">
          <span className="panel-kicker">HOW IT WORKS</span>
          <div className="step-list">
            <div className="step">
              <span>01</span>
              <div>
                <strong>You upload</strong>
                <p>Send the full clip here. No YouTube account needed.</p>
              </div>
            </div>
            <div className="step">
              <span>02</span>
              <div>
                <strong>Owner reviews</strong>
                <p>Every clip gets a human thumbs-up before it goes live.</p>
              </div>
            </div>
            <div className="step">
              <span>03</span>
              <div>
                <strong>It goes live</strong>
                <p>We title, describe and upload it to the channel.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="aside-card">
          <div className="aside-icon">
            <Icon name="star" size={17} />
          </div>
          <strong>Title is handled for you</strong>
          <p className="muted" aria-live="polite">
            Your clip becomes &quot;{name}&apos;s clip in {game || "[game]"} #
            {game ? lowestFree(used[game]) : "[n]"}&quot; when approved.
          </p>
        </div>
      </aside>
    </>
  );
}
