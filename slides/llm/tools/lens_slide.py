"""Turns the per-layer data of lens2d.py into the figure of the logit-lens slide
(« Layer by layer… », written by hand in index.html). One SVG, written to
themes/lens.svg and included with an <object> (an <img> would lose the hover):

- left, the plot: p(target) vs p(best other token), one point per layer, log axes;
- right, the transformer stack seen from the last position (« of »), bottom to
  top, with the unembedding (final norm, then W_U) on the newest block. The
  blocks are grouped by their top-1 token (the junk tokens of the first
  NOISE_UNTIL layers make one group), one segment per group with one dot per
  layer. Above W_U, two cards: the top-1 token on the left and the other one
  (France, or the runner-up once France leads) on the right, each linked to
  its W_U column, placed by token id. The cards show the last layer of the
  current group; hovering a point of the plot shows that layer instead.

Keyboard steps: one per group, no automatic play. The slide carries one Marp
fragment marker per group (themes/lens.js, data-steps on its div, which must
equal the number of groups printed by this script) and posts the step to the
script inside the SVG. Without bespoke (PDF) no step is posted and the SVG
shows its final state: every group, the cards of the last layer.

usage: python3 tools/lens_slide.py data/Qwen3-1.7B.json
writes themes/lens.svg only; the deck is never touched.
"""
import json
import math
import sys

from deckslide import lens_groups, word, write_svg

src = sys.argv[1]
d = json.load(open(src))
target = word(d['target'])
V = d['vocab']
# groups of consecutive layers with the same top-1 token
rows, lens = lens_groups(d)
groups = [[g['a'], g['b']] for g in lens]
G = len(groups)

# figure geometry (SVG user units = slide pixels)
W, H = 1136, 450
L, T, PW = 92, 14, 550              # plot frame: left, top, width
PH = H - T - 62                      # plot frame height: room for the x axis below
xs = [r['competitor_prob'] for r in rows]
ys = [r['target_prob'] for r in rows]
x0 = math.floor(math.log10(min(xs)))
y0 = math.floor(math.log10(min(ys)))
TOP = .35  # headroom above p = 1, in decades, so points at p ≈ 1 stay inside the frame

# right panel: W_U and the stack share their left edge and width
WX, WW = 730, 340                    # W_U and stack
WH = 40                              # W_U height
BASE = H - 8                         # bottom of the x bar
SEG0, SEGK, GAP = 21, 3.5, 4           # segment height: SEG0 + SEGK per extra layer
CW, CH = 165, 64                     # card size
CGAP = 22                            # cards bottom to W_U top
LANES = (15, 8)                      # leader lines: horizontal run above W_U, left card / right card


def px(p):
    return L + (math.log10(p) - x0) / (TOP - x0) * PW


def py(p):
    return T + PH - (math.log10(p) - y0) / (TOP - y0) * PH


def colour(k, n, lo=(0x4a, 0xa8, 0xff), hi=(0xf5, 0xc4, 0x51)):
    """two-colour gradient: early layers blue (--cutebugs-blue), late layers yellow (--cutebugs-red)"""
    t = k / (n - 1)
    return '#' + ''.join(f'{round(a + (b - a) * t):02x}' for a, b in zip(lo, hi))


def tick(e):
    return '1' if e == 0 else f'10<tspan baseline-shift="super" font-size="13">{e}</tspan>'


def fmt_p(p):
    if p >= .01:
        return f'{p * 100:.1f} %'
    if p >= 1e-4:
        return f'{p * 100:.2f} %'
    m, e = f'{p:.1e}'.split('e')
    return f'{m}·10<tspan baseline-shift="super" font-size="11">{int(e)}</tspan>'


def rank(k):
    return f'{k:,}'.replace(',', ' ')


def colx(token_id):
    return WX + 2 + token_id / V * (WW - 4)


