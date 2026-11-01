// Shows a clip framed the way it will look on YouTube after the worker's reshape (lib/shorts.mjs):
// crop = 9:16 centre crop (a Short), pad = 16:9 over a blurred copy (a regular video), none = as uploaded.
export default function FormatPreview({ src, transform, still = false, label }: { src: string; transform: string; still?: boolean; label: string }) {
  // still: no autoplay (reduced motion / review), show controls instead.
  const play = still ? { controls: true, preload: "metadata" as const } : { autoPlay: true, loop: true, muted: true, playsInline: true };
  if (transform === "pad")
    return (
      <div className="format-preview format-pad">
        <video src={src} className="format-pad-bg" muted playsInline aria-hidden="true" {...(still ? {} : { autoPlay: true, loop: true })} />
        <video src={src} className="format-pad-fg" aria-label={label} {...play} />
      </div>
    );
  return (
    <div className={`format-preview ${transform === "crop" ? "format-short" : "format-none"}`}>
      <video src={src} aria-label={label} {...play} />
    </div>
  );
}
