"use client";
import { motion, useReducedMotion } from "framer-motion";
import { CHANNEL_URL } from "./channel";

const EASE = [0.16, 1, 0.3, 1];

export default function Hero({ cta }) {
  const reduced = useReducedMotion();

  const line = (i) => ({
    initial: { y: reduced ? "0%" : "115%" },
    animate: { y: "0%" },
    transition: { duration: reduced ? 0.01 : 1, ease: EASE, delay: 0.15 + i * 0.14 },
  });
  const fade = (delay) => ({
    initial: { opacity: reduced ? 1 : 0 },
    animate: { opacity: 1 },
    transition: { duration: reduced ? 0.01 : 0.8, ease: "easeOut", delay },
  });

  return (
    <section className="hero">
      {/* the chrome banana is the layout's <ChromeShape /> (fixed, top right) */}

      <div className="hero-inner">
        <div className="hero-copy">
          <motion.p className="eyebrow" {...fade(0.05)}>
            <span className="eyebrow-block" aria-hidden="true" />
            Private clip dropbox <span className="eyebrow-slash">/</span> 01
          </motion.p>

          <h1 className="hero-title">
            <span className="mask">
              <motion.span className="mask-line" {...line(0)}>Your clip.</motion.span>
            </span>
            <span className="mask">
              <motion.span className="mask-line" {...line(1)}>
                Our <span className="accent">channel.</span>
              </motion.span>
            </span>
          </h1>

          <motion.p className="hero-sub" {...fade(0.55)}>
            Approved players submit gameplay clips. The channel owner reviews each one before it&rsquo;s published to the
            shared YouTube channel.
          </motion.p>

          <motion.div className="hero-ctas" {...fade(0.75)}>
            <a className="btn btn-primary" href={cta.href}>{cta.label}</a>
            <a className="btn btn-ghost" href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">Watch the channel ↗</a>
          </motion.div>
        </div>
      </div>

      <div className="hero-hud" aria-hidden="true">
        <span className="hud-chip"><span className="hud-dot" />Review pipeline active</span>
        <span className="hud-chip">Members: invite only</span>
      </div>
    </section>
  );
}