svg = []
# ---------- plot ----------
lo = max(x0, y0)
diag = [(px(10 ** lo), py(10 ** lo)), (px(10 ** TOP), py(10 ** TOP))]
svg.append(f'<clipPath id="lp-clip"><rect x="{L}" y="{T}" width="{PW}" height="{PH}"/></clipPath>')
svg.append(f'<polygon class="lp-win" clip-path="url(#lp-clip)" points="{L},{T} {L + PW},{T} '
           f'{diag[1][0]:.1f},{diag[1][1]:.1f} {diag[0][0]:.1f},{diag[0][1]:.1f} {L},{diag[0][1]:.1f}"/>')
for e in range(x0, 1):
    x = px(10 ** e)
    svg.append(f'<line class="lp-grid" x1="{x:.1f}" y1="{T}" x2="{x:.1f}" y2="{T + PH}"/>')
    svg.append(f'<text class="lp-tick" x="{x:.1f}" y="{T + PH + 26}" text-anchor="middle">{tick(e)}</text>')
for e in range(y0, 1):
    y = py(10 ** e)
    svg.append(f'<line class="lp-grid" x1="{L}" y1="{y:.1f}" x2="{L + PW}" y2="{y:.1f}"/>')
    svg.append(f'<text class="lp-tick" x="{L - 10}" y="{y + 6:.1f}" text-anchor="end">{tick(e)}</text>')
# minor ticks at 2..9 × 10^e on both axes: the uneven spacing shows the log scale
for e in range(x0, 1):
    for m in range(2, 10):
        if m * 10 ** e < 10 ** TOP:
            x = px(m * 10 ** e)
            svg.append(f'<line class="lp-minor" x1="{x:.1f}" y1="{T + PH}" x2="{x:.1f}" y2="{T + PH - 6}"/>')
for e in range(y0, 1):
    for m in range(2, 10):
        if m * 10 ** e < 10 ** TOP:
            y = py(m * 10 ** e)
            svg.append(f'<line class="lp-minor" x1="{L}" y1="{y:.1f}" x2="{L + 6}" y2="{y:.1f}"/>')
svg.append(f'<rect class="lp-frame" x="{L}" y="{T}" width="{PW}" height="{PH}"/>')
svg.append(f'<line class="lp-diag" x1="{diag[0][0]:.1f}" y1="{diag[0][1]:.1f}" x2="{diag[1][0]:.1f}" y2="{diag[1][1]:.1f}"/>')
svg.append(f'<text class="lp-wins" x="{L + 14}" y="{T + 44}">{target} wins</text>')
svg.append(f'<text class="lp-axis" x="{L + PW / 2}" y="{H - 8}" text-anchor="middle">probability of the best other token</text>')
svg.append(f'<text class="lp-axis" transform="translate(20 {T + PH / 2}) rotate(-90)" text-anchor="middle">probability of {target}</text>')
# path, one segment per layer, then points (later layers on top)
pts = [(px(x), py(y)) for x, y in zip(xs, ys)]
for k, ((a, b), (c, e)) in enumerate(zip(pts, pts[1:]), start=1):
    svg.append(f'<line class="lp-path lp-s{k}" x1="{a:.1f}" y1="{b:.1f}" x2="{c:.1f}" y2="{e:.1f}"/>')
n = len(rows)
# crowded points (layers 22-26 all sit at p ≈ 1): only the latest one keeps its label,
# for each step, since a label hidden at the end may be the latest one at an earlier step


def labelled_points(upto):
    keep, kept = set(), []
    for k in reversed(range(upto)):
        a, b = pts[k]
        if all(abs(a - c) > 26 or abs(b - e) > 16 for c, e in kept):
            kept.append((a, b))
            keep.add(k)
    return keep


