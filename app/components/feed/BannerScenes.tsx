'use client'
/**
 * BannerScenes — the animated infographic of a category banner. The server picks the scene from the category's
 * words with the poster topic engine (categories.banner.scene, see backend banner_service); each scene is drawn
 * here in the category's colour, on the left and right of the banner (the title sits in the middle).
 *
 *   warming     warming stripes with a rising temperature curve · thermometer and sun
 *   landscape   contour lines drawing themselves · a forest growing on a hill
 *   water       drifting waves · rain from a cloud into a rising gauge
 *   markets     candlesticks and a trend line · stacking coins and a rising percentage
 *   transport   route networks with vehicles moving between hubs
 *   energy      spinning wind turbines · pylons with current flowing along the lines
 *   city        skylines rising on a street, windows lighting up
 *   population  a population pyramid · a crowd with highlighted people
 *   learning    scores scatter with a trend line · a ranking and a graduation cap
 *   globe       a turning globe · places linked by arcs
 *
 * viewBox 1200 × 240: left scene in x 20–400, right scene in x 800–1180. Shapes vary per category (seeded by its
 * slug). The motion is CSS (globals.css, .gv-infographic) and SVG animateMotion / animate; it is left out when the
 * reader prefers reduced motion.
 */
import React, { useEffect, useMemo, useState } from 'react'
import type { BannerScene } from '../../../types/gisviz'

const C = 'var(--c)'
const B = 214                                  // baseline

function rng(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000 }
}
const d = (s: number) => ({ ['--d' as any]: `${s.toFixed(2)}s` }) as React.CSSProperties
const v = (o: Record<string, string | number>) => Object.fromEntries(Object.entries(o).map(([k, x]) => [`--${k}`, typeof x === 'number' ? `${x}s` : x])) as React.CSSProperties
const tint = (pct: number, to = '#ffffff') => `color-mix(in srgb, var(--c) ${Math.round(pct)}%, ${to})`

function useReducedMotion() {
  const [r, setR] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setR(m.matches); on()
    m.addEventListener('change', on); return () => m.removeEventListener('change', on)
  }, [])
  return r
}

/* ─────────────────────────────── scenes ─────────────────────────────── */

function Warming({ r }: { r: () => number }) {
  const n = 26
  const temps = Array.from({ length: n }, (_, i) => Math.min(1, Math.max(0, i / n * 0.9 + (r() - 0.5) * 0.35)))
  const pts = temps.map((t, i) => `${i ? 'L' : 'M'}${37 + i * 14},${190 - t * 130}`).join('')
  return (
    <>
      {temps.map((t, i) => (
        <rect key={i} className="gv-fadein" x={30 + i * 14} y={34} width={14} height={180} style={{ ...d(i * 0.05), fill: `color-mix(in srgb, var(--c) ${Math.round(15 + t * 85)}%, #3b7fc4)` }} />
      ))}
      <path className="gv-line" d={pts} pathLength={1} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={v({ d: 1.2, t: 2 })} />
      {/* thermometer */}
      <rect x={866} y={44} width={28} height={156} rx={14} fill="none" stroke={C} strokeOpacity={0.45} strokeWidth={2} />
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1={900} x2={912} y1={66 + i * 28} y2={66 + i * 28} stroke={C} strokeOpacity={0.4} strokeWidth={2} />)}
      <rect className="gv-bar" x={873} y={70} width={14} height={140} rx={7} fill={C} style={{ ...d(0.4), ['--b' as any]: 0.86 }} />
      <circle cx={880} cy={204} r={20} fill={C} />
      <text className="gv-pop" x={950} y={130} fontSize={34} fontWeight={800} fill={C} style={d(1.6)}>+1.4°</text>
      {/* sun */}
      <g className="gv-spin" style={v({ t: 22 })}>
        <circle cx={1090} cy={84} r={58} fill="none" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          return <line key={i} x1={1090 + Math.cos(a) * 40} y1={84 + Math.sin(a) * 40} x2={1090 + Math.cos(a) * 56} y2={84 + Math.sin(a) * 56}
                       stroke={C} strokeWidth={4} strokeLinecap="round" strokeOpacity={0.7} />
        })}
      </g>
      <circle className="gv-pop" cx={1090} cy={84} r={30} fill={C} style={d(0.3)} />
    </>
  )
}

