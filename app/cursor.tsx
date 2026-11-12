"use client";
import { useEffect, useRef } from "react";

// Dot + ring pointer that inverts what's under it. Links grow the ring; elements with data-cursor="Label"
// fill it with that label. Mouse only (touch keeps the normal behaviour); the system cursor stays visible.
export default function Cursor() {
  const el = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = el.current!;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      c.hidden = false;
      c.style.translate = `${e.clientX}px ${e.clientY}px`;
      const t = e.target as Element;
      const tagged = t.closest<HTMLElement>("[data-cursor]");
      const link = t.closest("a,button,summary,input,label,select,textarea,[role=slider]");
      c.classList.toggle("is-label", !!tagged);
      c.classList.toggle("is-link", !!link && !tagged);
      if (tagged) label.current!.textContent = tagged.dataset.cursor ?? "";
    };
    const down = () => c.classList.add("is-down");
    const up = () => c.classList.remove("is-down");
    const leave = () => { c.hidden = true; };
    addEventListener("pointermove", move);
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <div ref={el} className="cursor" aria-hidden="true" hidden>
      <span className="cursor-ring" />
      <span className="cursor-dot" />
      <span ref={label} className="cursor-label" />
    </div>
  );
}
