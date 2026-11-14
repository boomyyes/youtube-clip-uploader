"use client";
import { Component, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Nav from "./Nav";
import Marquee from "./Marquee";
import Footer from "./Footer";
import { CHANNEL_URL } from "./channel";
import "./landing.css";
import dynamic from "next/dynamic";

const BananaStage = dynamic(() => import("./BananaStage"), { ssr: false });

// Editorial landing, structured after dozfx.com's homepage (behaviour only, written fresh):
// 3D hero -> scroll-lit statement -> depth -> pinned numbered process -> marquee -> live stats -> FAQ -> closing.
// Behind it all, <BananaStage /> glides between Blender close-ups named by each section's data-pose.

class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div style={{ minHeight: "100vh" }} /> : this.props.children; }
}

const EASE = [0.16, 1, 0.3, 1];

// Pill link that leans toward the pointer (max 6 px) and fills from the side the pointer entered.
function MagneticLink({ className = "", children, ...props }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const place = (e) => {
    const el = ref.current, r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    return r;
  };
  return (
    <a
      ref={ref}
      className={`mag ${className}`}
      onPointerEnter={place}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const r = place(e);
        const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        ref.current.style.translate = `${dx * 6}px ${dy * 6}px`;
      }}
      onPointerLeave={(e) => { place(e); ref.current.style.translate = ""; }}
      {...props}
    >
      <span>{children}</span>
    </a>
  );
}

function Hero({ cta }) {
  const reduced = useReducedMotion();
  const line = (i) => ({
    initial: { y: reduced ? "0%" : "110%" },
    animate: { y: "0%" },
    transition: { duration: reduced ? 0.01 : 1.1, ease: EASE, delay: 0.1 + i * 0.12 },
  });
  return (
    <section className="hero" data-pose="hero">
      <p className="hero-index"><span>00 / Bananas</span><span>Private clip dropbox</span><span>Reviewed by hand</span></p>
      <h1 className="hero-title">
        <span className="mask"><motion.span className="mask-line" {...line(0)}>Your clip.</motion.span></span>
        <span className="mask"><motion.span className="mask-line" {...line(1)}>Our <em>channel.</em></motion.span></span>
      </h1>
      <motion.div className="hero-foot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.7, duration: 0.8 }}>
        <p>Drop a clip, pick the game. It gets a title, the owner reviews it, and it goes up on the Bananas channel.</p>
        <div className="hero-ctas">
          <MagneticLink className="mag-primary" href={cta.href}>{cta.label} →</MagneticLink>
          <MagneticLink href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">Watch the channel ↗</MagneticLink>
        </div>
      </motion.div>
      <span className="scroll-cue" aria-hidden="true">Scroll</span>
    </section>
  );
}

// Each word brightens as the paragraph scrolls through the viewport.
function Word({ progress, range, children }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}
function Statement() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.45"] });
  const text = "One channel, a whole crew of players. You send the clip, we name it, the owner watches every second, and only the good ones go live.";
  const words = text.split(" ");
  return (
    <section className="statement" ref={ref} data-pose="stem">
      <p className="label">01 / What this is</p>
      <p className="statement-text">
        {reduced ? text : words.map((w, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>
        ))}
      </p>
    </section>
  );
}

// Pinned: the camera sits on the gold underside while the headline fades in over it.
function Depth() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const titleOpacity = useTransform(scrollYProgress, [0.15, 0.45], reduced ? [1, 1] : [0, 1]);
  return (
    <section className="depth" ref={ref} data-pose="under">
      <div className="depth-pin">
        <motion.h2 style={{ opacity: titleOpacity }}>Built for <em>clips.</em></motion.h2>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Drop", body: "MP4, MOV, WebM or MKV, up to 2 GB. Trim it, pick Short or Regular, choose the game." },
  { title: "Title", body: "It's named for you: your name, the game, and the next number. No typing, no clickbait." },
  { title: "Review", body: "The owner watches every clip before anything touches YouTube. Not good enough? You get a reason." },
  { title: "Live", body: "Approved clips upload to the channel on their own. Shorts are reframed to 9:16 automatically." },
];
// Pinned: scrolling steps through the four stages; the counter and progress rail follow.
function Process() {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(STEPS.length - 1, Math.floor(v * STEPS.length))));
  const rail = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  if (reduced) {
    return (
      <section className="process process-static" data-pose="ridge">
        <p className="label">02 / How it works</p>
        {STEPS.map((s, i) => <div className="process-step" key={s.title}><span className="process-num">0{i + 1}</span><h3>{s.title}</h3><p>{s.body}</p></div>)}
      </section>
    );
  }
  return (
    <section className="process" ref={ref} data-pose="ridge" style={{ height: `${STEPS.length * 90}vh` }}>
      <div className="process-pin">
        <p className="label">02 / How it works</p>
        <div className="process-body">
          <span className="process-num" aria-hidden="true">0{step + 1}</span>
          <AnimatePresence mode="wait">
            <motion.div key={step} className="process-copy" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.45, ease: EASE }}>
              <h3>{STEPS[step].title}</h3>
              <p>{STEPS[step].body}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="process-rail" aria-hidden="true"><motion.span style={{ width: rail }} /></div>
        <ol className="sr-only">{STEPS.map((s) => <li key={s.title}>{s.title}: {s.body}</li>)}</ol>
      </div>
    </section>
  );
}

// Live totals from the database; counts up when it scrolls into view.
function Count({ to }) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => { const k = Math.min(1, (t - t0) / 1200); setN(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [to, reduced]);
  return <span ref={ref}>{reduced ? to : n}</span>;
}
function Stats({ stats }) {
  if (!stats) return null;
  const items = [["Clips on the channel", stats.live], ["Players in the crew", stats.members], ["Games on the list", stats.games]];
  return (
    <section className="stats" data-pose="close">
      <p className="label">03 / So far</p>
      <div className="stats-grid">
        {items.map(([l, v]) => <div key={l}><strong><Count to={v} /></strong><span>{l}</span></div>)}
      </div>
    </section>
  );
}

const FAQ = [
  ["Do I need a YouTube account?", "No. Clips go to the Bananas channel through the owner's connection. You only sign in with Google so we know who sent what."],
  ["Who can upload?", "Invited players. New accounts wait until the owner approves them."],
  ["What happens if my clip is rejected?", "You see the reason on your My clips page, and the file is deleted. The number frees up for your next clip in that game."],
  ["Can I delete my account?", "Yes, any time from your account page. Your details and unpublished clips are removed straight away."],
];
function Questions() {
  return (
    <section className="faq" data-pose="close">
      <p className="label">04 / Questions</p>
      <div className="faq-list">
        {FAQ.map(([q, a]) => (
          <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>
        ))}
      </div>
    </section>
  );
}

function Closing({ cta }) {
  return (
    <section className="closing" data-pose="hero">
      <h2>Drop the <em>next one.</em></h2>
      <MagneticLink className="mag-primary mag-large" href={cta.href}>{cta.label} →</MagneticLink>
    </section>
  );
}

export default function Landing({ cta, stats }) {
  // Smooth scrolling (skipped for reduced motion).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);

  return (
    <ErrorBoundary>
      <div className="landing">
        <BananaStage />
        <Nav cta={cta} />
        <main>
          <Hero cta={cta} />
          <div className="landing-body">
            <Statement />
            <Depth />
            <Process />
            <Marquee />
            <Stats stats={stats} />
            <Questions />
            <Closing cta={cta} />
          </div>
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}
