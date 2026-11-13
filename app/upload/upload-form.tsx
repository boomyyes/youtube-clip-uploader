"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_BYTES, VIDEO_TYPES, sortGames } from "@/lib/games";
import { createClient } from "@/lib/supabase/browser";
import Icon from "../ui-icon";
import { Notice } from "../ui";
import FormatPreview from "../format-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { MAX_SHORT_SECONDS, recommendFormat, transformFor } from "@/lib/shorts.mjs";

type Clip = { url: string; width: number; height: number; duration: number; still: boolean };

const RESHAPE_NOTE: Record<string, string> = {
  crop: "It will be cropped to vertical (9:16). Slide to choose which part of the frame to keep.",
  pad: "It will be padded to widescreen (16:9) over a blurred copy, so YouTube doesn't make it a Short.",
  none: "",
};

const time = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

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
export default function UploadForm({ name, used: initialUsed, games: initialGames }: { name: string; used: Record<string, number[]>; games: string[] }) {
  const [game, setGame] = useState("");
  const [games, setGames] = useState(initialGames);
  // Live game list: the owner edits it on /admin; re-read it on any change (Realtime on the games table).
  useEffect(() => {
    const supabase = createClient();
    const reload = async () => {
      const { data } = await supabase.from("games").select("name");
      if (!data) return;
      const list = sortGames(data.map((g) => g.name));
      setGames(list);
    };
    const channel = supabase.channel("games").on("postgres_changes", { event: "*", schema: "public", table: "games" }, reload).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  const [used, setUsed] = useState(initialUsed);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [noteLength, setNoteLength] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  // The chosen file's shape and length (read in the browser) drive the Short/Regular choice and preview.
  const [clip, setClip] = useState<Clip | null>(null);
  const [format, setFormat] = useState<"short" | "regular">("regular");
  const [trim, setTrim] = useState<[number, number]>([0, 0]); // kept part, in seconds
  const [cropX, setCropX] = useState(0.5); // where a Short is cropped from: 0 = left edge, 1 = right edge
  const urlRef = useRef<string | null>(null);
  const dropPreview = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setClip(null);
  };
  useEffect(() => dropPreview, []);

  function pickFile(file: File | undefined) {
    setFileName(file?.name ?? null);
    dropPreview();
    if (!file) return;
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (urlRef.current !== url) return; // another file was picked meanwhile
      const c = { url, width: probe.videoWidth, height: probe.videoHeight, duration: probe.duration, still: matchMedia("(prefers-reduced-motion: reduce)").matches };
      setClip(c);
      setTrim([0, c.duration]);
      setCropX(0.5);
      setFormat(recommendFormat(c));
    };
    // Some formats (often MKV) can't be read by the browser: no preview, and it uploads as a regular video.
    probe.onerror = () => setFormat("regular");
    probe.src = url;
  }
  // Drag a file anywhere over the page: show an overlay, and on drop put it in the file input (as if picked).
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busyRef = useRef(false);
  const depth = useRef(0); // dragenter/leave fire for every child element
  const pickRef = useRef(pickFile);
  useEffect(() => { pickRef.current = pickFile; }); // listeners below are added once but must call the latest pickFile
  useEffect(() => {
    const hasFile = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    const enter = (e: DragEvent) => { if (hasFile(e) && !busyRef.current) { depth.current++; setDragging(true); } };
    const leave = (e: DragEvent) => { if (hasFile(e) && --depth.current <= 0) { depth.current = 0; setDragging(false); } };
    const over = (e: DragEvent) => { if (hasFile(e)) e.preventDefault(); }; // allow dropping (else the browser opens the file)
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      const input = fileRef.current;
      if (!file || !input || busyRef.current) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files; // the form submits from the input, so drop and Browse behave the same
      pickRef.current(file);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);
  // The kept part decides the format, so trimming a long clip can make it a Short.
  const kept = clip ? { ...clip, duration: trim[1] - trim[0] } : null;
  const trimmed = !!clip && (trim[0] > 0 || trim[1] < clip.duration);
  const canShort = !!kept && kept.duration <= MAX_SHORT_SECONDS;
  const chosen = format === "short" && !canShort ? "regular" : format;
  const transform = kept ? transformFor(chosen, kept) : "none";

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
        title: customTitle,
        note: data.get("note"),
        format: clip ? chosen : "regular",
        width: clip?.width,
        height: clip?.height,
        duration: clip?.duration,
        ...(trimmed && { trimStart: trim[0], trimEnd: trim[1] }),
        ...(transform === "crop" && { cropX }),
      });
      form.reset();
      const sent = String(data.get("game"));
      setUsed((u) => ({ ...u, [sent]: [...(u[sent] ?? []), lowestFree(u[sent])] })); // that number is now taken
      setGame("");
      setFileName(null);
      setNoteLength(0);
      setCustomTitle("");
      dropPreview();
      setFormat("regular");
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
  useEffect(() => { busyRef.current = busy; }, [busy]); // no drops while a file is uploading
  return (
    <>
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div><Icon name="upload" size={40} /><strong>Drop your clip</strong><span>MP4, MOV, WebM or MKV · max 2 GB</span></div>
        </div>
      )}
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
          <div className={`file-drop ${fileName ? "has-file" : ""}`} data-cursor="Drop">
            <input
              ref={fileRef}
              id="file"
              name="file"
              type="file"
              accept={VIDEO_TYPES.join(",")}
              required
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <div className="file-drop-icon">
              <Icon name="upload" size={23} />
            </div>
            <div>
              <strong>{fileName ?? "Choose a video file"}</strong>
              <span>Drag it anywhere on the page or browse · MP4, MOV, WebM or MKV · max 2 GB</span>
            </div>
            <span className="file-browse" aria-hidden="true">
              Browse
            </span>
          </div>
          <p className="field-help">
            <Icon name="info" size={14} /> Files can be large, so uploads may
            take a few minutes. Keep this tab open.
          </p>
          {clip && (
            <fieldset className="format-choice">
              <legend className="field-label">Format</legend>
              <div className="format-options">
                <label className={`format-option ${chosen === "short" ? "is-selected" : ""}`}>
                  <input type="radio" name="format" value="short" checked={chosen === "short"} disabled={!canShort} onChange={() => setFormat("short")} />
                  YouTube Short {recommendFormat(kept!) === "short" && <span className="optional">Recommended</span>}
                  {!canShort && <span className="optional">Over 3 minutes</span>}
                </label>
                <label className={`format-option ${chosen === "regular" ? "is-selected" : ""}`}>
                  <input type="radio" name="format" value="regular" checked={chosen === "regular"} onChange={() => setFormat("regular")} />
                  Regular video {recommendFormat(kept!) === "regular" && <span className="optional">Recommended</span>}
                </label>
              </div>
              {RESHAPE_NOTE[transform] && <p className="field-help"><Icon name="info" size={14} /> {RESHAPE_NOTE[transform]}</p>}
              {clip.duration >= 2 && (
                <div className="edit-sliders">
                  <div>
                    <span className="field-label-row"><span className="field-label">Trim</span><strong>{time(trim[0])} → {time(trim[1])}</strong></span>
                    {/* at least 1 s kept: 10 steps of 0.1 s between the handles */}
                    <Slider min={0} max={clip.duration} step={0.1} minStepsBetweenThumbs={10} value={trim} data-cursor="Drag"
                      thumbLabels={["Trim start", "Trim end"]} thumbText={[time(trim[0]), time(trim[1])]}
                      onValueChange={([start, end]) => setTrim([start, end])} />
                  </div>
                  {transform === "crop" && (
                    <label>
                      <span>Crop position <strong>{cropX < 0.4 ? "Left" : cropX > 0.6 ? "Right" : "Centre"}</strong></span>
                      <Slider min={0} max={1} step={0.01} value={[cropX]} data-cursor="Drag"
                        thumbLabels={["Crop position"]} thumbText={[`${Math.round(cropX * 100)}% from the left`]}
                        onValueChange={([x]) => setCropX(x)} />
                    </label>
                  )}
                  <p className="field-help"><Icon name="info" size={14} /> Keeps {time(trim[1] - trim[0])}{trimmed ? ` of ${time(clip.duration)}` : " (the whole clip)"}. The full file is still uploaded; the cut happens after approval.</p>
                </div>
              )}
              <FormatPreview src={clip.url} transform={transform} still={clip.still} trim={trimmed ? trim : null} cropX={cropX} label={`Preview of ${fileName} as a ${chosen === "short" ? "Short" : "regular video"}`} />
            </fieldset>
          )}
          <label className="field-label" htmlFor="game">
            Game <span className="required">Required</span>
          </label>
          {/* Type to filter the list; an existing name snaps to its listed spelling, a new one is added on upload. */}
          <Input
            id="game"
            name="game"
            list="game-list"
            required
            maxLength={40}
            autoComplete="off"
            placeholder="Type or choose a game"
            aria-describedby="game-help"
            value={game}
            onChange={(e) => setGame(games.find((g) => g.toLowerCase() === e.target.value.trim().toLowerCase()) ?? e.target.value)}
          />
          <datalist id="game-list">
            {games.map((g) => <option key={g} value={g} />)}
          </datalist>
          <p className="field-help" id="game-help">
            <Icon name="info" size={14} /> {game.trim() && !games.includes(game) ? `"${game.trim()}" is new: it will be added to the list for everyone.` : "Pick from the list, or type a game that isn't there yet."}
          </p>
          <div className="field-label-row">
            <label className="field-label" htmlFor="title">
              Custom title <span className="optional">Optional</span>
            </label>
            <span className="char-count">{customTitle.length} / 50</span>
          </div>
          <Input
            id="title"
            name="title"
            maxLength={50}
            autoComplete="off"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value.replace(/[<>]/g, ""))}
            placeholder="e.g. Insane 1v5 clutch"
          />
          <div className="field-label-row">
            <label className="field-label" htmlFor="note">
              Note <span className="optional">Optional</span>
            </label>
            <span className="char-count">{noteLength} / 500</span>
          </div>
          <Textarea
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
              <span>Uploading {fileName}</span>
              <strong>{progress}%</strong>
            </div>
            <Progress id="progress" value={progress} aria-label={`Uploading ${fileName}`} aria-valuetext={`${progress}%`} />
            <p className="field-help">
              Your form is locked while the file is uploading.
            </p>
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {busy ? `Uploading, ${progress}%` : ""}
        </p>
        <div className="form-actions">
          <Button type="submit" size="lg" className="rounded-full" disabled={busy} data-cursor="Send">
            {busy ? <Spinner aria-hidden="true" role={undefined} aria-label={undefined} /> : <Icon name="upload" />}
            {busy ? "Uploading…" : "Send for review"}
          </Button>
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
            Your clip becomes &quot;{customTitle.trim() && `${customTitle.trim()} | `}{name}&apos;s clip in {game || "[game]"} #
            {game ? lowestFree(used[game]) : "[n]"}&quot; when approved.
          </p>
          {chosen === "short" && clip && <p className="muted">#Shorts is added to the description.</p>}
        </div>
      </aside>
    </>
  );
}
