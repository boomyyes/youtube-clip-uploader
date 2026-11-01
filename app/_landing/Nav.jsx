import Link from "next/link";
import PixelBananaMark from "./PixelBananaMark";
import { CHANNEL_URL } from "./channel";

export default function Nav() {
  return (
    <header className="nav">
      <Link className="nav-brand" href="/">
        <PixelBananaMark size={22} />
        <span className="nav-wordmark">Bananas All Over The World</span>
      </Link>
      <div className="nav-right">
        <a className="nav-yt" href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">YouTube ↗</a>
        <a className="btn btn-primary btn-small" href="/login">Sign in with Google</a>
      </div>
    </header>
  );
}