final_labels = labelled_points(n)
for k, (r, (a, b)) in enumerate(zip(rows, pts)):
    label = f'<text x="{a + 9:.1f}" y="{b + 5:.1f}"{"" if k in final_labels else " class=\"is-off\""}>{r["layer"]}</text>'
    svg.append(f'<g class="lp-pt lp-p{k}{" is-cur" if k == n - 1 else ""}" style="--c:{colour(k, n)}">'
               f'<circle class="lp-hit" cx="{a:.1f}" cy="{b:.1f}" r="13"/>'
               f'<circle cx="{a:.1f}" cy="{b:.1f}" r="6"/>{label}</g>')

# ---------- stack: x of « of », then one segment per group, bottom-up ----------
svg.append(f'<rect class="lp-x" x="{WX}" y="{BASE - 12}" width="{WW}" height="12" rx="2"/>')
svg.append(f'<text class="lp-lbl" x="{WX - 8}" y="{BASE - 1}" text-anchor="end">x</text>')
svg.append(f'<text class="lp-lbl" x="{WX + WW + 8}" y="{BASE - 1}">« of »</text>')
tops = [BASE - 16]                      # top of the stack after each step, step 0 = x alone
y = BASE - 18
seg_svg = []
for g, ((a, b), lg) in enumerate(zip(groups, lens)):
    m = b - a + 1
    h = SEG0 + SEGK * (m - 1)
    y -= h
    la, lb = rows[a]['layer'], rows[b]['layer']
    name, cls = lg['name'], ' lp-' + lg['cls'] if lg['cls'] else ''
    rng = str(la) if la == lb else f'{la}–{lb}'
    ty = y + min(h, SEG0) / 2 + 5.5
    step = min(5, (h - 8) / m)
    dots = ''.join(f'<circle cx="{WX + WW - 12}" cy="{y + h / 2 + (k - (m - 1) / 2) * step:.1f}" r="1.6"/>'
                   for k in range(m))
    seg_svg.append(f'<g class="lp-seg lp-g{g}{" is-cur" if g == G - 1 else ""}">'
                   f'<rect x="{WX}" y="{y:.1f}" width="{WW}" height="{h}" rx="3"/>'
                   f'<text class="lp-rng" x="{WX + 10}" y="{ty:.1f}">{rng}</text>'
                   f'<text class="lp-name{cls}" x="{WX + 66}" y="{ty:.1f}">{name}</text>{dots}</g>')
    tops.append(y)
    y -= GAP
svg.append(f'<line class="lp-stream" id="lp-stream" x1="{WX + WW - 30}" x2="{WX + WW - 30}" y1="{BASE - 12}" y2="{tops[-1]:.1f}"/>')
svg += seg_svg
# W_U sits on the newest group: its top for each step
wu_tops = [t - 12 - WH for t in tops]

# ---------- head: W_U, then per layer its two columns, leader lines and cards ----------
# drawn at W_U top = 0 and moved as a whole for each step
head = [f'<rect class="lp-wu" x="{WX}" y="0" width="{WW}" height="{WH}"/>',
        f'<text class="lp-ink" x="{WX - 8}" y="26" text-anchor="end">W<tspan baseline-shift="sub" font-size="12">U</tspan></text>',
        f'<text class="lp-lbl" x="{WX + WW + 8}" y="16">final</text>',
        f'<text class="lp-lbl" x="{WX + WW + 8}" y="33">norm</text>']
