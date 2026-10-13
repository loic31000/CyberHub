import type { CSSProperties } from "react";
import earth from "./geography/earth.svg";

// Geographic anchors and routes are illustrative, never live telemetry.
const cities = [
  ["New York", -74, 40.7],
  ["San Francisco", -122.4, 37.8],
  ["São Paulo", -46.6, -23.6],
  ["Londres", -0.1, 51.5],
  ["Paris", 2.35, 48.85],
  ["Francfort", 8.68, 50.1],
  ["Lagos", 3.4, 6.5],
  ["Le Cap", 18.4, -33.9],
  ["Le Caire", 31.2, 30],
  ["Dubaï", 55.3, 25.2],
  ["Mumbai", 72.9, 19.1],
  ["Madrid", -3.7, 40.4],
  ["Dakar", -17.4, 14.7],
  ["Montréal", -73.6, 45.5],
] as const;
function project(lon: number, lat: number) {
  const a = ((lon + 12) * Math.PI) / 180,
    b = (lat * Math.PI) / 180,
    c = (24 * Math.PI) / 180;
  return [
    400 + 236 * Math.cos(b) * Math.sin(a),
    258 -
      236 *
        (Math.cos(c) * Math.sin(b) - Math.sin(c) * Math.cos(b) * Math.cos(a)),
  ];
}
const anchors = cities.map(([name, lon, lat]) => ({
  name,
  p: project(lon, lat),
}));
const links = [
  [0, 3, "cyan", 58],
  [0, 4, "amber", 36],
  [13, 5, "cyan", 75],
  [1, 3, "cyan", 98],
  [2, 4, "cyan", 62],
  [2, 6, "amber", 48],
  [3, 9, "cyan", 65],
  [5, 10, "amber", 70],
  [4, 8, "cyan", 35],
  [6, 7, "cyan", 28],
  [12, 4, "cyan", 37],
  [8, 9, "cyan", 29],
  [7, 9, "red", 54],
  [0, 2, "cyan", 44],
  [11, 6, "cyan", 27],
] as const;
const routes = links.map(([from, to, tone, lift]) => {
  const [x, y] = anchors[from].p,
    [ex, ey] = anchors[to].p;
  return {
    tone,
    d: `M${x},${y} Q${(x + ex) / 2},${Math.min(y, ey) - lift} ${ex},${ey}`,
  };
});

export default function NetworkGlobe() {
  return (
    <div className="premium-network">
      <svg
        className="premium-earth"
        viewBox="90 0 620 520"
        role="img"
        aria-labelledby="premium-earth-title premium-earth-desc"
      >
        <title id="premium-earth-title">
          Globe géographique — connexions fictives
        </title>
        <desc id="premium-earth-desc">
          Projection centrée sur l’Atlantique et l’Afrique, côtes Natural Earth,
          Europe et Amériques visibles. Les arcs entre villes illustrent des
          opérations fictives.
        </desc>
        <defs>
          <radialGradient id="network-halo">
            <stop stopColor="#c9ffff" stopOpacity=".8" />
            <stop offset=".2" stopColor="#70e2ed" stopOpacity=".4" />
            <stop offset="1" stopColor="#70e2ed" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="network-amber-halo">
            <stop stopColor="#fff0c4" stopOpacity=".85" />
            <stop offset=".2" stopColor="#edb563" stopOpacity=".4" />
            <stop offset="1" stopColor="#edb563" stopOpacity="0" />
          </radialGradient>
        </defs>
        <image href={earth} width="800" height="520" />
        <g className="premium-arcs">
          {routes.map(({ d, tone }, i) => (
            <path
              key={i}
              d={d}
              className={tone}
              style={{ opacity: 0.35 + (i % 3) * 0.2 }}
            />
          ))}
        </g>
        <g className="premium-route-lights" aria-hidden="true">
          {routes
            .filter((_, i) => i % 2 === 0)
            .map(({ d, tone }, i) => (
              <circle
                key={i}
                r="1.8"
                className={`premium-traveler ${tone}`}
                style={
                  {
                    offsetPath: `path('${d}')`,
                    animationDelay: `-${i * 1.7}s`,
                    animationDuration: `${8 + i * 0.6}s`,
                  } as CSSProperties
                }
              />
            ))}
        </g>
        <g className="premium-anchors">
          {anchors.map(({ name, p: [x, y] }, i) => (
            <g
              key={name}
              className={i === 9 ? "amber" : i === 7 ? "red" : "cyan"}
            >
              {i % 3 === 0 && (
                <circle
                  className="premium-halo"
                  cx={x}
                  cy={y}
                  r="17"
                  fill={
                    i === 9 ? "url(#network-amber-halo)" : "url(#network-halo)"
                  }
                  style={{ animationDelay: `-${i * 0.7}s` }}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={i % 3 === 0 ? 3 : 2}
                className="premium-anchor"
              />
              <circle cx={x} cy={y} r=".8" fill="#f0ffff" />
            </g>
          ))}
        </g>
      </svg>
      <div className="premium-legend" aria-label="Légende de l’illustration géographique">
        <span>
          <i />
          Routes fictives
        </span>
        <span>
          <i className="blue" />
          Villes repères
        </span>
        <span>
          <i className="amber" />
          Liaisons d’exemple
        </span>
        <span>
          <i className="red" />
          Aucun trafic réel
        </span>
      </div>
      <span className="premium-demo">VISUALISATION FICTIVE</span>
    </div>
  );
}
