// Streamline "Pixel" icons (public/icons, CC BY 4.0). A CSS mask lets them take the text colour.
export type IconName =
  | "upload" | "clips" | "admin" | "account" | "signout" | "alert" | "bin" | "check" | "clock"
  | "film" | "info" | "key" | "link" | "refresh" | "star" | "users" | "youtube";

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const style = { "--src": `url(/icons/${name}.svg)`, "--size": `${size}px` } as React.CSSProperties;
  return <span className="icon" aria-hidden="true" style={style} />;
}
