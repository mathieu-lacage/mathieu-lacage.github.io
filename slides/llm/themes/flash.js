// « Flash-attention: a tiling case study »: what the abstract RTX 5090 of « Prefill is
// compute-bound » hid (a finite cache), and how FlashAttention-2 tiles attention.
//
// Each slide is a <div class="flash" data-flash="…"> drawn here as an SVG over the whole slide,
// in slide coordinates (1280 × 720):
//   hierarchy   VRAM ⇄ L2 ⇄ L1 ⇄ tensor cores, with their sizes and bandwidths
//   tiling      C = A · B cut in tiles of 1 row, 1 column, 3 × 4, 6 × 12 (4 steps, one per tiling)
//   nofit       one layer's S at n = 4 096 against L2 and L1, areas to scale
//   chain       FlashAttention-2: steps 0–5 the first block of query rows, tile by tile;
//               steps 6–8 each next block, played automatically
//   impact      tokens/s of prefill and decode, untiled against FA2
// Unlike the earlier sections, operations run one after the other here:
// time = Σ max(FLOPs / F, bytes / B) per operation.
// Uses steps.js. Styles: themes/flash.css.
(() => {
  const C = { slide: '#0f1829', panel: '#18233a', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', blue: '#4aa8ff',
    gold: '#f5c451', cyan: '#8fc5fa', green: '#7cc47a', magenta: '#d97fd0', orange: '#ff9f43' };
  const NS = 'http://www.w3.org/2000/svg';
  const el = (p, tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    p.appendChild(e);
    return e;
  };
  const MATH = { 'font-family': "'Times New Roman', 'STIX Two Text', serif", 'font-style': 'italic' };
  const halo = { 'paint-order': 'stroke', stroke: C.slide, 'stroke-width': 6 };
  // text with one-character subscripts: « Q_i »
  const sub = (p, attrs, str) => {
    const e = el(p, 'text', attrs);
    str.split(/(_\w)/).forEach((part) => {
      if (part.startsWith('_')) el(e, 'tspan', { 'baseline-shift': 'sub', 'font-size': '70%' }, part.slice(1));
      else if (part) el(e, 'tspan', {}, part);
    });
    return e;
  };
  const grid = (svg, x, y, rows, cols, s) => [...Array(rows).keys()].map((i) => [...Array(cols).keys()].map((j) =>
    el(svg, 'rect', { x: x + j * s, y: y + i * s, width: s, height: s, class: 'cell' })));

  /* ---------- the real memory hierarchy ---------- */
  const hierarchy = (svg) => {
    const defs = el(svg, 'defs');
    const mk = el(defs, 'marker', { id: 'flash-ar', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
    el(mk, 'path', { d: 'M0 0L10 5L0 10z', fill: C.slate });
    const box = (x, y, w, h, stroke, title, size) => {
      el(svg, 'rect', { x, y, width: w, height: h, rx: 6, fill: C.slide, stroke, 'stroke-width': 3 });
      el(svg, 'text', { x: x + 18, y: y + 40, fill: C.ink, 'font-size': 26, 'font-weight': 600 }, title);
      if (size) el(svg, 'text', { x: x + 18, y: y + 76, fill: C.slate, 'font-size': 22 }, size);
    };
    const link = (x1, x2, y, top) => {
      el(svg, 'line', { x1: x1 + 4, y1: y, x2: x2 - 4, y2: y, stroke: C.slate, 'stroke-width': 3, 'marker-start': 'url(#flash-ar)', 'marker-end': 'url(#flash-ar)' });
      el(svg, 'text', { x: (x1 + x2) / 2, y: y - 16, fill: C.ink, 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }, top);
    };
    // VRAM as on « Abstract model of RTX 5090 »: stacked bands
    el(svg, 'rect', { x: 60, y: 180, width: 280, height: 400, rx: 6, fill: C.slide, stroke: C.blue, 'stroke-width': 3 });
    el(svg, 'text', { x: 78, y: 220, fill: C.ink, 'font-size': 26, 'font-weight': 600 }, 'VRAM');
    el(svg, 'text', { x: 322, y: 220, fill: C.slate, 'font-size': 22, 'text-anchor': 'end' }, '32 GB');
    let y = 242;
    [['weights', C.magenta, 0.45], ['KV cache', C.gold, 0.25], ['activations', C.blue, 0.3]].forEach(([label, c, share]) => {
      const hh = 322 * share;
      el(svg, 'rect', { x: 74, y, width: 252, height: hh - 4, rx: 3, fill: c, opacity: 0.85 });
      el(svg, 'text', { x: 200, y: y + hh / 2 + 7, fill: C.slide, 'font-size': 22, 'font-weight': 600, 'text-anchor': 'middle' }, label);
      y += hh;
    });
    link(340, 460, 380, '1.79 TB/s');
    box(460, 300, 190, 160, C.cyan, 'L2 cache', '96 MB');
    link(650, 790, 380, '∞ bytes/s');
    el(svg, 'rect', { x: 770, y: 250, width: 460, height: 260, rx: 8, fill: 'none', stroke: C.dim, 'stroke-dasharray': '6 5' });
    el(svg, 'text', { x: 786, y: 278, fill: C.slate, 'font-size': 18 }, 'SM × 170');
    box(790, 300, 170, 160, C.green, 'L1 cache', '128 KB');
    link(960, 1070, 380, '∞ bytes/s');
    box(1070, 300, 145, 160, C.slate, 'Tensor', 'cores');
    el(svg, 'text', { x: 1088, y: 440, fill: C.ink, 'font-size': 19 }, '84 TFLOP/s');
  };

  /* ---------- tiling a matrix product ---------- */
  // step k (1..4) plays the k-th tiling; step 0: the matrices alone
  const tiling = (svg, root) => {
    const a = 6, b = 9, c = 12, s = 26;
    const ax = 110, bx = ax + b * s + 50, by = 150, y0 = by + b * s + 40;
    const A = grid(svg, ax, y0, a, b, s), B = grid(svg, bx, by, b, c, s), Cm = grid(svg, bx, y0, a, c, s);
    const name = (x, y, t) => el(svg, 'text', { x, y, fill: C.ink, 'font-size': 26, 'text-anchor': 'middle', ...MATH }, t);
    name(ax + b * s / 2, y0 + a * s + 34, 'A  (6 × 9)');
    name(bx + c * s / 2, by - 14, 'B  (9 × 12)');
    name(bx + c * s / 2, y0 + a * s + 34, 'C');
    const meter = el(svg, 'text', { x: ax + b * s / 2, y: by + 60, fill: C.gold, 'font-size': 24, 'text-anchor': 'middle' });
    const box = document.createElement('div');
    box.className = 'flash-box'; box.style.cssText = 'left: 790px; top: 150px; width: 430px;';
    box.innerHTML = `<p class="flash-flops">FLOPs: <i>2abc</i> = 1 296 for all</p>
<table class="flash-tab"><thead><tr><th>tile of C</th><th>cache</th><th>read</th></tr></thead><tbody>
<tr data-o="row"><td>1 row</td><td>19</td><td>702</td></tr>
<tr data-o="col"><td>1 column</td><td>19</td><td>756</td></tr>
<tr data-o="t34"><td>3 × 4</td><td>75</td><td>270</td></tr>
<tr data-o="t612"><td>6 × 12</td><td>234</td><td>162</td></tr>
</tbody></table>`;
    root.appendChild(box);
    const range = (k) => [...Array(k).keys()];
    // tiles of l × m cells of C: the l rows of A stay in cache while B streams by groups of m columns
    const tile = (l, m) => range(a / l).flatMap((I) => range(c / m).map((J) => {
      const loads = [], cells = [], res = [];
      range(l).forEach((p) => range(b).forEach((k) => { (J === 0 ? loads : res).push(['A', I * l + p, k]); }));
      range(b).forEach((k) => range(m).forEach((q) => loads.push(['B', k, J * m + q])));
      range(l).forEach((p) => range(m).forEach((q) => cells.push([I * l + p, J * m + q])));
      return { loads, res, cells };
    }));
    const events = {
      row: tile(1, 1),
      col: range(c).flatMap((j) => range(a).map((i) => ({
        loads: [...(i === 0 ? range(b).map((k) => ['B', k, j]) : []), ...range(b).map((k) => ['A', i, k])],
        res: i === 0 ? [] : range(b).map((k) => ['B', k, j]), cells: [[i, j]] }))),
      t34: tile(3, 4),
      t612: tile(6, 12),
    };
    const orders = ['row', 'col', 't34', 't612'];
    const M = { A, B };
    let order = null, idx = -1, timer;
    const done = new Set();
    const paint = () => {
      [...A.flat(), ...B.flat(), ...Cm.flat()].forEach((r) => r.setAttribute('class', 'cell'));
      done.forEach((key) => { const [i, j] = key.split(',').map(Number); Cm[i][j].classList.add('done'); });
      box.querySelectorAll('tr[data-o]').forEach((tr) => tr.classList.toggle('on', tr.dataset.o === order));
      if (!order) { meter.textContent = ''; return; }
      const evs = events[order]; let read = 0;
      for (let k = 0; k <= idx; k++) read += evs[k].loads.length;
      if (idx >= 0) {
        const e = evs[idx];
        e.res.forEach(([m, i, j]) => M[m][i][j].classList.add('res'));
        e.loads.forEach(([m, i, j]) => M[m][i][j].classList.add('load'));
        e.cells.forEach(([i, j]) => Cm[i][j].setAttribute('class', 'cell cur'));
      }
      meter.textContent = `read from VRAM: ${read}`;
    };
    const step = () => {
      const evs = events[order];
      if (idx >= evs.length - 1) return false;
      if (idx >= 0) evs[idx].cells.forEach(([i, j]) => done.add(`${i},${j}`));
      idx++; paint(); return true;
    };
    return (st) => {
      clearInterval(timer); idx = -1; done.clear();
      const play = st !== null;
      if (st === null) st = orders.length;
      order = st ? orders[st - 1] : null;
      if (!order) { paint(); return; }
      if (play) { step(); timer = setInterval(() => { if (!step()) clearInterval(timer); }, order === 'row' || order === 'col' ? 90 : 500); }
      else while (step());
    };
  };

  /* ---------- S and A do not fit ---------- */
  const nofit = (svg) => {
    const side = 400, x0 = 440, y0 = 160;
    const GiB = 2 ** 30, area = (bytes) => side * Math.sqrt(bytes / GiB);
    el(svg, 'rect', { x: x0, y: y0, width: side, height: side, fill: '#3a2a44', stroke: C.magenta, 'stroke-width': 3 });
    el(svg, 'text', { x: x0 + side / 2, y: y0 + side / 2 - 10, fill: C.ink, 'font-size': 26, 'text-anchor': 'middle', 'font-weight': 600 }, 'S of one layer');
    el(svg, 'text', { x: x0 + side / 2, y: y0 + side / 2 + 24, fill: C.slate, 'font-size': 20, 'text-anchor': 'middle' }, '32 heads × 4 096 × 4 096 × 2 B = 1 GiB');
    const l2 = area(96e6);
    el(svg, 'rect', { x: x0, y: y0 + side - l2, width: l2, height: l2, fill: 'none', stroke: C.cyan, 'stroke-width': 3 });
    el(svg, 'text', { x: x0 + l2 + 10, y: y0 + side - l2 + 20, fill: C.cyan, 'font-size': 18 }, 'L2: 96 MB');
    const l1 = Math.max(3, area(128e3));
    el(svg, 'rect', { x: x0, y: y0 + side - l1, width: l1, height: l1, fill: C.green });
    el(svg, 'line', { x1: x0 + l1, y1: y0 + side - l1, x2: x0 + 60, y2: y0 + side + 40, stroke: C.green, 'stroke-width': 2 });
    el(svg, 'text', { x: x0 + 66, y: y0 + side + 46, fill: C.green, 'font-size': 18 }, 'L1 / shared of one SM: 128 KB');
  };

  /* ---------- FlashAttention-2: chained tiles ---------- */
  // steps 0–5: the first block of query rows, tile by tile; steps 6–8: the next blocks, each one played automatically
  const blk = 4, CHAIN = blk + 1 + (blk - 1);
  const chain = (svg) => {
    const bs = 52, dh = 40;                              // 4 blocks of B_r = B_c rows; d_h drawn 40 px wide
    const qx = 396, qy = 250, kx = qx + dh + 40, ky = qy - dh - 40, sx = kx, sy = qy, vx = sx + blk * bs + 60, ox = vx + dh + 60;
    const rect = (x, y, w, h, stroke) => el(svg, 'rect', { x, y, width: w, height: h, fill: C.panel, stroke, 'stroke-width': 2 });
    const Q = [...Array(blk).keys()].map((i) => rect(qx, qy + i * bs, dh, bs, C.orange));
    const K = [...Array(blk).keys()].map((j) => rect(kx + j * bs, ky, bs, dh, C.green));
    const S = [...Array(blk).keys()].map((i) => [...Array(blk).keys()].map((j) => el(svg, 'rect', { x: sx + j * bs, y: sy + i * bs, width: bs, height: bs, fill: 'none', stroke: C.dim, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' })));
    const V = [...Array(blk).keys()].map((j) => rect(vx, qy + j * bs, dh, bs, C.magenta));
    const O = [...Array(blk).keys()].map((i) => rect(ox, qy + i * bs, dh, bs, C.blue));
    const lab = (x, y, t, c = C.ink) => sub(svg, { x, y, fill: c, 'font-size': 24, 'text-anchor': 'middle', ...MATH }, t);
    lab(qx + dh / 2, qy - 14, 'Q'); lab(kx + blk * bs / 2, ky - 14, 'Kᵀ'); lab(sx + blk * bs / 2, sy + blk * bs + 34, 'S, A: never stored', C.slate);
    lab(vx + dh / 2, qy - 14, 'V'); lab(ox + dh / 2, qy - 14, 'O');
    sub(svg, { x: qx - 14, y: qy + bs / 2 + 6, fill: C.slate, 'font-size': 18, 'text-anchor': 'end' }, 'B_r rows');
    const gold = (r, opacity = 1) => { r.setAttribute('fill', C.gold); r.setAttribute('fill-opacity', opacity); };
    // block of rows i, phase ph: 0 Q_i alone · 1..blk tile j = ph − 1 · blk + 1 O_i written
    const draw = (i, ph) => {
      [...Q, ...K, ...V, ...O].forEach((r) => { r.setAttribute('fill', C.panel); r.setAttribute('fill-opacity', 1); });
      S.flat().forEach((r) => { r.setAttribute('fill', 'none'); r.setAttribute('stroke', C.dim); });
      for (let k = 0; k < i; k++) gold(O[k]);
      if (ph <= blk) gold(Q[i]);
      if (ph >= 1 && ph <= blk) {
        const j = ph - 1;
        gold(K[j]); gold(V[j]); gold(S[i][j]); S[i][j].setAttribute('stroke', C.gold);
        for (let k = 0; k < j; k++) S[i][k].setAttribute('stroke', C.slate);
        gold(O[i], 0.4);
      } else if (ph > blk) {
        gold(O[i]);
        S[i].forEach((r) => r.setAttribute('stroke', C.slate));
      }
    };
    let prev = null, timer;
    return (st) => {
      clearInterval(timer);
      // play a block only when stepping forward onto it
      const play = st !== null && prev !== null && st === prev + 1;
      prev = st;
      if (st === null) st = CHAIN;
      if (st <= blk + 1) { draw(0, st); return; }
      const i = st - blk - 1;
      if (!play) { draw(i, blk + 1); return; }
      let ph = 0; draw(i, ph);
      timer = setInterval(() => { draw(i, ++ph); if (ph >= blk + 1) clearInterval(timer); }, 600);
    };
  };

  /* ---------- impact on tokens/s ---------- */
  // operations run one after the other: time = Σ max(FLOPs / F, bytes / B) per operation
  const md = { d: 4096, L: 32, nh: 32, dh: 128, dff: 11008, V: 32000, Br: 128 };
  const EF = 209.5e12 * 0.4, EB = 1.792e12 * 0.7;
  const ops = (r, n, fa) => {             // prefill: r = n new rows, context n
    const { d, nh, dh, dff } = md, q = nh * dh;
    const o = [[2 * r * d * q, 2 * (d * q + r * d + r * q)], [4 * r * d * q, 4 * (d * q + r * d + r * q)], [2 * r * q * d, 2 * (q * d + r * q + r * d)],
      [4 * r * d * dff, 4 * (d * dff + r * d + r * dff)], [5 * r * dff, 6 * r * dff], [2 * r * dff * d, 2 * (dff * d + r * dff + r * d)], [10 * r * d, 20 * r * d]];
    if (!fa) o.push([2 * r * n * dh * nh, 2 * nh * (2 * r * dh + r * n)], [5 * r * n * nh, 4 * nh * r * n], [2 * r * n * dh * nh, 2 * nh * (r * n + 2 * r * dh)]);
    else o.push([4 * r * n * dh * nh + 5 * r * n * nh, 2 * nh * (2 * r * dh + 2 * n * dh * Math.max(1, r / md.Br))]);
    return o;
  };
  const time = (r, n, fa) => {
    const t = ops(r, n, fa).reduce((acc, [f, b]) => acc + Math.max(f / EF, b / EB), 0) * md.L;
    return t + Math.max(2 * md.V * md.d / EF, 2 * md.V * md.d / EB);
  };
  // decode: the attention of one row reads K and V (n · d_h per head each), counted in its bytes
  const decOps = (n, fa) => {
    const { d, nh, dh, dff } = md, q = nh * dh;
    const o = [[2 * d * q, 2 * (d * q + d + q)], [4 * d * q, 4 * (d * q + d + q)], [2 * q * d, 2 * (q * d + q + d)],
      [4 * d * dff, 4 * (d * dff + d + dff)], [5 * dff, 6 * dff], [2 * dff * d, 2 * (dff * d + dff + d)], [10 * d, 20 * d]];
    if (!fa) o.push([2 * n * dh * nh, 2 * nh * (dh + n * dh + n)], [5 * n * nh, 4 * nh * n], [2 * n * dh * nh, 2 * nh * (n + n * dh + dh)]);
    else o.push([4 * n * dh * nh + 5 * n * nh, 2 * nh * (2 * dh + 2 * n * dh)]);
    return o.reduce((acc, [f, b]) => acc + Math.max(f / EF, b / EB), 0) * md.L + 2 * md.V * md.d / EB;
  };
  const tokPrefill = (n, fa) => n / time(n, n, fa);
  const tokDecode = (n, fa) => 1 / decOps(n, fa);
  const fmtN = (n) => (n >= 1048576 ? `${n / 1048576} M` : n >= 1024 ? `${Math.round(n / 1024)} k` : `${n}`);
  const impact = (svg) => {
    const panel = (x0, title, f, ymin, ymax, marks) => {
      const l = x0 + 90, t = 215, pw = 420, ph = 270, NMIN = 256, NMAX = 1048576;
      const X = (n) => l + Math.log(n / NMIN) / Math.log(NMAX / NMIN) * pw;
      const Y = (v) => t + ph - Math.log(v / ymin) / Math.log(ymax / ymin) * ph;
      el(svg, 'text', { x: x0, y: 160, fill: C.ink, 'font-size': 26, 'font-weight': 600 }, title);
      for (let v = ymin; v <= ymax * 1.001; v *= 10) {
        el(svg, 'line', { x1: l, x2: l + pw, y1: Y(v), y2: Y(v), stroke: C.dim, opacity: 0.6 });
        el(svg, 'text', { x: l - 10, y: Y(v) + 6, fill: C.slate, 'font-size': 17, 'text-anchor': 'end' }, `${fmtN(v)}`);
      }
      [1024, 16384, 262144].forEach((n) => el(svg, 'text', { x: X(n), y: t + ph + 26, fill: C.slate, 'font-size': 17, 'text-anchor': 'middle' }, fmtN(n)));
      el(svg, 'text', { x: l + pw / 2, y: t + ph + 54, fill: C.slate, 'font-size': 17, 'text-anchor': 'middle' }, 'n, tokens (log)');
      el(svg, 'text', { x: l - 60, y: t - 14, fill: C.slate, 'font-size': 17 }, 'tokens/s');
      const ns = [...Array(97).keys()].map((k) => NMIN * (NMAX / NMIN) ** (k / 96));
      [[false, C.slate, '8 5'], [true, C.gold, '']].forEach(([fa, c, dash]) => {
        el(svg, 'polyline', { points: ns.map((n) => `${X(n)},${Y(f(n, fa))}`).join(' '), fill: 'none', stroke: c, 'stroke-width': 3, ...(dash ? { 'stroke-dasharray': dash } : {}) });
      });
      marks.forEach((n) => {
        const a = f(n, false), b = f(n, true);
        el(svg, 'circle', { cx: X(n), cy: Y(b), r: 6, fill: C.gold, stroke: C.slide, 'stroke-width': 3 });
        el(svg, 'text', { x: X(n), y: Y(b) - 14, fill: C.ink, 'font-size': 17, 'text-anchor': 'middle', ...halo }, `${b / a >= 1.005 ? '+' + Math.round((b / a - 1) * 100) + ' %' : '≈ 0 %'}`);
      });
    };
    panel(80, 'Prefill: prompt tokens/s', tokPrefill, 10, 1e4, [4096, 32768, 1048576]);
    panel(660, 'Decode: generated tokens/s, B = 1', tokDecode, 1, 1000, [4096, 32768, 1048576]);
    [[C.slate, 'untiled, as before', '8 5'], [C.gold, 'FlashAttention-2', '']].forEach(([c, s, dash], k) => {
      el(svg, 'line', { x1: 380 + k * 330, x2: 410 + k * 330, y1: 572, y2: 572, stroke: c, 'stroke-width': 3, ...(dash ? { 'stroke-dasharray': dash } : {}) });
      el(svg, 'text', { x: 420 + k * 330, y: 578, fill: C.ink, 'font-size': 18 }, s);
    });  };

  document.querySelectorAll('div.flash[data-flash]:not(.flash-built)').forEach((root) => {
    root.classList.add('flash-built');
    const svg = el(root, 'svg', { viewBox: '0 0 1280 720' });
    const kind = root.dataset.flash;
    if (kind === 'hierarchy') hierarchy(svg);
    else if (kind === 'tiling') steps(root, 4, tiling(svg, root));
    else if (kind === 'nofit') nofit(svg);
    else if (kind === 'chain') steps(root, CHAIN, chain(svg));
    else if (kind === 'impact') impact(svg);
  });
})();
