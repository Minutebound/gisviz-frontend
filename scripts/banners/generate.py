#!/usr/bin/env python3
"""
Draws the feed's category banner art: one wide PNG per category (public/banners/<slug>.png) and one per scene
(public/banners/scene-<scene>.png, the fallback for a category added later). Also writes lib/bannerPalette.json,
the plate colour the banner component sits the art on.

    python3 scripts/banners/generate.py            # every banner
    python3 scripts/banners/generate.py climate    # just some (slugs or scene-names)

To add a category: add a row to CATEGORIES (slug, scene, theme colour), run the script, commit the PNG + JSON.
The scene is the one backend/app/services/banner_service.py picks for the category's words.
Needs: python3 + playwright with Chromium (PLAYWRIGHT_BROWSERS_PATH). Art is 2000 x 400, left 38% kept quiet for the title.
"""
import colorsys, json, math, os, random, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "banners"
W, H = 2000, 400
QUIET = 760                      # nothing important left of this x: the title sits there

# slug, scene, theme colour (the same as the backend seed)
CATEGORIES = [
    ("climate", "warming", "#f97316"),
    ("infrastructure", "energy", "#3b82f6"),
    ("demographics", "population", "#a855f7"),
    ("transport", "transport", "#10b981"),
    ("environment", "landscape", "#22c55e"),
    ("economy", "markets", "#6366f1"),
    ("urban-planning", "city", "#f43f5e"),
]
# scene -> default colour (backend banner_service.SCENES)
SCENES = {"warming": "#e8590c", "landscape": "#2f9e44", "water": "#1c7ed6", "markets": "#b7791f", "transport": "#7048e8",
          "energy": "#1971c2", "city": "#c2255c", "population": "#d6336c", "learning": "#0ca678", "globe": "#06ba24"}


# ───────────────────────────── colour ─────────────────────────────
def hex_to_hls(h):
    h = h.lstrip("#"); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    return hh, l, s

def hls(h, l, s):
    r, g, b = colorsys.hls_to_rgb(h % 1, max(0, min(1, l)), max(0, min(1, s)))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))

def palette(color):
    """Deep field, four tints from dark to light, the category colour itself, and a pale highlight of the same hue."""
    h, _l, s = hex_to_hls(color)
    s = max(0.45, min(0.9, s))
    return {
        "bg": hls(h, 0.115, s * 0.62), "bg2": hls(h, 0.165, s * 0.7),
        "d1": hls(h, 0.21, s * 0.72), "d2": hls(h, 0.29, s * 0.78), "d3": hls(h, 0.40, s * 0.85), "d4": hls(h, 0.52, s),
        "ac": color, "hi": hls(h, 0.92, 0.75), "cool": hls(h + 0.58, 0.45, 0.42),
    }


# ───────────────────────────── drawing helpers ─────────────────────────────
def f(n):
    return f"{n:.1f}"

def poly(points, **a):
    return "<path d=\"M" + "L".join(f"{f(x)},{f(y)}" for x, y in points) + "Z\" " + attrs(a) + "/>"

def attrs(a):
    return " ".join(f'{k.replace("_", "-")}="{v}"' for k, v in a.items())

def smooth(points):
    """Catmull-Rom through points as a cubic path."""
    p = [points[0]] + points + [points[-1]]
    d = f"M{f(p[1][0])},{f(p[1][1])}"
    for i in range(1, len(p) - 2):
        x0, y0, x1, y1, x2, y2, x3, y3 = *p[i - 1], *p[i], *p[i + 1], *p[i + 2]
        d += f" C{f(x1 + (x2 - x0) / 6)},{f(y1 + (y2 - y0) / 6)} {f(x2 - (x3 - x1) / 6)},{f(y2 - (y3 - y1) / 6)} {f(x2)},{f(y2)}"
    return d

