import Icon from "../pixel-icon";
import { PageHeader } from "../ui";

export const metadata = { title: "Credits · Clip Desk" };

// Every file in public/assets and public/icons must be listed here with its licence.
const ASSETS = [
  {
    what: "OpenMoji banana emoji",
    use: "Logo and banana rain",
    licence: "CC BY-SA 4.0",
    href: "https://openmoji.org/library/emoji-1F34C/",
    site: "openmoji.org",
  },
  {
    what: "Streamline Pixel icon set",
    use: "Interface icons",
    licence: "CC BY 4.0",
    href: "https://www.streamlinehq.com/icons/pixel",
    site: "streamlinehq.com",
  },
  {
    what: "Space Grotesk + IBM Plex Mono",
    use: "Typography, via Google Fonts",
    licence: "SIL Open Font License 1.1",
    href: "https://fonts.google.com/",
    site: "fonts.google.com",
  },
];

export default function Credits() {
  return (
    <div className="content-page credits-page">
      <PageHeader eyebrow="PUBLIC DOCUMENT / 03" title="Credits">Free assets and open licences behind the clip desk.</PageHeader>
      <div className="credits-grid">
        <section className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">ASSET REGISTER</span><h2>Visual credits</h2></div>
            <span className="panel-header-icon"><Icon name="star" size={21} /></span>
          </div>
          <div className="credit-list">
            {ASSETS.map((a) => (
              <div key={a.href}>
                <strong>{a.what}</strong>
                <span>{a.use} · {a.licence} · <a href={a.href}>{a.site}</a></span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div><span className="panel-kicker">DESIGN NOTES</span><h2>Arcade Ops Console</h2></div>
            <span className="panel-header-icon"><Icon name="film" size={21} /></span>
          </div>
          <p className="muted">
            Charcoal panels keep forms and review queues calm, and banana yellow marks the next action. Clip status follows
            banana ripeness: green while waiting, yellow once it&apos;s on YouTube.
          </p>
          <div className="swatch-row" aria-hidden="true">
            {["#0A0D12", "#171F2D", "#F5C842", "#B6F36B", "#FF8A70"].map((c) => <span key={c} style={{ background: c }} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
