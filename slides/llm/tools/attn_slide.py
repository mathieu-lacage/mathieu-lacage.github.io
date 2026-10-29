"""Turns data/attn-<name>.json (tools/attn_map.py) and the logit-lens data of the
same model and prompt (tools/lens2d.py) into the figure of « How France is
built » (written by hand in index.html). One SVG, written to themes/attn.svg and
included with an <object> (its script receives the steps):

- left, the heatmap: attention weight of the last token on each earlier token,
  one row per layer, layer 1 at the bottom, one block of thin columns per token,
  one column per head. The attention sink and the token itself are left out as
  in attn_map.py;
- right, the transformer stack of the logit-lens slide, its groups (layers with
  the same top-1 token, see deckslide.lens_groups) sitting on their own rows.
  A small gap splits the heatmap and the stack at every group boundary.

Keyboard steps: one per group. The slide carries one Marp fragment marker per
group (themes/attn.js, data-steps on its div, which must equal the number of
groups printed by this script) and posts the step to the script inside the
SVG, which shows the first groups: their stack blocks and heatmap rows.
Without bespoke (PDF) no step is posted and the SVG shows every group.

usage: python3 tools/attn_slide.py data/attn-Qwen3-1.7B.json data/Qwen3-1.7B.json
writes themes/attn.svg only; the deck is never touched.
"""
import json
import sys

from deckslide import lens_groups, word, write_svg

d = json.load(open(sys.argv[1]))
lens = json.load(open(sys.argv[2]))
if (d['model'], d['prompt']) != (lens['model'], lens['prompt']):
    sys.exit(f'{sys.argv[1]} and {sys.argv[2]}: not the same model and prompt')
nL, nH = d['n_layers'], d['n_heads']
toks_all = d['tokens']
keep = list(range(d.get('skip', 1), len(toks_all) - (0 if d.get('keep_self') else 1)))
toks = [toks_all[s] for s in keep]
reader = word(toks_all[-1].strip())             # the token that reads: « of »
A = d['attn']                                   # layer x head x position (all positions)
rows, groups = lens_groups(lens)
G = len(groups)
group_of = {}                                   # layer (1-based) -> group index
for g, lg in enumerate(groups):
    for r in rows[lg['a']:lg['b'] + 1]:
        group_of[r['layer']] = g
assert sorted(group_of) == list(range(1, nL + 1)), 'the lens data does not cover every layer'


def colour(v, lo=(0x18, 0x23, 0x3a), hi=(0xf5, 0xc4, 0x51)):
    """two-colour gradient: 0 = --cutebugs-panel, 1 = --cutebugs-red (yellow)"""
    return '#' + ''.join(f'{round(a + (b - a) * v):02x}' for a, b in zip(lo, hi))


# geometry (slide pixels): one block of nH columns per token, blocks separated by a gap
W, H = 1136, 450
HW, CH, GAP = 5.5, 13.5, 8          # head column width, row height, gap between token blocks
BG = 4                              # gap between two groups, heatmap and stack alike
BW = HW * nH                        # block width
GL, GT = 44, 4                      # grid origin
GW, GH = BW * len(toks) + GAP * (len(toks) - 1), CH * nL + BG * (G - 1)
WX, WW = GL + GW + 38, 340          # stack
BX = WX + WW + 80                   # colour bar


def row_y(layer):
    """top of a layer's row: layer 1 at the bottom, a gap at each group boundary"""
    return GT + (nL - layer) * CH + (G - 1 - group_of[layer]) * BG


def layer(k):
    return rows[k]['layer']


svg = []
# ---------- heatmap: empty panels (rows not shown yet), then one <g> per row ----------
for lg in groups:
    top, bottom = row_y(layer(lg['b'])), row_y(layer(lg['a'])) + CH
    for j in range(len(toks)):
        svg.append(f'<rect class="am-blank" x="{GL + j * (BW + GAP):.1f}" y="{top:.1f}" width="{BW:.1f}" height="{bottom - top:.1f}"/>')
for i in range(nL):
    y, g = row_y(i + 1), group_of[i + 1]
    svg.append(f'<text class="am-l am-lab am-g{g}" x="{GL - 8}" y="{y + CH - 3:.1f}" text-anchor="end">{i + 1}</text>')
    cells = []
    for j, s in enumerate(keep):
        x0 = GL + j * (BW + GAP)
        for h in range(nH):
            # slight overlap hides the antialiasing seams between thin columns
            cells.append(f'<rect x="{x0 + h * HW:.1f}" y="{y:.1f}" width="{HW + .3:.1f}" height="{CH + .3:.1f}" '
                         f'fill="{colour(A[i][h][s])}"/>')
    svg.append(f'<g class="am-row am-g{g}">{"".join(cells)}</g>')
# frame around the rows of the current group
for g, lg in enumerate(groups):
    top, bottom = row_y(layer(lg['b'])), row_y(layer(lg['a'])) + CH
    svg.append(f'<rect class="am-band am-g{g}" x="{GL - 3}" y="{top - 1.5:.1f}" width="{GW + 6:.1f}" '
               f'height="{bottom - top + 3:.1f}" rx="3"/>')
