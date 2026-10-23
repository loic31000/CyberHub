import { useId } from 'react'

/** A conceptual routing diagram: no live peers, routes, or measurements are shown. */
export default function BGPRouteMotif() {
  const diagramId = useId().replace(/:/g, '')
  return (
    <svg className="bgp-route-motif" viewBox="0 0 560 230" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`route-spine-${diagramId}`} x1="74" y1="168" x2="491" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#72D8FF" stopOpacity="0.12" />
          <stop offset="0.52" stopColor="#72D8FF" stopOpacity="0.86" />
          <stop offset="1" stopColor="#E9B77D" stopOpacity="0.48" />
        </linearGradient>
        <pattern id={`route-grid-${diagramId}`} width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="#83B5CF" fillOpacity="0.22" />
        </pattern>
      </defs>
      <rect width="560" height="230" fill={`url(#route-grid-${diagramId})`} />
      <path className="bgp-route-line bgp-route-line--quiet" d="M54 48H186L253 104H374L458 164H531" />
      <path className="bgp-route-line bgp-route-line--quiet" d="M21 184H119L186 128H307L374 70H496" />
      <path className="bgp-route-line bgp-route-line--quiet" d="M119 20V76L186 128V202M307 28V104L374 164V218M458 24V82L496 112" />
      <path className="bgp-route-line bgp-route-line--main" stroke={`url(#route-spine-${diagramId})`} d="M54 48H186L253 104H374L458 164H531" />
      <path className="bgp-route-line bgp-route-line--branch" d="M186 128L253 104L307 28" />
      <path className="bgp-route-line bgp-route-line--branch" d="M374 70L458 82L496 112" />
      <g className="bgp-route-nodes">
        <circle cx="54" cy="48" r="4" /><circle cx="119" cy="76" r="3" />
        <circle cx="186" cy="48" r="5" /><circle cx="186" cy="128" r="4" />
        <circle cx="253" cy="104" r="7" /><circle cx="307" cy="28" r="3" />
        <circle cx="307" cy="104" r="4" /><circle cx="374" cy="70" r="5" />
        <circle cx="374" cy="164" r="4" /><circle cx="458" cy="82" r="3" />
        <circle cx="458" cy="164" r="5" /><circle cx="496" cy="112" r="3" />
        <circle cx="531" cy="164" r="3" />
      </g>
      <g className="bgp-route-labels">
        <text x="35" y="34">ORIGIN</text>
        <text x="230" y="88">TRANSIT</text>
        <text x="420" y="148">PEERING</text>
      </g>
      <circle className="bgp-route-beacon" cx="253" cy="104" r="12" />
    </svg>
  )
}
