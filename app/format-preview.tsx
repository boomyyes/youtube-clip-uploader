"use client";
// Shows a clip framed the way it will look on YouTube after the worker's edits (lib/shorts.mjs):
// crop = 9:16 crop at cropX (a Short), pad = 16:9 over a blurred copy (a regular video), none = as uploaded.
// trim = the kept [start, end] in seconds: playback stays inside it.
export default function FormatPreview({ src, transform, still = false, label, trim, cropX = 0.5 }: {
  src: string; transform: string; still?: boolean; label: string; trim?: [number, number] | null; cropX?: number;
}) {
  // still: no autoplay (reduced motion / review), show controls instead.
  const play = still ? { controls: true, preload: "metadata" as const } : { autoPlay: true, loop: true, muted: true, playsInline: true };
  const keep = trim
    ? {
        onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => { e.currentTarget.currentTime = trim[0]; },
        onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => {
          const v = e.currentTarget;
          if (v.currentTime < trim[0] - 0.25 || v.currentTime >= trim[1]) v.currentTime = trim[0];
        },
      }
    : {};
  if (transform === "pad")
    return (
      <div className="format-preview format-pad">
        <video src={src} className="format-pad-bg" muted playsInline aria-hidden="true" {...keep} {...(still ? {} : { autoPlay: true, loop: true })} />
        <video src={src} className="format-pad-fg" aria-label={label} {...keep} {...play} />
      </div>
    );
  return (
    <div className={`format-preview ${transform === "crop" ? "format-short" : "format-none"}`}>
      <video src={src} aria-label={label} style={transform === "crop" ? { objectPosition: `${cropX * 100}% 50%` } : undefined} {...keep} {...play} />
    </div>
  );
}
