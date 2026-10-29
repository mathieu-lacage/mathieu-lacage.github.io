// « Prefill is compute-bound »: the cost of a prefill on an abstract RTX 5090.
//
// Each slide is a <div class="cost" data-cost="…"> drawn here as an SVG over the whole slide,
// in slide coordinates (1280 × 720):
//   model     the abstract GPU: VRAM ⇄ cache ⇄ compute
//   matmul    FLOPs, bytes read and bytes written of C = A · B (5 steps)
//   flops, ftime, bytes, btime    one curve per contribution and their total, log-log,
//             against the prompt size n (Llama-2-7B); ftime and btime mark n = 1 k
//   bound     compute time and memory time on one plot
//   roofline  FLOP/s against FLOPs per byte
// and, for « Decode is bandwidth-bound » (one new row per sequence, context n, batch B):
//   dflops, dbytes, dtime    per token against the context n (B = 1); dtime marks n = 1 k
//   batch     the weights are shared by the batch, each KV cache is not
//   throughput   tokens/s against B, one curve per n, up to a full VRAM
//   droofline    the roofline, one curve per n along B
// The formulas are the ones of the table « Prefill: one block, product by product »,
// with n_h heads for Q, K and V and untiled attention (S and A go through VRAM).
// Uses steps.js. Styles: themes/cost.css.
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

  // a curly brace from (x1,y1) to (x2,y2), bulging by w to the left of that direction (themes/braces.js)
  const curly = (x1, y1, x2, y2, w, q = 0.6) => {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(0.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(0.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(0.75, 1 - q)} T${tip}`;
  };
  // brace along the left or top side [p, q] of a matrix whose edge is at e
  const brace = (svg, side, p, q, e, label, color) => {
    const G = 8, W = 12, st = { fill: 'none', stroke: color, 'stroke-width': 2 }, tx = { fill: color, 'font-size': 26, ...MATH };
    if (side === 'left') {
      el(svg, 'path', { d: curly(e - G, p, e - G, q, W), ...st });
      el(svg, 'text', { x: e - G - W - 8, y: (p + q) / 2 + 8, 'text-anchor': 'end', ...tx }, label);
    } else {
      el(svg, 'path', { d: curly(q, e - G, p, e - G, W), ...st });
      el(svg, 'text', { x: (p + q) / 2, y: e - G - W - 8, 'text-anchor': 'middle', ...tx }, label);
    }
  };

  /* ---------- the model and its formulas ---------- */
  // Llama-2-7B, with n_h heads for Q, K and V; bf16: 2 bytes per number
  const M = { d: 4096, L: 32, nh: 32, dh: 128, dff: 11008, V: 32000 };
  const GPU = { flops: 209.5e12, bw: 1.792e12, mfu: 0.4, mbu: 0.7 };
  const EF = GPU.flops * GPU.mfu, EB = GPU.bw * GPU.mbu;
  const FLOPS = [
    { label: 'FFN gate, up, down', color: C.green, f: (m, n) => m.L * 3 * 2 * n * m.d * m.dff },
    { label: 'x · W_Q, Z · W_O', color: C.blue, f: (m, n) => m.L * 2 * 2 * n * m.d * m.nh * m.dh },
    { label: 'x · W_K, x · W_V', color: C.orange, f: (m, n) => m.L * 2 * 2 * n * m.d * m.nh * m.dh },
    { label: 'Q · Kᵀ', color: C.magenta, f: (m, n) => m.L * m.nh * 2 * n * n * m.dh },
    { label: 'A · V', color: C.gold, f: (m, n) => m.L * m.nh * 2 * n * n * m.dh },
    { label: 'softmax, SiLU, norms', color: C.cyan, f: (m, n) => m.L * (5 * n * n * m.nh + 5 * n * m.dff + 10 * n * m.d) },
  ];
  const BYTES = [
    { label: 'FFN weights', color: C.green, f: (m) => 2 * m.L * 3 * m.d * m.dff },
    { label: 'attention weights', color: C.blue, f: (m) => 2 * m.L * 4 * m.d * m.nh * m.dh },
    { label: 'W_E rows, W_U', color: C.orange, f: (m, n) => 2 * m.V * m.d + 2 * n * m.d },
    { label: 'activations ∝ n', color: C.gold, f: (m, n) => {
      const q = m.nh * m.dh;
      return m.L * 2 * n * (3 * (m.d + q) + 4 * q + (q + m.d) + 2 * (m.d + m.dff) + 3 * m.dff + (m.dff + m.d) + 10 * m.d);
    } },
    { label: 'S and A ∝ n²', color: C.magenta, f: (m, n) => m.L * m.nh * 2 * 4 * n * n },
  ];
  const sum = (series, m, n) => series.reduce((a, s) => a + s.f(m, n), 0);
  const per = (series, rate) => series.map((s) => ({ ...s, f: (m, n) => s.f(m, n) / rate }));

  const fmt = (v, unit) => {
    if (unit === 's') {
      if (v >= 86400) return `${+(v / 86400).toFixed(v < 864000 ? 1 : 0)} d`;
      if (v >= 3600) return `${+(v / 3600).toFixed(v < 36000 ? 1 : 0)} h`;
      if (v >= 60) return `${+(v / 60).toFixed(v < 600 ? 1 : 0)} min`;
      if (v >= 1) return `${+v.toPrecision(3)} s`;
      if (v >= 1e-3) return `${+(v * 1e3).toPrecision(3)} ms`;
      return `${+(v * 1e6).toPrecision(3)} µs`;
    }
    const u = unit === 'FLOP' ? '' : 'B';
    for (const [x, pfx] of [[1e21, 'Z'], [1e18, 'E'], [1e15, 'P'], [1e12, 'T'], [1e9, 'G'], [1e6, 'M']]) {
      if (v >= x) { const q = v / x; return `${Math.abs(q - Math.round(q)) < 1e-6 ? Math.round(q) : q.toFixed(q < 10 ? 1 : 0)} ${pfx}${u}`; }
    }
    return `${v.toFixed(0)} ${u}`;
  };
  const fmtN = (n) => (n >= 1048576 ? `${n / 1048576} M` : n >= 1024 ? `${Math.round(n / 1024)} k` : `${n}`);

  /* ---------- log-log curves against n ---------- */
  // opts: total (draw the dashed total), mark (n of the vertical bar), unit,
  // xlabel, shade: [n, label] (grey from n on; default: beyond Llama-2-7B's context)
  const curves = (svg, series, opts) => {
    const NMIN = 128, NMAX = 1048576, K = 128;
    const l = 150, t = 150, pw = 800, ph = 420;
    const ns = [...Array(K + 1).keys()].map((k) => NMIN * (NMAX / NMIN) ** (k / K));
    const vals = ns.map((n) => series.map((s) => s.f(M, n)));
    const tots = vals.map((v) => v.reduce((a, b) => a + b, 0));
    const ticks = opts.unit === 's' ? [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1, 10, 60, 600, 3600, 36000, 86400, 864000]
      : [...Array(40).keys()].map((e) => 10 ** (e - 6));
    const vmin = Math.min(...vals.flat()), vmax = Math.max(...(opts.total ? tots : vals.flat()));
    const lo = Math.log10(ticks.filter((v) => v <= vmin).pop()), hi = Math.log10(ticks.find((v) => v >= vmax));
    const X = (n) => l + Math.log(n / NMIN) / Math.log(NMAX / NMIN) * pw;
    const Y = (v) => t + ph - (Math.log10(v) - lo) / (hi - lo) * ph;
    ticks.filter((v) => Math.log10(v) >= lo - 1e-9 && Math.log10(v) <= hi + 1e-9).forEach((v) => {
      el(svg, 'line', { x1: l, x2: l + pw, y1: Y(v), y2: Y(v), stroke: C.dim, 'stroke-width': 1, opacity: 0.6 });
      el(svg, 'text', { x: l - 12, y: Y(v) + 6, fill: C.slate, 'font-size': 18, 'text-anchor': 'end' }, fmt(v, opts.unit));
    });
    for (let n = NMAX; n > NMIN; n /= 4) el(svg, 'text', { x: X(n), y: t + ph + 28, fill: C.slate, 'font-size': 18, 'text-anchor': 'middle' }, fmtN(n));
    el(svg, 'line', { x1: l, x2: l + pw, y1: t + ph, y2: t + ph, stroke: C.dim, 'stroke-width': 2 });
    el(svg, 'text', { x: l + pw / 2, y: t + ph + 58, fill: C.slate, 'font-size': 18, 'text-anchor': 'middle' }, opts.xlabel || 'n, prompt tokens (log)');
    // Llama-2-7B reads at most 4 096 tokens
    const [ns0, shade] = opts.shade || [4096, 'beyond Llama-2-7B’s context'];
    el(svg, 'rect', { x: X(ns0), y: t, width: X(NMAX) - X(ns0), height: ph, fill: C.slate, opacity: 0.07 });
    el(svg, 'text', { x: X(ns0) + 8, y: t + 22, fill: C.slate, 'font-size': 16 }, shade);
    series.forEach((s, k) => el(svg, 'polyline', { points: ns.map((n, q) => `${X(n)},${Y(vals[q][k])}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 3 }));
    if (opts.total) el(svg, 'polyline', { points: ns.map((n, q) => `${X(n)},${Y(tots[q])}`).join(' '), fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-dasharray': '8 5' });
    // legend, right of the plot: total first, then the series top to bottom
    const keys = [...(opts.total ? [{ label: 'total', color: C.ink, total: true }] : []), ...[...series].reverse()];
    keys.forEach((s, k) => {
      const y = t + 12 + k * 32, x = l + pw + 30;
      el(svg, 'line', { x1: x, x2: x + 26, y1: y, y2: y, stroke: s.color, 'stroke-width': s.total ? 4 : 3, ...(s.total ? { 'stroke-dasharray': '7 4' } : {}) });
      el(svg, 'text', { x: x + 38, y: y + 6, fill: C.ink, 'font-size': 18 }, s.label);
    });
    if (opts.mark) {
      const nm = opts.mark, xm = X(nm), halo = { 'paint-order': 'stroke', stroke: C.slide, 'stroke-width': 6 };
      el(svg, 'line', { x1: xm, x2: xm, y1: t, y2: t + ph, stroke: C.gold, 'stroke-width': 2, 'stroke-dasharray': '6 4' });
      el(svg, 'text', { x: xm, y: t + 22, fill: C.gold, 'font-size': 18, 'text-anchor': 'middle', ...halo }, `n = ${fmtN(nm)}`);
      const pts = opts.total ? [[sum(series, M, nm), C.ink]] : series.map((s) => [s.f(M, nm), s.color]);
      pts.forEach(([v, c]) => {
        el(svg, 'circle', { cx: xm, cy: Y(v), r: 7, fill: c, stroke: C.slide, 'stroke-width': 3 });
        el(svg, 'text', { x: xm - 12, y: Y(v) - 12, fill: C.ink, 'font-size': 22, 'font-weight': 600, 'text-anchor': 'end', ...halo }, fmt(v, opts.unit));
      });
    }
  };

  /* ---------- roofline ---------- */
  // axes and roof; returns the scales
  const roofAxes = (svg, pw) => {
    const l = 190, t = 150, ph = 420, IX = [0.5, 2000], FY = [1e11, 4e14];
    const X = (i) => l + Math.log(i / IX[0]) / Math.log(IX[1] / IX[0]) * pw;
    const Y = (f) => t + ph - Math.log(f / FY[0]) / Math.log(FY[1] / FY[0]) * ph;
    [1, 10, 100, 1000].forEach((i) => {
      el(svg, 'line', { x1: X(i), x2: X(i), y1: t, y2: t + ph, stroke: C.dim, opacity: 0.6 });
      el(svg, 'text', { x: X(i), y: t + ph + 28, fill: C.slate, 'font-size': 18, 'text-anchor': 'middle' }, i.toLocaleString('fr-FR'));
    });
    [1e11, 1e12, 1e13, 1e14].forEach((f) => {
      el(svg, 'line', { x1: l, x2: l + pw, y1: Y(f), y2: Y(f), stroke: C.dim, opacity: 0.6 });
      el(svg, 'text', { x: l - 12, y: Y(f) + 6, fill: C.slate, 'font-size': 18, 'text-anchor': 'end' }, `${fmt(f, 'FLOP')}FLOP/s`);
    });
    el(svg, 'text', { x: l + pw / 2, y: t + ph + 58, fill: C.slate, 'font-size': 18, 'text-anchor': 'middle' }, 'arithmetic intensity, FLOPs per byte (log)');
    const roof = (F, B, c, w, dash) => {
      el(svg, 'polyline', { points: `${X(IX[0])},${Y(B * IX[0])} ${X(F / B)},${Y(F)} ${X(IX[1])},${Y(F)}`, fill: 'none', stroke: c, 'stroke-width': w, ...(dash ? { 'stroke-dasharray': '8 5' } : {}) });
    };
    roof(GPU.flops, GPU.bw, C.dim, 2, true);
    roof(EF, EB, C.slate, 4);
    const ridge = EF / EB;
    el(svg, 'line', { x1: X(ridge), x2: X(ridge), y1: Y(EF), y2: t + ph, stroke: C.slate, 'stroke-dasharray': '4 4' });
    el(svg, 'text', { x: X(ridge) + 8, y: t + ph - 12, fill: C.slate, 'font-size': 18 }, `ridge ≈ ${Math.round(ridge)}`);
    el(svg, 'text', { x: X(8), y: Y(EB * 8) - 40, fill: C.slate, 'font-size': 20, 'text-anchor': 'middle' }, 'memory bound');
    el(svg, 'text', { x: l + pw, y: Y(EF) + 84, fill: C.slate, 'font-size': 20, 'text-anchor': 'end' }, `compute bound · ${fmt(EF, 'FLOP')}FLOP/s`);
    el(svg, 'text', { x: l + pw, y: Y(GPU.flops) - 12, fill: C.slate, 'font-size': 16, 'text-anchor': 'end' }, 'peak: 209.5 TFLOP/s, 1.79 TB/s');
    return { X, Y, l, t, pw };
  };
  const roofline = (svg) => {
    const { X, Y } = roofAxes(svg, 900);
    const at = (n) => { const i = sum(FLOPS, M, n) / sum(BYTES, M, n); return [i, Math.min(EF, EB * i)]; };
    const ns = [...Array(49).keys()].map((k) => 2 ** (8 + k / 4));
    el(svg, 'polyline', { points: ns.map((n) => { const [i, f] = at(n); return `${X(i)},${Y(f)}`; }).join(' '), fill: 'none', stroke: C.gold, 'stroke-width': 2, opacity: 0.8 });
    [[1024, '1 k'], [4096, '4 k'], [32768, '32 k'], [262144, '256 k'], [1048576, '1 M']].forEach(([n, s], k) => {
      const [i, f] = at(n);
      el(svg, 'circle', { cx: X(i), cy: Y(f), r: 8, fill: C.gold, stroke: C.slide, 'stroke-width': 3 });
      el(svg, 'text', { x: X(i), y: Y(f) + (k % 2 ? -16 : 32), fill: C.ink, 'font-size': 18, 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: C.slide, 'stroke-width': 6 }, s);
    });
  };


  /* ---------- decode: one new row per sequence, context n, batch B ---------- */
  const PM = M.L * (4 * M.d * M.nh * M.dh + 3 * M.d * M.dff) + M.V * M.d;   // weights used in a product, W_U included
  const KVTOK = M.L * 2 * M.nh * M.dh * 2;                                     // KV cache bytes per token: 512 KiB
  const VRAM = 32e9, WBYTES = 13.5e9;
  const fits = (n) => Math.floor((VRAM - WBYTES) / (KVTOK * n));             // sequences of context n next to the weights
  const DFL = [
    { label: 'weight products', color: C.green, f: (m, n, B = 1) => B * 2 * PM },
    { label: 'q · Kᵀ, a · V', color: C.magenta, f: (m, n, B = 1) => B * 4 * m.L * n * m.nh * m.dh },
    { label: 'softmax, SiLU, norms', color: C.cyan, f: (m, n, B = 1) => B * m.L * (5 * n * m.nh + 5 * m.dff + 10 * m.d) },
  ];
  const DBY = [
    { label: 'weights', color: C.blue, f: () => 2 * PM + 2 * M.d },
    { label: 'KV cache read', color: C.gold, f: (m, n, B = 1) => B * KVTOK * n },
    { label: 'other activations', color: C.orange, f: (m, n, B = 1) => {
      const q = m.nh * m.dh;
      return B * m.L * 2 * (3 * (m.d + q) + (q + m.d) + 2 * (m.d + m.dff) + 3 * m.dff + (m.dff + m.d) + 10 * m.d + m.nh * (2 * m.dh + 4 * n));
    } },
  ];
  const dsum = (series, n, B) => series.reduce((a, s) => a + s.f(M, n, B), 0);
  const step = (n, B) => Math.max(dsum(DFL, n, B) / EF, dsum(DBY, n, B) / EB);
  const VSHADE = [(VRAM - WBYTES) / KVTOK, `KV cache > VRAM (${fmtN(Math.round((VRAM - WBYTES) / KVTOK))} tokens)`];
  const NS3 = [[128, C.green], [1024, C.gold], [4096, C.magenta]];
  const HALO = { 'paint-order': 'stroke', stroke: C.slide, 'stroke-width': 6 };
  const keys = (svg, x, y, list) => list.forEach(([s, c], k) => {
    el(svg, 'line', { x1: x, x2: x + 26, y1: y + k * 32, y2: y + k * 32, stroke: c, 'stroke-width': 3 });
    el(svg, 'text', { x: x + 38, y: y + k * 32 + 6, fill: C.ink, 'font-size': 18 }, s);
  });

  // text with one-letter subscripts: « d_h »
  const sub = (p, attrs, str) => {
    const e = el(p, 'text', attrs);
    str.split(/(_\w)/).forEach((part) => {
      if (part.startsWith('_')) el(e, 'tspan', { 'baseline-shift': 'sub', 'font-size': '70%' }, part.slice(1));
      else if (part) el(e, 'tspan', {}, part);
    });
    return e;
  };
  const batch = (svg) => {
    const s = 22;
    const panel = (x0, title, rows, inner, cols, lab, gold) => {
      el(svg, 'text', { x: x0, y: 168, fill: C.ink, 'font-size': 26, 'font-weight': 600 }, title);
      const ax = x0 + 40, by = 310, ay = by + inner * s + 40;
      const box = (x, y, r, c, fill, stroke) => el(svg, 'rect', { x, y, width: c * s, height: r * s, fill, stroke, 'stroke-width': 2, rx: 2 });
      box(ax, ay, rows, inner, C.panel, C.blue);
      box(ax + inner * s + 30, by, inner, cols, gold ? '#3a3420' : '#3a2a44', gold ? C.gold : C.magenta);
      box(ax + inner * s + 30, ay, rows, cols, C.panel, C.slate);
      sub(svg, { x: ax + inner * s / 2, y: ay + rows * s + 34, fill: C.ink, 'font-size': 24, 'text-anchor': 'middle', ...MATH }, lab[0]);
      sub(svg, { x: ax + inner * s + 30 + cols * s / 2, y: by - 12, fill: C.ink, 'font-size': 24, 'text-anchor': 'middle', ...MATH }, lab[1]);
    };
    panel(90, 'x · W: weights are shared', 4, 6, 7, ['X  (B × d)', 'W  (d × m)'], false);
    panel(680, 'q · Kᵀ: each sequence has its own K', 4, 4, 8, ['Q  (B × d_h)', 'K of each sequence  (d_h × n)'], true);
  };
  const Bs = (n) => [...Array(200).keys()].map((k) => 2 ** (k / 20)).filter((B) => B <= fits(n));
  const throughput = (svg) => {
    const l = 170, t = 150, pw = 780, ph = 420, X0 = 1, X1 = 512, Y0 = 10, Y1 = 1e4;
    const X = (v) => l + Math.log(v / X0) / Math.log(X1 / X0) * pw;
    const Y = (v) => t + ph - Math.log(v / Y0) / Math.log(Y1 / Y0) * ph;
    [10, 100, 1000, 1e4].forEach((v) => {
      el(svg, 'line', { x1: l, x2: l + pw, y1: Y(v), y2: Y(v), stroke: C.dim, opacity: 0.6 });
      el(svg, 'text', { x: l - 12, y: Y(v) + 6, fill: C.slate, 'font-size': 18, 'text-anchor': 'end' }, `${fmtN(v)} tok/s`);
    });
    [1, 4, 16, 64, 256].forEach((v) => el(svg, 'text', { x: X(v), y: t + ph + 28, fill: C.slate, 'font-size': 18, 'text-anchor': 'middle' }, `${v}`));
    el(svg, 'line', { x1: l, x2: l + pw, y1: t + ph, y2: t + ph, stroke: C.dim, 'stroke-width': 2 });
    el(svg, 'text', { x: l + pw / 2, y: t + ph + 58, fill: C.slate, 'font-size': 18, 'text-anchor': 'middle' }, 'B, sequences decoded together (log)');
    NS3.forEach(([n, c]) => {
      const bmax = fits(n), y = Y(bmax / step(n, bmax)), x = X(bmax);
      el(svg, 'polyline', { points: Bs(n).map((B) => `${X(B)},${Y(B / step(n, B))}`).join(' '), fill: 'none', stroke: c, 'stroke-width': 3 });
      el(svg, 'path', { d: `M${x - 8},${y - 8}L${x + 8},${y + 8}M${x - 8},${y + 8}L${x + 8},${y - 8}`, stroke: c, 'stroke-width': 3 });
      el(svg, 'text', { x: x - 12, y: y - 14, fill: C.ink, 'font-size': 18, 'text-anchor': 'end', ...HALO }, `B = ${bmax}: ${Math.round(bmax / step(n, bmax)).toLocaleString('fr-FR')} tok/s`);
    });
    keys(svg, l + pw + 30, t + 12, NS3.map(([n, c]) => [`n = ${fmtN(n)}`, c]));
    el(svg, 'text', { x: l + pw + 30, y: t + 120, fill: C.slate, 'font-size': 16 }, '✕ VRAM full');
  };
  const droofline = (svg) => {
    const { X, Y, l, t, pw } = roofAxes(svg, 760);
    NS3.forEach(([n, c]) => {
      const at = (B) => { const i = dsum(DFL, n, B) / dsum(DBY, n, B); return [i, Math.min(EF, EB * i)]; };
      el(svg, 'polyline', { points: Bs(n).map((B) => { const [i, f] = at(B); return `${X(i)},${Y(f)}`; }).join(' '), fill: 'none', stroke: c, 'stroke-width': 3 });
      [1, fits(n)].forEach((B, k) => {
        const [i, f] = at(B);
        el(svg, 'circle', { cx: X(i), cy: Y(f), r: 7, fill: c, stroke: C.slide, 'stroke-width': 3 });
        if (k) el(svg, 'text', { x: X(i) + 12, y: Y(f) + 26, fill: C.ink, 'font-size': 18, ...HALO }, `B = ${B}`);
      });
    });
    const i1 = dsum(DFL, 1024, 1) / dsum(DBY, 1024, 1);
    el(svg, 'text', { x: X(i1) + 12, y: Y(EB * i1) + 6, fill: C.ink, 'font-size': 18, ...HALO }, 'B = 1');
    keys(svg, l + pw + 30, t + 12, NS3.map(([n, c]) => [`n = ${fmtN(n)}`, c]));
    el(svg, 'text', { x: l + pw + 30, y: t + 120, fill: C.slate, 'font-size': 16 }, 'dots: B = 1 and');
    el(svg, 'text', { x: l + pw + 30, y: t + 142, fill: C.slate, 'font-size': 16 }, 'the largest B that fits');
  };

  /* ---------- the abstract RTX 5090 ---------- */
  const model = (svg) => {
    const defs = el(svg, 'defs');
    const mk = el(defs, 'marker', { id: 'cost-ar', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
    el(mk, 'path', { d: 'M0 0L10 5L0 10z', fill: C.slate });
    const head = (x, y, w, title, size, stroke, h) => {
      el(svg, 'rect', { x, y, width: w, height: h, rx: 6, fill: C.slide, stroke, 'stroke-width': 3 });
      el(svg, 'text', { x: x + 20, y: y + 40, fill: C.ink, 'font-size': 28, 'font-weight': 600 }, title);
      if (size) el(svg, 'text', { x: x + w - 20, y: y + 40, fill: C.slate, 'font-size': 24, 'text-anchor': 'end' }, size);
    };
    // a box filled with stacked bands: [label, colour, share]
    const filled = (x, y, w, h, stroke, title, size, bands) => {
      head(x, y, w, title, size, stroke, h);
      let by = y + 62; const bh = h - 78;
      bands.forEach(([label, c, share]) => {
        const hh = bh * share;
        el(svg, 'rect', { x: x + 14, y: by, width: w - 28, height: hh - 4, rx: 3, fill: c, opacity: 0.85 });
        el(svg, 'text', { x: x + w / 2, y: by + hh / 2 + 8, fill: C.slide, 'font-size': 24, 'font-weight': 600, 'text-anchor': 'middle' }, label);
        by += hh;
      });
    };
    const link = (x1, x2, y, top, bottom) => {
      el(svg, 'line', { x1: x1 + 4, y1: y, x2: x2 - 4, y2: y, stroke: C.slate, 'stroke-width': 3, 'marker-start': 'url(#cost-ar)', 'marker-end': 'url(#cost-ar)' });
      el(svg, 'text', { x: (x1 + x2) / 2, y: y - 16, fill: C.ink, 'font-size': 24, 'font-weight': 600, 'text-anchor': 'middle' }, top);
      if (bottom) el(svg, 'text', { x: (x1 + x2) / 2, y: y + 32, fill: C.slate, 'font-size': 20, 'text-anchor': 'middle' }, bottom);
    };
    filled(90, 180, 360, 400, C.blue, 'VRAM', '32 GB', [['weights', C.magenta, 0.45], ['KV cache', C.gold, 0.25], ['activations', C.blue, 0.3]]);
    link(450, 620, 380, '1.79 TB/s', 'read or write');
    filled(620, 180, 250, 400, C.green, 'Cache', 'size: ∞', [['temporaries', C.green, 1]]);
    link(870, 1020, 380, '∞ bytes/s');
    head(1020, 290, 190, 'Compute', '', C.slate, 180);
    ['tensor cores', '209.5 TFLOP/s', 'bf16, dense'].forEach((s, k) => el(svg, 'text', { x: 1040, y: 370 + k * 32, fill: C.slate, 'font-size': 22 }, s));
  };

  /* ---------- C = A · B, step by step ---------- */
  // 0 shapes · 1 the cell c11 · 2 its sum of products · 3 every cell, then 2abc · 4 bytes read · 5 bytes written
  const matmul = (svg, root) => {
    const a = 4, b = 6, c = 5, s = 32;
    const ax = 230, bx = ax + b * s + 60, by = 195, y0 = by + b * s + 52;
    const grid = (x, y, rows, cols) => [...Array(rows).keys()].map((i) => [...Array(cols).keys()].map((j) =>
      el(svg, 'rect', { x: x + j * s, y: y + i * s, width: s, height: s, class: 'cell' })));
    const A = grid(ax, y0, a, b), B = grid(bx, by, b, c), Cm = grid(bx, y0, a, c);
    const name = (x, y, t, anchor) => el(svg, 'text', { x, y, fill: C.ink, 'font-size': 32, 'text-anchor': anchor, ...MATH }, t);
    name(ax + b * s / 2, y0 + a * s + 44, 'A', 'middle');
    name(bx + c * s + 22, by + b * s / 2 + 10, 'B', 'start');
    name(bx + c * s + 22, y0 + a * s / 2 + 10, 'C', 'start');
    brace(svg, 'left', y0, y0 + a * s, ax, 'a', C.blue); brace(svg, 'top', ax, ax + b * s, y0, 'b', C.gold);
    brace(svg, 'left', by, by + b * s, bx, 'b', C.gold); brace(svg, 'top', bx, bx + c * s, by, 'c', C.magenta);
    const terms = el(svg, 'g');
    const say = el(svg, 'text', { x: bx, y: y0 + a * s + 44, fill: C.ink, 'font-size': 24 });
    const px = bx + c * s + 90;
    const all = [...A.flat(), ...B.flat(), ...Cm.flat()];
    const counts = (k, gold) => [['FLOPs', '2abc'], ['bytes read', '2(ab + bc)'], ['bytes written', '2ac']].slice(0, k).forEach(([t, v], q) => {
      el(terms, 'text', { x: px, y: by + 40 + q * 54, fill: C.slate, 'font-size': 24 }, t);
      el(terms, 'text', { x: px + 170, y: by + 40 + q * 54, fill: q === gold ? C.gold : C.ink, 'font-size': 30, ...MATH }, v);
    });
    let timer;
    return (st) => {
      clearInterval(timer); terms.innerHTML = ''; say.textContent = '';
      all.forEach((r) => r.setAttribute('class', 'cell'));
      const play = st !== null;
      if (st === null) st = 5;
      if (st === 1 || st === 2) {
        A[0].forEach((r) => r.classList.add('row')); B.forEach((row) => row[0].classList.add('row')); Cm[0][0].classList.add('on');
        say.textContent = 'c11: row 1 of A, column 1 of B';
      }
      if (st === 2) {
        el(terms, 'text', { x: px, y: by + 30, fill: C.ink, 'font-size': 26, ...MATH }, 'c11 = 0');
        let k = 0;
        const tick = () => {
          if (k > 0) { A[0][k - 1].setAttribute('class', 'cell row'); B[k - 1][0].setAttribute('class', 'cell row'); }
          if (k < b) {
            A[0][k].setAttribute('class', 'cell on'); B[k][0].setAttribute('class', 'cell on');
            el(terms, 'text', { x: px + 50, y: by + 68 + k * 36, fill: C.gold, 'font-size': 26, ...MATH }, `+ a1${k + 1} · b${k + 1}1`);
            say.textContent = `${k + 1} multiplies + ${k + 1} adds`;
          } else { say.textContent = 'b multiplies + b adds = 2b FLOPs'; clearInterval(timer); }
          k++;
        };
        timer = setInterval(tick, 500); tick();
      }
      if (st === 3) {
        say.textContent = 'a · c cells';
        // one cell at a time: its row of A, its column of B and the cell itself in gold
        let k = 0;
        const tick = () => {
          all.forEach((r) => r.setAttribute('class', 'cell'));
          if (k === a * c) { clearInterval(timer); counts(1, 0); return; }
          const i = Math.floor(k / c), j = k % c;
          A[i].forEach((r) => r.classList.add('on')); B.forEach((row) => row[j].classList.add('on')); Cm[i][j].classList.add('on');
          k++;
        };
        if (play) { timer = setInterval(tick, 200); tick(); } else counts(1, 0);
      }
      if (st === 4) {
        [...A.flat(), ...B.flat()].forEach((r) => r.classList.add('on'));
        counts(2, 1);
        say.textContent = 'A and B: VRAM → cache, once';
      }
      if (st === 5) {
        Cm.flat().forEach((r) => r.classList.add('on'));
        counts(3, 2);
        say.textContent = 'C: cache → VRAM, once';
      }
    };
  };

  document.querySelectorAll('div.cost[data-cost]:not(.cost-built)').forEach((root) => {
    root.classList.add('cost-built');
    const svg = el(root, 'svg', { viewBox: '0 0 1280 720' });
    const kind = root.dataset.cost;
    if (kind === 'model') model(svg);
    else if (kind === 'matmul') { const draw = matmul(svg, root); steps(root, 5, draw); }
    else if (kind === 'flops') curves(svg, FLOPS, { unit: 'FLOP', total: true });
    else if (kind === 'ftime') curves(svg, per(FLOPS, EF), { unit: 's', total: true, mark: 1024 });
    else if (kind === 'bytes') curves(svg, BYTES, { unit: 'B', total: true });
    else if (kind === 'btime') curves(svg, per(BYTES, EB), { unit: 's', total: true, mark: 1024 });
    else if (kind === 'bound') {
      curves(svg, [
        { label: 'memory time', color: C.blue, f: (m, n) => sum(BYTES, m, n) / EB },
        { label: 'compute time', color: C.green, f: (m, n) => sum(FLOPS, m, n) / EF },
      ], { unit: 's', mark: 1024 });
    } else if (kind === 'roofline') roofline(svg);
    else if (kind === 'dflops') curves(svg, DFL, { unit: 'FLOP', total: true, xlabel: 'n, context tokens (log)', shade: VSHADE });
    else if (kind === 'dbytes') curves(svg, DBY, { unit: 'B', total: true, xlabel: 'n, context tokens (log)', shade: VSHADE });
    else if (kind === 'dtime') {
      curves(svg, [
        { label: 'memory time', color: C.blue, f: (m, n) => dsum(DBY, n, 1) / EB },
        { label: 'compute time', color: C.green, f: (m, n) => dsum(DFL, n, 1) / EF },
      ], { unit: 's', mark: 1024, xlabel: 'n, context tokens (log)', shade: VSHADE });
    } else if (kind === 'batch') batch(svg);
    else if (kind === 'throughput') throughput(svg);
    else if (kind === 'droofline') droofline(svg);
  });
})();
