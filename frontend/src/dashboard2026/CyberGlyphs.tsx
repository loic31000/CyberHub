import type { ComponentType, ReactNode, SVGProps } from "react";

/*
 * Signature pass: the CyberHub glyph family.
 *
 * One drawing grammar for the rail, the environment cards, the widgets and the
 * customisation catalogue: a 24 px grid, a 1.6 px round stroke, simple
 * geometric shapes, and one filled "node" per glyph, the circuit's signal
 * point. The node takes the accent colour (`.cg-node`), so every icon carries
 * the same small spark of the board behind the dashboard.
 *
 * Glyphs accept the props the dashboard already passes to Lucide icons
 * (`size`, `className`), so either can be used wherever an icon is expected.
 */

export type GlyphProps = SVGProps<SVGSVGElement> & { size?: number | string };
export type IconComponent = ComponentType<{ size?: number | string; className?: string }>;

const node = (cx: number, cy: number, r = 1.35) => <circle className="cg-node" cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

function glyph(name: string, body: ReactNode) {
  const Glyph = ({ size = 24, className, ...rest }: GlyphProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`cyber-glyph${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {body}
    </svg>
  );
  Glyph.displayName = name;
  return Glyph;
}

/* ---------- workspace ---------- */

export const OverviewGlyph = glyph(
  "OverviewGlyph",
  <>
    <rect x="3.5" y="3.5" width="7" height="8" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="5" rx="1.6" />
    <rect x="13.5" y="11.5" width="7" height="9" rx="1.6" />
    <rect x="3.5" y="14.5" width="7" height="6" rx="1.6" />
    {node(7, 7.5)}
  </>,
);

export const SearchGlyph = glyph(
  "SearchGlyph",
  <>
    <circle cx="10.8" cy="10.8" r="6.5" />
    <path d="M15.6 15.6 20 20" />
    {node(10.8, 10.8, 1.15)}
  </>,
);

export const ConsoleGlyph = glyph(
  "ConsoleGlyph",
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
    <path d="m7.5 9.8 2.6 2.2-2.6 2.2M12.6 14.4h4" />
    {node(17.4, 7.9, 1.1)}
  </>,
);

export const ToolsGlyph = glyph(
  "ToolsGlyph",
  <>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    {node(5.6, 18.4, 1)}
  </>,
);

export const WriteupGlyph = glyph(
  "WriteupGlyph",
  <>
    <path d="M5.5 21V4" />
    <path d="M5.5 4.8h12l-2.4 3.9 2.4 3.9h-12" />
    {node(10.6, 8.7, 1.15)}
  </>,
);

/* ---------- intelligence ---------- */

export const CveGlyph = glyph(
  "CveGlyph",
  <>
    <path d="M12 3.3 19 6v5.6c0 4.3-2.9 7.5-7 9.1-4.1-1.6-7-4.8-7-9.1V6z" />
    <path d="M12 8.2v4.3" />
    {node(12, 15.5, 1.25)}
  </>,
);

export const PlaybookGlyph = glyph(
  "PlaybookGlyph",
  <>
    <path d="M3.5 5.5h5A3.5 3.5 0 0 1 12 9v10.5a2.6 2.6 0 0 0-2.6-2.6H3.5z" />
    <path d="M20.5 5.5h-5A3.5 3.5 0 0 0 12 9v10.5a2.6 2.6 0 0 1 2.6-2.6h5.9z" />
    <path d="m14.6 11.3 1.5 1.5 2.7-2.7" />
    {node(7.4, 10.2, 1.1)}
  </>,
);

/* ATT&CK: a matrix of tactic columns. */
export const MitreGlyph = glyph(
  "MitreGlyph",
  <>
    <rect x="3.5" y="4" width="4.5" height="16" rx="1.3" />
    <rect x="9.75" y="4" width="4.5" height="10" rx="1.3" />
    <rect x="16" y="4" width="4.5" height="13" rx="1.3" />
    {node(12, 18.2)}
  </>,
);

export const LayersGlyph = glyph(
  "LayersGlyph",
  <>
    <path d="m12 3.8 8 4.2-8 4.2-8-4.2z" />
    <path d="m4 12.2 8 4.2 8-4.2" />
    <path d="m4 16.4 8 4.2 8-4.2" />
    {node(12, 8, 1.2)}
  </>,
);

export const LolbinGlyph = glyph(
  "LolbinGlyph",
  <>
    <path d="M6.5 3.5H14L18.5 8v12.5h-12z" />
    <path d="M14 3.5V8h4.5" />
    <path d="m9.2 12.4 2.2 1.8-2.2 1.8" />
    {node(14.6, 16, 1.1)}
  </>,
);

/* ---------- operations ---------- */

export const CloakGlyph = glyph(
  "CloakGlyph",
  <>
    <path d="M3 12s3.3-5.8 9-5.8 9 5.8 9 5.8-3.3 5.8-9 5.8S3 12 3 12z" />
    <path d="M4.6 19.4 19.4 4.6" />
    {node(12, 12, 1.6)}
  </>,
);

/* IOC: an indicator, a hexagonal tag with a centred target. */
export const IocGlyph = glyph(
  "IocGlyph",
  <>
    <path d="m12 3.2 7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6z" />
    <path d="M12 7.6v2.3M12 14.1v2.3M7.6 12h2.3M14.1 12h2.3" />
    {node(12, 12, 1.4)}
  </>,
);

export const CorrelationGlyph = glyph(
  "CorrelationGlyph",
  <>
    <circle cx="5.5" cy="6" r="2" />
    <circle cx="18.5" cy="6" r="2" />
    <circle cx="5.5" cy="18" r="2" />
    <circle cx="18.5" cy="18" r="2" />
    <path d="m7 7.5 3.4 3.4M17 7.5l-3.4 3.4M7 16.5l3.4-3.4M17 16.5l-3.4-3.4" />
    {node(12, 12, 1.8)}
  </>,
);

/* OSINT: a lens with a reticle, searching outward. */
export const OsintGlyph = glyph(
  "OsintGlyph",
  <>
    <circle cx="10.5" cy="10.5" r="6.4" />
    <path d="m15.3 15.3 4.7 4.7M10.5 5.6v1.9M10.5 13.5v1.9M5.6 10.5h1.9M13.5 10.5h1.9" />
    {node(10.5, 10.5, 1.2)}
  </>,
);

/* Investigations: a case file with its timeline. */
export const InvestigationGlyph = glyph(
  "InvestigationGlyph",
  <>
    <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2.1H19a1.5 1.5 0 0 1 1.5 1.5v8.4A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
    <path d="M7.4 14h3M13.6 14h3" />
    {node(12, 14, 1.3)}
  </>,
);

/* ---------- resources and network ---------- */

export const NotesGlyph = glyph(
  "NotesGlyph",
  <>
    <rect x="5" y="3.5" width="14" height="17" rx="2" />
    <path d="M8.5 8.4h7M8.5 12h7M8.5 15.6h3.8" />
    {node(15.6, 15.6, 1.1)}
  </>,
);

export const CheatsheetGlyph = glyph(
  "CheatsheetGlyph",
  <>
    <path d="M7.5 3.5h10a2 2 0 0 1 2 2V17" />
    <path d="M4.5 7.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13h-10a2 2 0 0 1-2-2z" />
    <path d="M8 11h5M8 14.5h3" />
    {node(13.2, 14.5, 1.05)}
  </>,
);

export const EncoderGlyph = glyph(
  "EncoderGlyph",
  <>
    <rect x="3.5" y="4" width="6" height="7" rx="2.4" />
    <path d="M15.5 4v7M13.6 5.6 15.5 4" />
    <path d="M6.5 20v-7l-1.9 1.6" />
    <rect x="14.5" y="13" width="6" height="7" rx="2.4" />
    {node(12, 12, 1.05)}
  </>,
);

export const RevshellGlyph = glyph(
  "RevshellGlyph",
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
    <path d="m15.6 9.6-3 2.4 3 2.4M12.6 12H8.4" />
    {node(7.3, 12, 1.2)}
  </>,
);

/* BGP: autonomous systems and the route between them. */
export const BgpGlyph = glyph(
  "BgpGlyph",
  <>
    <circle cx="6" cy="17" r="2.3" />
    <circle cx="18" cy="16" r="2.3" />
    <circle cx="12" cy="6.5" r="2.6" />
    <path d="m7.2 15 3.5-6.3M13.3 8.8l3.5 5.1M8.3 16.8h7.4" />
    {node(12, 6.5, 1.05)}
  </>,
);

export const HistorianGlyph = glyph(
  "HistorianGlyph",
  <>
    <path d="M4.6 9.4A8 8 0 1 1 4 12" />
    <path d="M4 5.4v4h4" />
    <path d="M12 8v4.2l2.8 1.8" />
    {node(12, 12.2, 1.2)}
  </>,
);

/* ---------- system and widgets ---------- */

export const SourcesGlyph = glyph(
  "SourcesGlyph",
  <>
    <ellipse cx="12" cy="6" rx="7" ry="2.6" />
    <path d="M5 6v5.6c0 1.45 3.13 2.6 7 2.6s7-1.15 7-2.6V6" />
    <path d="M12 14.2v3.2" />
    {node(12, 19.4, 1.6)}
  </>,
);

export const NetworkGlyph = glyph(
  "NetworkGlyph",
  <>
    <circle cx="12" cy="12" r="8.3" />
    <path d="M3.7 12h16.6" />
    <path d="M12 3.7c2.4 2.3 3.6 5.1 3.6 8.3s-1.2 6-3.6 8.3c-2.4-2.3-3.6-5.1-3.6-8.3S9.6 6 12 3.7z" />
    {node(18.3, 6.5, 1.35)}
  </>,
);

/* Threat Monitor: a radar sweep and one contact. */
export const RadarGlyph = glyph(
  "RadarGlyph",
  <>
    <circle cx="12" cy="12" r="8.3" />
    <path d="M12 7.2a4.8 4.8 0 1 1-4.8 4.8" />
    <path d="m12 12 5.6-5.6" />
    {node(12, 12, 1.3)}
    {node(15.3, 15, 1.05)}
  </>,
);

/* Operations: a signal trace ending on its node. */
export const PulseGlyph = glyph(
  "PulseGlyph",
  <>
    <path d="M3 12.5h4.2l2.3-5 3.6 10 2.4-5h3.4" />
    {node(20.4, 12.5, 1.5)}
  </>,
);

/* Watch: an antenna listening to bulletins. */
export const WatchGlyph = glyph(
  "WatchGlyph",
  <>
    <path d="M12 14.4V21M8.4 21h7.2" />
    <path d="M8.6 10a4.8 4.8 0 0 1 6.8 0" />
    <path d="M5.8 7.2a8.8 8.8 0 0 1 12.4 0" />
    {node(12, 13, 1.6)}
  </>,
);
