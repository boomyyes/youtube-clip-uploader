"use client";
import { Component, useEffect } from "react";
import Lenis from "lenis";
import Nav from "./Nav";
import Hero from "./Hero";
import Marquee from "./Marquee";
import HowItWorks from "./HowItWorks";
import Footer from "./Footer";
import "./landing.css";

// A WebGL/3D crash shouldn't take the page down: render nothing extra instead.
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div style={{ minHeight: "100vh" }} /> : this.props.children;
  }
}

export default function Landing({ cta }) {
  // Smooth scrolling (skipped for reduced motion).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let raf;
    const loop = (t) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="landing">
        <Nav cta={cta} />
        <main>
          <Hero cta={cta} />
          <Marquee />
          <HowItWorks />
        </main>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}