def base(p, glow_at=(1560, 190)):
    """The plate: deep field, a soft glow where the art is brightest, a fine graticule that fades toward the title."""
    grat = "".join(f'<line x1="0" x2="{W}" y1="{y}" y2="{y}"/>' for y in range(40, H, 40)) + \
           "".join(f'<line y1="0" y2="{H}" x1="{x}" x2="{x}"/>' for x in range(100, W, 100))
    return f"""
<defs>
  <linearGradient id="field" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{p['bg']}"/><stop offset=".55" stop-color="{p['bg2']}"/><stop offset="1" stop-color="{p['bg']}"/></linearGradient>
  <radialGradient id="glow" cx="{glow_at[0]}" cy="{glow_at[1]}" r="640" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{p['ac']}" stop-opacity=".42"/><stop offset=".6" stop-color="{p['ac']}" stop-opacity=".08"/><stop offset="1" stop-color="{p['ac']}" stop-opacity="0"/></radialGradient>
  <linearGradient id="fadeL" x1="0" x2="1" y1="0" y2="0" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".35" stop-color="#fff" stop-opacity="1"/></linearGradient>
  <mask id="gm"><rect x="{QUIET - 200}" width="{W - QUIET + 200}" height="{H}" fill="url(#fadeL)"/></mask>
</defs>
<rect width="{W}" height="{H}" fill="url(#field)"/><rect width="{W}" height="{H}" fill="url(#glow)"/>
<g mask="url(#gm)" stroke="{p['hi']}" stroke-opacity=".055" stroke-width="1">{grat}</g>"""

def fade_in(inner, x0=QUIET - 120, x1=QUIET + 380, id_="fi"):
    """Everything drawn by a scene eases in from transparent at the title side, so the art never meets the text."""
    return f"""<defs><linearGradient id="{id_}g" gradientUnits="userSpaceOnUse" x1="{x0}" x2="{x1}" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
<mask id="{id_}"><rect width="{W}" height="{H}" fill="url(#{id_}g)"/></mask></defs><g mask="url(#{id_})">{inner}</g>"""


# ───────────────────────────── scenes ─────────────────────────────
def warming(p, r):
    n, x0, x1 = 64, 800, 1990
    bw = (x1 - x0) / n
    cool = p["cool"]
    def mixc(a, b, t):
        A = [int(a[i:i + 2], 16) for i in (1, 3, 5)]; B = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
        return "#%02x%02x%02x" % tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))
    ts = [min(1, max(0, i / n * 0.92 + (r.random() - 0.5) * 0.3)) for i in range(n)]
    def col(t):
        stops = [(0, cool), (.35, p["d3"]), (.7, p["ac"]), (1, p["hi"])]
        for (a, ca), (b, cb) in zip(stops, stops[1:]):
            if t <= b: return mixc(ca, cb, (t - a) / (b - a))
        return stops[-1][1]
    s = "".join(f'<rect x="{f(x0 + i * bw)}" y="0" width="{f(bw + 0.6)}" height="{H}" fill="{col(t)}"/>' for i, t in enumerate(ts))
    pts = [(x0 + (i + .5) * bw, 330 - ts[i] * 250) for i in range(0, n, 3)]
    # smoothed anomaly curve over the stripes
    s += f'<path d="{smooth(pts)}" fill="none" stroke="{p["hi"]}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
    s += f'<circle cx="{f(pts[-1][0])}" cy="{f(pts[-1][1])}" r="11" fill="{p["hi"]}"/><circle cx="{f(pts[-1][0])}" cy="{f(pts[-1][1])}" r="26" fill="none" stroke="{p["hi"]}" stroke-opacity=".5" stroke-width="2"/>'
    return fade_in(s, 780, 1180)