cy = -CGAP - CH
for k, r in enumerate(rows):
    fr = r['target_rank'] == 1
    fr_card = (target, r['target_id'], r['target_prob'], 'TOP-1' if fr else f'RANK {rank(r["target_rank"])}', 'fr')
    ot_card = (word(r['competitor']), r['competitor_id'], r['competitor_prob'], 'RUNNER-UP' if fr else 'TOP-1', 'ot')
    # by probability: the top-1 token on the left, the other one on the right
    left, right = (fr_card, ot_card) if fr else (ot_card, fr_card)
    parts = []
    for (tok, tid, p, badge, cls), x, lane in ((left, WX, LANES[0]), (right, WX + WW - CW, LANES[1])):
        cx, col = x + CW / 2, colx(tid)
        parts.append(f'<rect class="lp-col lp-{cls}" x="{col - 2:.1f}" y="-3" width="4" height="{WH + 6}"/>'
                     f'<path class="lp-lead lp-{cls}" d="M{cx:.1f},{cy + CH} V{-lane} H{col:.1f} V-2"/>'
                     f'<g class="lp-card lp-{cls}{" lp-lead1" if badge == "TOP-1" else ""}" transform="translate({x} {cy})">'
                     f'<rect width="{CW}" height="{CH}" rx="6"/>'
                     f'<text class="lp-badge" x="10" y="16">{badge}</text>'
                     f'<text class="lp-tok" x="10" y="38">{tok}</text>'
                     f'<text class="lp-num" x="10" y="56">p = {fmt_p(p)}</text></g>')
    head.append(f'<g class="lp-ov lp-o{k}{" is-cur" if k == n - 1 else ""}">{"".join(parts)}</g>')
svg.append(f'<g class="lp-head" transform="translate(0 {wu_tops[-1]:.1f})">{"".join(head)}</g>')

svg_css = '''.lp-win { fill: var(--cutebugs-green); fill-opacity: .2; }
.lp-grid { stroke: var(--cutebugs-dim); stroke-width: 1; stroke-opacity: .5; }
.lp-frame { fill: none; stroke: var(--cutebugs-dim); stroke-width: 1.5; }
.lp-diag { stroke: var(--cutebugs-green); stroke-width: 2; stroke-dasharray: 8 6; }
.lp-wins { fill: var(--cutebugs-green); font-size: 20px; font-weight: 600; }
.lp-minor { stroke: var(--cutebugs-slate); stroke-width: 1; }
.lp-tick { fill: var(--cutebugs-slate); font-size: 17px; }
.lp-axis { fill: var(--cutebugs-ink); font-size: 19px; }
.lp-path { fill: none; stroke: var(--cutebugs-slate); stroke-opacity: .6; stroke-width: 1.5; }
.is-off { display: none; }
.lp-pt { cursor: default; }
.lp-pt circle { fill: var(--c); stroke: #0f1829; stroke-width: 1.5; }
.lp-pt circle.lp-hit { fill: transparent; stroke: none; }
.lp-pt.is-cur circle:not(.lp-hit) { stroke: var(--cutebugs-ink); stroke-width: 3; }
.lp-pt text { fill: var(--c); font-size: 14px; font-weight: 600; paint-order: stroke; stroke: #0f1829; stroke-width: 4px; }
.lp-lbl { fill: var(--cutebugs-slate); font-size: 15px; }
.lp-ink { fill: var(--cutebugs-ink); font-size: 19px; }
.lp-x { fill: var(--cutebugs-blue); fill-opacity: .35; }
.lp-stream { stroke: var(--cutebugs-ink); stroke-opacity: .5; stroke-width: 2; }
.lp-seg rect { fill: var(--cutebugs-panel); stroke: var(--cutebugs-blue); stroke-width: 1; }
.lp-seg.is-cur rect { stroke: var(--cutebugs-red); stroke-width: 2; }
.lp-seg circle { fill: var(--cutebugs-blue); }
.lp-rng { fill: var(--cutebugs-slate); font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 13px; }
.lp-name { fill: var(--cutebugs-ink); font-size: 16px; font-weight: 600; }
.lp-name.lp-fr { fill: var(--cutebugs-red); }
.lp-name.lp-noise { fill: var(--cutebugs-slate); font-weight: 400; font-style: italic; }
.lp-wu { fill: url(#lp-wu-tex); stroke: var(--cutebugs-blue); stroke-width: 1.5; }
.lp-ov { display: none; }
.lp-ov.is-cur { display: inline; }
.lp-col.lp-fr { fill: var(--cutebugs-red); }
.lp-col.lp-ot { fill: var(--cutebugs-cyan); }
.lp-lead { fill: none; stroke-width: 1.5; }
.lp-lead.lp-fr { stroke: var(--cutebugs-red); }
.lp-lead.lp-ot { stroke: var(--cutebugs-cyan); }
.lp-card rect { fill: var(--cutebugs-panel); stroke-width: 1.5; }
.lp-card.lp-lead1 rect { stroke-width: 3; }
.lp-card.lp-fr rect { stroke: var(--cutebugs-red); }
.lp-card.lp-ot rect { stroke: var(--cutebugs-cyan); }
.lp-card.lp-fr .lp-badge, .lp-card.lp-fr .lp-tok { fill: var(--cutebugs-red); }
.lp-card.lp-ot .lp-badge, .lp-card.lp-ot .lp-tok { fill: var(--cutebugs-cyan); }
.lp-badge { font-size: 11px; font-weight: 600; letter-spacing: .08em; }
.lp-tok { font-size: 20px; font-weight: 600; }
.lp-num { fill: var(--cutebugs-ink); font-size: 14px; font-variant-numeric: tabular-nums; }
'''
# W_U texture: one faint line every 6 px, the vocabulary rows seen edge-on
defs = ('<defs><pattern id="lp-wu-tex" width="6" height="40" patternUnits="userSpaceOnUse">'
        '<rect width="6" height="40" fill="#18233a"/><rect width="1" height="40" fill="#3d4a63"/></pattern></defs>')
