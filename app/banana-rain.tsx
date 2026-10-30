"use client";
import { useEffect, useRef } from "react";

// Big bananas falling slowly, drawn as a glyph grid in the look of fiddle.digital's "PXD VID" experiment
// (own implementation, matched by eye). Each cell samples a low-res, shaded render of the OpenMoji banana and,
// dark to bright, becomes: black + white X, amber ring tile, amber dot tile, solid amber, solid red. Decorative only.
const CELL = 18;
const COUNT = 6;
const SPEED = 3; // grid cells per second (~40px/s): slow
const AMBER = "#f9b224";
const RED = "#e8412c";
const WHITE = "#ffffff";
const BLACK = "#050505";

type Banana = { x: number; y: number; size: number; angle: number; spin: number };

export default function BananaRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const low = document.createElement("canvas"); // one pixel per cell
    const lctx = low.getContext("2d", { willReadFrequently: true })!;
    const img = new Image();
    img.src = "/assets/openmoji-banana.svg";
    let cols = 0, rows = 0, raf = 0, last = 0, stopped = false;
    let bananas: Banana[] = [];

    const spawn = (y: number): Banana => ({
      x: Math.random() * cols,
      y,
      size: 28 + Math.random() * 20, // cells, so roughly 400–670px
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.25,
    });

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(innerWidth / CELL);
      rows = Math.ceil(innerHeight / CELL);
      low.width = cols;
      low.height = rows;
      bananas = Array.from({ length: COUNT }, (_, i) => spawn((i / COUNT) * (rows + 40) - 30));
    }

    function draw() {
      lctx.clearRect(0, 0, cols, rows);
      for (const b of bananas) {
        lctx.save();
        lctx.translate(b.x, b.y);
        lctx.rotate(b.angle);
        lctx.drawImage(img, -b.size / 2, -b.size / 2, b.size, b.size);
        // shade across the banana so one fruit spans the whole glyph ramp, red highlight to amber to dark
        // along the fruit (the emoji runs bottom-left to top-right)
        const g = lctx.createLinearGradient(-b.size / 2, b.size / 2, b.size / 2, -b.size / 2);
        g.addColorStop(0.15, "rgba(240,60,40,1)");
        g.addColorStop(0.5, "rgba(255,190,40,0)");
        g.addColorStop(0.9, "rgba(20,10,0,.55)");
        lctx.globalCompositeOperation = "source-atop";
        lctx.fillStyle = g;
        lctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size);
        lctx.globalCompositeOperation = "source-over";
        lctx.restore();
      }
      const px = lctx.getImageData(0, 0, cols, rows).data;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.lineCap = "square";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = (r * cols + c) * 4;
          const a = px[i + 3];
          if (a < 50) continue;
          const [R, G] = [px[i], px[i + 1]];
          const lum = (R * 0.3 + G * 0.59 + px[i + 2] * 0.11) / 255;
          const redness = (R - G) / 255; // the highlight band is red-orange
          const x = c * CELL, y = r * CELL, m = CELL / 2, s = CELL - 2;
          if (lum < 0.3 || a < 150) {
            // dark: black cell, thick white X
            ctx.fillStyle = BLACK;
            ctx.fillRect(x + 1, y + 1, s, s);
            ctx.strokeStyle = WHITE;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x + 5, y + 5); ctx.lineTo(x + CELL - 5, y + CELL - 5);
            ctx.moveTo(x + CELL - 5, y + 5); ctx.lineTo(x + 5, y + CELL - 5);
            ctx.stroke();
          } else if (redness > 0.25) {
            ctx.fillStyle = RED;
            ctx.fillRect(x + 1, y + 1, s, s);
          } else if (lum < 0.5) {
            // amber-framed ring tile: black disc, amber dot
            ctx.fillStyle = AMBER;
            ctx.fillRect(x + 1, y + 1, s, s);
            ctx.fillStyle = BLACK;
            ctx.beginPath(); ctx.arc(x + m, y + m, 6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = AMBER;
            ctx.beginPath(); ctx.arc(x + m, y + m, 2, 0, Math.PI * 2); ctx.fill();
          } else if (lum < 0.68) {
            // amber tile with a black dot
            ctx.fillStyle = AMBER;
            ctx.fillRect(x + 1, y + 1, s, s);
            ctx.fillStyle = BLACK;
            ctx.beginPath(); ctx.arc(x + m, y + m, 4.5, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillStyle = AMBER;
            ctx.fillRect(x + 1, y + 1, s, s);
          }
        }
      }
    }

  function tick(t: number) {
      const dt = Math.min((t - last) / 1000, 0.1);
      if (t - last > 50) { // ~20 fps is plenty for a slow fall
        last = t;
        for (let k = 0; k < bananas.length; k++) {
          const b = bananas[k];
          b.y += SPEED * dt;
          b.angle += b.spin * dt;
          if (b.y - b.size > rows) bananas[k] = spawn(-b.size);
        }
        draw();
      }
      if (!stopped) raf = requestAnimationFrame(tick);
    }

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    img.onload = () => {
      if (stopped) return; // unmounted before the image loaded: never start a second loop on this canvas
      resize();
      if (still) draw();
      else raf = requestAnimationFrame(tick);
    };
    const onResize = () => { resize(); if (still) draw(); };
    addEventListener("resize", onResize);
    return () => { stopped = true; img.onload = null; cancelAnimationFrame(raf); removeEventListener("resize", onResize); };
  }, []);

  return <canvas ref={ref} className="banana-rain" aria-hidden="true" />;
}