def energy(p, r):
    s = ""
    hills = [(300, 0.012, p["d1"], 0), (340, 0.017, p["d2"], 2)]
    for base_y, k, c, ph in hills:
        pts = [(x, base_y + 28 * math.sin(x * k + ph) + 14 * math.sin(x * k * 2.3 + ph)) for x in range(760, W + 40, 40)]
        s += f'<path d="{smooth(pts)} L{W + 40},{H} L760,{H} Z" fill="{c}"/>'
    # pylons with sagging lines
    xs = [880, 1130, 1380, 1630, 1880]
    for x in xs:
        s += (f'<path d="M{x - 26},330 L{x - 7},120 L{x + 7},120 L{x + 26},330 M{x - 19},260 L{x + 19},260 M{x - 14},200 L{x + 14},200 '
              f'M{x - 34},128 L{x + 34},128 M{x - 26},330 L{x + 14},200 M{x + 26},330 L{x - 14},200" fill="none" stroke="{p["d4"]}" stroke-width="3" stroke-linejoin="round"/>')
    for a, b in zip(xs, xs[1:]):
        for o in (-34, 34):
            s += f'<path d="M{a + o},128 Q{(a + b) / 2 + o},176 {b + o},128" fill="none" stroke="{p["hi"]}" stroke-opacity=".75" stroke-width="2.4"/>'
    for x in xs: s += f'<circle cx="{x}" cy="120" r="7" fill="{p["hi"]}"/>'
    # turbines in front, three sizes
    for x, h_, ang in [(1010, 210, 8), (1520, 250, 40), (1750, 180, 75), (1270, 150, 22)]:
        top = 360 - h_; L = h_ * .42
        s += f'<path d="M{x - 5},362 L{x - 2},{top} L{x + 2},{top} L{x + 5},362Z" fill="{p["d4"]}"/>'
        for a in (0, 120, 240):
            rad = math.radians(a + ang); ex, ey = x + math.cos(rad) * L, top + math.sin(rad) * L
            nx, ny = -math.sin(rad) * 7, math.cos(rad) * 7
            s += f'<path d="M{x},{top} L{f(x + math.cos(rad) * L * .3 + nx)},{f(top + math.sin(rad) * L * .3 + ny)} L{f(ex)},{f(ey)}Z" fill="{p["hi"]}"/>'
        s += f'<circle cx="{x}" cy="{top}" r="7" fill="{p["ac"]}"/>'
    return fade_in(s, 780, 1100)

