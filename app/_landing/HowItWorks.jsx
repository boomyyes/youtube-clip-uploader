"use client";
import { motion, useReducedMotion } from "framer-motion";
import Icon from "../ui-icon";

const STEPS = [
  { n: "01", icon: "upload", title: "You upload", body: "Send the full clip, no YouTube account needed." },
  { n: "02", icon: "check", title: "Owner reviews", body: "Every clip gets a human thumbs-up." },
  { n: "03", icon: "youtube", title: "It goes live", body: "Titled, described and uploaded to the channel." },
];

const EASE = [0.16, 1, 0.3, 1];

export default function HowItWorks() {
  const reduced = useReducedMotion();
  const rise = (i) => ({
    initial: { opacity: 0, y: reduced ? 0 : 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: reduced ? 0.01 : 0.75, ease: EASE, delay: i * 0.12 },
  });

  return (
    <section className="steps">
      <div className="section-head">
        <motion.p className="eyebrow" {...rise(0)}>
          <span className="eyebrow-block" aria-hidden="true" />
          How it works <span className="eyebrow-slash">/</span> 02
        </motion.p>
        <motion.h2 className="section-title" {...rise(1)}>Three steps. Zero YouTube work for you.</motion.h2>
      </div>
      <div className="step-grid">
        {STEPS.map((s, i) => (
          <motion.article className="step" key={s.n} {...rise(i)}>
            <div className="step-top">
              <span className="step-num">{s.n}</span>
              <span className="step-icon"><Icon name={s.icon} size={18} /></span>
            </div>
            <h3 className="step-title">{s.title}</h3>
            <p className="step-body">{s.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