function Landscape({ r }: { r: () => number }) {
  const ring = (k: number) => {
    const rad = 24 + k * 19, n = 28
    const p = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2, w = 1 + 0.16 * Math.sin(a * 3 + k) + 0.08 * Math.cos(a * 5 - k * 2)
      return `${i ? 'L' : 'M'}${(210 + Math.cos(a) * rad * w * 1.5).toFixed(1)},${(126 + Math.sin(a) * rad * w * 0.82).toFixed(1)}`
    }).join('') + 'Z'
    return p
  }
  const trees = Array.from({ length: 8 }, (_, i) => ({ x: 830 + i * 44 + r() * 14, h: 60 + r() * 70 }))
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map(k => (
        <path key={k} className="gv-line" d={ring(k)} pathLength={1} fill={k === 0 ? C : 'none'} fillOpacity={0.25}
              stroke={C} strokeOpacity={1 - k * 0.13} strokeWidth={k === 0 ? 2.5 : 1.8} style={v({ d: 0.2 + k * 0.25, t: 1.4 })} />
      ))}
      <circle className="gv-pop" cx={210} cy={126} r={5} fill={C} style={d(1.8)} />
      <path d="M790,214 Q900,150 1000,182 T1190,170 L1190,214 Z" fill={C} fillOpacity={0.14} />
      {trees.map((t, i) => (
        <g key={i} className="gv-bar" style={{ ...d(0.3 + i * 0.12), ['--b' as any]: 0.94 }}>
          <rect x={t.x - 3} y={B - 20} width={6} height={20} fill={C} fillOpacity={0.7} />
          <polygon points={`${t.x},${B - 20 - t.h} ${t.x - t.h * 0.32},${B - 18} ${t.x + t.h * 0.32},${B - 18}`} fill={C} fillOpacity={0.55 + (i % 3) * 0.15} />
        </g>
      ))}
    </>
  )
}

function Water({ r, still }: { r: () => number; still: boolean }) {
  const wave = (y: number, amp: number) => {
    let p = `M-160,${y}`
    for (let x = -160; x <= 560; x += 40) p += ` Q${x + 20},${y - amp} ${x + 40},${y} T${x + 80},${y}`
    return p + ` L560,240 L-160,240 Z`
  }
  const drops = Array.from({ length: 14 }, () => ({ x: 880 + r() * 170, d: r() * 1.6 }))
  return (
    <>
      <clipPath id="gv-wclip"><rect x={20} y={20} width={380} height={210} rx={12} /></clipPath>
      <g clipPath="url(#gv-wclip)">
        {[[110, 14, 0.18, 9], [140, 12, 0.3, 7], [172, 10, 0.5, 5]].map(([y, a, o, t], i) => (
          <path key={i} className={still ? '' : 'gv-drift'} d={wave(y, a)} fill={C} fillOpacity={o} style={v({ t, dx: '-160px' })} />
        ))}
      </g>
      {/* cloud + rain + gauge */}
      <g fill={C} fillOpacity={0.35}>
        <circle cx={930} cy={64} r={28} /><circle cx={966} cy={52} r={34} /><circle cx={1004} cy={66} r={26} /><rect x={904} y={64} width={124} height={26} rx={13} />
      </g>
      {!still && drops.map((p, i) => (
        <line key={i} className="gv-fall" x1={p.x} x2={p.x - 4} y1={98} y2={112} stroke={C} strokeWidth={2.5} strokeLinecap="round" style={v({ d: p.d, t: 1.4 })} />
      ))}
      <rect x={1100} y={70} width={44} height={144} rx={8} fill="none" stroke={C} strokeOpacity={0.45} strokeWidth={2} />
      {[0, 1, 2, 3].map(i => <line key={i} x1={1148} x2={1160} y1={90 + i * 32} y2={90 + i * 32} stroke={C} strokeOpacity={0.45} strokeWidth={2} />)}
      <rect className="gv-bar" x={1104} y={118} width={36} height={92} rx={5} fill={C} fillOpacity={0.8} style={{ ...d(0.5), ['--b' as any]: 0.8 }} />
    </>
  )
}

