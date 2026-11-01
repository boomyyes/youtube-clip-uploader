import PixelBananaMark from "./PixelBananaMark";
import { CHANNEL_URL } from "./channel";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <PixelBananaMark size={26} />
          <div>
            <strong className="footer-name">Bananas All Over The World</strong>
            <span className="footer-tag">Private clip dropbox for the Bananas channel.</span>
          </div>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/credits">Credits</a>
          <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">Watch the channel ↗</a>
        </nav>
      </div>
      <div className="footer-meta">
        <span>Clips reviewed by hand before publish</span>
        <span>© Bananas All Over The World</span>
      </div>
    </footer>
  );
}
