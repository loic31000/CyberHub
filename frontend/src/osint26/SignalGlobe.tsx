import { useRef, type CSSProperties } from 'react'

/*
 * OSINT Signal Globe — radio wave propagation. A holographic sphere (no Earth,
 * no places) carrying a field of points, and beside it an emitting station:
 * the single source of the signal, searching for the pseudonym.
 *
 * During a scan, four waves follow each other (2.4 s apart, a 9.6 s cycle).
 * Each: the emitter charges, then three or four radio arcs leave it a little
 * apart, open towards the sphere, grow and fade as they reach its edge. There
 * the wave goes on across the surface: a front on the sphere itself (a circle
 * around the side facing the antenna), bright on the visible face, faint on
 * the far one, widening then closing on the far side. As it passes, 16 to 19
 * points light up in cascade (the near ones first), hold, and fade slowly;
 * the next wave arrives while the last of them are still dimming. Nothing
 * comes back to the antenna. Which points and the small offsets are fixed by index:
 * stable and reproducible. No line stays once its wave has passed.
 *
 * A metaphor of WhatsMyName's mass collection: a point is not a site nor a
 * result. The counters in the caption are the only figures.
 * Geometry and timings are built once from the sphere; all motion is CSS.
 */
const W = 640, H = 420
const CX = 404, CY = 206, R = 166 // the sphere
const E = { x: 112, y: 182 } // the emitter's core
const TILT = (18 * Math.PI) / 180
const WAVES = 4
const SPACING = 2.4 // s between waves
const ARCS = [4, 3, 4, 3] // radio arcs per wave
const ARC_GAP = 0.22 // s between two arcs of a wave
const JITTER = [0, 0.05, 0.02, 0.07] // s: each wave leaves a touch differently
const ACTIVE = [17, 19, 16, 18] // points lit per wave
// The front on the sphere: the arcs reach its edge after FRONT_AT, then it
// sweeps from THETA0 to THETA1 degrees around the axis in SWEEP seconds.
// These values and AXIS are mirrored by the keyframes in osint.css.
const FRONT_AT = 1.08
const SWEEP = 2.3
const THETA0 = 6, THETA1 = 174

type V = [number, number, number]
type Last = { username: string; status: 'done' | 'error'; found: number; checked: number; total: number }
type Progress = { checked: number; total: number; found: number }

const tilt = ([x, y, z]: V): V => [x, y * Math.cos(TILT) - z * Math.sin(TILT), y * Math.sin(TILT) + z * Math.cos(TILT)]
const px = (v: V) => ({ x: CX + R * v[0], y: CY - R * v[1], front: v[2] > 0, z: v[2] })
const f = (n: number) => n.toFixed(1)
const rad = (d: number) => (d * Math.PI) / 180

/* A circle of the sphere, as front and back runs of a path. */
function circle(at: (t: number) => V) {
  let front = '', back = '', prev: boolean | null = null
  for (let i = 0; i <= 96; i += 1) {
    const p = px(tilt(at((i / 96) * 2 * Math.PI)))
    const cmd = prev === p.front ? 'L' : 'M'
    if (p.front) front += `${cmd}${f(p.x)} ${f(p.y)}`; else back += `${cmd}${f(p.x)} ${f(p.y)}`
    prev = p.front
  }
  return { front, back }
}
const LATITUDES = [-50, -20, 12, 42].map((d) => circle((t) => [Math.cos(rad(d)) * Math.cos(t), Math.sin(rad(d)), Math.cos(rad(d)) * Math.sin(t)]))
const MERIDIANS = [0, 60, 120].map((d) => circle((t) => [Math.cos(t) * Math.sin(rad(d)), Math.sin(t), Math.cos(t) * Math.cos(rad(d))]))

/* The field: 52 points on the sphere (golden angle), of varied weight. */
const POINTS = Array.from({ length: 52 }, (_, i) => {
  const y = 1 - ((i + 0.5) / 52) * 2
  const r = Math.sqrt(1 - y * y)
  const a = i * 2.39996 + 0.5
  return { i, ...px(tilt([r * Math.cos(a), y, r * Math.sin(a)])), weight: (i * 7) % 3, minor: i % 2 === 1 }
})
// Points a wave can light: the front, and the back near the limb (drawn faint).
const ELIGIBLE = POINTS.filter((p) => p.z > -0.3)
const ORDER = [...ELIGIBLE].sort((a, b) => ((a.i * 29) % 53) - ((b.i * 29) % 53))