function Markets({ r }: { r: () => number }) {
  let p = 150
  const candles = Array.from({ length: 12 }, () => {
    const o = p; p = Math.max(50, Math.min(196, p - 6 - (r() - 0.35) * 30))
    return { o, c: p, hi: Math.min(o, p) - 6 - r() * 10, lo: Math.max(o, p) + 6 + r() * 10 }
  })
  const line = candles.map((k, i) => `${i ? 'L' : 'M'}${48 + i * 30},${k.c}`).join('')
  const stacks = [4, 6, 8, 11]
  return (
    <>
      {candles.map((k, i) => {
        const up = k.c < k.o, top = Math.min(k.o, k.c), h = Math.max(4, Math.abs(k.o - k.c))
        return (
          <g key={i}>
            <line className="gv-fadein" x1={48 + i * 30} x2={48 + i * 30} y1={k.hi} y2={k.lo} stroke={C} strokeOpacity={0.6} strokeWidth={2} style={d(0.1 + i * 0.08)} />
            <rect className="gv-bar" x={40 + i * 30} y={top} width={16} height={h} rx={2} fill={C} fillOpacity={up ? 0.95 : 0.4} style={{ ...d(0.1 + i * 0.08), ['--b' as any]: 0.9 }} />
          </g>
        )
      })}
      <path className="gv-line" d={line} pathLength={1} fill="none" stroke={C} strokeWidth={2.5} strokeDasharray="1" style={v({ d: 1.2, t: 1.6 })} />
      {stacks.map((n, s) => Array.from({ length: n }, (_, i) => (
        <g key={`${s}-${i}`} className="gv-pop" style={d(0.2 + s * 0.25 + i * 0.07)}>
          <ellipse cx={850 + s * 66} cy={B - 6 - i * 11} rx={26} ry={8} fill={tint(55 + (i % 2) * 25)} stroke={C} strokeWidth={1.5} />
        </g>
      )))}
      <g className="gv-bob" style={v({ t: 2.6 })}>
        <path d="M1110,118 L1140,84 L1170,118 L1152,118 L1152,150 L1128,150 L1128,118 Z" fill={C} />
      </g>
      <text className="gv-pop" x={1140} y={180} textAnchor="middle" fontSize={26} fontWeight={800} fill={C} style={d(1.8)}>+3.2%</text>
    </>
  )
}

function Transport({ r, still }: { r: () => number; still: boolean }) {
  const zone = (x0: number) => Array.from({ length: 6 }, (_, i) => ({ x: x0 + 20 + (i % 3) * 150 + r() * 50, y: 50 + Math.floor(i / 3) * 120 + r() * 40 }))
  const nets = [zone(20), zone(780)]
  return (
    <>
      {nets.map((nodes, z) => {
        const edges = [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5], [0, 4], [2, 4]]
        return (
          <g key={z}>
            {edges.map(([a, b], i) => {
              const A = nodes[a], Bn = nodes[b], mx = (A.x + Bn.x) / 2 + (r() - 0.5) * 40, my = (A.y + Bn.y) / 2 + (r() - 0.5) * 40
              const path = `M${A.x},${A.y} Q${mx},${my} ${Bn.x},${Bn.y}`
              return (
                <g key={i}>
                  <path d={path} fill="none" stroke={C} strokeOpacity={0.22} strokeWidth={5} strokeLinecap="round" />
                  <path className={still ? '' : 'gv-flow'} d={path} fill="none" stroke={C} strokeOpacity={0.75} strokeWidth={2} strokeLinecap="round" style={v({ t: 1 + (i % 3) * 0.4 })} />
                  {!still && i % 2 === 0 && (
                    <circle r={5} fill={C}><animateMotion dur={`${3 + (i % 4)}s`} repeatCount="indefinite" path={path} keyPoints={i % 4 ? '0;1' : '1;0'} keyTimes="0;1" calcMode="linear" /></circle>
                  )}
                </g>
              )
            })}
            {nodes.map((n, i) => (
              <g key={i}>
                {i % 2 === 0 && <circle className="gv-ripple" cx={n.x} cy={n.y} r={16} fill="none" stroke={C} strokeWidth={1.4} style={d(i * 0.5)} />}
                <circle className="gv-pop" cx={n.x} cy={n.y} r={i % 2 ? 6 : 9} fill="var(--color-gisviz-card, #fff)" stroke={C} strokeWidth={3} style={d(0.2 + i * 0.1)} />
              </g>
            ))}
          </g>
        )
      })}
    </>
  )
}

