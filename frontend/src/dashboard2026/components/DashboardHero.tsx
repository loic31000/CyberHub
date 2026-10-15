import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import TerminalFlux from "../TerminalFlux";
import CircuitBoard from "../CircuitBoard";

/* TERMINAL OVERVIEW, typed glyph by glyph once the page has painted; read whole by screen readers. */
function TypedTitle() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => setTyping(true)); });
    return () => cancelAnimationFrame(frame);
  }, []);
  let step = 0;
  const glyphs = (word: string) => [...word].map((char) => {
    const order = step++;
    return <i key={order} className="typed-glyph" style={{ "--glyph": order } as CSSProperties}>{char}</i>;
  });
  const first = glyphs("TERMINAL");
  step += 1;
  const second = glyphs("OVERVIEW");
  return <h1 id="overview-title" className={`typed-title${typing ? " is-typing" : ""}`}>
    <span className="sr-only">TERMINAL OVERVIEW</span>
    <i className="typed-word" aria-hidden="true">{first}</i>{" "}
    <span aria-hidden="true">{second}</span>
  </h1>;
}

/* The page header: terminal flux and hero circuit (decorative), title, index and session mark. */
export function DashboardHero() {
  return <section className="overview-hero" aria-labelledby="overview-title">
    <TerminalFlux />
    <CircuitBoard />
    <div className="hero-copy">
      <span className="hero-breadcrumb">/ CORE / DASHBOARD</span>
      <TypedTitle />
      <p>Votre espace de travail CyberHub, recherche, analyse et opérations depuis une interface unifiée.</p>
    </div>
    <div className="hero-index" aria-hidden="true"><span>CYBER INTELLIGENCE</span><span>OPEN SOURCE</span><span>DEFENSIVE OPERATIONS</span><span>THREAT ANALYSIS</span></div>
    <p className="hero-session"><strong><i aria-hidden="true" />CONSOLE LOCALE</strong><span className="hero-session-mark">CH/TTY-01</span></p>
  </section>;
}
