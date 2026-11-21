// Attention variants compared: compute, KV cache, quality (attention.html).
//
// <div class="tr" data-tr="compare" data-upto="MLA">: the « where it stands » slide after each
// variant. Log-log plots of the attention FLOPs of a prefill of n tokens and of the KV cache at
// context n, plus a quality strip. The variants up to data-upto (deck order) are drawn, the earlier
// ones in slate, data-upto in gold, MHA in blue.
// <div class="tr" data-tr="plane">: the history slide, every variant on one plane (x compute,
// y KV cache, both at n = 128K, colour quality), revealed in chronological order.
// <div class="tr" data-tr="lanes">: an alternative history slide (unused), one lane per trick.
// The <p> children are the captions, one per step. Elements carry their visibility as in
// themes/swa.js (data-s / data-e: first / last step). Uses steps.js. Styles: themes/tradeoffs.css.
(() => {
  const C = { blue: '#4aa8ff', magenta: '#d97fd0', green: '#7cc47a', gold: '#f5c451', cyan: '#8fc5fa',
              orange: '#ff9f43', slate: '#8e95a2', ink: '#e3e9f3', panel: '#18233a', dim: '#3d4a63',
              slide: '#0f1829', line: '#2a3550' };
  // quality grades, checked with the dataviz validator on the slide background (all pairs ΔE ≥ 9.8 deutan)
  const Q = { worse: '#ff7a45', mid: '#6b7385', better: '#3ddc97' };
  const qcol = (q) => (q < -0.3 ? Q.worse : q > 0.3 ? Q.better : Q.mid);
  const A = (o = {}) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => ` data-${k}="${v}"`).join('');
  const text = (x, y, t, style = '', o = {}) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" style="${style}"${A(o)}>${t}</text>`;
  const line = (x1, y1, x2, y2, stroke, extra = '', o = {}) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" ${extra}${A(o)}/>`;
  const rect = (x, y, w, h, fill, extra = '', o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}${A(o)}/>`;
  const g = (inner, o = {}) => `<g${A(o)}>${inner}</g>`;
  const svg = (inner) => `<svg width="1280" height="720" viewBox="0 0 1280 720"><defs>
    <marker id="tr-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0 0L10 5L0 10z" fill="${C.slate}"/></marker>
    <marker id="tr-arrg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0 0L10 5L0 10z" fill="${C.gold}"/></marker></defs>${inner}</svg>`;

  // ---- the cost models: a 32-layer model, d = 4 096, H = 32 query heads of d_h = 128, bf16 ----
  const L = 32, H = 32, dh = 128, B = 2;
  const pairs = (n) => n * (n + 1) / 2;                          // causal query-key pairs
  const win = (n, W) => (n <= W ? pairs(n) : pairs(W) + (n - W) * W);  // at most W keys per query
  const dense = (n, dqk, dv) => 2 * pairs(n) * H * (dqk + dv);   // FLOPs, per layer: QKᵀ and AV
  const kdaFl = (n) => 2 * n * H * (3 * dh * dh + 64 * 2 * dh);  // chunked delta rule, chunk 64
  const kdaMem = H * dh * dh * B;                                // one d_k × d_v state per head
  const M = {
    MHA: { mem: (n) => L * n * 2 * H * dh * B, fl: (n) => L * dense(n, dh, dh), q: 0 },
    MQA: { mem: (n) => L * n * 2 * dh * B, fl: (n) => L * dense(n, dh, dh), q: -0.7 },
    GQA: { mem: (n) => L * n * 2 * 8 * dh * B, fl: (n) => L * dense(n, dh, dh), q: -0.15 },
    MLA: { mem: (n) => L * n * 576 * B, fl: (n) => L * dense(n, 192, dh), q: 0.2 },
    DSA: { mem: (n) => L * n * (576 * B + 128), fl: (n) => L * (2 * pairs(n) * 32 * 128 + 2 * win(n, 2048) * H * 320), q: 0.1 },
    SWA: { mem: (n) => L * Math.min(n, 4096) * 2 * H * dh * B, fl: (n) => L * 2 * win(n, 4096) * H * 2 * dh, q: -0.85 },
    KDA: { mem: () => L * kdaMem, fl: (n) => L * kdaFl(n), q: -1 },
    // hybrids: Gemma 3's pattern, 5 SWA layers (W = 1 024) per global layer, on MHA as SWA above;
    // Kimi Linear, 3 KDA layers per MLA layer
    'SWA 5:1': { mem: (n) => L / 6 * (5 * Math.min(n, 1024) + n) * 2 * H * dh * B,
                 fl: (n) => L / 6 * (5 * 2 * win(n, 1024) + 2 * pairs(n)) * H * 2 * dh, q: -0.15 },
    'KDA 3:1': { mem: (n) => L / 4 * (3 * kdaMem + n * 576 * B), fl: (n) => L / 4 * (3 * kdaFl(n) + dense(n, 192, dh)), q: 0.6 },
  };
  const DECK = ['MHA', 'MQA', 'SWA', 'SWA 5:1', 'GQA', 'MLA', 'DSA', 'KDA', 'KDA 3:1'];   // chronological, as in the deck

  // ---- log scales ----
  const lg = Math.log10;
  const scale = (d0, d1, r0, r1) => (v) => r0 + (lg(v) - lg(d0)) / (lg(d1) - lg(d0)) * (r1 - r0);
  const NS = [1, 4, 16, 64, 256, 1024].map((k) => k * 1024);
  const nLab = (n) => (n >= 1 << 20 ? `${n >> 20}M` : `${n >> 10}K`);
  const SI = (v, unit) => {
    const p = ['', 'K', 'M', 'G', 'T', 'P', 'E'], e = Math.floor(lg(v) / 3);
    return `${Math.round(v / 10 ** (3 * e))} ${p[e]}${unit}`;
  };
  const SI2 = (v, unit) => {                                     // two significant digits
    const p = ['', 'K', 'M', 'G', 'T', 'P', 'E'], e = Math.floor(lg(v) / 3), x = v / 10 ** (3 * e);
    return `${x < 10 ? x.toFixed(1) : Math.round(x)} ${p[e]}${unit}`;
  };
  const ratio = (r) => (r >= 1.5 ? `÷${r >= 100 ? Math.round(r).toLocaleString('en').replace(/,/g, ' ') : (+r.toFixed(r >= 10 ? 0 : 1)).toString()}` :
                        r <= 0.67 ? `×${(1 / r).toFixed(1)}` : '≈');

  // a log-log panel: frame, grid, ticks; returns the scales
  const panel = (x0, y0, w, h, ylo, yhi, unit, title) => {
    const sx = scale(1024, 1 << 20, x0, x0 + w), sy = scale(ylo, yhi, y0 + h, y0);
    let s = text(x0, y0 - 18, title, `font-size:19px;font-weight:600`);
    for (let e = Math.ceil(lg(ylo)); e <= lg(yhi); e++) {
      const y = sy(10 ** e);
      s += line(x0, y, x0 + w, y, C.line, 'stroke-width="1"') + text(x0 - 8, y + 5, SI(10 ** e, unit), `font-size:13px;fill:${C.slate};text-anchor:end`);
    }
    NS.forEach((n) => { s += line(sx(n), y0 + h, sx(n), y0 + h + 5, C.slate) + text(sx(n), y0 + h + 22, nLab(n), `font-size:13px;fill:${C.slate};text-anchor:middle`); });
    s += line(x0, y0 + h, x0 + w, y0 + h, C.slate) + text(x0 + w, y0 + h + 44, 'context n →', `font-size:14px;fill:${C.slate};text-anchor:end`);
    return { s, sx, sy };
  };
  const path = (f, sx, sy) => {
    let d = '';
    for (let k = 10; k <= 20.001; k += 0.05) { const n = 2 ** k; d += `${d ? 'L' : 'M'}${sx(n).toFixed(1)} ${sy(f(n)).toFixed(1)}`; }
    return d;
  };
  // end labels, pushed apart vertically; identical curves share one label « MHA = MQA = GQA »
  const endLabels = (items, x, gap = 17) => {
    const groups = [];
    items.slice().sort((a, b) => a.y - b.y).forEach((it) => {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last.y0 - it.y) < 0.5) last.items.push(it); else groups.push({ y0: it.y, y: it.y, items: [it] });
    });
    for (let i = 1; i < groups.length; i++) groups[i].y = Math.max(groups[i].y, groups[i - 1].y + gap);
    return groups.map((gr) => gr.items.map((it) => it.style)).length && groups;
  };

  const FIG = {};

  // ---- the per-method slide ----
  // step 0: the variants seen so far; step 1: the new one, in gold; step 2: its ratios vs MHA at 128 K.
  // MHA's slide introduces the plots instead: 0 empty axes, 1 the curves, 2 slope triangles,
  // 3 the values at 128 K, 4 the quality strip.
  FIG.compare = (root) => {
    const upto = root.dataset.upto, k = DECK.indexOf(upto), seen = DECK.slice(0, k + 1), intro = upto === 'MHA';
    const N = 128 * 1024;
    const P1 = panel(150, 190, 330, 300, 1e11, 1e18, 'FLOP', 'Compute: prefill of n tokens');
    const P2 = panel(640, 190, 330, 300, 1e7, 1e12, 'B', 'Memory: KV cache at context n');
    let s = P1.s + P2.s;
    const style = (id) => (id === upto ? `stroke="${C.gold}" stroke-width="4"` : id === 'MHA' ? `stroke="${C.blue}" stroke-width="2.5"` :
                           `stroke="${C.slate}" stroke-width="1.8" stroke-opacity=".75"`);
    const ink = (id) => (id === upto ? C.gold : id === 'MHA' ? C.blue : C.slate);
    [[P1, 'fl', 488], [P2, 'mem', 978]].forEach(([P, key, xl]) => {
      // draw the new curve last, so it is on top
      seen.slice().sort((a, b) => (a === upto) - (b === upto)).forEach((id) => {
        s += `<path d="${path(M[id][key], P.sx, P.sy)}" fill="none" ${style(id)} stroke-linejoin="round"${A({ s: id === upto ? 1 : null })}/>`;
      });
      endLabels(seen.map((id) => ({ id, y: P.sy(M[id][key](1 << 20)) })), xl).forEach((gr) => {
        const ids = gr.items.map((it) => it.id), cur = ids.includes(upto);
        const lab = ids.map((id) => `<tspan style="fill:${ink(id)}">${id}</tspan>`).join(' = ');
        // before step 1 the new curve is hidden: its label too (a shared label shows without it)
        if (cur && ids.length > 1) {
          s += text(xl, gr.y + 5, ids.filter((i) => i !== upto).map((id) => `<tspan style="fill:${ink(id)}">${id}</tspan>`).join(' = '), 'font-size:15px', { e: 0 });
          s += text(xl, gr.y + 5, lab, 'font-size:15px;font-weight:600', { s: 1 });
        } else s += text(xl, gr.y + 5, lab, `font-size:15px${cur ? ';font-weight:600' : ''}`, { s: cur ? 1 : null });
      });
      if (intro) {
        // step 2: ×4 in n, from 16K to 64K: ×16 compute, ×4 memory
        const [n1, n2] = [16384, 65536], x1 = P.sx(n1), x2 = P.sx(n2), y1 = P.sy(M.MHA[key](n1)), y2 = P.sy(M.MHA[key](n2));
        const f = M.MHA[key](n2) / M.MHA[key](n1);
        s += g(`<path d="M${x1} ${y1}L${x2} ${y1}L${x2} ${y2}" fill="none" stroke="${C.ink}" stroke-width="2"/>` +
          text((x1 + x2) / 2, y1 + 22, '×4 n', 'font-size:16px;text-anchor:middle') +
          text(x2 + 8, (y1 + y2) / 2 + 6, `×${Math.round(f)}`, `font-size:17px;font-weight:600;fill:${C.gold}`) +
          text(x2 + 8, (y1 + y2) / 2 + 26, key === 'fl' ? 'slope 2' : 'slope 1', `font-size:14px;fill:${C.slate}`), { s: 2 });
        // step 3: the values at 128 K
        const x = P.sx(N), y = P.sy(M.MHA[key](N));
        s += g(line(x, P.sy(key === 'fl' ? 1e18 : 1e12), x, P.sy(key === 'fl' ? 1e11 : 1e7), C.slate, 'stroke-dasharray="3 5"') +
          `<circle cx="${x}" cy="${y}" r="5" fill="${C.gold}"/>` +
          text(x - 10, y - 10, SI2(M.MHA[key](N), key === 'fl' ? 'FLOP' : 'B'), `font-size:17px;font-weight:600;fill:${C.gold};text-anchor:end`) +
          text(x, P.sy(key === 'fl' ? 1e18 : 1e12) - 4, 'n = 128K', `font-size:13px;fill:${C.slate};text-anchor:middle`), { s: 3 });
        return;
      }
      // step 2: the ratio at 128 K
      const x = P.sx(N), ym = P.sy(M.MHA[key](N)), yc = P.sy(M[upto][key](N));
      const r = M.MHA[key](N) / M[upto][key](N);
      s += g(line(x, P.sy(key === 'fl' ? 1e18 : 1e12), x, P.sy(key === 'fl' ? 1e11 : 1e7), C.slate, 'stroke-dasharray="3 5"') +
        (Math.abs(ym - yc) > 8 ? line(x, ym, x, yc, C.gold, 'stroke-width="2" marker-end="url(#tr-arrg)"') : '') +
        `<circle cx="${x}" cy="${yc}" r="5" fill="${C.gold}"/>` +
        text(x - 8, (ym + yc) / 2 + 6, `${ratio(r)} vs MHA`, `font-size:17px;font-weight:600;fill:${C.gold};text-anchor:end`) +
        text(x, P.sy(key === 'fl' ? 1e18 : 1e12) - 4, 'n = 128K', `font-size:13px;fill:${C.slate};text-anchor:middle`), { s: 2 });
    });
    // quality strip: three bands, each variant a dot (on MHA's slide, shown at step 4)
    const qx = 1090, qy = (q) => 340 - q * 140, s0 = s;
    s += text(1060, 172, 'Quality vs MHA', 'font-size:19px;font-weight:600');
    [['better', 0.65, Q.better], ['≈ MHA', 0, C.ink], ['worse', -0.8, Q.worse]].forEach(([t, q, c]) =>
      { s += text(1060, qy(q) + 5, t, `font-size:14px;fill:${c};text-anchor:start`); });
    s += line(qx + 50, qy(1), qx + 50, qy(-1.1), C.line, 'stroke-width="2"') +
      line(qx + 44, qy(0.3), qx + 56, qy(0.3), C.line, 'stroke-width="2"') + line(qx + 44, qy(-0.3), qx + 56, qy(-0.3), C.line, 'stroke-width="2"');
    // the grade picks the band; inside a band the dots are spaced evenly, ordered by q
    const band = (q) => (q > 0.3 ? 0.65 : q < -0.3 ? -0.8 : 0), qpos = {};
    [0.65, 0, -0.8].forEach((c) => {
      const ids = seen.filter((id) => band(M[id].q) === c).sort((a, b) => M[b].q - M[a].q);
      const gap = Math.min(22, 76 / Math.max(ids.length - 1, 1));
      ids.forEach((id, i) => { qpos[id] = qy(c) + (i - (ids.length - 1) / 2) * gap; });
    });
    seen.forEach((id) => {
      const y = qpos[id], cur = id === upto;
      // dot in its quality colour (as on the history slide); the new variant larger, ringed
      s += g(`<circle cx="${qx + 50}" cy="${y}" r="${cur ? 8 : 6}" fill="${qcol(M[id].q)}" stroke="${C.slide}" stroke-width="2"/>` +
        (cur ? `<circle cx="${qx + 50}" cy="${y}" r="13" fill="none" stroke="${C.ink}" stroke-width="2"/>` : '') +
        text(qx + 70, y + 5, id, `font-size:15px;fill:${ink(id)}${cur ? ';font-weight:600' : ''}`), { s: cur && !intro ? 1 : null });
    });
    s += text(1060, 520, 'from each paper\'s ablations:', `font-size:12px;fill:${C.slate}`) +
      text(1060, 536, 'ordinal, not one benchmark', `font-size:12px;fill:${C.slate}`);
    if (intro) s = s0 + g(s.slice(s0.length), { s: 4 });
    return svg(s);
  };

  // ---- history 1: one plane, x = compute, y = KV cache (both at n = 128K), colour = quality;
  // variants added in chronological order, an arrow from their parent ----
  const HIST = [
    { id: 'MHA', yr: 2017.45 }, { id: 'MQA', yr: 2019.85, from: 'MHA' }, { id: 'SWA', yr: 2020.3 },
    { id: 'GQA', yr: 2023.4, from: 'MQA' }, { id: 'MLA', yr: 2024.4 }, { id: 'SWA 5:1', yr: 2024.55, from: 'SWA' },
    { id: 'DSA', yr: 2025.7, from: 'MLA' }, { id: 'KDA', yr: 2025.78 }, { id: 'KDA 3:1', yr: 2025.86, from: 'KDA' },
  ];
  // quality, three grades: worse (orange), ≈ MHA (light neutral), better (green); q within ±0.3 is ≈
  FIG.plane = () => {
    const N = 128 * 1024, x0 = 250, x1 = 980, y0 = 262, y1 = 520;
    const sx = scale(1e13, 1e16, x0, x1), sy = scale(1e7, 1e11, y1, y0);
    let s = '';
    // timeline ribbon
    const tx = (yr) => 170 + (yr - 2017) / 9 * 990;
    s += line(tx(2017), 170, tx(2026), 170, C.line, 'stroke-width="2"');
    for (let yr = 2017; yr <= 2025; yr++) s += line(tx(yr), 165, tx(yr), 175, C.slate) + text(tx(yr), 158, yr, `font-size:13px;fill:${C.slate};text-anchor:middle`);
    // axes
    for (let e = 13; e <= 16; e++) s += line(sx(10 ** e), y0, sx(10 ** e), y1, C.line) + text(sx(10 ** e), y1 + 20, SI(10 ** e, 'FLOP'), `font-size:13px;fill:${C.slate};text-anchor:middle`);
    for (let e = 7; e <= 11; e++) s += line(x0, sy(10 ** e), x1, sy(10 ** e), C.line) + text(x0 - 8, sy(10 ** e) + 5, SI(10 ** e, 'B'), `font-size:13px;fill:${C.slate};text-anchor:end`);
    s += text(x1, y1 + 42, 'prefill compute at n = 128K →', `font-size:15px;fill:${C.slate};text-anchor:end`) +
      text(x0 - 8, y0 - 14, '↑ KV cache at n = 128K', `font-size:15px;fill:${C.slate};text-anchor:start`) +
      text(x0 + 10, y1 - 10, '↙ cheaper', `font-size:14px;fill:${C.slate}`);
    // quality legend: three swatches
    const bx = 1070;
    s += text(bx, 280, 'Quality vs MHA', 'font-size:16px;font-weight:600') +
      [['better', 1], ['≈ MHA', 0], ['worse', -1]].map(([t, q], i) =>
        `<circle cx="${bx + 9}" cy="${316 + i * 36}" r="9" fill="${qcol(q)}"/>` + text(bx + 28, 321 + i * 36, t, 'font-size:16px')).join('') +
      text(bx, 432, 'from each paper\'s', `font-size:12px;fill:${C.slate}`) + text(bx, 447, 'ablations', `font-size:12px;fill:${C.slate}`);
    const pos = {};
    HIST.forEach((v, k) => {
      const row = { SWA: 1, 'SWA 5:1': 1, KDA: 1, 'KDA 3:1': 2 }[v.id] ?? 0, q = M[v.id].q;
      s += g(`<circle cx="${tx(v.yr)}" cy="170" r="5" fill="${qcol(q)}"/>` +
        text(tx(v.yr), 192 + row * 15, v.id, `font-size:13px;text-anchor:middle`), { s: k });
      const x = sx(M[v.id].fl(N)), y = sy(M[v.id].mem(N));
      pos[v.id] = [x, y];
      if (v.from) {
        const [fx, fy] = pos[v.from], dx = x - fx, dy = y - fy, d = Math.hypot(dx, dy) || 1;
        s += line(fx + dx / d * 10, fy + dy / d * 10, x - dx / d * 12, y - dy / d * 12, C.slate, 'stroke-width="1.5" marker-end="url(#tr-arr)"', { s: k });
      }
      s += g(`<circle cx="${x}" cy="${y}" r="9" fill="${qcol(q)}" stroke="${C.slide}" stroke-width="2"/>` +
        (v.id === 'DSA' || v.id === 'SWA' ? text(x - 14, y + 5, v.id, 'font-size:16px;text-anchor:end') : text(x + 14, y + 5, v.id, 'font-size:16px')), { s: k });
      s += `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="${C.ink}" stroke-width="2"${A({ s: k, e: k })}/>`;
    });
    return svg(s);
  };

  // ---- history 2: one lane per trick ----
  FIG.lanes = () => {
    const N = 128 * 1024, tx = (yr) => 300 + (yr - 2017) / 9 * 910;
    const lanes = ['Fewer K/V heads', 'Compress K/V', 'Read fewer keys', 'Fixed-size state', 'Mix layer types'];
    const ly = (i) => 200 + i * 78;
    const cards = [
      { id: 'MHA', yr: 2017.45, lane: -1, who: 'Transformer' },
      { id: 'MQA', yr: 2019.85, lane: 0, who: 'Shazeer' },
      { id: 'SWA', yr: 2020.3, lane: 2, who: 'Longformer' },
      { id: 'GQA', yr: 2023.4, lane: 0, who: 'Llama 2 70B' },
      { id: 'MLA', yr: 2024.4, lane: 1, who: 'DeepSeek-V2' },
      { id: 'SWA 5:1', yr: 2024.45, lane: 4, who: 'Gemma 2, 3' },
      { id: 'DSA', yr: 2025.7, lane: 2, who: 'DeepSeek-V3.2' },
      { id: 'KDA', yr: 2025.6, lane: 3, who: 'Kimi Linear' },
      { id: 'KDA 3:1', yr: 2025.8, lane: 4, who: 'Kimi Linear' },
    ];
    let s = '';
    for (let yr = 2017; yr <= 2026; yr++) s += line(tx(yr), 172, tx(yr), 560, C.line) + text(tx(yr), 162, yr, `font-size:13px;fill:${C.slate};text-anchor:middle`);
    const w = 100, hh = 68, mhaR = tx(2017.45) + w / 2;
    lanes.forEach((t, i) => { s += text(72, ly(i) + 6, t, `font-size:17px;fill:${C.slate}`) + line(mhaR + 30, ly(i), 1210, ly(i), C.line, 'stroke-dasharray="2 6"'); });
    const qm = (q) => (q > 0.3 ? `<tspan style="fill:${Q.better}">▲ quality</tspan>` : q < -0.3 ? `<tspan style="fill:${Q.worse}">▼ quality</tspan>` : '≈ quality');
    cards.forEach((c, k) => {
      const x = Math.min(tx(c.yr) - w / 2, 1210 - w), y = c.lane < 0 ? ly(2) - hh / 2 : ly(c.lane) - hh / 2;
      const r = M.MHA.mem(N) / M[c.id].mem(N);
      const body = c.lane < 0 ? text(x + 9, y + 52, 'the reference', 'font-size:12px') :
        text(x + 9, y + 47, `KV ${ratio(r)}`, 'font-size:12px') + text(x + 9, y + 61, qm(M[c.id].q), 'font-size:12px');
      s += g(rect(x, y, w, hh, C.panel, `rx="5" stroke="${C.blue}" stroke-width="1.5"`) +
        text(x + 9, y + 18, c.id, 'font-size:15px;font-weight:600') +
        text(x + 9, y + 32, c.who, `font-size:11px;fill:${C.slate}`) + body, { s: k });
      s += rect(x - 3, y - 3, w + 6, hh + 6, 'none', `rx="7" stroke="${C.gold}" stroke-width="2.5"`, { s: k, e: k });
    });
    // MHA feeds every lane
    lanes.forEach((_, i) => { s += line(mhaR, ly(2), mhaR + 30, ly(i), C.slate, 'stroke-width="1"', { s: 0 }); });
    return svg(s);
  };

  document.querySelectorAll('.tr').forEach((root) => {
    const caps = [...root.querySelectorAll(':scope > p')];
    const body = document.createElement('div'); body.className = 'tr-body';
    body.innerHTML = FIG[root.dataset.tr](root);
    const box = document.createElement('div'); box.className = 'tr-caps';
    box.append(...caps);
    root.append(body, box);
    const show = (st) => {
      body.querySelectorAll('[data-s], [data-e]').forEach((el) => {
        const s = el.dataset.s != null ? +el.dataset.s : -Infinity, e = el.dataset.e != null ? +el.dataset.e : Infinity;
        el.classList.toggle('off', st < s || st > e);
      });
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    };
    steps(root, caps.length - 1, (st) => show(st == null ? caps.length - 1 : st));
  });
})();