function Energy({ still }: { still: boolean }) {
  const turbines = [{ x: 90, h: 120, t: 5 }, { x: 205, h: 150, t: 4 }, { x: 330, h: 110, t: 6 }]
  const pylons = [840, 990, 1140]
  const pylon = (x: number) => `M${x - 22},${B} L${x - 6},90 L${x + 6},90 L${x + 22},${B} M${x - 16},170 L${x + 16},170 M${x - 12},130 L${x + 12},130 M${x - 30},96 L${x + 30},96 M${x - 22},${B} L${x + 12},130 M${x + 22},${B} L${x - 12},130`
  return (
    <>
      {turbines.map((t, i) => {
        const hy = B - t.h, L = t.h * 0.45
        return (
          <g key={i}>
            <path d={`M${t.x - 4},${B} L${t.x - 2},${hy} L${t.x + 2},${hy} L${t.x + 4},${B} Z`} fill={C} fillOpacity={0.55} />
            <g className={still ? '' : 'gv-spin'} style={v({ t: t.t })}>
              <circle cx={t.x} cy={hy} r={L} fill="none" />
              {[0, 120, 240].map(a => {
                const rad = (a * Math.PI) / 180, ex = t.x + Math.cos(rad) * L, ey = hy + Math.sin(rad) * L
                const px = Math.cos(rad + Math.PI / 2) * 6, py = Math.sin(rad + Math.PI / 2) * 6
                return <path key={a} d={`M${t.x},${hy} L${t.x + Math.cos(rad) * L * 0.3 + px},${hy + Math.sin(rad) * L * 0.3 + py} L${ex},${ey} Z`} fill={C} />
              })}
            </g>
            <circle cx={t.x} cy={hy} r={5} fill={C} />
          </g>
        )
      })}
      {pylons.map(x => <path key={x} d={pylon(x)} fill="none" stroke={C} strokeOpacity={0.7} strokeWidth={2.2} strokeLinejoin="round" />)}
      {[0, 1].flatMap(s => [-30, 30].map(o => {
        const x0 = pylons[s] + o, x1 = pylons[s + 1] + o
        const path = `M${x0},96 Q${(x0 + x1) / 2},128 ${x1},96`
        return (
          <g key={`${s}${o}`}>
            <path d={path} fill="none" stroke={C} strokeOpacity={0.35} strokeWidth={1.6} />
            <path className={still ? '' : 'gv-flow'} d={path} fill="none" stroke={C} strokeWidth={2.6} strokeLinecap="round" style={v({ t: 0.9 })} />
          </g>
        )
      }))}
      <path className="gv-blink" d="M1066,24 L1050,56 L1064,56 L1056,80 L1080,46 L1066,46 L1074,24 Z" fill={C} style={v({ t: 1.6 })} />
    </>
  )
}

function City({ r }: { r: () => number }) {
  const side = (x0: number, x1: number) => {
    const out: { x: number; w: number; h: number }[] = []
    for (let x = x0; x < x1 - 20;) { const w = 22 + r() * 22; out.push({ x, w, h: 50 + r() * 130 }); x += w + 4 }
    return out
  }
  const blds = [...side(24, 400), ...side(800, 1180)]
  return (
    <>
      <line x1={10} x2={1190} y1={B} y2={B} stroke={C} strokeOpacity={0.45} strokeWidth={2} />
      <line className="gv-flow" x1={10} x2={1190} y1={B + 9} y2={B + 9} stroke={C} strokeOpacity={0.4} strokeWidth={2} style={v({ t: 2.5 })} />
      {blds.map((b, i) => (
        <g key={i} className="gv-bar" style={{ ...d(0.05 + (i % 14) * 0.06), ['--b' as any]: 1 }}>
          <rect x={b.x} y={B - b.h} width={b.w} height={b.h} rx={2} fill={C} fillOpacity={0.22 + (i % 4) * 0.12} />
          {Array.from({ length: Math.floor(b.h / 22) }, (_, k) => [0, 1].map(c => (
            <rect key={`${k}-${c}`} className="gv-blink" x={b.x + 5 + c * (b.w / 2 - 2)} y={B - b.h + 8 + k * 22} width={Math.max(4, b.w / 2 - 9)} height={8} rx={1}
                  fill={C} style={v({ d: r() * 3, t: 2 + r() * 3 })} />
          )))}
        </g>
      ))}
    </>
  )
}

