const ITEMS = ["Drop it", "Name it", "Review it", "Post it"];

function Row({ hidden }) {
  return (
    <div className="marquee-row" aria-hidden={hidden || undefined}>
      {ITEMS.map((t, i) => (
        <span className="marquee-item" key={i}>
          <span>{t}</span>
          <span className="marquee-sep">{"//"}</span>
        </span>
      ))}
    </div>
  );
}

export default function Marquee() {
  return (
    <div className="marquee">
      <div className="marquee-track">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
