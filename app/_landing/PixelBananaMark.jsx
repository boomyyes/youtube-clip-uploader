export default function PixelBananaMark({ size = 24 }) {
  const p = [
    ["#F5C842", 17, 6, 4, 4],
    ["#F5C842", 15, 9, 4, 4],
    ["#F5C842", 13, 12, 4, 4],
    ["#F5C842", 11, 15, 4, 4],
    ["#F5C842", 9, 18, 4, 4],
    ["#F5C842", 8, 21, 4, 3],
    ["#F9B224", 17, 9, 3, 3],
    ["#F9B224", 15, 12, 3, 3],
    ["#F9B224", 13, 15, 3, 3],
    ["#F9B224", 11, 18, 3, 3],
    ["#7A4A1E", 7, 24, 5, 3],
    ["#7A4A1E", 19, 6, 3, 2],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Bananas All Over The World logo" style={{ display: "block" }}>
      <g shapeRendering="crispEdges">
        {p.map(([c, x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill={c} />
        ))}
      </g>
    </svg>
  );
}
