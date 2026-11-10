// « Megakernels », « Paged attention »: the layout of « Decode » (inference deck, themes/prefill.js),
// same coordinates and colours, with the KV cache box replaced by a pool of pages and a page table.
// Builds the figure inside every <div class="pd" data-pa="paged">; its <p> children are the captions,
// one per step. Helpers copied from themes/prefill.js; styles from themes/prefill.css (load it).
// Uses steps.js (load it first).
(() => {
  const C = { slide: '#0f1829', panel: '#18233a', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', blue: '#4aa8ff',
    gold: '#f5c451', cyan: '#8fc5fa', x: '#4aa8ff', q: '#ff9f43', k: '#7cc47a', v: '#d97fd0', z: '#a46cf5', o: '#6d86ff' };
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const R = (x, y, w, h, a) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const P = (d, a) => `<path d="${d}" ${a}/>`;
  const rand = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const HEAT = [[12, .55], [24, .2], [36, .7], [48, .35], [60, .1], [72, .6]];
  const DEFS = `<defs>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<pattern id="ID-heat${i}" x="${(i * 36) % 84}" width="84" height="40" patternUnits="userSpaceOnUse">${HEAT.map(([x, a]) => R(x, 0, 12, 40, `fill="${C.slide}" fill-opacity="${a}"`)).join('')}</pattern>`).join('')}
  <pattern id="ID-wl" width="10" height="5" patternUnits="userSpaceOnUse">${R(0, 0, 10, 2, `fill="${C.dim}"`)}</pattern>
  <pattern id="ID-ktl" width="10" height="5" patternUnits="userSpaceOnUse">${R(0, 0, 10, 2, `fill="${C.slide}" fill-opacity=".55"`)}</pattern>
  <marker id="ID-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.slate}"/></marker>
  <marker id="ID-ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.gold}"/></marker>
  </defs>`;
  function curly(x1, y1, x2, y2, w, q = 0.6) {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(0.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(0.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(0.75, 1 - q)} T${tip}`;
  }
  function brace(side, a, b, e, label) {
    const W = 14, G = 3, st = `fill="none" stroke="${C.cyan}" stroke-width="1.5"`;
    if (side === 'left') return P(curly(e - G, a, e - G, b, W - 2), st) + T(e - G - W - 6, (a + b) / 2 + 7, label, 'class="bl" text-anchor="end"');
    if (side === 'right') return P(curly(e + G, b, e + G, a, W - 2), st) + T(e + G + W + 6, (a + b) / 2 + 7, label, 'class="bl"');
    if (side === 'top') return P(curly(b, e - G, a, e - G, W - 2), st) + T((a + b) / 2, e - G - W - 4, label, 'class="bl" text-anchor="middle"');
    return P(curly(a, e + G, b, e + G, W - 2), st) + T((a + b) / 2, e + G + W + 18, label, 'class="bl" text-anchor="middle"');
  }
  const DH = 'd<tspan baseline-shift="sub" font-size="14">h</tspan>';
  const sub = (s) => `<tspan baseline-shift="sub" font-size="15">${s}</tspan>`;
  function act(x, y, w, u, rows, col, label, row = () => ({})) {
    let o = '';
    for (let i = 0; i < rows; i++) {
      const r = row(i);
      const op = r.ghost ? .45 : r.dim ? .25 : 1;
      o += `<g opacity="${op}">` + R(x, y + i * u, w, u - 2, `fill="${col}"`) + R(x, y + i * u, w, u - 2, `fill="url(#ID-heat${(i + (r.seed || 0)) % 7})"`) + '</g>';
      if (r.hl) o += R(x + 1.5, y + i * u + 1.5, w - 3, u - 5, `fill="none" stroke="${C.gold}" stroke-width="3"`);
    }
    return o + (label ? T(x + w / 2, y + rows * u / 2, label, 'class="nm"') : '');
  }
  const ghostBox = (x, y, w, h) => R(x - 4, y - 4, w + 8, h + 6, `fill="none" stroke="${C.slate}" stroke-width="1.5" stroke-dasharray="4 3"`);
  const slot = (x, y, w, h) => R(x, y, w, h, `fill="none" stroke="${C.dim}" stroke-width="1.5" stroke-dasharray="4 3"`);
  const weight = (x, y, w, h, label) => R(x, y, w, h, `fill="url(#ID-wl)" stroke="${C.blue}" stroke-width="2"`) + T(x + w / 2, y + h / 2, label, 'class="nm"');
  const op = (cx, cy, rx, ry, label) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.slide}" stroke="${C.ink}" stroke-width="2"/>` +
    T(cx, cy + 6, label, 'font-size="18" text-anchor="middle"');
  const wire = (pts, { dash = false, gold = false } = {}) => P('M' + pts.map((p) => p.join(',')).join(' L'),
    `fill="none" stroke="${gold ? C.gold : C.slate}" stroke-width="2" ${dash ? 'stroke-dasharray="6 5"' : ''} marker-end="url(#ID-${gold ? 'ag' : 'ar'})"`);
  function keysT(x, y, u, n, dh, seed = 0) {
    let o = '';
    for (let j = 0; j < n; j++) o += R(x + j * u, y, u - 2, dh, `fill="${C.k}" fill-opacity="${(.55 + .45 * rand(j + seed, 3)).toFixed(2)}"`) + R(x + j * u, y, u - 2, dh, 'fill="url(#ID-ktl)"');
    return o;
  }
  function grid(x, y, u, n, kind) {
    let o = '';
    for (let j = 0; j < n; j++) {
      const a = kind === 'score' ? .2 + .7 * rand(4, j) : .15 + .85 * (j === 0 ? .5 : rand(11, j) * .6);
      o += R(x + j * u, y, u - 2, u - 2, `fill="${kind === 'score' ? '#8e95a2' : '#8fc5fa'}" fill-opacity="${a.toFixed(2)}"`);
    }
    return o;
  }
  // a copy drawn at its landing place, that flies in from the centre `from` (relative to the centre `to`),
  // turned by rot and scaled by (sx, sy) at the start; the landing itself fades in after it (class land)
  const fly = (inner, to, from, rot = 0, sx = 1, sy = 1) => `<g class="pa-fly" style="transform-origin:${to[0]}px ${to[1]}px; --dx:${from[0] - to[0]}px; --dy:${from[1] - to[1]}px; --rot:${rot}deg; --sx:${sx}; --sy:${sy}">${inner}</g>`;
  const land = (inner, on) => (on ? `<g class="land">${inner}</g>` : inner);

  // the layout of « Decode »: geo(5, 1) of themes/prefill.js
  const u = 26, N = 130, NQ = 26, d = 130, dh = 78, g = 10, SG = 130;
  const X0 = 380, X1 = 520, X2 = 608, X3 = 868, X4 = 1008, X5 = 1096, XV = 868;
  const YWQ = 342, YQ = 482, YKT = 394, YV = 342, YWV = 202, YWO = 394, yk = 306, ywk = 166, YW = 156;
  // the pool: 8 pages of 2 tokens, one K cell and one V cell per token
  const PX = 812, PS = 52, PW = 22, PY = 66, PU = 22;
  const px = (p) => PX + p * PS, pc = (p) => [px(p) + PW + 1, PY + PU];
  const OTHER = [0, 3, 6];
  // the page table: physical page of each logical page of « ␣of »'s request
  const TX = 660, TS = 46, TW = 40, TABLE = [5, 2, 7];

  // steps: 0 decode, cache unknown · 1 pool · 2 page table · 3 Kᵀ gathered · 4 V gathered ·
  // 5 scores, softmax, z₅, o₅ · 6 page 7 added, k₅, v₅ appended · 7 pages come and go
  function fig(s, play) {
    const at = (k) => play && s === k;
    let o = DEFS;
    // the pool
    if (s >= 1) {
      for (let p = 0; p < 8; p++) {
        const mine = s >= 2 && (p === 5 || p === 2 || (p === 7 && s >= 6)), other = OTHER.includes(p);
        const rows = other ? 2 : p === 5 || p === 2 ? 2 : p === 7 && s >= 6 ? 1 : 0;
        o += T(px(p) + PW + 1, PY - 8, p, `font-size="14" text-anchor="middle" fill="${mine ? C.gold : C.slate}"`);
        o += slot(px(p), PY, 2 * PW + 2, 2 * PU);
        const cells = act(px(p), PY, PW, PU, rows, C.k, '', () => ({ dim: other, seed: p })) + act(px(p) + PW + 2, PY, PW, PU, rows, C.v, '', () => ({ dim: other, seed: p + 3 }));
        o += p === 7 && rows ? land(cells, at(6)) : cells;
        if (mine) o += R(px(p) - 3, PY - 3, 2 * PW + 8, 2 * PU + 4, `fill="none" stroke="${C.gold}" stroke-width="2" rx="3"`);
      }
      o += T(PX + 8 * PS - 6, PY + 2 * PU + 26, 'pool of pages · this block and head', `font-size="15" text-anchor="end" fill="${C.gold}"`);
      o += R(PX, PY + 2 * PU + 15, 12, 12, `fill="${C.k}" opacity=".25"`) + T(PX + 18, PY + 2 * PU + 26, 'other requests', `font-size="14" fill="${C.slate}"`);
    }
    // the page table, one entry per page of « ␣of »'s request
    if (s >= 2) {
      TABLE.forEach((p, i) => {
        if (i === 2 && s < 6) { o += slot(TX + i * TS, PY, TW, 2 * PU); return; }
        const cx = TX + i * TS + TW / 2;
        const e = R(TX + i * TS, PY, TW, 2 * PU, `fill="${C.panel}" stroke="${C.gold}" stroke-width="2"`) + T(cx, PY + PU + 7, p, `class="mono" font-size="20" text-anchor="middle" fill="${C.gold}"`)
          + P(`M${cx} ${PY - 2} C${cx} ${[6, 30, -14][i]} ${pc(p)[0]} ${[6, 30, -14][i]} ${pc(p)[0]} ${PY - 26}`, `fill="none" stroke="${C.gold}" stroke-width="1.5" marker-end="url(#ID-ag)"`);
        o += i === 2 ? land(e, at(6)) : e;
      });
      o += T(TX + (3 * TS - 6) / 2, PY + 2 * PU + 26, 'page table', `font-size="15" text-anchor="middle" fill="${C.gold}"`);
    }

    // x₅, q₅ = x₅ W_Q
    o += act(X0, YQ, d, u, 1, C.x, 'x₅') + brace('left', YQ, YQ + NQ, X0, '1') + brace('bottom', X0, X0 + d, YQ + NQ, 'd');
    o += T(X0 + d / 2, YQ - 12, '« ␣of »', `font-size="16" text-anchor="middle" fill="${C.gold}"`);
    o += weight(X1, YWQ, dh, d, 'W' + sub('Q')) + brace('left', YWQ, YWQ + d, X1, 'd');
    o += act(X1, YQ, dh, u, 1, C.q, 'q₅') + brace('bottom', X1, X1 + dh, YQ + NQ, DH);
    // k₅ = x₅ W_K, turned into column 5 of Kᵀ
    o += wire([[X0 + d / 2, YQ], [X0 + d / 2, yk + u + 4]], { dash: true });
    o += act(X0, yk, d, u, 1, C.x, '', () => ({ ghost: true })) + ghostBox(X0, yk, d, u);
    o += weight(X1, ywk, dh, d, 'W' + sub('K')) + brace('left', ywk, ywk + d, X1, 'd');
    o += act(X1, yk, dh, u, 1, C.k, 'k₅');
    const c5 = [X2 + 4 * u + (u - 2) / 2, YKT + dh / 2], tc = [c5[0], yk + u / 2];
    o += wire([[X1 + dh, tc[1]], [tc[0] - 19, tc[1]]]) + wire([[tc[0], tc[1] + 17], [tc[0], YKT - 2]]) + op(tc[0], tc[1], 17, 17, 'T');
    o += keysT(X2 + 4 * u, YKT, u, 1, dh, 4) + brace('right', YKT, YKT + dh, X2 + N, DH);
    // Kᵀ columns 1–4: empty slots, then gathered: 1–2 from page 5, 3–4 from page 2
    const SRC = [[5, 0], [2, 2]];
    if (s < 3) for (let j = 0; j < 4; j++) o += slot(X2 + j * u, YKT, u - 2, dh);
    else SRC.forEach(([p, j0]) => {
      const cols = keysT(X2 + j0 * u, YKT, u, 2, dh, j0);
      o += land(cols, at(3));
      if (at(3)) o += fly(cols, [X2 + j0 * u + u - 1, YKT + dh / 2], [px(p) + PW / 2, PY + PU], 90, 2 * PU / (2 * u), PW / dh);
      if (s <= 4) o += T(X2 + j0 * u + u - 1, YKT - 8, `page ${p}`, `font-size="13" text-anchor="middle" fill="${C.gold}"`);
    });
    o += T(X2 + N / 2, YKT + dh / 2, 'K<tspan baseline-shift="super" font-size="15">T</tspan>', 'class="nm"');
    // v₅ = x₅ W_V, row 5 of V; rows 1–4: empty slots, then gathered from the same pages
    const yv = YV + 4 * u;
    o += weight(X4, YWV, dh, d, 'W' + sub('V')) + brace('left', YWV, YWV + d, X4, 'd');
    o += wire([[X0 + d / 2, yk - 4], [X0 + d / 2, YW], [XV + d / 2, YW], [XV + d / 2, yv - 5]], { dash: true });
    o += act(XV, yv, d, u, 1, C.x, '', () => ({ ghost: true })) + ghostBox(XV, yv, d, u);
    o += act(X4, yv, dh, u, 1, C.v, 'v₅');
    if (s < 4) for (let i = 0; i < 4; i++) o += slot(X4, YV + i * u, dh, u - 2);
    else SRC.forEach(([p, i0]) => {
      const rows = act(X4, YV + i0 * u, dh, u, 2, C.v, '', () => ({ seed: i0 }));
      o += land(rows, at(4));
      if (at(4)) o += fly(rows, [X4 + dh / 2, YV + i0 * u + u - 1], [px(p) + PW + 2 + PW / 2, PY + PU], 0, PW / dh, 2 * PU / (2 * u));
      if (s === 4) o += T(X4 - 8, YV + i0 * u + u + 4, `page ${p}`, `font-size="13" text-anchor="end" fill="${C.gold}"`);
    });
    if (s >= 4) o += T(X4 + dh / 2, YV + 2 * u, 'V', 'class="nm"');
    // the rest of « Decode », unchanged
    if (s >= 5) {
      o += grid(X2, YQ, u, 5, 'score') + brace('bottom', X2, X2 + N, YQ + NQ, 'n') + T(X2 + N / 2, YQ + NQ / 2, 'q₅·Kᵀ', 'class="nm" style="font-size:18px"');
      const sx = X2 + N + SG / 2, sy = YQ + NQ / 2;
      o += wire([[X2 + N + 2, sy], [sx - 44, sy]]) + wire([[sx + 42, sy], [X3 - 2, sy]]) + op(sx, sy, 42, 22, 'softmax');
      o += grid(X3, YQ, u, 5, 'weight') + brace('bottom', X3, X3 + N, YQ + NQ, 'n') + T(X3 + N / 2, YQ + NQ / 2, 'a₅', 'class="nm" style="font-size:18px"');
      o += act(X4, YQ, dh, u, 1, C.z, 'z₅') + brace('bottom', X4, X4 + dh, YQ + NQ, DH);
      o += weight(X5, YWO, d, dh, 'W' + sub('O')) + brace('top', X5, X5 + d, YWO, 'd') + brace('right', YWO, YWO + dh, X5 + d, DH);
      o += act(X5, YQ, d, u, 1, C.o, 'o₅') + brace('bottom', X5, X5 + d, YQ + NQ, 'd') + brace('right', YQ, YQ + NQ, X5 + d, '1');
    }
    // the append: k₅ and v₅ fly to the first slot of page 7
    if (at(6)) {
      o += fly(act(px(7), PY, PW, PU, 1, C.k, ''), [px(7) + PW / 2, PY + PU / 2], c5, -90, dh / PW, (u - 2) / PU);
      o += fly(act(px(7) + PW + 2, PY, PW, PU, 1, C.v, ''), [px(7) + PW + 2 + PW / 2, PY + PU / 2], [X4 + dh / 2, yv + (u - 2) / 2], 0, dh / PW, (u - 2) / PU);
    }
    if (s >= 6) {
      o += R(X2 + 4 * u - 1.5, YKT - 1.5, u + 1, dh + 3, `fill="none" stroke="${C.gold}" stroke-width="${s === 6 ? 3 : 0}"`);
      if (s === 6) o += R(X4 + 1.5, yv + 1.5, dh - 3, u - 5, `fill="none" stroke="${C.gold}" stroke-width="3"`);
    }
    return o;
  }

  document.querySelectorAll('div.pd[data-pa]:not(.pd-built)').forEach((root) => {
    root.classList.add('pd-built');
    const caps = [...root.querySelectorAll(':scope > p')];
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
      svg.innerHTML = fig(st, play).replaceAll('ID-', 'pa-');
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    });
  });
})();