/*
 * The wave's axis, from the sphere's centre towards the antenna (left, a touch
 * up, a touch towards us). A front is the circle of the sphere at an angle
 * theta from it: projected, a fixed ellipse (RING) moved along the axis by
 * R cos(theta) and scaled by sin(theta), so CSS can carry it.
 */
const AXIS: V = (() => { const v: V = [-0.92, 0.08, 0.38]; const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n] })()
const CN = Math.sqrt(1 - AXIS[2] ** 2)
const C: V = [(-AXIS[2] * AXIS[0]) / CN, (-AXIS[2] * AXIS[1]) / CN, CN] // across the axis, towards the viewer
const B: V = [AXIS[1] * C[2] - AXIS[2] * C[1], AXIS[2] * C[0] - AXIS[0] * C[2], AXIS[0] * C[1] - AXIS[1] * C[0]]
// Starts on the far side, so the visible part of every front sits mid-path (dashes in osint.css).
const RING = Array.from({ length: 73 }, (_, i) => {
  const a = -Math.PI / 2 + (i / 72) * 2 * Math.PI
  return `${i ? 'L' : 'M'}${f(R * (Math.cos(a) * B[0] + Math.sin(a) * C[0]))} ${f(-R * (Math.cos(a) * B[1] + Math.sin(a) * C[1]))}`
}).join('')
// When the front passes a point: its angle from the axis, on the sweep's clock.
const passAt = (p: { x: number; y: number; z: number }) => {
  const dot = ((p.x - CX) / R) * AXIS[0] + ((CY - p.y) / R) * AXIS[1] + p.z * AXIS[2]
  const theta = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI
  return FRONT_AT + Math.max(0, Math.min(1, (theta - THETA0) / (THETA1 - THETA0))) * SWEEP
}

/* An arc around the emitter, of radius r, centred on angle a (radians), spanning +/- h. */
const arc = (r: number, a: number, h: number) =>
  `M${f(E.x + r * Math.cos(a - h))} ${f(E.y + r * Math.sin(a - h))}A${f(r)} ${f(r)} 0 0 1 ${f(E.x + r * Math.cos(a + h))} ${f(E.y + r * Math.sin(a + h))}`
const TOWARDS = Math.atan2(CY - E.y, CX - E.x)
const ARC_LEAD = arc(100, TOWARDS, rad(30))
const ARC_WAKE = arc(93, TOWARDS, rad(28))

// Each wave walks the points with its own stride (coprime with their count): other points each time.
const coprime = (a: number, b: number): boolean => (b ? coprime(b, a % b) : a === 1)
const STRIDES = [1, 5, 7, 11, 13, 17].filter((k) => coprime(k, ORDER.length)).slice(0, WAVES)
const WAVE = Array.from({ length: WAVES }, (_, s) => {
  const start = s * SPACING + JITTER[s]
  const arcs = Array.from({ length: ARCS[s] }, (_, k) => ({ k, delay: start + 0.12 + k * ARC_GAP }))
  const points = Array.from({ length: ACTIVE[s] }, (_, j) => {
    const t = ORDER[(s * 7 + j * (STRIDES[s] ?? 1)) % ORDER.length]
    return { j, i: t.i, x: t.x, y: t.y, back: !t.front, minor: j % 2 === 1, delay: start + passAt(t) + ((j * 37) % 9) * 0.025 } // a touch of spread: no two flash as one
  })
  return { s, front: start + FRONT_AT, arcs, points }
})