function Population({ r }: { r: () => number }) {
  const rows = 11
  const widths = Array.from({ length: rows }, (_, i) => 30 + (i / (rows - 1)) * 120 + (r() - 0.5) * 30)
  return (
    <>
      <line x1={210} x2={210} y1={30} y2={B} stroke={C} strokeOpacity={0.4} strokeWidth={1.5} />
      {widths.map((w, i) => {
        const y = 32 + i * 16.5, wr = w * (0.9 + r() * 0.2)
        return (
          <g key={i}>
            <rect className="gv-barx" x={206 - w} y={y} width={w} height={13} rx={3} fill={C} style={{ ...d(0.1 + i * 0.07), ['--o' as any]: '100% 50%' }} />
            <rect className="gv-barx" x={214} y={y} width={wr} height={13} rx={3} fill={C} fillOpacity={0.45} style={{ ...d(0.1 + i * 0.07), ['--o' as any]: '0% 50%' }} />
          </g>
        )
      })}
      {Array.from({ length: 32 }, (_, i) => {
        const x = 830 + (i % 8) * 44, y = 52 + Math.floor(i / 8) * 44, on = r() < 0.22
        return (
          <g key={i} className={on ? 'gv-pop gv-beat-soft' : 'gv-pop'} style={d(0.2 + i * 0.035)}>
            <circle cx={x} cy={y} r={7} fill={C} fillOpacity={on ? 1 : 0.28} />
            <path d={`M${x - 10},${y + 26} Q${x - 10},${y + 10} ${x},${y + 10} Q${x + 10},${y + 10} ${x + 10},${y + 26} Z`} fill={C} fillOpacity={on ? 1 : 0.28} />
          </g>
        )
      })}
    </>
  )
}

function Learning({ r }: { r: () => number }) {
  const pts = Array.from({ length: 30 }, () => { const x = r(); return { x, y: 0.15 + x * 0.65 + (r() - 0.5) * 0.3 } })
  const X = (t: number) => 50 + t * 330, Y = (t: number) => 200 - Math.min(1, Math.max(0, t)) * 160
  const bars = [0.95, 0.82, 0.74, 0.63, 0.55, 0.41]
  return (
    <>
      <line x1={40} x2={390} y1={204} y2={204} stroke={C} strokeOpacity={0.4} strokeWidth={1.5} />
      <line x1={44} x2={44} y1={30} y2={208} stroke={C} strokeOpacity={0.4} strokeWidth={1.5} />
      {pts.map((p, i) => <circle key={i} className="gv-pop" cx={X(p.x)} cy={Y(p.y)} r={5} fill={C} fillOpacity={0.65} style={d(0.1 + i * 0.04)} />)}
      <path className="gv-line" d={`M${X(0)},${Y(0.15)} L${X(1)},${Y(0.8)}`} pathLength={1} stroke={C} strokeWidth={3} strokeLinecap="round" style={v({ d: 1.4, t: 1 })} />
      {bars.map((w, i) => (
        <rect key={i} className="gv-barx" x={830} y={70 + i * 24} width={w * 270} height={16} rx={4} fill={C} fillOpacity={1 - i * 0.12} style={{ ...d(0.2 + i * 0.1), ['--o' as any]: '0% 50%' }} />
      ))}
      <g className="gv-bob" style={v({ t: 3 })}>
        <path d="M1110,30 L1160,46 L1110,62 L1060,46 Z" fill={C} />
        <path d="M1082,54 L1082,70 Q1110,82 1138,70 L1138,54 L1110,63 Z" fill={C} fillOpacity={0.7} />
      </g>
    </>
  )
}