for j, t in enumerate(toks):
    svg.append(f'<text class="am-tok" x="{GL + j * (BW + GAP) + BW / 2:.1f}" y="{GT + GH + 26}" '
               f'text-anchor="middle">{word(t)}</text>')
svg.append(f'<text class="am-axis" transform="translate(12 {GT + GH / 2}) rotate(-90)" text-anchor="middle">layer</text>')

# ---------- stack: one block per group on its rows, x of « of » below ----------
for g, lg in enumerate(groups):
    la, lb = layer(lg['a']), layer(lg['b'])
    y, h = row_y(lb), (lb - la + 1) * CH
    # one font size for every block, small enough for a one-row block: label centred
    # on the row (the first row of a taller block), 4.6 = half the cap height of 13 px
    ty = y + min(h, 22) / 2 + 4.6
    rng = str(la) if la == lb else f'{la}–{lb}'
    # one tick per layer boundary inside the block
    seps = ''.join(f'<line x1="{WX + WW - 40}" x2="{WX + WW - 6}" y1="{row_y(k) + CH:.1f}" y2="{row_y(k) + CH:.1f}"/>'
                   for k in range(la + 1, lb + 1))
    cls = f' am-{lg["cls"]}' if lg['cls'] else ''
    svg.append(f'<g class="am-seg am-g{g}{" is-cur" if g == G - 1 else ""}">'
               f'<rect x="{WX}" y="{y:.1f}" width="{WW}" height="{h:.1f}" rx="3"/>{seps}'
               f'<text class="am-rng" x="{WX + 10}" y="{ty:.1f}">{rng}</text>'
               f'<text class="am-name{cls}" x="{WX + 66}" y="{ty:.1f}">{lg["name"]}</text></g>')
svg.append(f'<rect class="am-x" x="{WX}" y="{GT + GH + 5}" width="{WW}" height="10" rx="2"/>'
           f'<text class="am-lbl" x="{WX - 8}" y="{GT + GH + 15}" text-anchor="end">x</text>'
           f'<text class="am-lbl" x="{WX + WW + 8}" y="{GT + GH + 15}">« {reader} »</text>')

# ---------- colour bar ----------
svg.append(f'<defs><linearGradient id="am-grad" x1="0" y1="1" x2="0" y2="0">'
           f'<stop offset="0" stop-color="{colour(0)}"/><stop offset="1" stop-color="{colour(1)}"/></linearGradient></defs>')
svg.append(f'<rect x="{BX}" y="{GT}" width="14" height="{GH}" fill="url(#am-grad)"/>')
for v in (0, .5, 1):
    svg.append(f'<text class="am-l" x="{BX + 20}" y="{GT + GH - v * GH + 5:.1f}">{v * 100:.0f} %</text>')

# step s (0..G): the first s groups, the current one framed (none at the last step).
# The static file is the last step, as the PDF shows it.
svg.append('''<script><![CDATA[
(() => {
  const G = %d;
  function show(s) {
    for (let g = 0; g < G; g++) document.querySelectorAll(`.am-g${g}`).forEach((el) => {
      el.classList.toggle('is-off', g >= s);
      el.classList.toggle('is-cur', el.classList.contains('am-band') ? g === s - 1 && s < G : g === s - 1);
    });
  }
  window.addEventListener('message', (ev) => {
    if (ev.data && typeof ev.data.attn === 'number') show(Math.max(0, Math.min(G, ev.data.attn)));
  });
  if (window.parent !== window) window.parent.postMessage({ attnReady: true }, '*');
})();
]]></script>''' % G)

figure = write_svg('attn.svg', W, H, '''.am-l { fill: var(--cutebugs-slate); font-size: 12px; }
.am-tok { fill: var(--cutebugs-ink); font-size: 18px; }
.am-axis { fill: var(--cutebugs-slate); font-size: 16px; }
.am-lbl { fill: var(--cutebugs-slate); font-size: 15px; }
.am-blank { fill: var(--cutebugs-panel); }
.am-row, .am-seg, .am-lab, .am-band { transition: opacity .25s; }
.am-row.is-off, .am-seg.is-off { opacity: 0; }
.am-lab.is-off { opacity: .3; }
.am-band { fill: none; stroke: var(--cutebugs-red); stroke-width: 2; opacity: 0; }
.am-band.is-cur { opacity: 1; }
.am-seg rect { fill: var(--cutebugs-panel); stroke: var(--cutebugs-blue); stroke-width: 1; }
.am-seg.is-cur rect { stroke: var(--cutebugs-red); stroke-width: 2; }
.am-seg line { stroke: var(--cutebugs-dim); stroke-width: 1; }
.am-rng { fill: var(--cutebugs-slate); font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px; }
.am-name { fill: var(--cutebugs-ink); font-size: 13px; font-weight: 600; }
.am-name.am-fr { fill: var(--cutebugs-red); }
.am-name.am-noise { fill: var(--cutebugs-slate); font-weight: 400; font-style: italic; }
.am-x { fill: var(--cutebugs-blue); fill-opacity: .35; }
@media (prefers-reduced-motion: reduce) { .am-row, .am-seg, .am-lab, .am-band { transition: none; } }''', '\n'.join(svg))
print(f'wrote themes/attn.svg: {G} groups (deck: data-steps="{G}")')
print(figure)
