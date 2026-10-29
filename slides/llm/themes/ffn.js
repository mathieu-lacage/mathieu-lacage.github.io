// FFN slides: « Inside the FFN » (up/down blocks, then gate/up/down), « FFN, matrix version »,
// « Mixture of Experts » and « The router ».
//
// Each slide is a <div class="ffn" data-ffn="name"> whose <p> children are its captions,
// one per step. The figure is one SVG in slide coordinates (1280 × 720), built once by
// FIG[name](); its elements carry their visibility as attributes:
//   data-s / data-e  first / last step the element shows (default: always)
//   data-play        the step whose entry replays the element's CSS animation (class pop,
//                    hop): only when stepping forward by one, otherwise the end state shows
// In the PDF (steps() gives null) the last step shows, without animation.
// Colours: X blue, gate blue, up magenta, H gold, Down green, Y violet (as on the transformer slide).
// Uses steps.js (load it first). Styles: themes/ffn.css.
(() => {
  const C = { blue: '#4aa8ff', magenta: '#d97fd0', green: '#7cc47a', gold: '#f5c451', orange: '#ff9f43', slate: '#8e95a2',
              ink: '#e3e9f3', panel: '#18233a', dim: '#3d4a63', red: '#ff6b6b', slide: '#0f1829', brace: '#8fc5fa' };
  const A = (o = {}) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => ` data-${k}="${v}"`).join('');
  const rect = (x, y, w, h, fill, o = {}, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}${A(o)}/>`;
  const text = (x, y, t, o = {}, style = '') => `<text x="${x}" y="${y}" style="${style}"${A(o)}>${t}</text>`;
  const line = (x1, y1, x2, y2, stroke, o = {}, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" ${extra}${A(o)}/>`;
  const g = (inner, o = {}, extra = '') => `<g ${extra}${A(o)}>${inner}</g>`;
  const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const shade = (palette, r) => palette[Math.floor(r() * palette.length)];
  const sub = (s) => `<tspan baseline-shift="sub" font-size="14">${s}</tspan>`;

  function brace(x1, x2, y, label, color, o = {}, below = true) {
    const d = below ? 8 : -8, m = (x1 + x2) / 2;
    return g(`<path d="M${x1} ${y} q0 ${d} 8 ${d} H${m - 8} q8 0 8 ${d} q0 ${-d} 8 ${-d} H${x2 - 8} q8 0 8 ${-d}" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      text(m, y + (below ? 2 * d + 20 : 2 * d - 8), label, {}, `font-size:18px;fill:${color};text-anchor:middle;font-style:italic`), o);
  }
  function vbrace(x, y1, y2, label, color, o = {}) {
    const m = (y1 + y2) / 2;
    return g(`<path d="M${x} ${y1} q-8 0 -8 8 V${m - 8} q0 8 -8 8 q8 0 8 8 V${y2 - 8} q0 8 8 8" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      text(x - 24, m + 6, label, {}, `font-size:18px;fill:${color};text-anchor:end;font-style:italic`), o);
  }
  // arrowheads: marker ids are per figure (a marker in a hidden slide would not render elsewhere)
  let uid = 0;
  const arrow = (x1, y1, x2, y2, k, o = {}, w = 2.5) => line(x1, y1, x2, y2, C[k], o, `stroke-width="${w}" marker-end="url(#AH-${k})"`);
  function svg(inner) {
    const id = `ffn${uid++}`;
    const defs = ['slate', 'gold'].map((k) =>
      `<marker id="${id}-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${C[k]}"/></marker>`).join('');
    return `<svg width="1280" height="720" viewBox="0 0 1280 720"><defs>${defs}</defs>${inner.replaceAll('url(#AH-', `url(#${id}-`)}</svg>`;
  }
  // matrix as a block of cells (rows × cols, unit u), faint grid
  function mat(x, y, rows, cols, u, color, { o = {}, op = .35, label = '' } = {}) {
    let s = rect(x, y, cols * u, rows * u, color, {}, `opacity="${op}"`);
    for (let i = 1; i < rows; i++) s += line(x, y + i * u, x + cols * u, y + i * u, C.slide, {}, 'stroke-width="1"');
    for (let j = 1; j < cols; j++) s += line(x + j * u, y, x + j * u, y + rows * u, C.slide, {}, 'stroke-width="1"');
    s += rect(x, y, cols * u, rows * u, 'none', {}, `stroke="${color}" stroke-width="1.5"`);
    if (label) s += text(x + cols * u / 2, y - 10, label, {}, `font-size:22px;font-weight:600;fill:${color};text-anchor:middle`);
    return g(s, o);
  }
  const block = (x, y1, y2, label, color, o) => g(
    rect(x, y1, 54, y2 - y1, '#1a2a4a', {}, `stroke="${color}" stroke-width="3"`) +
    `<text transform="translate(${x + 37} ${(y1 + y2) / 2}) rotate(-90)" style="font-size:27px;text-anchor:middle;letter-spacing:.06em;fill:${C.ink}">${label}</text>`, o);

  const BLUE = ['#1f3f6b', '#2b5a94', '#3a78bf', '#4aa8ff', '#2f6db0'];
  const GATE = ['#3a78bf', '#4aa8ff', '#7cc0ff'];                    // SiLU(gate) where it is open
  const UPC = ['#7a3f75', '#a5559e', '#d97fd0', '#8e4a88', '#c06cb8'];
  const GOLD = ['#8a6d22', '#c09a35', '#f5c451', '#a8832c'];
  const ZERO = ['#1b2335', '#222a3c', '#262d3a'];                    // ≈ 0 after SiLU
  const VIO = ['#2b3f8a', '#3f58c4', '#5b74e8', '#7f8cff', '#4250a8'];
  const TOKENS = ['Paris', '␣is', '␣the', '␣capital'];
  const n = 4, d = 8, dff = 24, cw = 16;                             // d_ff = 3 d, cells to scale

  const FIG = {};

  // Up / Down as blocks. Steps: 0 X · 1 Up, empty H · 2–5 one H row per step ·
  // 6 Down, empty Y · 7–10 one Y row per step · 11 weights
  FIG.blocks = () => {
    const rh = 34, gap = 12, top = 270, bot = top + n * rh + (n - 1) * gap, mid = (top + bot) / 2;
    const UP = 2, DOWN = UP + n + 1, LAST = DOWN + n;
    const rowY = (i) => top + i * (rh + gap);
    const X = 180, B1 = X + d * cw + 44, H = B1 + 54 + 52, B2 = H + dff * cw + 44, Y = B2 + 54 + 84;
    const M = (x, cols, pal, seed, rowO = () => ({})) => {
      const r = rng(seed); let s = '';
      for (let i = 0; i < n; i++) {
        let row = '';
        for (let j = 0; j < cols; j++) row += rect(x + j * cw, rowY(i), cw, rh, pal(i, j, r));
        s += g(row, rowO(i));
      }
      return s;
    };
    const slots = (x, cols, first, fill) => [...Array(n)].map((_, i) =>
      rect(x, rowY(i), cols * cw, rh, 'none', { s: first, e: fill + i - 1 }, `stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4 4"`)).join('');
    const ring = (x, cols, i, st) => rect(x - 2, rowY(i) - 2, cols * cw + 4, rh + 4, 'none', { s: st, e: st }, `stroke="${C.gold}" stroke-width="4" rx="2"`);
    const ttb = (x, cols, label, o) => brace(x, x + cols * cw, top - 14, label, C.brace, o, false);
    let s = '';
    s += TOKENS.map((t, i) => text(X - 62, rowY(i) + 24, t, {}, `font-size:18px;text-anchor:end;fill:${C.slate}`)).join('');
    s += vbrace(X - 12, top, bot, 'n', C.brace) + ttb(X, d, 'd', {});
    s += M(X, d, (i, j, r) => shade(BLUE, r), 3);
    // up
    s += arrow(X + d * cw + 8, mid, B1 - 8, mid, 'slate', { s: 1 });
    s += block(B1, top - 40, bot + 40, 'Up', C.blue, { s: 1 });
    s += arrow(B1 + 62, mid, H - 8, mid, 'slate', { s: 1 });
    const r2 = rng(99);
    const keep = [...Array(n)].map(() => [...Array(dff)].map(() => r2() < .3));
    s += slots(H, dff, 1, UP);
    s += M(H, dff, (i, j, r) => shade(keep[i][j] ? GOLD : ZERO, r), 11, (i) => ({ s: UP + i }));
    s += ttb(H, dff, 'd_ff = 3 d = 6 144', { s: 1 });
    for (let i = 0; i < n; i++) s += ring(X, d, i, UP + i) + ring(H, dff, i, UP + i);
    // down
    s += arrow(H + dff * cw + 8, mid, B2 - 8, mid, 'slate', { s: DOWN - 1 });
    s += block(B2, top - 40, bot + 40, 'Down', C.green, { s: DOWN - 1 });
    s += arrow(B2 + 62, mid, Y - 50, mid, 'slate', { s: DOWN - 1 });
    s += vbrace(Y - 12, top, bot, 'n', C.brace, { s: DOWN - 1 }) + ttb(Y, d, 'd', { s: DOWN - 1 });
    s += slots(Y, d, DOWN - 1, DOWN);
    s += M(Y, d, (i, j, r) => shade(VIO, r), 21, (i) => ({ s: DOWN + i }));
    for (let i = 0; i < n; i++) s += ring(H, dff, i, DOWN + i) + ring(Y, d, i, DOWN + i);
    const wl = (x, t) => text(x, bot + 78, t, { s: LAST }, `font-size:17px;text-anchor:middle;fill:${C.slate}`);
    s += wl(B1 + 27, 'd × d_ff') + wl(B2 + 27, 'd_ff × d');
    return svg(s);
  };

  // Gate and Up as two vectors combined element by element. Gate band on top, H in the
  // middle, Up band at the bottom, all in the same columns: column j of gate and up gives
  // column j of H; the three cells being multiplied are outlined in place.
  // Steps: 0 X · 1 blocks, empty slots · 2 « Paris »: gate and up vectors · 3 element 1 ·
  // 4 element 2 · 5 the other elements, animated · 6–8 the other tokens, one animated step
  // each · 9 Down, empty Y · 10–13 one Y row per step · 14 weights
  FIG.gated = () => {
    const rh = 20, gap = 6, band = n * rh + (n - 1) * gap, TG = 172, TH = 302, TU = 432;
    const yr = (t, i) => t + i * (rh + gap);
    const GATE1 = 2, EL1 = 3, EL2 = 4, REST = 5, ROW = (i) => REST + i, DOWN = REST + n + 1, LAST = DOWN + n;
    const DT = .12;                                               // seconds per element in the animation
    const r0 = rng(99);
    const open = [...Array(n)].map(() => [...Array(dff)].map(() => r0() < .3));
    open[0][0] = true; open[0][1] = false;                        // « Paris »: element 1 open, element 2 closed
    const X = 180, B1 = X + d * cw + 60, W = B1 + 54 + 56, B2 = W + dff * cw + 44, Y = B2 + 54 + 84;
    const midH = TH + band / 2;
    const cells = (x, t, i, cols, col) => { let out = ''; for (let j = 0; j < cols; j++) out += rect(x + j * cw, yr(t, i), cw, rh, col(j)); return out; };
    const slot = (x, t, i, cols, o) => rect(x, yr(t, i), cols * cw, rh, 'none', o, `stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4 4"`);
    const ring = (x, t, i, cols, o) => rect(x - 2, yr(t, i) - 2, cols * cw + 4, rh + 4, 'none', o, `stroke="${C.gold}" stroke-width="3" rx="2"`);
    let s = '';
    // input X, level with H
    s += TOKENS.map((t, i) => text(X - 56, yr(TH, i) + 16, t, {}, `font-size:17px;text-anchor:end;fill:${C.slate}`)).join('');
    s += vbrace(X - 12, TH, TH + band, 'n', C.brace) + brace(X, X + d * cw, TH - 12, 'd', C.brace, {}, false);
    { const r = rng(3); for (let i = 0; i < n; i++) s += cells(X, TH, i, d, () => shade(BLUE, r)); }
    // gate and up blocks, both fed by X
    const fx = X + d * cw + 24, yG = TG + band / 2, yU = TU + band / 2;
    s += g(line(X + d * cw + 6, midH, fx, midH, C.slate, {}, 'stroke-width="2.5"') + line(fx, yG, fx, yU, C.slate, {}, 'stroke-width="2.5"') +
      arrow(fx, yG, B1 - 8, yG, 'slate') + arrow(fx, yU, B1 - 8, yU, 'slate') +
      arrow(B1 + 62, yG, W - 8, yG, 'slate') + arrow(B1 + 62, yU, W - 8, yU, 'slate'), { s: 1 });
    s += block(B1, TG - 24, TG + band + 24, 'Gate', C.blue, { s: 1 });
    s += block(B1, TU - 24, TU + band + 24, 'Up', C.magenta, { s: 1 });
    const lab = (t, txt, color) => text(W + dff * cw + 14, t + band / 2 + 6, txt, { s: 1 }, `font-size:18px;fill:${color}`);
    s += lab(TG, `gate = SiLU(x W${sub('gate')})`, C.blue) + lab(TU, `up = x W${sub('up')}`, C.magenta);
    s += text(W - 14, midH + 8, '⊙', { s: 1 }, `font-size:30px;text-anchor:end;fill:${C.gold}`);
    s += brace(W, W + dff * cw, TG - 12, 'd_ff = 3 d = 6 144', C.brace, { s: 1 }, false);
    // the three cells multiplied together, outlined in place: gate_j, up_j and h_j
    const trio = (i, j, o, extra = '') => g(
      line(W + j * cw + cw / 2, yr(TG, i) + rh + 2, W + j * cw + cw / 2, yr(TU, i) - 2, C.gold, {}, 'stroke-width="1.5" stroke-dasharray="3 4" opacity=".7"') +
      [yr(TG, i), yr(TH, i), yr(TU, i)].map((y) => rect(W + j * cw - 2, y - 2, cw + 4, rh + 4, 'none', {}, `stroke="${C.gold}" stroke-width="3"`)).join(''), o, extra);
    for (let i = 0; i < n; i++) {
      const first = i === 0, gStep = first ? GATE1 : ROW(i), mStep = first ? REST : ROW(i);
      const j0 = first ? 2 : 0, t0 = first ? .2 : .5;            // first animated element, start of the animation
      s += slot(W, TG, i, dff, { s: 1, e: gStep - 1 }) + slot(W, TU, i, dff, { s: 1, e: gStep - 1 });
      const r = rng(40 + i);
      const gc = [...Array(dff)].map((_, j) => shade(open[i][j] ? GATE : ZERO, r));
      const uc = [...Array(dff)].map(() => shade(UPC, r));
      const hc = [...Array(dff)].map((_, j) => shade(open[i][j] ? GOLD : ZERO, r));
      // gate and up vectors (they fade in on the one-step tokens)
      s += g(cells(W, TG, i, dff, (j) => gc[j]), { s: gStep, play: first ? null : gStep }, first ? '' : 'class="pop"');
      s += g(cells(W, TU, i, dff, (j) => uc[j]), { s: gStep, play: first ? null : gStep }, first ? '' : 'class="pop"');
      s += ring(X, TH, i, d, { s: gStep, e: mStep });
      if (first) s += ring(W, TG, i, dff, { s: GATE1, e: GATE1 }) + ring(W, TU, i, dff, { s: GATE1, e: GATE1 });
      // h_j: a dashed slot until it is computed
      for (let j = 0; j < dff; j++) {
        const at = first && j === 0 ? EL1 : first && j === 1 ? EL2 : mStep, animated = at === mStep;
        s += rect(W + j * cw, yr(TH, i), cw, rh, 'none', { s: 1, e: at - 1 }, `stroke="${C.dim}" stroke-width="1" stroke-dasharray="3 3"`);
        s += rect(W + j * cw, yr(TH, i), cw, rh, hc[j], { s: at, play: animated ? mStep : null },
          animated ? `class="pop" style="--delay:${(t0 + (j - j0) * DT).toFixed(2)}s"` : '');
      }
      if (first) s += trio(i, 0, { s: EL1, e: EL1 }) + trio(i, 1, { s: EL2, e: EL2 });
      // the other elements: one outline that hops from element to element
      s += g(trio(i, j0), { s: mStep, e: mStep, play: mStep },
        `class="hop" style="--n:${dff - j0};--w:${(dff - j0) * cw}px;--dur:${((dff - j0) * DT).toFixed(2)}s;--delay:${t0}s"`);
    }
    // down
    s += arrow(W + dff * cw + 8, midH, B2 - 8, midH, 'slate', { s: DOWN - 1 });
    s += block(B2, TH - 24, TH + band + 24, 'Down', C.green, { s: DOWN - 1 });
    s += arrow(B2 + 62, midH, Y - 46, midH, 'slate', { s: DOWN - 1 });
    s += vbrace(Y - 12, TH, TH + band, 'n', C.brace, { s: DOWN - 1 }) + brace(Y, Y + d * cw, TH - 12, 'd', C.brace, { s: DOWN - 1 }, false);
    { const r = rng(21); for (let i = 0; i < n; i++) {
      s += slot(Y, TH, i, d, { s: DOWN - 1, e: DOWN + i - 1 });
      s += g(cells(Y, TH, i, d, () => shade(VIO, r)), { s: DOWN + i });
      s += ring(W, TH, i, dff, { s: DOWN + i, e: DOWN + i }) + ring(Y, TH, i, d, { s: DOWN + i, e: DOWN + i });
    } }
    const wl = (x, y, t) => text(x, y, t, { s: LAST }, `font-size:16px;text-anchor:middle;fill:${C.slate}`);
    s += wl(B1 + 27, TG + band + 46, 'd × d_ff') + wl(B1 + 27, TU + band + 46, 'd × d_ff') + wl(B2 + 27, TH + band + 46, 'd_ff × d');
    return svg(s);
  };

  // Cross layout (A left, B above, C below B), u = 1 cell, d = 8, d_ff = 24.
  // Steps: 0 X · 1 X [W_gate | W_up] · 2 row 4 · 3 SiLU ⊙: H · 4 H W_down · 5 + X
  FIG.matrix = () => {
    const u = 9, y = 430;
    const xX = 70, xW = 170, xH = 720, xD = 970, xY = 1100;
    let s = '';
    s += mat(xX, y, n, d, u, C.slate, { label: 'X', op: .5 });
    s += mat(xW, y - 10 - d * u, d, dff, u, C.blue, { label: `W${sub('gate')}`, o: { s: 1 } });
    s += mat(xW + dff * u, y - 10 - d * u, d, dff, u, C.magenta, { label: `W${sub('up')}`, o: { s: 1 } });
    s += mat(xW, y, n, dff, u, C.blue, { o: { s: 1 }, op: .25 });
    s += mat(xW + dff * u, y, n, dff, u, C.magenta, { o: { s: 1 }, op: .25 });
    s += g(text(xW + dff * u / 2, y + n * u + 28, 'G', {}, `font-size:22px;font-weight:600;fill:${C.blue};text-anchor:middle`) +
           text(xW + dff * u * 1.5, y + n * u + 28, 'U', {}, `font-size:22px;font-weight:600;fill:${C.magenta};text-anchor:middle`), { s: 1 });
    // row 4 (« capital »)
    s += rect(xX, y + 3 * u, d * u, u, C.gold, { s: 2 }, 'opacity=".9"');
    s += rect(xW, y + 3 * u, 2 * dff * u, u, C.gold, { s: 2 }, 'opacity=".9"');
    s += rect(xW, y - 10 - d * u, 2 * dff * u, d * u, 'none', { s: 2, e: 2 }, `stroke="${C.gold}" stroke-width="2.5"`);
    // SiLU ⊙
    s += g(`<ellipse cx="${xH - 50}" cy="${y + n * u / 2}" rx="36" ry="22" fill="${C.panel}" stroke="${C.gold}" stroke-width="2"/>` +
      text(xH - 50, y + n * u / 2 + 6, 'SiLU ⊙', {}, `font-size:14px;text-anchor:middle;fill:${C.gold}`) +
      arrow(xW + 2 * dff * u + 4, y + n * u / 2, xH - 88, y + n * u / 2, 'slate', {}, 1.5) +
      arrow(xH - 14, y + n * u / 2, xH - 4, y + n * u / 2, 'slate', {}, 1.5), { s: 3 });
    s += mat(xH, y, n, dff, u, C.gold, { label: 'H', o: { s: 3 } });
    s += rect(xH, y + 3 * u, dff * u, u, C.gold, { s: 3 }, 'opacity=".9"');
    // W_down above the output
    s += mat(xD, y - 10 - dff * u, dff, d, u, C.green, { o: { s: 4 } });
    s += g(text(xD + d * u + 10, y - 10 - dff * u / 2, `W${sub('down')}`, {}, `font-size:22px;font-weight:600;fill:${C.green}`), { s: 4 });
    s += mat(xD, y, n, d, u, C.green, { o: { s: 4 }, op: .3 });
    s += rect(xD, y + 3 * u, d * u, u, C.gold, { s: 4 }, 'opacity=".9"');
    // residual
    s += g(text(xD + d * u + 18, y + n * u / 2 + 8, '+ X =', {}, `font-size:20px;fill:${C.slate}`), { s: 5 });
    s += mat(xY, y, n, d, u, C.red, { label: 'Y', o: { s: 5 }, op: .4 });
    // braces
    s += brace(xX, xX + d * u, y + n * u + 10, 'd', C.slate);
    s += vbrace(xX - 10, y, y + n * u, 'n', C.slate);
    s += brace(xW, xW + dff * u, y + n * u + 40, 'd_ff', C.blue, { s: 1 });
    s += brace(xH, xH + dff * u, y + n * u + 10, 'd_ff = 3 d', C.gold, { s: 3 });
    s += vbrace(xD - 10, y - 10 - dff * u, y - 10, 'd_ff', C.green, { s: 4 });
    return svg(s);
  };

  // ── Mixture of Experts: 8 independent FFNs, a router, top 2 per token (cartoon routing) ──
  const MOE = {
    pick: [[2, 5], [0, 5], [0, 3], [5, 7]],              // chosen experts per token (0-based)
    p: [[.62, .38], [.55, .45], [.70, .30], [.58, .42]],
    E: 8,
  };
  const cellsRow = (x, y, k, w, h, pal, seed) => { const r = rng(seed); let s = ''; for (let j = 0; j < k; j++) s += rect(x + j * w, y, w, h, shade(pal, r)); return s; };
  const vblock = (x, y1, y2, w, label, color, o = {}, fs = 26) => g(
    rect(x, y1, w, y2 - y1, '#1a2a4a', {}, `stroke="${color}" stroke-width="3"`) +
    `<text transform="translate(${x + w / 2 + fs * .36} ${(y1 + y2) / 2}) rotate(-90)" style="font-size:${fs}px;text-anchor:middle;letter-spacing:.04em;fill:${C.ink}">${label}</text>`, o);
  // a small FFN as on « Inside the FFN »: Up → wide vector → Down
  const MBW = 20;                                                 // mini block width
  const miniW = (u = 6, cols = 24) => MBW + 12 + cols * u + 12 + MBW;
  const miniBlock = (x, y, h, label, color, fs) => rect(x, y, MBW, h, '#1a2a4a', {}, `stroke="${color}" stroke-width="2"`) +
    `<text transform="translate(${x + MBW / 2 + fs * .36} ${y + h / 2}) rotate(-90)" style="font-size:${fs}px;text-anchor:middle;fill:${C.ink}">${label}</text>`;
  // seed null: the wide vector is not computed, an empty dashed slot (miniVec fills it)
  const miniVec = (x, y, h, seed, { u = 6, cols = 24, o = {} } = {}) => {
    const r = rng(seed);
    let s = '';
    for (let j = 0; j < cols; j++) s += rect(x + MBW + 12 + j * u, y + h / 2 - 8, u, 16, shade(r() < .3 ? GOLD : ZERO, r));
    return g(s, o);
  };
  function miniFFN(x, y, h, seed, { up = 'Up', down = 'Down', u = 6, cols = 24, o = {}, fs = 11 } = {}) {
    const bw = MBW;
    let s = miniBlock(x, y, h, up, C.blue, fs);
    s += line(x + bw + 2, y + h / 2, x + bw + 10, y + h / 2, C.slate, {}, 'stroke-width="1.5"');
    s += seed == null
      ? rect(x + bw + 12, y + h / 2 - 8, cols * u, 16, 'none', {}, `stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4 3"`)
      : miniVec(x, y, h, seed, { u, cols });
    const dx = x + bw + 12 + cols * u;
    s += line(dx + 2, y + h / 2, dx + 10, y + h / 2, C.slate, {}, 'stroke-width="1.5"');
    s += miniBlock(dx + 12, y, h, down, C.green, fs);
    return g(s, o);
  }

  // Steps: 0 one FFN · 1 8 independent FFNs, nothing computed · 2 router scores · 3 « Paris »: top 2 · 4 « Paris »: routes, × p, Σ ·
  // 5–7 the other tokens (top 2 and routes in one step).
  // Earlier routes stay faint; the router's top-2 outlines only show for the current token.
  FIG.moe = () => {
    const { pick, p, E } = MOE;
    const cu = 12, rh = 24, gap = 10, top = 290;
    const rowY = (i) => top + i * (rh + gap), X = 150, XR = X + d * cu;
    const RB = 280, SC = 340, sw = 16;                        // router block, score grid
    const EX = 600, EY = (e) => 144 + e * 53, eh = 44, EW = miniW();
    const YX = 980, SX = YX - 44, SR = SC + E * sw;
    const midY = top + (n * rh + (n - 1) * gap) / 2;
    let s = '';
    s += TOKENS.map((t, i) => text(X - 14, rowY(i) + 17, t, {}, `font-size:16px;text-anchor:end;fill:${C.slate}`)).join('');
    s += text(X + d * cu / 2, top - 14, 'x', {}, 'font-size:20px;font-style:italic;text-anchor:middle');
    for (let i = 0; i < n; i++) s += cellsRow(X, rowY(i), d, cu, rh, BLUE, 3 + i);
    // step 0: the FFN of the previous slides
    s += g(arrow(XR + 10, midY, EX - 40, midY, 'slate') + miniFFN(EX, midY - 30, 60, 7, { u: 7, fs: 14 }) +
      text(EX + miniW(7) / 2, midY - 44, 'FFN', {}, 'font-size:20px;text-anchor:middle;font-weight:600') +
      arrow(EX + miniW(7) + 10, midY, YX - 20, midY, 'slate'), { e: 0 });
    // the 8 experts
    // the 8 experts: nothing computed until a token is routed to them
    for (let e = 0; e < E; e++) s += miniFFN(EX, EY(e), eh, null, { up: `Up ${e + 1}`, down: `Down ${e + 1}`, o: { s: 1 } });
    // router and its scores
    s += g(arrow(XR + 8, midY, RB - 8, midY, 'slate') + vblock(RB, top - 30, top + n * (rh + gap) + 20, 40, 'Router', C.orange, {}, 20) +
      arrow(RB + 48, midY, SC - 8, midY, 'slate'), { s: 2 });
    for (let i = 0; i < n; i++) for (let e = 0; e < E; e++) {
      const k = pick[i].indexOf(e), sc = k >= 0 ? p[i][k] : .04 + ((i * 5 + e * 3) % 7) / 60;
      s += rect(SC + e * sw, rowY(i), sw - 2, rh, C.ink, { s: 2 }, `opacity="${(.12 + sc).toFixed(2)}"`);
      if (k >= 0) s += rect(SC + e * sw - 1, rowY(i) - 1, sw, rh + 2, 'none', { s: i === 0 ? 3 : 4 + i, e: 4 + i }, `stroke="${C.gold}" stroke-width="2.5"`);
    }
    s += text(SC + E * sw / 2, top - 14, 'scores', { s: 2 }, `font-size:16px;text-anchor:middle;fill:${C.slate}`);
    s += g([...Array(E)].map((_, e) => text(SC + e * sw + sw / 2 - 1, top + n * (rh + gap) + 10, String(e + 1), {}, `font-size:12px;text-anchor:middle;fill:${C.slate}`)).join(''), { s: 2 });
    // routes: token row → its 2 experts → × p → Σ → its y row
    s += text(YX + d * cu / 2, top - 14, 'y = x + Σ', { s: 4 }, 'font-size:18px;font-style:italic;text-anchor:middle');
    for (let i = 0; i < n; i++) {
      const st = 4 + i, cy = rowY(i) + rh / 2;
      let r = '';
      pick[i].forEach((e, k) => {
        const w = 1.5 + p[i][k] * 5, ey = EY(e) + eh / 2;
        r += `<path d="M${SR + 4} ${cy} C ${SR + 90} ${cy}, ${EX - 70} ${ey}, ${EX - 6} ${ey}" fill="none" stroke="${C.gold}" stroke-width="${w}"/>`;
        r += `<path d="M${EX + EW + 6} ${ey} C ${EX + EW + 80} ${ey}, ${SX - 80} ${cy}, ${SX - 14} ${cy}" fill="none" stroke="${C.gold}" stroke-width="${w}"/>`;
        r += text(EX + EW + 12, ey - 8, `× ${p[i][k].toFixed(2)}`, {}, `font-size:15px;fill:${C.gold};font-weight:600`);
      });
      const sigma = (op) => `<circle cx="${SX}" cy="${cy}" r="12" fill="${C.panel}" stroke="${C.gold}" stroke-width="2" opacity="${op}"/>` +
        text(SX, cy + 5, 'Σ', {}, `font-size:14px;text-anchor:middle;fill:${C.gold};opacity:${op}`);
      r += sigma(1) + line(SX + 12, cy, YX - 4, cy, C.gold, {}, 'stroke-width="2"');
      s += g(r, { s: st, e: st });
      // after its step: faint routes and Σ
      s += g(r.replace(/<text[^>]*>[^<]*<\/text>/g, '').replace(/<circle[^>]*\/>/g, ''), { s: st + 1 }, 'opacity=".25"');
      s += g(sigma(.5), { s: st + 1 });
      s += pick[i].map((e) => rect(EX - 4, EY(e) - 4, EW + 8, eh + 8, 'none', { s: st, e: st }, `stroke="${C.gold}" stroke-width="2.5" rx="4"`)).join('');
      // only the 2 picked experts compute, a wide vector of this token; the other 6 fade out
      s += pick[i].map((e) => miniVec(EX, EY(e), eh, 100 + 8 * i + e, { o: { s: st, e: st } })).join('');
      for (let e = 0; e < E; e++) if (!pick[i].includes(e))
        s += rect(EX - 2, EY(e) - 2, EW + 4, eh + 4, C.slide, { s: st, e: st }, 'opacity=".6"');
      s += rect(X - 2, rowY(i) - 2, d * cu + 4, rh + 4, 'none', { s: i === 0 ? 3 : st, e: st }, `stroke="${C.gold}" stroke-width="3"`);
      s += g(cellsRow(YX, rowY(i), d, cu, rh, VIO, 30 + i), { s: st });
    }
    return svg(s);
  };

  // How the router scores « Paris » (cross layout: x left, W_router above, scores where they
  // meet); the numbers are made up so that the result is the 0.62 / 0.38 of the MoE slide.
  // Steps: 0 x · 1 W_router · 2 score 1 · 3 score 2 · 4 the other scores, animated · 5 softmax ·
  // 6 top 2 · 7 renormalized
  FIG.router = () => {
    const E = MOE.E;
    const logit = [0.19, 0.00, 2.11, 0.34, -0.22, 1.61, 0.00, 0.34];
    const prob = [.06, .05, .41, .07, .04, .25, .05, .07];
    const top = [2, 5], renorm = { 2: .62, 5: .38 };
    const cu = 22, xh = 30, XL = 130, RY = 410, WX = 370, colW = 60, WY = RY - 12 - d * cu;
    const PY = RY + 54, NY = PY + 54, DT = .3;
    const ST = { W: 1, e1: 2, e2: 3, rest: 4, soft: 5, top: 6, norm: 7 };
    const gold = (x, y, w, h) => rect(x, y, w, h, 'none', {}, `stroke="${C.gold}" stroke-width="3"`);
    let s = '';
    s += text(XL + d * cu / 2, RY - 14, 'x « Paris »', {}, 'font-size:18px;text-anchor:middle');
    s += cellsRow(XL, RY, d, cu, xh, BLUE, 3);
    s += brace(XL, XL + d * cu, RY + xh + 8, 'd', C.brace);
    // W_router: d rows, one column per expert
    const r = rng(17); let w = '';
    for (let i = 0; i < d; i++) for (let e = 0; e < E; e++)
      w += rect(WX + e * colW, WY + i * cu, colW - 2, cu - 2, C.orange, {}, `opacity="${(.15 + r() * .45).toFixed(2)}"`);
    s += g(w + text(WX - 14, WY + d * cu / 2 + 8, `W${sub('router')}`, {}, `font-size:22px;font-weight:600;text-anchor:end;fill:${C.orange}`) +
      text(WX - 14, WY + d * cu / 2 + 30, 'd × 8', {}, `font-size:14px;text-anchor:end;fill:${C.slate}`) +
      [...Array(E)].map((_, e) => text(WX + e * colW + colW / 2 - 1, WY - 10, `expert ${e + 1}`, {}, `font-size:13px;text-anchor:middle;fill:${C.slate}`)).join(''), { s: ST.W });
    // scores: 1 and 2 one step each, then the rest animated
    s += text(WX + E * colW + 16, RY + 21, `scores = x W${sub('router')}`, { s: ST.W }, 'font-size:17px');
    for (let e = 0; e < E; e++) {
      const at = e === 0 ? ST.e1 : e === 1 ? ST.e2 : ST.rest, anim = at === ST.rest;
      s += rect(WX + e * colW, RY, colW - 2, xh, 'none', { s: ST.W, e: at - 1 }, `stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4 4"`);
      s += g(rect(WX + e * colW, RY, colW - 2, xh, C.panel, {}, `stroke="${C.orange}" stroke-width="1.5"`) +
        text(WX + e * colW + colW / 2 - 1, RY + 21, logit[e].toFixed(2), {}, 'font-size:16px;text-anchor:middle'),
        { s: at, play: anim ? ST.rest : null }, anim ? `class="pop" style="--delay:${((e - 2) * DT + .1).toFixed(2)}s"` : '');
    }
    const col = (e) => gold(WX + e * colW - 2, WY - 2, colW + 2, d * cu + 2) + gold(WX + e * colW - 2, RY - 2, colW + 2, xh + 4);
    const xring = gold(XL - 2, RY - 2, d * cu + 4, xh + 4);
    s += g(xring + col(0), { s: ST.e1, e: ST.e1 }) + g(xring + col(1), { s: ST.e2, e: ST.e2 }) + g(xring, { s: ST.rest, e: ST.rest });
    s += g(col(2), { s: ST.rest, e: ST.rest, play: ST.rest },
      `class="hop" style="--n:${E - 2};--w:${(E - 2) * colW}px;--dur:${((E - 2) * DT).toFixed(2)}s;--delay:.1s"`);
    // softmax, then top 2
    s += text(WX - 14, PY + 21, 'softmax', { s: ST.soft }, `font-size:17px;text-anchor:end;fill:${C.slate}`);
    for (let e = 0; e < E; e++) {
      s += g(rect(WX + e * colW, PY, colW - 2, xh, C.panel, {}, `stroke="${C.slate}" stroke-width="1"`) +
        rect(WX + e * colW, PY, (colW - 2) * prob[e] / .41, xh, C.gold, {}, 'opacity=".35"') +
        text(WX + e * colW + colW / 2 - 1, PY + 21, prob[e].toFixed(2), {}, 'font-size:16px;text-anchor:middle'), { s: ST.soft });
      s += top.includes(e) ? g(gold(WX + e * colW - 2, PY - 2, colW + 2, xh + 4), { s: ST.top })
                           : rect(WX + e * colW, PY, colW - 2, xh, C.slide, { s: ST.top }, 'opacity=".7"');
    }
    s += text(WX + E * colW + 16, PY + 21, 'Σ = 1', { s: ST.soft }, `font-size:17px;fill:${C.slate}`);
    // renormalized
    s += text(WX - 14, NY + 21, 'top 2, renormalized', { s: ST.norm }, `font-size:17px;text-anchor:end;fill:${C.slate}`);
    top.forEach((e) => {
      const cx = WX + e * colW + colW / 2 - 1;
      s += g(rect(WX + e * colW, NY, colW - 2, xh, C.gold) +
        text(cx, NY + 21, renorm[e].toFixed(2), {}, 'font-size:16px;text-anchor:middle;fill:#0b1220;font-weight:600') +
        line(cx, PY + xh + 2, cx, NY - 2, C.gold, {}, 'stroke-width="1.5" stroke-dasharray="3 3"'), { s: ST.norm });
    });
    s += text(WX + E * colW + 16, NY + 21, `= p${sub('3')}, p${sub('6')} of the previous slide`, { s: ST.norm }, `font-size:15px;fill:${C.gold}`);
    return svg(s);
  };

  function apply(root, k, play) {
    root.querySelectorAll('[data-s],[data-e]').forEach((el) => {
      const s = el.dataset.s != null ? +el.dataset.s : 0, e = el.dataset.e != null ? +el.dataset.e : 1e9;
      el.classList.toggle('off', k < s || k > e);
    });
    root.querySelectorAll('[data-play]').forEach((el) => {
      el.classList.remove('play');
      if (play && +el.dataset.play === k) { void el.getBoundingClientRect(); el.classList.add('play'); }
    });
  }

  document.querySelectorAll('div.ffn[data-ffn]:not(.ffn-built)').forEach((root) => {
    root.classList.add('ffn-built');
    const caps = [...root.querySelectorAll(':scope > p')];
    const body = document.createElement('div'), box = document.createElement('div');
    body.className = 'ffn-body'; box.className = 'ffn-caps';
    body.innerHTML = FIG[root.dataset.ffn]();
    box.append(...caps);
    root.replaceChildren(body, box);
    let prev = null;
    steps(root, caps.length - 1, (st) => {
      const play = st !== null && prev !== null && st === prev + 1;
      if (st === null) st = caps.length - 1;
      prev = st;
      apply(body, st, play);
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    });
  });
})();