export default function SignalGlobe({ target, categories, category, siteCount, progress, running, warn, last }: {
  target: string | null
  categories: string[]
  category: string
  siteCount: number | null
  progress: Progress | null
  running: boolean
  warn?: boolean
  last?: Last | null
}) {
  const state = running ? (warn ? 'error' : 'scan') : last ? (last.status === 'error' ? 'error' : 'done') : target ? 'armed' : 'idle'
  const pct = progress && progress.total > 0 ? Math.min(100, (progress.checked / progress.total) * 100) : 0
  const name = running ? target : last ? last.username : target
  const label = name ? `@${name.length > 16 ? `${name.slice(0, 15)}…` : name}` : 'Cible à définir'
  const plate = Math.max(118, label.length * 8.6 + 28)
  // The waves run during a scan; one last wave only when this globe saw the
  // scan end. Coming back to an already finished search, it stays still.
  const sawScan = useRef(false)
  if (state === 'scan') sawScan.current = true
  else if (state !== 'done') sawScan.current = false
  const closing = state === 'done' && sawScan.current
  const waves = state === 'scan' ? WAVE : closing ? WAVE.slice(0, 1) : []
  const key = closing ? 'end' : 'scan' // the closing wave mounts afresh, from its start
  const ms = (t: number) => `${t.toFixed(3)}s`

  return (
    <figure className={`os26-globe is-${state}${closing ? ' is-closing' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="os26-g-body" cx="40%" cy="32%" r="78%">
            <stop offset="0" stopColor="#143450" />
            <stop offset=".55" stopColor="#0a1c2c" />
            <stop offset="1" stopColor="#060f18" />
          </radialGradient>
          <radialGradient id="os26-g-halo" cx="50%" cy="50%" r="50%">
            <stop offset=".64" stopColor="#00d4ff" stopOpacity="0" />
            <stop offset=".76" stopColor="#00d4ff" stopOpacity=".07" />
            <stop offset="1" stopColor="#00d4ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="os26-a-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#00d4ff" stopOpacity=".5" />
            <stop offset=".45" stopColor="#00d4ff" stopOpacity=".12" />
            <stop offset="1" stopColor="#00d4ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="os26-w-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#00d4ff" stopOpacity="0" />
            <stop offset=".5" stopColor="#c8f8ff" />
            <stop offset="1" stopColor="#00d4ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="os26-a-dish" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0a1824" /><stop offset="1" stopColor="#1a3c55" />
          </linearGradient>
        </defs>

        {/* The sphere: halo, body, a quiet wireframe (back fainter), the rim, the points. */}
        <circle cx={CX} cy={CY} r={R + 34} fill="url(#os26-g-halo)" />
        <circle className="os26-g-body" cx={CX} cy={CY} r={R} fill="url(#os26-g-body)" />
        <g className="os26-g-back">{[...LATITUDES, ...MERIDIANS].map((c, i) => <path key={i} d={c.back} />)}</g>
        <g className="os26-g-front">
          {LATITUDES.map((c, i) => <path key={i} d={c.front} />)}
          {MERIDIANS.map((c, i) => <path key={`m${i}`} d={c.front} />)}
        </g>
        <circle className="os26-g-rim" cx={CX} cy={CY} r={R} />
        {/* The fronts across the surface: a faint far side, a bright visible side with its glow. */}
        {waves.map((w) => [0, 1].map((n) => (
          <g key={`${key}-f${w.s}-${n}`} className={`os26-w-front${n ? ' is-second' : ''}`} style={{ '--w': ms(w.front + n * 0.24) } as CSSProperties}>
            <path className="os26-w-far" d={RING} pathLength={100} />
            <path className="os26-w-band" d={RING} pathLength={100} />
            <path className="os26-w-line" d={RING} pathLength={100} />
          </g>
        )))}
        {POINTS.map((p) => (
          <circle key={p.i} className={`os26-g-pt${p.front ? '' : ' is-back'} is-w${p.weight}${p.minor ? ' is-minor' : ''}`}
            cx={p.x} cy={p.y} r={p.front ? [1.8, 2.3, 2.9][p.weight] : 1.4} />
        ))}
        {/* The points the front wakes, in cascade. */}
        {waves.map((w) => w.points.map((p) => (
          <g key={`${key}-p${w.s}-${p.j}`} className={`os26-p${p.back ? ' is-back' : ''}${p.minor ? ' is-minor' : ''}`} style={{ '--p': ms(p.delay) } as CSSProperties}>
            <circle className="os26-p-halo" cx={p.x} cy={p.y} r="7" />
            <circle className="os26-p-core" cx={p.x} cy={p.y} r={p.back ? 1.8 : 2.6} />
          </g>
        )))}

        {/* The real progress, secondary: a fine ring. */}
        <circle className="os26-g-track" cx={CX} cy={CY} r={R + 12} />
        {(running || (state === 'done' && last && last.total > 0)) && (
          <circle className="os26-g-gauge" cx={CX} cy={CY} r={R + 12} pathLength={100} transform={`rotate(-90 ${CX} ${CY})`}
            strokeDasharray={`${running ? pct : Math.min(100, ((last?.checked ?? 0) / Math.max(1, last?.total ?? 1)) * 100)} 100`} />
        )}

        {/* Radio arcs from the emitter. */}
        {waves.map((w) => w.arcs.map((a) => (
          <g key={`${key}-a${w.s}-${a.k}`} className={`os26-w-arc${a.k >= 2 ? ' is-minor' : ''}${a.k === 3 ? ' is-soft' : ''}`} style={{ '--a': ms(a.delay) } as CSSProperties}>
            <path className="os26-w-arc-wake" d={ARC_WAKE} vectorEffect="non-scaling-stroke" />
            <path className="os26-w-arc-lead" d={ARC_LEAD} vectorEffect="non-scaling-stroke" />
          </g>
        )))}

        {/* The emitting station: a socket, a lattice mast, a reflector and the emitter's core. */}
        <g className="os26-a">
          <path className="os26-a-trace" d="M78 318H62V334M146 318H162V334M112 320V340" />
          <circle className="os26-a-via" cx="62" cy="337" r="2.6" />
          <circle className="os26-a-via" cx="162" cy="337" r="2.6" />
          <circle className="os26-a-via" cx="112" cy="343" r="2.6" />
          <rect className="os26-a-base" x="74" y="302" width="76" height="18" rx="3" />
          <rect className="os26-a-chip" x="84" y="306" width="22" height="10" rx="1.5" />
          {[118, 126, 134, 142].map((x) => <rect key={x} className="os26-a-pad" x={x - 1.5} y="309" width="3" height="4" rx=".6" />)}
          <path className="os26-a-mast" d="M100 302L108 214M124 302L116 214" />
          <path className="os26-a-brace" d="M101.4 290L122.6 270M120.9 272L103.6 252M105.1 254L119.4 234M118.2 236L107 222" />
          <circle className="os26-a-pivot" cx="112" cy="210" r="4" />
          <path className="os26-a-arm" d="M112 206L100 190" />
          <path className="os26-a-dish" d="M98 154Q72 182 98 210Q88 182 98 154Z" fill="url(#os26-a-dish)" />
          <path className="os26-a-feed" d="M98 168L112 182L98 196" />
          <circle className="os26-a-glow" cx={E.x} cy={E.y} r="30" fill="url(#os26-a-glow)" />
          <circle className="os26-a-ripple" cx={E.x} cy={E.y} r="9" />
          <circle className="os26-a-ring" cx={E.x} cy={E.y} r="10" />
          <circle className="os26-a-core" cx={E.x} cy={E.y} r="5" />
        </g>
        <rect className="os26-g-plate" x={E.x - plate / 2} y="360" width={plate} height="26" rx="13" />
        <text className={`os26-g-name${name ? '' : ' is-empty'}`} x={E.x} y="378" textAnchor="middle">{label}</text>
      </svg>

      <figcaption>
        <span className="os26-kicker">OSINT SIGNAL GLOBE</span>
        {running && progress ? (
          <dl className="os26-globe-figures">
            <div><dt>Sites vérifiés</dt><dd>{progress.checked.toLocaleString('fr-FR')}<small> / {progress.total.toLocaleString('fr-FR')}</small></dd></div>
            <div><dt>Progression</dt><dd>{Math.round(pct)}<small> %</small></dd></div>
            <div className="is-found"><dt>Profils trouvés</dt><dd>{progress.found.toLocaleString('fr-FR')}</dd></div>
          </dl>
        ) : running ? (
          <p>Démarrage de la recherche…</p>
        ) : last ? (
          <p>
            Dernière opération <b>@{last.username}</b> · {last.status === 'error' ? <>en échec · {last.checked.toLocaleString('fr-FR')} / {last.total.toLocaleString('fr-FR')} sites vérifiés</>
              : <><b className="is-found">{last.found}</b> profil{last.found > 1 ? 's' : ''} trouvé{last.found > 1 ? 's' : ''} sur {last.checked.toLocaleString('fr-FR')} sites vérifiés</>}
          </p>
        ) : (
          <p>
            {category
              ? <>Périmètre : <b>catégorie {category}</b> · nombre de sites non fourni par le catalogue</>
              : <>Périmètre : <b>tous les sites</b>{siteCount !== null && <> · {siteCount.toLocaleString('fr-FR')} référencés</>}</>}
            {categories.length > 0 && <> · {categories.length} familles</>}
          </p>
        )}
      </figcaption>
    </figure>
  )
}
