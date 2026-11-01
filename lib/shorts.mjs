// YouTube has no "Short" flag: any upload that is vertical/square and <= 3 minutes becomes a Short.
// So the format a user picks is honoured by reshaping: wide -> Short is centre-cropped to 9:16,
// vertical -> regular is padded to 16:9 over a blurred copy. Shared by the upload form, API and worker.
export const MAX_SHORT_SECONDS = 180;

const vertical = ({ width, height }) => height >= width;

/** @returns {"short" | "regular"} */
export function recommendFormat(dims) {
  return vertical(dims) && dims.duration <= MAX_SHORT_SECONDS ? "short" : "regular";
}

/** @returns {"none" | "crop" | "pad"} what the worker must do so YouTube shows the chosen format */
export function transformFor(format, dims) {
  if (format === "short") {
    if (dims.duration > MAX_SHORT_SECONDS) throw new Error("Shorts must be 3 minutes or less.");
    return vertical(dims) ? "none" : "crop";
  }
  // Over 3 minutes YouTube never makes a Short, so a vertical clip needs no padding.
  return vertical(dims) && dims.duration <= MAX_SHORT_SECONDS ? "pad" : "none";
}

const ENCODE = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"];

// The uploaded file is untrusted. ffmpeg must never guess its format: a file disguised as a playlist (HLS, concat)
// could make it fetch URLs or read local files (e.g. the worker's secrets) into the output. So the demuxer is forced
// from this allowlist (keyed by the content type R2 enforced at upload) and only local-file access is allowed.
const DEMUXER = { "video/mp4": "mov", "video/quicktime": "mov", "video/webm": "matroska", "video/x-matroska": "matroska" };

/**
 * The uploader's trim and Short crop position, checked against the clip length. Throws on bad input.
 * Trim is stored only when it cuts something; crop_x (0 = left edge, 1 = right edge) only matters for a crop.
 */
export function checkEdits({ trimStart, trimEnd, cropX }, duration) {
  const out = { trim_start: null, trim_end: null, crop_x: null };
  if (trimStart != null || trimEnd != null) {
    const s = Number(trimStart), e = Number(trimEnd);
    if (!(s >= 0 && e <= duration && e - s >= 1)) throw new Error("Trim must keep at least 1 second of the clip.");
    if (s > 0 || e < duration) Object.assign(out, { trim_start: round(s), trim_end: round(e) });
  }
  if (cropX != null) {
    const x = Number(cropX);
    if (!(x >= 0 && x <= 1)) throw new Error("Bad crop position.");
    out.crop_x = round(x);
  }
  return out;
}
const round = (n) => Math.round(n * 100) / 100;

/** Whether the worker must re-encode the clip (reshape and/or trim) instead of sending the file as it is. */
export const needsEncode = (clip) => (clip.transform ?? "none") !== "none" || clip.trim_start != null;

/** ffmpeg arguments for the clip's edits (a clips row) on a file with this (already validated) content type. */
export function ffmpegArgs({ transform, trim_start, trim_end, crop_x }, input, output, type) {
  if (!needsEncode({ transform, trim_start })) throw new Error("Nothing to encode");
  const demuxer = DEMUXER[type];
  if (!demuxer) throw new Error(`Can't reshape files of type ${type}`);
  // Input options: seek to the start and read only the kept length.
  const trim = trim_start != null ? ["-ss", String(Number(trim_start)), "-t", String(Number(trim_end) - Number(trim_start))] : [];
  const filter =
    transform === "none"
      ? []
      : transform === "crop"
      ? ["-vf", `crop=trunc(ih*9/16/2)*2:ih:(iw-ow)*${Number(crop_x ?? 0.5)}:0`]
      : [
          "-filter_complex",
          "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=20:5[bg];" +
            "[0:v]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0",
        ];
  return ["-y", "-protocol_whitelist", "file", ...trim, "-f", demuxer, "-i", input, ...filter, ...ENCODE, output];
}