def population(p, r):
    rows, cx = 19, 1250
    s = f'<line x1="{cx}" x2="{cx}" y1="30" y2="372" stroke="{p["hi"]}" stroke-opacity=".35" stroke-width="2"/>'
    for i in range(rows):
        t = i / (rows - 1)
        w = (50 + t * 190 + (r.random() - .5) * 24) * 1.2
        wr = w * (.88 + r.random() * .22)
        y = 30 + i * 18.2
        s += f'<rect x="{f(cx - 5 - w)}" y="{f(y)}" width="{f(w)}" height="14" rx="3" fill="{p["ac"]}" fill-opacity="{f(.55 + .45 * (1 - t))[:4]}"/>'
        s += f'<rect x="{cx + 5}" y="{f(y)}" width="{f(wr)}" height="14" rx="3" fill="{p["hi"]}" fill-opacity="{f(.25 + .3 * (1 - t))[:4]}"/>'
    # a crowd, a few people lit
    for k in range(48):
        x = 1620 + (k % 8) * 48; y = 66 + (k // 8) * 52
        on = r.random() < .2
        c, o = (p["hi"], 1) if on else (p["d4"], .6)
        s += f'<circle cx="{x}" cy="{y}" r="8" fill="{c}" fill-opacity="{o}"/><path d="M{x - 12},{y + 30} Q{x - 12},{y + 12} {x},{y + 12} Q{x + 12},{y + 12} {x + 12},{y + 30}Z" fill="{c}" fill-opacity="{o}"/>'
    return fade_in(s, 780, 1060)

def transport(p, r):
    cols, rows = 7, 3
    nodes = [[(840 + c * 175 + (r.random() - .5) * 70, 70 + rr * 130 + (r.random() - .5) * 60) for c in range(cols)] for rr in range(rows)]
    s = ""
    for k in range(5):  # faint land masses for context
        cx, cy = 900 + k * 260 + r.random() * 60, 120 + r.random() * 160
        pts = [(cx + math.cos(a / 8 * 6.283) * (90 + r.random() * 70), cy + math.sin(a / 8 * 6.283) * (50 + r.random() * 40)) for a in range(8)]
        s += f'<path d="{smooth(pts + [pts[0]])} Z" fill="{p["d1"]}" fill-opacity=".8"/>'
    links = []
    for rr in range(rows):
        for c in range(cols):
            if c + 1 < cols and r.random() < .9: links.append((nodes[rr][c], nodes[rr][c + 1], 14))
            if rr + 1 < rows and r.random() < .6: links.append((nodes[rr][c], nodes[rr + 1][c], 10))
            if rr + 1 < rows and c + 1 < cols and r.random() < .22: links.append((nodes[rr][c], nodes[rr + 1][c + 1], 10))
    for _ in range(3):  # long hub-to-hub arcs
        a_, b_ = nodes[r.randrange(rows)][r.randrange(0, 3)], nodes[r.randrange(rows)][r.randrange(4, cols)]
        links.append((a_, b_, -90))
    paths = []
    for A, B_, bulge in links:
        mx, my = (A[0] + B_[0]) / 2, (A[1] + B_[1]) / 2 - bulge
        paths.append((A, (mx, my), B_))
        s += f'<path d="M{f(A[0])},{f(A[1])} Q{f(mx)},{f(my)} {f(B_[0])},{f(B_[1])}" fill="none" stroke="{p["d3"]}" stroke-width="7" stroke-linecap="round" stroke-opacity=".5"/>'
        s += f'<path d="M{f(A[0])},{f(A[1])} Q{f(mx)},{f(my)} {f(B_[0])},{f(B_[1])}" fill="none" stroke="{p["ac"]}" stroke-width="2.4" stroke-linecap="round"/>'
    for A, M, B_ in paths:  # vehicles
        if r.random() < .5:
            t = .25 + r.random() * .5
            x = (1 - t) ** 2 * A[0] + 2 * (1 - t) * t * M[0] + t ** 2 * B_[0]; y = (1 - t) ** 2 * A[1] + 2 * (1 - t) * t * M[1] + t ** 2 * B_[1]
            s += f'<circle cx="{f(x)}" cy="{f(y)}" r="9" fill="{p["hi"]}"/><circle cx="{f(x)}" cy="{f(y)}" r="18" fill="{p["hi"]}" fill-opacity=".2"/>'
    for i, (x, y) in enumerate([n for row in nodes for n in row]):
        big = i % 4 == 0
        s += f'<circle cx="{f(x)}" cy="{f(y)}" r="{14 if big else 8}" fill="{p["bg"]}" stroke="{p["hi"]}" stroke-width="3.5"/>'
        if big: s += f'<circle cx="{f(x)}" cy="{f(y)}" r="28" fill="none" stroke="{p["hi"]}" stroke-opacity=".3" stroke-width="2"/>'
    return fade_in(s, 780, 1120)

def landscape(p, r):
    s = ""
    for cx, cy, sc in [(1360, 170, 1.0), (1780, 215, .78)]:
        for k in range(14):
            rad = 22 + k * 20 * sc; n = 40
            pts = [(cx + math.cos(a / n * 6.283) * rad * 1.7 * (1 + .14 * math.sin(a / n * 6.283 * 3 + k * .5) + .07 * math.cos(a / n * 6.283 * 5 - k)),
                    cy + math.sin(a / n * 6.283) * rad * .8 * (1 + .14 * math.sin(a / n * 6.283 * 3 + k * .5))) for a in range(n)]
            c = p["hi"] if k % 5 == 0 else p["d4"]
            s += f'<path d="{smooth(pts + [pts[0]])} Z" fill="{p["ac"] if k == 0 else "none"}" fill-opacity=".35" stroke="{c}" stroke-opacity="{f(.9 - k * .045)[:4]}" stroke-width="{3 if k % 5 == 0 else 1.8}"/>'
    for layer, (base_y, col, op, hmin, hmax) in enumerate([(350, p["d2"], 1, 40, 80), (378, p["d1"], 1, 50, 100)]):
        x = 760
        while x < W + 20:
            th = hmin + r.random() * (hmax - hmin); tw = th * .36
            for tier in range(3):
                ty = base_y - th * (.35 + tier * .3); ww = tw * (1 - tier * .28)
                s += f'<polygon points="{f(x)},{f(ty - th * .42)} {f(x - ww)},{f(ty)} {f(x + ww)},{f(ty)}" fill="{col}"/>'
            s += f'<rect x="{f(x - 2.5)}" y="{f(base_y - th * .1)}" width="5" height="{f(th * .12 + 40)}" fill="{col}"/>'
            x += 24 + r.random() * 26
    return fade_in(s, 780, 1120)

def markets(p, r):
    n, x0, step = 37, 800, 33.5
    price, cs = 280.0, []
    for i in range(n):
        o = price; price = max(60, min(340, price - 5.0 - (r.random() - .5) * 34)); cs.append((o, price, min(o, price) - 8 - r.random() * 18, max(o, price) + 8 + r.random() * 18))
    s = ""
    ma = [(x0 + i * step, sum(c[1] for c in cs[max(0, i - 5):i + 1]) / len(cs[max(0, i - 5):i + 1])) for i, c in enumerate(cs)]
    s += f'<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{p["ac"]}" stop-opacity=".4"/><stop offset="1" stop-color="{p["ac"]}" stop-opacity="0"/></linearGradient></defs>'
    s += f'<path d="{smooth(ma)} L{ma[-1][0]},{H} L{ma[0][0]},{H}Z" fill="url(#area)"/>'
    for i, (o, c, hi, lo) in enumerate(cs):
        x = x0 + i * step; up = c < o
        col = p["hi"] if up else p["d3"]
        s += f'<line x1="{x}" x2="{x}" y1="{f(hi)}" y2="{f(lo)}" stroke="{col}" stroke-width="2.4" stroke-opacity=".9"/>'
        s += f'<rect x="{x - 9}" y="{f(min(o, c))}" width="18" height="{f(max(5, abs(o - c)))}" rx="2.5" fill="{col}"/>'
    s += f'<path d="{smooth(ma)}" fill="none" stroke="{p["ac"]}" stroke-width="5" stroke-linecap="round"/>'
    s += f'<circle cx="{ma[-1][0]}" cy="{f(ma[-1][1])}" r="10" fill="{p["hi"]}"/>'
    return fade_in(s, 780, 1140)

def city(p, r):
    s = f'<rect x="{QUIET}" y="360" width="{W}" height="40" fill="{p["d1"]}"/>'
    def row(base_y, hmin, hmax, wmin, wmax, fill, op, lit):
        x, out = 760, ""
        while x < W + 20:
            w = wmin + r.random() * (wmax - wmin); h = hmin + r.random() * (hmax - hmin)
            out += f'<rect x="{f(x)}" y="{f(base_y - h)}" width="{f(w)}" height="{f(h)}" fill="{fill}" fill-opacity="{op}"/>'
            if r.random() < .25: out += f'<rect x="{f(x + w / 2 - 1.5)}" y="{f(base_y - h - 26)}" width="3" height="28" fill="{fill}" fill-opacity="{op}"/>'
            if lit:
                for ky in range(int((h - 14) // 17)):
                    for kx in range(int((w - 8) // 13)):
                        if r.random() < lit:
                            out += f'<rect x="{f(x + 6 + kx * 13)}" y="{f(base_y - h + 10 + ky * 17)}" width="6" height="9" rx="1" fill="{p["hi"] if r.random() < .6 else p["ac"]}" fill-opacity=".92"/>'
            x += w + 3 + r.random() * 5
        return out
    s += row(360, 90, 250, 38, 70, p["d1"], 1, 0) + row(360, 70, 210, 34, 62, p["d2"], 1, .18) + row(360, 40, 150, 30, 56, p["d3"], 1, .32)
    return fade_in(s, 780, 1120)

def water(p, r):
    s = ""
    for k, (y, amp, col, op) in enumerate([(210, 26, p["d2"], .9), (252, 22, p["d3"], .85), (296, 18, p["ac"], .8), (340, 14, p["d4"], .9)]):
        pts = [(x, y + amp * math.sin(x / (170 - k * 14) + k * 1.4)) for x in range(740, W + 60, 30)]
        s += f'<path d="{smooth(pts)} L{W + 60},{H} L740,{H}Z" fill="{col}" fill-opacity="{op}"/>'
        s += f'<path d="{smooth(pts)}" fill="none" stroke="{p["hi"]}" stroke-opacity=".5" stroke-width="2"/>'
    for cx, cy, sc in [(1560, 90, 1.0), (1790, 70, .7)]:
        s += "".join(f'<circle cx="{cx + dx * sc}" cy="{cy + dy * sc}" r="{rr * sc}" fill="{p["hi"]}" fill-opacity=".85"/>' for dx, dy, rr in [(-40, 6, 30), (0, -8, 40), (44, 4, 30)])
        s += f'<rect x="{cx - 70 * sc}" y="{cy + 6 * sc}" width="{140 * sc}" height="{28 * sc}" rx="{14 * sc}" fill="{p["hi"]}" fill-opacity=".85"/>'
    for i in range(26):
        x = 1470 + r.random() * 230; y = 150 + r.random() * 70
        s += f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x - 6)}" y2="{f(y + 18)}" stroke="{p["hi"]}" stroke-width="3" stroke-linecap="round" stroke-opacity=".8"/>'
    return fade_in(s, 780, 1100)

def learning(p, r):
    s = f'<line x1="820" x2="1500" y1="350" y2="350" stroke="{p["hi"]}" stroke-opacity=".4" stroke-width="2"/><line x1="826" x2="826" y1="40" y2="356" stroke="{p["hi"]}" stroke-opacity=".4" stroke-width="2"/>'
    for i in range(70):
        t = r.random(); x = 850 + t * 620; y = 320 - (t * .72 + .1 + (r.random() - .5) * .3) * 270
        s += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(5 + r.random() * 5)}" fill="{p["ac"] if r.random() < .6 else p["hi"]}" fill-opacity=".85"/>'
    s += f'<path d="M850,300 L1470,120" stroke="{p["hi"]}" stroke-width="5" stroke-linecap="round"/>'
    for i, wv in enumerate([.95, .84, .73, .6, .5, .38, .28]):
        s += f'<rect x="1600" y="{138 + i * 36}" width="{f(wv * 340)}" height="25" rx="6" fill="{p["ac"]}" fill-opacity="{f(1 - i * .1)[:4]}"/>'
    s += f'<path d="M1860,24 L1960,52 L1860,80 L1760,52Z" fill="{p["hi"]}"/><path d="M1790,66 L1790,98 Q1860,120 1930,98 L1930,66 L1860,86Z" fill="{p["hi"]}" fill-opacity=".7"/>'
    return fade_in(s, 780, 1100)

def globe(p, r):
    cx, cy, R = 1500, 205, 215
    s = f'<defs><clipPath id="gc"><circle cx="{cx}" cy="{cy}" r="{R}"/></clipPath></defs>'
    s += f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="{p["d1"]}" stroke="{p["hi"]}" stroke-opacity=".7" stroke-width="3"/>'
    s += f'<g clip-path="url(#gc)">'
    for _ in range(9):
        bx, by = cx + (r.random() - .5) * R * 1.7, cy + (r.random() - .5) * R * 1.5
        pts = [(bx + math.cos(a / 7 * 6.283) * (30 + r.random() * 50), by + math.sin(a / 7 * 6.283) * (22 + r.random() * 36)) for a in range(7)]
        s += f'<path d="{smooth(pts + [pts[0]])} Z" fill="{p["d3"]}" fill-opacity=".55"/>'
    for k in (-.66, -.33, 0, .33, .66): s += f'<ellipse cx="{cx}" cy="{f(cy + k * R)}" rx="{f(R * math.sqrt(1 - k * k))}" ry="12" fill="none" stroke="{p["hi"]}" stroke-opacity=".3" stroke-width="1.6"/>'
    for k in range(5): s += f'<ellipse cx="{cx}" cy="{cy}" rx="{f(R * abs(math.cos(k * math.pi / 5)))}" ry="{R}" fill="none" stroke="{p["hi"]}" stroke-opacity=".3" stroke-width="1.6"/>'
    s += "</g>"
    pins = [(cx - 120, cy - 40), (cx + 40, cy - 90), (cx + 120, cy + 30), (cx - 30, cy + 80), (1850, 120), (1930, 280)]
    for a, b in zip(pins, pins[1:] + [pins[0]]):
        s += f'<path d="M{a[0]},{a[1]} Q{f((a[0] + b[0]) / 2)},{f(min(a[1], b[1]) - 90)} {b[0]},{b[1]}" fill="none" stroke="{p["hi"]}" stroke-width="3" stroke-linecap="round" stroke-opacity=".9"/>'
    for x, y in pins: s += f'<circle cx="{x}" cy="{y}" r="9" fill="{p["ac"]}" stroke="{p["hi"]}" stroke-width="3"/><circle cx="{x}" cy="{y}" r="24" fill="none" stroke="{p["hi"]}" stroke-opacity=".35" stroke-width="2"/>'
    return fade_in(s, 780, 1100)


SCENE_FN = {"warming": warming, "energy": energy, "population": population, "transport": transport, "landscape": landscape,
            "markets": markets, "city": city, "water": water, "learning": learning, "globe": globe}
GLOW = {"warming": (1700, 110), "energy": (1500, 200), "population": (1400, 160), "transport": (1450, 200), "landscape": (1500, 170),
        "markets": (1700, 150), "city": (1500, 210), "water": (1560, 110), "learning": (1450, 180), "globe": (1500, 205)}


def svg(scene, color, seed):
    p = palette(color)
    r = random.Random(f"{scene}:{seed}")
    body = SCENE_FN[scene](p, r)
    return p, f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{base(p, GLOW[scene])}{body}</svg>'


def main():
    want = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [(slug, scene, color, slug) for slug, scene, color in CATEGORIES] + \
           [(f"scene-{sc}", sc, col, sc) for sc, col in SCENES.items()]
    jobs = [j for j in jobs if not want or j[0] in want or j[1] in want]
    from playwright.sync_api import sync_playwright
    palette_json = json.loads((ROOT / "lib" / "bannerPalette.json").read_text()) if (ROOT / "lib" / "bannerPalette.json").exists() else {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page(viewport={"width": W, "height": H})
        for name, scene, color, seed in jobs:
            p, markup = svg(scene, color, seed)
            pg.set_content(f'<html><body style="margin:0;background:{p["bg"]}">{markup}</body></html>')
            tmp = OUT / f"{name}.raw.png"
            pg.screenshot(path=str(tmp), clip={"x": 0, "y": 0, "width": W, "height": H})
            from PIL import Image
            im = Image.open(tmp).convert("RGB"); im.save(OUT / f"{name}.png", optimize=True); tmp.unlink()
            palette_json[name] = {"scene": scene, "bg": p["bg"], "bg2": p["bg2"], "ac": p["ac"], "hi": p["hi"]}
            print(f"{name:22} {(OUT / f'{name}.png').stat().st_size // 1024:>4} KB")
        b.close()
    (ROOT / "lib" / "bannerPalette.json").write_text(json.dumps(dict(sorted(palette_json.items())), indent=2) + "\n")


if __name__ == "__main__":
    main()
