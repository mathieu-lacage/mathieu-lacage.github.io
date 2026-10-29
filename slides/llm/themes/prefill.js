// Prefill and decode slides: « Prefill, then decode » (the two phases), « Prefill » and
// « Decode » (the layout of « Matrix version », themes/attention.js, redrawn in SVG).
//
// Each slide is a <div class="pd" data-pd="summary|prefill|decode"> whose <p> children are
// its captions, one per step. FIG[name](st, play) returns the figure of step st, in slide
// coordinates (1280 × 720); it is drawn again at every step. play is true when stepping
// forward by one: only then do the copies fly (class fly) and their landing fade in (land).
// Pattern and marker ids get one prefix per slide: an id in a hidden slide would not render.
// In the PDF (steps() gives null) the last step shows.
// Uses steps.js. Styles: themes/prefill.css.
(() => {
  // colours of « Matrix version » (themes/attention.js): x blue, Q orange, K green, V magenta, Z violet, O indigo
  const C = { slide: '#0f1829', panel: '#18233a', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', blue: '#4aa8ff',
    gold: '#f5c451', cyan: '#8fc5fa', x: '#4aa8ff', q: '#ff9f43', k: '#7cc47a', v: '#d97fd0', z: '#a46cf5', o: '#6d86ff' };
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const R = (x, y, w, h, a) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const P = (d, a) => `<path d="${d}" ${a}/>`;
  const rand = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  // the dark stripes of .at-row, shifted per row as background-position-x: (i * 36) % 84
  const HEAT = [[12, .55], [24, .2], [36, .7], [48, .35], [60, .1], [72, .6]];
  const DEFS = `<defs>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<pattern id="ID-heat${i}" x="${(i * 36) % 84}" width="84" height="40" patternUnits="userSpaceOnUse">${HEAT.map(([x, a]) => R(x, 0, 12, 40, `fill="${C.slide}" fill-opacity="${a}"`)).join('')}</pattern>`).join('')}
  <pattern id="ID-wl" width="10" height="5" patternUnits="userSpaceOnUse">${R(0, 0, 10, 2, `fill="${C.dim}"`)}</pattern>
  <pattern id="ID-ktl" width="10" height="5" patternUnits="userSpaceOnUse">${R(0, 0, 10, 2, `fill="${C.slide}" fill-opacity=".55"`)}</pattern>
  <pattern id="ID-mask" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">${R(0, 0, 2, 7, 'fill="#2a3650"')}</pattern>
  <marker id="ID-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.slate}"/></marker>
  <marker id="ID-ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.gold}"/></marker>
  </defs>`;

  // a curly brace from (x1,y1) to (x2,y2), bulging by w to the left of that direction (themes/braces.js)
  function curly(x1, y1, x2, y2, w, q = 0.6) {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(0.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(0.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(0.75, 1 - q)} T${tip}`;
  }
  // a brace on one side of the span a..b of the edge at coordinate e, label outside
  function brace(side, a, b, e, label) {
    const W = 14, G = 3, st = `fill="none" stroke="${C.cyan}" stroke-width="1.5"`;
    if (side === 'left') return P(curly(e - G, a, e - G, b, W - 2), st) + T(e - G - W - 6, (a + b) / 2 + 7, label, 'class="bl" text-anchor="end"');
    if (side === 'right') return P(curly(e + G, b, e + G, a, W - 2), st) + T(e + G + W + 6, (a + b) / 2 + 7, label, 'class="bl"');
    if (side === 'top') return P(curly(b, e - G, a, e - G, W - 2), st) + T((a + b) / 2, e - G - W - 4, label, 'class="bl" text-anchor="middle"');
    return P(curly(a, e + G, b, e + G, W - 2), st) + T((a + b) / 2, e + G + W + 18, label, 'class="bl" text-anchor="middle"');
  }
  const DH = 'd<tspan baseline-shift="sub" font-size="14">h</tspan>';
  const sub = (s) => `<tspan baseline-shift="sub" font-size="15">${s}</tspan>`;

  // n rows of an activation; row(i) → { off, ghost, cache, hl, dim }
  function act(x, y, w, u, rows, col, label, row = () => ({})) {
    let o = '';
    for (let i = 0; i < rows; i++) {
      const r = row(i);
      if (r.off) continue;
      const op = r.ghost ? .45 : r.cache ? .5 : r.dim ? .25 : 1;
      o += `<g opacity="${op}">` + R(x, y + i * u, w, u - 2, `fill="${col}"`) + R(x, y + i * u, w, u - 2, `fill="url(#ID-heat${i % 7})"`) + '</g>';
      if (r.hl) o += R(x + 1.5, y + i * u + 1.5, w - 3, u - 5, `fill="none" stroke="${C.gold}" stroke-width="3"`);
    }
    return o + (label ? T(x + w / 2, y + rows * u / 2, label, 'class="nm"') : '');
  }
  const ghostBox = (x, y, w, h) => R(x - 4, y - 4, w + 8, h + 6, `fill="none" stroke="${C.slate}" stroke-width="1.5" stroke-dasharray="4 3"`);
  const cacheBox = (x, y, w, h, label = 'cache') => R(x - 4, y - 4, w + 8, h + 6, `fill="none" stroke="${C.gold}" stroke-width="2" stroke-dasharray="6 4"`)
    + (label ? T(x + w / 2, y - 10, label, `font-size="15" text-anchor="middle" fill="${C.gold}"`) : '');
  const weight = (x, y, w, h, label, hl) => R(x, y, w, h, `fill="url(#ID-wl)" stroke="${hl ? C.gold : C.blue}" stroke-width="2"`) + T(x + w / 2, y + h / 2, label, 'class="nm"');
  const op = (cx, cy, rx, ry, label, hl) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.slide}" stroke="${hl ? C.gold : C.ink}" stroke-width="2"/>` +
    T(cx, cy + 6, label, `font-size="18" text-anchor="middle" ${hl ? `fill="${C.gold}"` : ''}`);
  const wire = (pts, { dash = false, gold = false } = {}) => P('M' + pts.map((p) => p.join(',')).join(' L'),
    `fill="none" stroke="${gold ? C.gold : C.slate}" stroke-width="2" ${dash ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#ID-${gold ? 'ag' : 'ar'})"`);
  // Kᵀ: one green column per token; col(j) → { cache, hl }
  function keysT(x, y, u, n, dh, col = () => ({})) {
    let o = '';
    for (let j = 0; j < n; j++) {
      const c = col(j);
      o += `<g opacity="${c.cache ? .5 : 1}" ${c.cls ? `class="${c.cls}"` : ''}>` + R(x + j * u, y, u - 2, dh, `fill="${C.k}"`) + R(x + j * u, y, u - 2, dh, 'fill="url(#ID-ktl)"') + '</g>';
      if (c.hl) o += R(x + j * u + 1.5, y + 1.5, u - 5, dh - 3, `fill="none" stroke="${C.gold}" stroke-width="3"`);
    }
    return o + T(x + n * u / 2, y + dh / 2, 'K<tspan baseline-shift="super" font-size="15">T</tspan>', 'class="nm"');
  }
  // rows × n cells (causal): kind 'score' | 'weight'; rows are the token indices i0 … i0 + rows − 1
  function grid(x, y, u, i0, rows, n, kind, label) {
    let o = '';
    for (let r = 0; r < rows; r++) for (let j = 0; j < n; j++) {
      const i = i0 + r, px = x + j * u, py = y + r * u;
      o += R(px, py, u - 2, u - 2, `fill="none" stroke="${C.dim}"`);
      if (j > i) { o += R(px, py, u - 2, u - 2, 'fill="url(#ID-mask)" stroke="#2a3650"'); continue; }
      const a = kind === 'score' ? .2 + .7 * rand(i, j) : .15 + .85 * (j === 0 ? .5 : rand(i + 7, j) * .6);
      o += R(px, py, u - 2, u - 2, `fill="${kind === 'score' ? '#8e95a2' : '#8fc5fa'}" fill-opacity="${a.toFixed(2)}"`);
    }
    return o + T(x + n * u * .7, y + Math.min(rows * u * .28, u / 2), label, 'class="nm" style="font-size:19px"');
  }

  /* The layout of « Matrix version »: every product A · B = C has A left of C and B above it.
     n rows of K and V, nq rows of x, Q, scores, A, Z and O (n for prefill, 1 for decode). */
  function geo(n, nq, u = 26) {
    const N = n * u, NQ = nq * u, d = 5 * u, dh = 3 * u, g = 10, SG = 130;
    const X0 = 380, X1 = X0 + d + g, X2 = X1 + dh + g, X3 = X2 + N + SG, X4 = X3 + N + g, X5 = X4 + dh + g, XV = X3 + N - d;
    const YWK = 62, YK = YWK + d + g, YWQ = YK + N + g, YQ = YWQ + d + g;
    return { u, n, nq, N, NQ, d, dh, g, SG, X0, X1, X2, X3, X4, X5, XV, YWK, YK, YWQ, YQ, YKT: YQ - g - dh, YV: YQ - g - N, YWV: YQ - g - N - g - d, YWO: YQ - g - dh };
  }
  // the KV cache of this block and head, top right: k rows and v rows
  const CX = { k: 1092, v: 1180, y: 58 };
  function cache(G, rows, newRow = -1) {
    const { u, dh } = G;
    let o = T(CX.v + dh + 8, 34, 'KV cache · this block and head', `font-size="15" text-anchor="end" fill="${C.gold}"`);
    o += act(CX.k, CX.y, dh, u, rows, C.k, '', (i) => ({ hl: i === newRow }));
    o += act(CX.v, CX.y, dh, u, rows, C.v, '', (i) => ({ hl: i === newRow }));
    o += T(CX.k + dh / 2, CX.y + rows * u / 2, 'K', 'class="nm"') + T(CX.v + dh / 2, CX.y + rows * u / 2, 'V', 'class="nm"');
    return o + R(CX.k - 8, CX.y - 8, CX.v + dh - CX.k + 16, rows * u + 14, `fill="none" stroke="${C.gold}" stroke-width="1.5" stroke-dasharray="6 4" rx="4"`);
  }

  /* ---------------- 1. prefill, then decode ---------------- */
  // steps: 0 prefill · 1 the cache it fills · 2 first decode pass · 3 second one
  function figSummary(s) {
    let o = DEFS;
    const toks = ['Paris', '␣is', '␣the', '␣capital'], Y0 = 236, RHT = 40, MID = Y0 + 2 * RHT - 6, SY = 220, SH = 180;
    const stack = (x) => R(x, SY, 56, SH, `fill="${C.panel}" stroke="${C.blue}" stroke-width="2.5"`) +
      T(x + 36, SY + SH / 2, 'L blocks', `font-size="20" text-anchor="middle" transform="rotate(-90 ${x + 28} ${SY + SH / 2})"`);
    const tok = (x, y, t, a = 'end', gold = false) => T(x, y, t, `class="mono" font-size="22" text-anchor="${a}" fill="${gold ? C.gold : C.ink}" ${gold ? 'font-weight="600"' : ''}`);
    // the KV cache: one k|v pair per token, the new ones framed in gold
    const kv = (x, cols, newFrom) => {
      let r = '';
      for (let j = 0; j < cols; j++) {
        const nw = j >= newFrom, px = x + j * 42;
        r += R(px, 490, 19, 56, `fill="${C.k}" opacity="${nw ? 1 : .45}"`) + R(px + 20, 490, 19, 56, `fill="${C.v}" opacity="${nw ? 1 : .45}"`);
        if (nw) r += R(px - 2, 488, 43, 60, `fill="none" stroke="${C.gold}" stroke-width="2"`);
      }
      return r;
    };
    // prefill: n rows in, the first token out
    o += T(72, 190, 'prefill', `font-size="26" font-weight="600" fill="${C.blue}"`);
    toks.forEach((t, i) => o += tok(220, Y0 + i * RHT + 22, t));
    o += wire([[228, MID], [256, MID]]) + stack(260) + wire([[320, MID], [348, MID]]) + tok(354, MID + 8, '␣of', 'start', true);
    o += T(288, SY + SH + 28, 'n rows at once', 'font-size="17" text-anchor="middle" fill="#8e95a2"');
    if (s >= 1) {
      o += T(72, 524, 'KV cache', `font-size="18" fill="${C.gold}"`) + kv(204, 4, 0);
      o += P(`M288 ${SY + SH + 40} V484`, `fill="none" stroke="${C.gold}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ID-ag)"`) +
        T(296, 466, 'writes', `font-size="15" fill="${C.gold}"`);
    }
    // decode: one row in, one token out, the cache read and one pair appended
    const dec = (x, tin, tout, cols) => {
      let r = T(x, 190, 'decode', `font-size="26" font-weight="600" fill="${C.gold}"`);
      r += tok(x + 100, MID + 8, tin, 'end', true) + wire([[x + 106, MID], [x + 126, MID]]) + stack(x + 130) + wire([[x + 190, MID], [x + 210, MID]]);
      r += tok(x + 216, MID + 8, tout, 'start', true);
      r += T(x + 158, SY - 12, '1 row', 'font-size="17" text-anchor="middle" fill="#8e95a2"');
      r += kv(x, cols, cols - 1);
      r += P(`M${x + 158} 484 V${SY + SH + 6}`, `fill="none" stroke="${C.slate}" stroke-width="2" marker-end="url(#ID-ar)"`) + T(x + 166, 450, 'reads', 'font-size="15" fill="#8e95a2"');
      return r;
    };
    if (s >= 2) o += dec(470, '␣of', '␣France', 5);
    if (s >= 3) o += dec(820, '␣France', '.', 6) + T(1150, MID + 8, '…', 'font-size="28" fill="#8e95a2"');
    return o;
  }

  /* ---------------- 2. prefill: « Matrix version », every row at once ---------------- */
  // steps: 0 x · 1 Q, K · 2 Kᵀ, scores, softmax · 3 V, Z, O · 4 K and V to the cache
  function figPrefill(s) {
    const G = geo(4, 4), { u, N, d, dh, g, SG, X0, X1, X2, X3, X4, X5, XV, YWK, YK, YWQ, YQ, YKT, YV, YWV, YWO } = G;
    let o = DEFS;
    const all = (on) => () => ({ off: !on });
    // Q = x W_Q
    o += act(X0, YQ, d, u, 4, C.x, 'x') + brace('left', YQ, YQ + N, X0, 'n') + brace('bottom', X0, X0 + d, YQ + N, 'd');
    if (s >= 1) {
      o += weight(X1, YWQ, dh, d, 'W' + sub('Q'), s === 1) + brace('left', YWQ, YWQ + d, X1, 'd');
      o += act(X1, YQ, dh, u, 4, C.q, 'Q') + brace('bottom', X1, X1 + dh, YQ + N, DH);
      // K = x W_K from a ghost copy of x
      o += wire([[X0 + d / 2, YQ], [X0 + d / 2, YK + N + 4]], { dash: true });
      o += act(X0, YK, d, u, 4, C.x, 'x', () => ({ ghost: true })) + ghostBox(X0, YK, d, N) + brace('left', YK, YK + N, X0, 'n');
      o += weight(X1, YWK, dh, d, 'W' + sub('K'), s === 1) + brace('left', YWK, YWK + d, X1, 'd');
      o += act(X1, YK, dh, u, 4, C.k, 'K', () => ({ hl: s === 4 }));
    }
    if (s >= 2) {
      const tc = [X2 + N / 2, YK + N / 2];
      o += wire([[X1 + dh, tc[1]], [tc[0] - 19, tc[1]]]) + wire([[tc[0], tc[1] + 17], [tc[0], YKT - 2]]) + op(tc[0], tc[1], 17, 17, 'T');
      o += keysT(X2, YKT, u, 4, dh) + brace('right', YKT, YKT + dh, X2 + N, DH);
      o += grid(X2, YQ, u, 0, 4, 4, 'score', 'Q·K<tspan baseline-shift="super" font-size="13">T</tspan>') + brace('bottom', X2, X2 + N, YQ + N, 'n');
      const sx = X2 + N + SG / 2, sy = YQ + N / 2;
      o += wire([[X2 + N + 2, sy], [sx - 44, sy]]) + wire([[sx + 42, sy], [X3 - 2, sy]]) + op(sx, sy, 42, 22, 'softmax');
      o += grid(X3, YQ, u, 0, 4, 4, 'weight', 'A') + brace('bottom', X3, X3 + N, YQ + N, 'n');
    }
    if (s >= 3) {
      o += wire([[X0 + d / 2, YK], [X0 + d / 2, YWK - 16], [XV + d / 2, YWK - 16], [XV + d / 2, YV - 5]], { dash: true });
      o += act(XV, YV, d, u, 4, C.x, 'x', () => ({ ghost: true })) + ghostBox(XV, YV, d, N) + brace('left', YV, YV + N, XV, 'n');
      o += weight(X4, YWV, dh, d, 'W' + sub('V'), s === 3) + brace('left', YWV, YWV + d, X4, 'd');
      o += act(X4, YV, dh, u, 4, C.v, 'V', () => ({ hl: s === 4 }));
      o += act(X4, YQ, dh, u, 4, C.z, 'Z') + brace('bottom', X4, X4 + dh, YQ + N, DH);
      o += weight(X5, YWO, d, dh, 'W' + sub('O'), s === 3) + brace('top', X5, X5 + d, YWO, 'd') + brace('right', YWO, YWO + dh, X5 + d, DH);
      o += act(X5, YQ, d, u, 4, C.o, 'O') + brace('bottom', X5, X5 + d, YQ + N, 'd') + brace('right', YQ, YQ + N, X5 + d, 'n');
    }
    if (s >= 4) {
      o += cache(G, 4);
      o += wire([[X1 + dh / 2, YK - 2], [X1 + dh / 2, 197], [CX.k + dh / 2, 197], [CX.k + dh / 2, CX.y + 4 * u + 10]], { gold: true });
      o += wire([[X4 + dh + 2, YV + 10], [CX.v + dh / 2, YV + 10], [CX.v + dh / 2, CX.y + 4 * u + 10]], { gold: true });
    }
    return o;
  }

  /* ---------------- 3. decode: the same layout, one new row, K and V from the cache ---------------- */
  // a copy of `inner` that moves (and turns by rot degrees) from the centre `from` to the centre `to`,
  // then fades: only when stepping forward (play); the element it lands as fades in after it (class land)
  const fly = (inner, from, to, rot = 0) => `<g class="fly" style="transform-origin:${from[0]}px ${from[1]}px; --dx:${to[0] - from[0]}px; --dy:${to[1] - from[1]}px; --rot:${rot}deg">${inner}</g>`;
  const land = (inner, on) => (on ? `<g class="land">${inner}</g>` : inner);
  // steps: 0 x₅ · 1 W_Q, q₅ · 2 x₅ ghost, W_K, k₅ · 3 k₅ → Kᵀ column 5 · 4 cached K → Kᵀ columns 1–4 ·
  // 5 q₅·Kᵀ · 6 softmax, a₅ · 7 x₅ copy under W_V · 8 v₅ · 9 x₅ copy and v₅ down to row 5 ·
  // 10 cached V → rows 1–4 · 11 z₅ · 12 W_O, o₅ · 13 k₅ᵀ → cache · 14 v₅ → cache
  function figDecode(s, play) {
    const G = geo(5, 1), { u, N, NQ, d, dh, g, SG, X0, X1, X2, X3, X4, X5, XV, YWK, YQ, YKT, YV, YWV, YWO } = G;
    const at = (k) => play && s === k;
    let o = DEFS;
    // the cache: 4 rows of K and V, then k₅ (step 13) and v₅ (step 14)
    o += T(CX.v + dh + 8, 34, 'KV cache · this block and head', `font-size="15" text-anchor="end" fill="${C.gold}"`);
    o += act(CX.k, CX.y, dh, u, 4, C.k, '') + act(CX.v, CX.y, dh, u, 4, C.v, '');
    if (s >= 13) o += land(act(CX.k, CX.y + 4 * u, dh, u, 1, C.k, '', () => ({ hl: s === 13 })), at(13));
    if (s >= 14) o += land(act(CX.v, CX.y + 4 * u, dh, u, 1, C.v, '', () => ({ hl: s === 14 })), at(14));
    const kr = s >= 13 ? 5 : 4, vr = s >= 14 ? 5 : 4;
    o += T(CX.k + dh / 2, CX.y + kr * u / 2, 'K', 'class="nm"') + T(CX.v + dh / 2, CX.y + vr * u / 2, 'V', 'class="nm"');
    o += R(CX.k - 8, CX.y - 8, CX.v + dh - CX.k + 16, 5 * u + 14, `fill="none" stroke="${C.gold}" stroke-width="1.5" stroke-dasharray="6 4" rx="4"`);

    // x: only the new row
    o += act(X0, YQ, d, u, 1, C.x, 'x₅', () => ({ hl: s === 0 })) + brace('left', YQ, YQ + NQ, X0, '1') + brace('bottom', X0, X0 + d, YQ + NQ, 'd');
    o += T(X0 + d / 2, YQ - 12, '« ␣of »', `font-size="16" text-anchor="middle" fill="${C.gold}"`);
    if (s >= 1) {
      o += weight(X1, YWQ_(G), dh, d, 'W' + sub('Q'), s === 1) + brace('left', YWQ_(G), YWQ_(G) + d, X1, 'd');
      o += act(X1, YQ, dh, u, 1, C.q, 'q₅', () => ({ hl: s === 1 })) + brace('bottom', X1, X1 + dh, YQ + NQ, DH);
    }
    // k₅ = x₅ W_K: a ghost of x₅, W_K just above k₅
    const yk = YWQ_(G) - g - u, ywk = yk - g - d;
    if (s >= 2) {
      o += wire([[X0 + d / 2, YQ], [X0 + d / 2, yk + u + 4]], { dash: true });
      o += act(X0, yk, d, u, 1, C.x, '', () => ({ ghost: true })) + ghostBox(X0, yk, d, u);
      o += weight(X1, ywk, dh, d, 'W' + sub('K'), s === 2) + brace('left', ywk, ywk + d, X1, 'd');
      o += act(X1, yk, dh, u, 1, C.k, 'k₅', () => ({ hl: s === 2 }));
    }
    // Kᵀ: column 5 is k₅ turned a quarter (step 3), columns 1–4 the cached K turned (step 4)
    const c5 = [X2 + 4 * u + (u - 2) / 2, YKT + dh / 2], tc = [c5[0], yk + u / 2];
    if (s >= 3) {
      o += wire([[X1 + dh, tc[1]], [tc[0] - 19, tc[1]]]) + wire([[tc[0], tc[1] + 17], [tc[0], YKT - 2]]) + op(tc[0], tc[1], 17, 17, 'T');
      o += land(keysT(X2 + 4 * u, YKT, u, 1, dh, () => ({ hl: s === 3 || s === 13 })).replace(/<text[^]*$/, ''), at(3));
      if (at(3)) o += fly(act(X1, yk, dh, u, 1, C.k, ''), [X1 + dh / 2, yk + (u - 2) / 2], c5, 90);
      o += brace('right', YKT, YKT + dh, X2 + N, DH);
    }
    if (s >= 4) {
      const fresh = s === 4;
      o += land(keysT(X2, YKT, u, 4, dh, () => ({ cache: fresh })).replace(/<text[^]*$/, '') + (fresh ? cacheBox(X2, YKT, 4 * u - 2, dh, '') : ''), at(4));
      if (at(4)) o += fly(act(CX.k, CX.y, dh, u, 4, C.k, ''), [CX.k + dh / 2, CX.y + 2 * u - 1], [X2 + 2 * u - 1, YKT + dh / 2], -90);
      o += T(X2 + N / 2, YKT + dh / 2, 'K<tspan baseline-shift="super" font-size="15">T</tspan>', 'class="nm"');
    }
    if (s >= 5) {
      o += grid(X2, YQ, u, 4, 1, 5, 'score', '') + brace('bottom', X2, X2 + N, YQ + NQ, 'n');
      o += T(X2 + N / 2, YQ + NQ / 2, 'q₅·Kᵀ', 'class="nm" style="font-size:18px"');
    }
    if (s >= 6) {
      const sx = X2 + N + SG / 2, sy = YQ + NQ / 2;
      o += wire([[X2 + N + 2, sy], [sx - 44, sy]]) + wire([[sx + 42, sy], [X3 - 2, sy]]) + op(sx, sy, 42, 22, 'softmax');
      o += grid(X3, YQ, u, 4, 1, 5, 'weight', '') + brace('bottom', X3, X3 + N, YQ + NQ, 'n') + T(X3 + N / 2, YQ + NQ / 2, 'a₅', 'class="nm" style="font-size:18px"');
    }
    // v₅ = x₅ W_V: a copy of x₅ flies under W_V (7), v₅ (8), both slide down to row 5 of V (9)
    const yv = s >= 9 ? YV + 4 * u : YV;
    if (s >= 7) {
      o += weight(X4, YWV, dh, d, 'W' + sub('V'), s === 7 || s === 8) + brace('left', YWV, YWV + d, X4, 'd');
      const ghost = act(XV, yv, d, u, 1, C.x, '', () => ({ ghost: true })) + ghostBox(XV, yv, d, u);
      o += wire([[X0 + d / 2, yk - 4], [X0 + d / 2, YWK - 16], [XV + d / 2, YWK - 16], [XV + d / 2, yv - 5]], { dash: true });
      if (at(7)) o += land(ghost, true) + fly(act(X0, YQ, d, u, 1, C.x, ''), [X0 + d / 2, YQ + (u - 2) / 2], [XV + d / 2, YV + (u - 2) / 2]);
      else if (at(9)) o += land(ghost, true) + fly(act(XV, YV, d, u, 1, C.x, '', () => ({ ghost: true })) + ghostBox(XV, YV, d, u), [0, 0], [0, 4 * u]);
      else o += ghost;
    }
    if (s >= 8) {
      const v5 = (y) => act(X4, y, dh, u, 1, C.v, 'v₅', () => ({ hl: s === 8 || s === 9 || s === 14 }));
      o += land(v5(yv), at(8) || at(9));
      if (at(9)) o += fly(v5(YV), [0, 0], [0, 4 * u]);
    }
    // rows 1–4 of V: the cached V flies in between W_V and v₅
    if (s >= 10) {
      const fresh = s === 10;
      o += land(act(X4, YV, dh, u, 4, C.v, '', () => ({ cache: fresh })) + (fresh ? cacheBox(X4, YV, dh, 4 * u, '') : ''), at(10));
      if (at(10)) o += fly(act(CX.v, CX.y, dh, u, 4, C.v, ''), [CX.v + dh / 2, CX.y + 2 * u - 1], [X4 + dh / 2, YV + 2 * u - 1]);
      o += T(X4 + dh / 2, YV + 2 * u, 'V', 'class="nm"');
    }
    if (s >= 11) o += act(X4, YQ, dh, u, 1, C.z, 'z₅', () => ({ hl: s === 11 })) + brace('bottom', X4, X4 + dh, YQ + NQ, DH);
    if (s >= 12) {
      o += weight(X5, YWO, d, dh, 'W' + sub('O'), s === 12) + brace('top', X5, X5 + d, YWO, 'd') + brace('right', YWO, YWO + dh, X5 + d, DH);
      o += act(X5, YQ, d, u, 1, C.o, 'o₅', () => ({ hl: s === 12 })) + brace('bottom', X5, X5 + d, YQ + NQ, 'd') + brace('right', YQ, YQ + NQ, X5 + d, '1');
    }
    // the new key and value are appended to the cache
    if (at(13)) o += fly(keysT(X2 + 4 * u, YKT, u, 1, dh).replace(/<text[^]*$/, ''), c5, [CX.k + dh / 2, CX.y + 4 * u + (u - 2) / 2], -90);
    if (at(14)) o += fly(act(X4, YV + 4 * u, dh, u, 1, C.v, ''), [X4 + dh / 2, YV + 4 * u + (u - 2) / 2], [CX.v + dh / 2, CX.y + 4 * u + (u - 2) / 2]);
    return o;
  }
  const YWQ_ = (G) => G.YWQ;

  const FIG = { summary: figSummary, prefill: figPrefill, decode: figDecode };
  let uid = 0;
  document.querySelectorAll('div.pd[data-pd]:not(.pd-built)').forEach((root) => {
    root.classList.add('pd-built');
    const caps = [...root.querySelectorAll(':scope > p')], fig = FIG[root.dataset.pd], id = `pd${uid++}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), box = document.createElement('div');
    svg.setAttribute('viewBox', '0 0 1280 720');
    box.className = 'pd-caps';
    box.append(...caps);
    root.replaceChildren(svg, box);
    let prev = null;
    steps(root, caps.length - 1, (st) => {
      const play = st !== null && prev !== null && st === prev + 1;
      if (st === null) st = caps.length - 1;
      prev = st;
      svg.innerHTML = fig(st, play).replaceAll('ID-', `${id}-`);
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    });
  });
})();