# step s (0..G): the first s groups, their points, W_U on the newest one, the cards of
# its last layer. Hovering a shown point shows that layer's cards until the next step.
svg.append('''<script><![CDATA[
(() => {
  const LAST = %s, WU = %s, TOPS = %s, LABELS = %s, N = %d;
  const $ = (s) => document.querySelector(s);
  const head = $('.lp-head');
  function cards(k) {
    for (let j = 0; j < N; j++) $(`.lp-o${j}`).classList.toggle('is-cur', j === k);
    for (let j = 0; j < N; j++) $(`.lp-p${j}`).classList.toggle('is-cur', j === k);
  }
  function show(s) {
    const last = s ? LAST[s - 1] : -1;
    for (let j = 0; j < N; j++) {
      $(`.lp-p${j}`).classList.toggle('is-off', j > last);
      if (j) $(`.lp-s${j}`).classList.toggle('is-off', j > last);
    }
    LAST.forEach((_, g) => {
      $(`.lp-g${g}`).classList.toggle('is-off', g >= s);
      $(`.lp-g${g}`).classList.toggle('is-cur', g === s - 1);
    });
    for (let j = 0; j < N; j++) $(`.lp-p${j} text`).classList.toggle('is-off', !LABELS[s].includes(j));
    $('#lp-stream').setAttribute('y2', TOPS[s]);
    head.setAttribute('transform', `translate(0 ${WU[s]})`);
    cards(last);
  }
  for (let j = 0; j < N; j++) $(`.lp-p${j}`).addEventListener('mouseenter', () => cards(j));
  window.addEventListener('message', (ev) => {
    if (ev.data && typeof ev.data.lens === 'number') show(Math.max(0, Math.min(LAST.length, ev.data.lens)));
  });
  if (window.parent !== window) window.parent.postMessage({ lensReady: true }, '*');
})();
]]></script>''' % (json.dumps([b for a, b in groups]), json.dumps([round(t, 1) for t in wu_tops]),
       json.dumps([round(t, 1) for t in tops]), json.dumps([sorted(labelled_points(b + 1)) for b in [-1] + [b for a, b in groups]]), n))
write_svg('lens.svg', W, H, svg_css, defs + '\n' + '\n'.join(svg))
print(f'wrote themes/lens.svg: {G} groups (deck: data-steps="{G}")')
for g in lens:
    print(f'  layers {rows[g["a"]]["layer"]}-{rows[g["b"]]["layer"]}: {g["name"]}')
