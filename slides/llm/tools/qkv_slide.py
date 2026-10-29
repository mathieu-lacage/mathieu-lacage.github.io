"""Turns data/qkv-<name>.json (tools/qkv_map.py) into the figure of the
« Self-Attention Intuitively » slide (written by hand in index.html): one column
x per token, from which a query (last token only), a key and a value grow;
arcs from every token to the last one, as thick as the attention weight; the
values travel along the arcs, add up into a sum that is written back into x
of the last token.

What is real and what is a cartoon: the x strips (a sample of the numbers),
the arc weights (the attention sink, the first token, left out and the
others renormalized) and the word under each value (its top unembedded
token) are real. The bright peaks on q, k and v are made up, so that a
matching key is easy to see: it peaks where q does.

Animation: the slide carries one Marp fragment marker per step (themes/qkv.js,
data-steps on its div = STEPS) and posts the step to the script inside the
SVG. Moving forward one step plays its animation; any other move just shows
the step. Without bespoke (PDF) no step is posted and the SVG shows the final
state.

usage: python3 tools/qkv_slide.py data/qkv-Qwen3-1.7B.json
writes themes/qkv.svg only; the deck is never touched.
"""
import html
import json
import math
import sys

from deckslide import write_svg

src = sys.argv[1]
d = json.load(open(src))
toks = d['tokens']
N = len(toks)
Q = N - 1                       # the reading token
STEPS = 6                       # deck: data-steps = STEPS, and STEPS + 1 captions

# weights on the arcs: the sink (first token) left out, the others renormalized
raw = d['weight']
w = [0.0] + [a / sum(raw[1:]) for a in raw[1:]]

# the word under each value: its first unembedded token that is a whole word
SKIP = {'Freem'}                # word pieces that look like words


def label(top):
    words = [t.strip() for t in top if t.startswith(' ') and t.strip().isalpha() and len(t.strip()) >= 4]
    for k, t in enumerate(words):
        if t not in SKIP and not any(u != t and u.startswith(t) for u in words[k + 1:]):
            return t
    return '·'


vword = [label(t) for t in d['value_top']]
vword[0] = '·'                  # the sink's value is tiny: nothing to read
sword = label(d['sum_top'])

# the cartoon: peaks as fractions of a column's height
QB = [.16, .46, .78]
KB = [[.3, .62], [.16, .46, .92], [.3, .62], [.16, .46, .78], [.05, .62], [.3, .92], [.78, .3], [.05, .9]]
VB = [[.5], [.2, .66], [.36, .9], [.1, .4, .55], [.26, .8], [.62, .95], [.3, .72], [.05, .5]]
assert len(KB) == len(VB) == N

# geometry, in slide pixels; the SVG shows the region OX..OX+W, OY..OY+H of the slide
OX, OY, W, H = 72, 136, 1136, 452
XT, XH, KT, KH, VT = 340, 214, 346, 72, 476       # x strip, q/k and v columns: tops and heights
SW, XW = 18, 14                                   # column and x strip widths
BASE = 302                                        # foot of the arcs, above the words
X7 = 330 + 118 * Q
ZX = X7 + SW + 8                                  # the sum, right of the last value


def cx(i):
    return 330 + 118 * i


PAL = {'Q': ((10, 28, 52), (214, 236, 255)), 'K': ((36, 14, 40), (255, 214, 248)), 'V': ((12, 36, 22), (222, 255, 210))}
ROLE = {'Q': 'var(--cutebugs-blue)', 'K': 'var(--cutebugs-magenta)', 'V': 'var(--cutebugs-green)'}
GOLD = 'var(--cutebugs-red)'
defs, grads = [], {}