function Globe({ r, still }: { r: () => number; still: boolean }) {
  const cx = 210, cy = 124, R = 92
  const pins = Array.from({ length: 4 }, (_, i) => ({ x: 830 + i * 100 + r() * 30, y: 70 + r() * 110 }))
  return (
    <>
      <circle cx={cx} cy={cy} r={R} fill={C} fillOpacity={0.08} stroke={C} strokeWidth={2.2} />
      {[-0.6, -0.3, 0, 0.3, 0.6].map((k, i) => (
        <ellipse key={i} cx={cx} cy={cy + k * R} rx={R * Math.sqrt(1 - k * k)} ry={6} fill="none" stroke={C} strokeOpacity={0.35} strokeWidth={1.3} />
      ))}
      {[0, 1, 2, 3].map(i => (
        <ellipse key={i} cx={cx} cy={cy} rx={R * Math.abs(Math.cos((i * Math.PI) / 4))} ry={R} fill="none" stroke={C} strokeOpacity={0.45} strokeWidth={1.3}>
          {!still && <animate attributeName="rx" values={`${R};0;${R}`} dur="8s" begin={`${-i * 2}s`} repeatCount="indefinite" />}
        </ellipse>
      ))}
      {[[-30, -20], [35, 10], [-10, 45]].map(([dx, dy], i) => (
        <g key={i}>
          <circle className="gv-ripple" cx={cx + dx} cy={cy + dy} r={12} fill="none" stroke={C} strokeWidth={1.3} style={d(i * 0.7)} />
          <circle className="gv-pop" cx={cx + dx} cy={cy + dy} r={5} fill={C} style={d(0.4 + i * 0.2)} />
        </g>
      ))}
      {pins.slice(0, -1).map((p, i) => {
        const q = pins[i + 1]
        return <path key={i} className="gv-line" d={`M${p.x},${p.y} Q${(p.x + q.x) / 2},${Math.min(p.y, q.y) - 70} ${q.x},${q.y}`} pathLength={1}
                     fill="none" stroke={C} strokeWidth={2.2} strokeDasharray="1" style={v({ d: 0.5 + i * 0.5, t: 1.2 })} />
      })}
      {pins.map((p, i) => (
        <g key={i}>
          <circle className="gv-ripple" cx={p.x} cy={p.y} r={14} fill="none" stroke={C} strokeWidth={1.3} style={d(i * 0.6)} />
          <circle className="gv-pop" cx={p.x} cy={p.y} r={7} fill={C} style={d(0.2 + i * 0.4)} />
        </g>
      ))}
    </>
  )
}

/* ─────────────────────────────── the stage ─────────────────────────────── */

/** layout "wide": the scene's two halves left and right of the banner (viewBox 1200 × 240, middle left free);
 *  layout "panel": both halves side by side in one compact picture (800 × 240), for a column of its own. */
export default function BannerScenes({ scene, seed, color, layout = 'wide' }: {
  scene: BannerScene; seed: string; color: string; layout?: 'wide' | 'panel'
}) {
  const still = useReducedMotion()
  const body = useMemo(() => {
    const r = rng(`${scene}:${seed}`)
    switch (scene) {
      case 'warming': return <Warming r={r} />
      case 'landscape': return <Landscape r={r} />
      case 'water': return <Water r={r} still={still} />
      case 'markets': return <Markets r={r} />
      case 'transport': return <Transport r={r} still={still} />
      case 'energy': return <Energy still={still} />
      case 'city': return <City r={r} />
      case 'population': return <Population r={r} />
      case 'learning': return <Learning r={r} />
      default: return <Globe r={r} still={still} />
    }
  }, [scene, seed, still])
  if (layout === 'panel') return (
    <svg viewBox="0 0 800 240" preserveAspectRatio="xMidYMid meet" className="gv-infographic h-full w-full" aria-hidden
         style={{ ['--c' as any]: color }}>
      <svg x={0} y={0} width={400} height={240} viewBox="0 0 400 240" overflow="hidden">{body}</svg>
      <svg x={400} y={0} width={400} height={240} viewBox="800 0 400 240" overflow="hidden">{body}</svg>
    </svg>
  )
  return (
    <svg viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid meet" className="gv-infographic h-full w-full" aria-hidden
         style={{ ['--c' as any]: color }}>
      {body}
    </svg>
  )
}