def peaks(role, bands, ops=None):
    """a vertical gradient, dark except for bright peaks at bands (each as bright as its op)"""
    key = (role, tuple(bands), tuple(ops or ()))
    if key not in grads:
        gid = f'qk-g{len(grads)}'
        (a, b), hw, stops = PAL[role], .11, []
        for s in range(61):
            y = s / 60
            v = max([(ops[k] if ops else 1) * (.5 + .5 * math.cos(math.pi * abs(y - f) / hw))
                     for k, f in enumerate(bands) if abs(y - f) < hw] or [0])
            c = ''.join(f'{round(p + (q - p) * v):02x}' for p, q in zip(a, b))
            stops.append(f'<stop offset="{y:.3f}" stop-color="#{c}"/>')
        defs.append(f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">{"".join(stops)}</linearGradient>')
        grads[key] = gid
    return grads[key]


def col(x, y, role, bands, ops=None, outline=None):
    return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{SW}" height="{KH}" rx="2" fill="url(#{peaks(role, bands, ops)})" '
            f'stroke="{outline or ROLE[role]}" stroke-width="2"/>')


def heat(v, m):
    """a strip cell: dark at 0, yellow (positive) or blue (negative) at the largest magnitude"""
    t = min(1, abs(v) / m) ** .7
    b, c = (24, 35, 58), ((245, 196, 81) if v >= 0 else (74, 168, 255))
    return '#' + ''.join(f'{round(p + (q - p) * t):02x}' for p, q in zip(b, c))


def strip(x, vals, written=False):
    m, ch = max(abs(v) for v in vals), XH / len(vals)
    cells = ''.join(f'<rect x="{x}" y="{XT + k * ch:.2f}" width="{XW}" height="{ch + .4:.2f}" fill="{heat(v, m)}"/>'
                    for k, v in enumerate(vals))
    return cells + f'<rect class="qk-xo{" qk-written" if written else ""}" x="{x}" y="{XT}" width="{XW}" height="{XH}" fill="none"/>'


def word(t):
    return html.escape(t.strip())


def grow(cls, role, i, fx, fy, body):
    """a q/k/v column that grows out of x of token i; its link (a faint arrow from x) is drawn after"""
    x0 = cx(i) - 44 + XW
    if fx - x0 > 40:                                   # the key of the last token sits behind its query
        mid = fx + SW / 2
        link = (f'<path d="M {x0} {fy + KH + 8} H {mid} V {fy + KH + 2}"/>'
                f'<path class="qk-tip" d="M {mid - 4} {fy + KH + 7} L {mid} {fy + KH + 1} L {mid + 4} {fy + KH + 7}"/>')
    else:
        my = fy + KH / 2
        link = (f'<path d="M {x0} {my} H {fx - 2}"/>'
                f'<path class="qk-tip" d="M {fx - 7} {my - 4} L {fx - 1} {my} L {fx - 7} {my + 4}"/>')
    return (f'<g class="qk-link" data-role="{role}" stroke="{ROLE[role]}">{link}</g>'
            f'<g class="{cls} qk-grow" data-role="{role}" data-fx="{fx}" data-fy="{fy}" data-sx="{cx(i) - 44}">{body}</g>')


svg = []
# legend
svg.append(f'<text class="qk-lab qk-lq" x="248" y="372" style="fill: {ROLE["Q"]}">q: is it a city?</text>')
svg.append(f'<text class="qk-lab qk-lk" x="248" y="396" style="fill: {ROLE["K"]}">k: cityness</text>')
svg.append(f'<text class="qk-lab qk-lv" x="248" y="514" style="fill: {ROLE["V"]}">v: what it offers</text>')

# one group per token: word, x, q/k/v, the copy of q that comes to compare with k
for i, t in enumerate(toks):
    x = cx(i)
    g = [f'<text class="qk-word{" qk-reader" if i == Q else ""}" x="{x}" y="326">{word(t)}</text>',
         strip(x - 44, d['x'][i], written=i == Q)]       # final state: the sum is written into x of the reader
    if i == Q:
        g.append(grow('qk-q', 'Q', i, x, KT, col(x, KT, 'Q', QB)))
        g.append(grow('qk-k', 'K', i, x + SW + 6, KT, col(x + SW + 6, KT, 'K', KB[i])))
    else:
        g.append(grow('qk-k', 'K', i, x, KT, col(x, KT, 'K', KB[i])))
    g.append(grow('qk-v', 'V', i, x, VT, col(x, VT, 'V', VB[i])))
    g.append(f'<text class="qk-vw" x="{x + SW / 2}" y="{VT + KH + 18}">{word(vword[i])}</text>')
    if 0 < i < Q:
        gx = x + SW + 6
        ticks = ''.join(f'<line x1="{x + SW}" y1="{KT + f * KH:.1f}" x2="{gx}" y2="{KT + f * KH:.1f}"/>'
                        for f in KB[i] if f in QB)
        g.append(f'<g class="qk-ghost" data-dx="{X7 - x}">{col(gx, KT, "Q", QB)}<g class="qk-tick">{ticks}</g></g>')
    svg.append(f'<g class="qk-tok{" qk-sink" if i == 0 else ""}">{"".join(g)}</g>')

# arcs, from every token but the sink to the reader, then the reader onto itself
arcs = []
for j in range(1, Q):
    x1, x2 = cx(j), X7 - 30 + j * 7
    apex = 18 + (x2 - x1) * .17
    arcs.append((j, f'M {x1} {BASE} Q {(x1 + x2) / 2} {BASE - 2 * apex:.1f} {x2} {BASE}'))
    if w[j] >= .04:
        svg.append(f'<text class="qk-pct" x="{(x1 + x2) / 2}" y="{BASE - apex - 10 - 13 * w[j]:.1f}">{round(w[j] * 100)} %</text>')
arcs.append((Q, f'M {X7 + 2} {BASE} C {X7 - 14} {BASE - 56}, {X7 + 62} {BASE - 56}, {X7 + 18} {BASE + 1}'))
for j, path in arcs:
    svg.append(f'<path class="qk-arc" id="qk-arc{j}" d="{path}" stroke-width="{2 + 26 * w[j]:.1f}"/>')

# the sum: every value's peaks, as bright as its weight
sb = [f for j in range(1, N) for f in VB[j]]
so = [w[j] for j in range(1, N) for f in VB[j]]
svg.append(f'<g class="qk-sum">{col(ZX, VT, "V", sb, so, GOLD)}'
           f'<text class="qk-sl" x="{ZX + SW / 2}" y="{VT - 8}">sum</text>'
           f'<text class="qk-sl" x="{ZX + SW}" y="{VT + KH + 34}" style="text-anchor: end">{word(sword)}</text></g>')

# moving copies, centred on (0, 0): the values on their way, the sum on its way into x
for j in range(1, N):
    svg.append(f'<g class="qk-mover" id="qk-m{j}">{col(-SW / 2, -KH / 2, "V", VB[j])}</g>')
svg.append(f'<g class="qk-mover" id="qk-wr">{col(-SW / 2, -KH / 2, "V", sb, so, GOLD)}</g>')

svg_css = '''.qk-lab { font-size: 19px; text-anchor: end; transition: opacity .35s; }
.qk-word { fill: var(--cutebugs-ink); font-size: 21px; text-anchor: middle; }
.qk-word.qk-reader { fill: var(--cutebugs-red); font-weight: 600; }
.qk-sink { opacity: .35; }
.qk-xo { stroke: var(--cutebugs-dim); stroke-width: 1; }
.qk-xo.qk-written { stroke: var(--cutebugs-red); stroke-width: 2.5; }
.qk-vw { fill: var(--cutebugs-green); font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-anchor: middle; transition: opacity .35s; }
.qk-link { fill: none; stroke-width: 1.5; stroke-opacity: .5; transition: opacity .3s; }
.qk-link .qk-tip { stroke-opacity: .8; }
.qk-tick { stroke: var(--cutebugs-red); stroke-width: 3; }
.qk-arc { fill: none; stroke: var(--cutebugs-red); stroke-linecap: round; opacity: .35; }
.qk-pct { fill: var(--cutebugs-red); font-family: 'IBM Plex Mono', monospace; font-size: 18px; text-anchor: middle; transition: opacity .35s; }
.qk-sl { fill: var(--cutebugs-red); font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-anchor: middle; }
.qk-mover { opacity: 0; }
.is-off { opacity: 0 !important; }
'''

# the step machine; without a step posted (PDF), the final state above stays
script = '''<script><![CDATA[
(() => {
  const W = %(w)s, Q = %(q)d, STEPS = %(steps)d;
  const XT = %(xt)d, XH = %(xh)d, KH = %(kh)d, VT = %(vt)d, SW = %(sw)d, XW = %(xw)d, X7 = %(x7)d, ZX = %(zx)d;
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const off = (e, on) => e.classList.toggle('is-off', !on);
  const ease = (u) => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const span = (t, s, e) => Math.max(0, Math.min(1, (t - s) / (e - s)));
  let raf = 0;
  function play(ms, fn, linear) {
    cancelAnimationFrame(raf);
    if (reduce) return fn(1);
    const t0 = performance.now();
    const tick = (now) => { const t = Math.min(1, (now - t0) / ms); fn(linear ? t : ease(t)); if (t < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }

  // q, k, v grow out of x: from the x strip's box to their own
  const grows = { Q: $$('.qk-grow[data-role=Q]'), K: $$('.qk-grow[data-role=K]'), V: $$('.qk-grow[data-role=V]') };
  const links = (r) => $$(`.qk-link[data-role=${r}]`);
  function growAt(r, u) {
    for (const g of grows[r]) {
      const fx = +g.dataset.fx, fy = +g.dataset.fy, sx = +g.dataset.sx;
      const kx = (XW + (SW - XW) * u) / SW, ky = (XH + (KH - XH) * u) / KH;
      const X = sx + (fx - sx) * u, Y = XT + (fy - XT) * u;
      g.setAttribute('transform', u >= 1 ? '' : `translate(${X - fx * kx} ${Y - fy * ky}) scale(${kx} ${ky})`);
      g.style.opacity = Math.min(1, u * 3);
    }
  }
  function growIn(r) {
    links(r).forEach((l) => off(l, false));
    play(1000, (u) => { growAt(r, u); if (u >= 1) links(r).forEach((l) => off(l, true)); });
  }

  // arcs drawn with a dash that shrinks
  const arcs = $$('.qk-arc').map((p) => ({ p, j: +p.id.slice(6), len: p.getTotalLength() }));
  function drawArcs(on, animate, dim) {
    arcs.forEach(({ p, len }, k) => {
      p.style.strokeDasharray = len;
      p.style.transition = animate && !reduce ? `stroke-dashoffset .9s ease ${k * .08}s, opacity .3s` : 'opacity .3s';
      p.style.strokeDashoffset = on ? 0 : len;
      p.style.opacity = dim ? .35 : .9;
    });
  }

  // the copies of q slide in from the reader to sit next to each key
  function ghosts(on, animate) {
    for (const g of $$('.qk-ghost')) {
      g.style.transition = 'none';
      if (on && animate && !reduce) {
        g.style.transform = `translateX(${g.dataset.dx}px)`;
        g.getBoundingClientRect();
        g.style.transition = 'opacity .3s, transform .8s ease';
      }
      off(g, on);
      g.style.transform = 'translateX(0)';
    }
  }

  // values: rise from their column to the foot of their arc, follow it, then gather into the sum
  const movers = arcs.map((a) => ({ ...a, g: $(`#qk-m${a.j}`) }));
  const home = (j) => [330 + 118 * j + SW / 2, VT + KH / 2];
  const sumAt = [ZX + SW / 2, VT + KH / 2];
  const put = (g, x, y, o, s = 1) => { g.setAttribute('transform', `translate(${x} ${y}) scale(${s})`); g.style.opacity = o; };
  const fadeTo = (j) => .2 + .8 * W[j];
  const carry = (t) => movers.forEach((m) => {
    const [hx, hy] = home(m.j), a = Math.min(1, t / .3), b = Math.max(0, (t - .3) / .7);
    if (b === 0) { const s = m.p.getPointAtLength(0); put(m.g, hx + (s.x - hx) * a, hy + (s.y - hy) * a, 1, 1 - .4 * a); }
    else { const pt = m.p.getPointAtLength(m.len * b); put(m.g, pt.x, pt.y, 1 + (fadeTo(m.j) - 1) * b, .6); }
  });
  // the light payloads arrive first, the heaviest last and slowest
  const order = movers.slice().sort((a, b) => W[a.j] - W[b.j]);
  const win = new Map(order.map((m, k) => [m, k === order.length - 1 ? [.5, 1] : [k * .06, k * .06 + .3]]));
  const sum = $('.qk-sum');
  const gather = (t) => {
    movers.forEach((m) => {
      const [s, e] = win.get(m), u = ease(span(t, s, e)), ep = m.p.getPointAtLength(m.len);
      put(m.g, ep.x + (sumAt[0] - ep.x) * u, ep.y + (sumAt[1] - ep.y) * u, u >= 1 ? 0 : fadeTo(m.j), .6 + .4 * u);
    });
    sum.style.opacity = .15 + .85 * span(t, .7, 1);
  };
  // the sum, copied into x of the reader
  const wr = $('#qk-wr'), xo = $$('.qk-xo')[Q], xAt = [X7 - 44 + XW / 2, XT + XH / 2];
  const write = (t) => {
    wr.setAttribute('transform', `translate(${sumAt[0] + (xAt[0] - sumAt[0]) * t} ${sumAt[1] + (xAt[1] - sumAt[1]) * t}) scale(${1 - .2 * t} ${1 + (XH / KH - 1) * t})`);
    wr.style.opacity = t < .85 ? .95 : .95 * (1 - (t - .85) / .15);
    xo.classList.toggle('qk-written', t > .8);
  };

  function show(step, animate) {
    cancelAnimationFrame(raf);
    off($('.qk-lq'), step >= 1); off($('.qk-lk'), step >= 2); off($('.qk-lv'), step >= 4);
    [[1, 'Q'], [2, 'K'], [4, 'V']].forEach(([s, r]) => {
      growAt(r, 1);
      grows[r].forEach((g) => { g.style.opacity = step >= s ? 1 : 0; });
      links(r).forEach((l) => off(l, step >= s));
    });
    $$('.qk-vw').forEach((e) => off(e, step >= 4));
    ghosts(step >= 3, animate && step === 3);
    drawArcs(step >= 3, animate && step === 3, step >= 5 && !(animate && step === 5));
    $$('.qk-pct').forEach((e) => off(e, step >= 3));
    movers.forEach((m) => { m.g.style.opacity = 0; });
    wr.style.opacity = 0;
    sum.style.opacity = step >= 5 && !(animate && step === 5) ? 1 : 0;
    xo.classList.toggle('qk-written', step >= 6);
    if (!animate) return;
    const r = { 1: 'Q', 2: 'K', 4: 'V' }[step];
    if (r) { growAt(r, 0); growIn(r); }
    // the payloads ride their arcs, then gather into the sum, in one step
    if (step === 5) play(2600, (t) => { carry(t); if (t >= 1) { drawArcs(true, false, true); play(2400, gather, true); } });
    if (step === 6) { xo.classList.remove('qk-written'); play(1300, write); }
  }

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (!m || typeof m.qkv !== 'number') return;
    show(Math.min(m.qkv, STEPS), !!m.animate);
  });
  if (window.parent !== window) window.parent.postMessage({ qkvReady: true }, '*');
})();
]]></script>''' % dict(w=json.dumps([round(v, 4) for v in w]), q=Q, steps=STEPS, xt=XT, xh=XH, kh=KH, vt=VT,
                     sw=SW, xw=XW, x7=X7, zx=ZX)

body = (f'<defs>{"".join(defs)}</defs>\n<g transform="translate({-OX} {-OY})">\n' + '\n'.join(svg) + '\n</g>\n' + script)
tag = write_svg('qkv.svg', W, H, svg_css, body)
print('wrote themes/qkv.svg; values read as', list(zip(toks, vword)), 'sum:', sword)
print(tag)
