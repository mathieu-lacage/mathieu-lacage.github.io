// Multi-head attention: how H heads are cut out of one d × d projection each, run side by
// side and put back together. Same convention as attention.js: every product A · B = C has A
// to the left of C and B above it, so the drawing needs no arrows.
//   1. one product x · [W_Q | W_K | W_V] computes Q, K and V for every head;
//   2. head h owns column slice h of each W (and of Q, K, V): the slices slide into one
//      column per head, W_Q^(h) W_K^(h) W_V^(h) above Q_h K_h V_h;
//   3. in each column, A_h = softmax(Q_h K_hᵀ) sits under Q_h and K_h, and Z_h = A_h · V_h
//      under V_h (A_h to its left, V_h above it);
//   4. the Z_h slide together into Z, and O = Z · W_O = Σ_h Z_h · W_O^(h) builds up one
//      head at a time (row slice h of W_O meets column slice h of Z).
//
// Builds the animation inside every <div class="viz" data-anim="heads"> from:
//   data-tokens  the rows, "Paris ␣is …" (only their number n is used)
//   data-heads   the number of (query) heads H (4)
//   data-kv      the number of key / value heads, a divisor of H (H: multi-head attention).
//                With fewer (grouped-query attention), W_K and W_V have only data-kv column
//                slices; each column holds a group of H / data-kv query heads, which share
//                its K and V: one row A_h, Z_h per query head, Z_h under the shared V (two per
//                row when a group holds more than 2 query heads, e.g. data-kv="1")
//   data-unit    pixels per unit: n = N, d_h = 2 and d = H · d_h units (18)
//   data-window  optional, a sliding window W: one more step right after the attention
//                step, where every key j <= i - W of the A_h turns masked (tinted, .sw-drop)
//                and the head patterns are renormalized over the window
//   data-latent  optional, multi-latent attention with a latent of that many units (d_c = units · u):
//                x · [W_DKV | W_Q] = [c | Q] on the first row; a shadow copy of c (an arrow from c)
//                starts a second row, c · [W_UK | W_UV] = [K | V], the up weights only d_c tall.
//                Two more steps: the up weights before K and V appear, and the regrouping in two
//                moves, Q first, then K and V rising into the columns. Every head keeps its own
//                K_h, V_h; c stays next to x, the only thing decode caches
// Its <p> children are the captions, one per step, in order.
// Positions are slide coordinates (the root sits at 72, 150), as in attention.js; its
// styles (.at-*) are reused. The attention patterns are illustrative: head 1 reads the
// previous token, head 2 the first token, head 3 itself, head 4 two tokens back, and so on round.
// Uses viz-core.js (load it first) and braces.js (load it after).
(() => {
  const { one, from, parseTokens } = window.AD;
  const OX = 72, OY = 150;                              // the root's position on the slide
  const COL = { x: '#4aa8ff', q: '#ff9f43', k: '#7cc47a', v: '#d97fd0', z: '#a46cf5', o: '#6d86ff', c: '#f2c14e' };
  const QKV = [['Q', COL.q], ['K', COL.k], ['V', COL.v]];

  // causal attention weights of head k for N tokens: most of each row on one target
  // with a window Wn, only keys i - Wn < j <= i: the target moves into the window, renormalized
  const pattern = (k, N, Wn = N) => Array.from({ length: N }, (_, i) => {
    const lo = Math.max(0, i - Wn + 1), m = i - lo;   // m + 1 keys in the window
    const t = Math.max(lo, [Math.max(i - 1, 0), 0, i, Math.max(i - 2, 0)][k % 4]);
    return Array.from({ length: i + 1 }, (_, j) => (j < lo ? 0 : m === 0 ? 1 : j === t ? 0.75 : 0.25 / m));
  });

  function build(root) {
    const N = parseTokens(root.dataset.tokens).length, H = +(root.dataset.heads || 4);
    const KV = +(root.dataset.kv || H), R = H / KV;     // R query heads per key / value head
    const Wn = +(root.dataset.window || 0);             // sliding window, 0: none
    const LAT = +(root.dataset.latent || 0);            // latent width in units, 0: none
    const heads = Array.from({ length: H }, (_, k) => k), groups = Array.from({ length: KV }, (_, j) => j);

    // timeline
    let s = 0;
    const next = () => ++s;
    const PROJ = next(), UW = LAT ? next() : null, UP = LAT ? next() : null, SLICE = next(), RQ = LAT ? next() : null, REG = next(), ATT = next(), WIN = Wn ? next() : null, ZS = next(), CAT = next(), WO = next();
    const SUM = heads.map(next);                        // SUM[k]: head k adds Z_k · W_O^(k) to O
    const FINAL = s;
    const REGQ = LAT ? RQ : REG;                        // Q regrouped (latent: one step before K, V)

    // geometry
    const u = +(root.dataset.unit || 18), n = N * u, dh = 2 * u, d = H * dh, dk = KV * dh, g = 10, sg = 6;
    const XX = 80, YW = 160, YP = YW + d + g, YA = YP + n + 16;
    const ya = (r) => YA + r * (n + 16);                 // row of the r-th query head of a column
    // more than 2 query heads per column (multi-query attention): 2 per row, or they run off the slide
    const LN = R > 2 ? 2 : 1, RW = Math.ceil(R / LN);    // lanes, rows per column
    const DC = LAT * u, XC = XX + d + 20;               // the latent c and W_DKV, right of x
    const BASE = LAT ? XC + DC + 20 : 250;              // left edge of the head columns
    const wh = (m) => (LAT && m ? DC : d);              // height of W_m: W_UK, W_UV are only d_c tall
    const YP2 = YP + n + g + DC + 50;                   // latent: the row of c · [W_UK | W_UV]
    const W = [d, dk, dk];                               // widths of W_Q, W_K, W_V
    const fx = (m, k) => BASE + (m > 0) * (d + g) + (m > 1) * (dk + g) + k * dh;  // slice k of W_m, side by side (one product)
    // latent: slice k of W_m before regrouping, Q right of c, K and V on the second row
    const fxF = (m, k) => (LAT ? XC + DC + g + (m > 1) * (dk + g) + k * dh : fx(m, k));
    const fyF = (m) => (LAT && m ? YP2 - YP : 0);
    const CW = (R + 2) * dh + (R + 1) * sg + (LN - 1) * (dh + sg);  // R query slices, K and V, room for the 2nd lane of Z
    const hx = (j) => BASE + j * (CW + 36);               // column j, of key / value head j
    const slot = (m, k) => (m ? R - 1 + m : k % R);      // slice k of W_m, its place in its column
    const sx = (m, k) => hx(m ? k : Math.floor(k / R)) + slot(m, k) * (dh + sg);  // slice k of W_m, regrouped
    const ZX = hx(KV) + 10, OXO = ZX + d + 18, YWO = YA - g - d;

    const ctx = AD.context();
    const { h } = ctx;
    const at = (x, y, w, hh) => `left:${x - OX}px; top:${y - OY}px; width:${w}px; height:${hh}px;`;
    const box = (cls, x, y, w, hh, opt = {}, ...kids) => h('div', `at-b ${cls}`, { ...opt, style: at(x, y, w, hh) + (opt.style || '') }, ...kids);
    const name = (html, opt = {}) => h('span', `at-nm ${opt.cls || ''}`, { ...opt, html });
    const sup = (main, sb, sp) => `${main}<span class="hd-ss"><span>${sp}</span><span>${sb}</span></span>`;
    const rowsOf = (w, color, top = 0) => Array.from({ length: N }, (_, i) => h('div', 'at-row', {
      style: `top:${top + i * u}px; height:${u - 2}px; background-color:${color}; background-position-x:${(i * 36 + w) % 84}px` }));
    const act = (x, y, w, color, label, o = {}) => box('at-box', x, y, w, n, o, ...rowsOf(w, color), name(label, o.nm));
    const brace = (side, a, b, e, label, vis, hl) => {
      const W = 14, G = 3;
      const rr = { left: [e - G - W, a, W, b - a], right: [e + G, a, W, b - a],
        top: [a, e - G - W, b - a, W], bottom: [a, e + G, b - a, W] }[side];
      return box('at-br', ...rr, { vis, hl, html: `<svg class="viz-brace" data-side="${side}"><path/></svg>` },
        h('span', `at-bl at-bl-${side}`, { html: label }));
    };
    const DH = 'd<sub>h</sub>';
    const els = [], moves = [];                         // moves: [element, step, dx, dy]

    // column panels, behind everything
    groups.forEach((j) => els.push(box('hd-panel', hx(j) - 12, YW - 12, CW + 24, ya(RW - 1) + n - YW + 24,
      { vis: [from(REG)], hl: [one(REG)] }, h('span', 'hd-ht',
        { html: R === 1 ? `head ${j + 1}` : `heads ${Array.from({ length: R }, (_, r) => j * R + r + 1).join(', ')}` }))));
    // x, and a faint rail: the same x feeds every head
    els.push(box('hd-rail', XX + d + 8, YP + n / 2 - 1, hx(KV - 1) - 14 - (XX + d + 8), 2, { vis: [from(REGQ)] }),
      act(XX, YP, d, COL.x, 'x', { hl: [one(0), one(PROJ)] }),
      brace('left', YP, YP + n, XX, 'n'), brace('top', XX, XX + d, YP, 'd'));
    // the latent: c = x · W_DKV, d_c wide, and its shadow copy on the second row, an arrow from c
    if (LAT) {
      const y1 = YP + n + 8, y2 = YP2 - 8, ax = XC + DC / 2;
      els.push(box('at-w', XC, YW, DC, d, { vis: [from(PROJ)], hl: [one(PROJ)] }, name('W<sub>DKV</sub>', { cls: 'hd-sm' })),
        brace('top', XC, XC + DC, YW, 'd<sub>c</sub>', [from(PROJ)]), brace('left', YW, YW + d, XC, 'd', [from(PROJ)]),
        act(XC, YP, DC, COL.c, 'c', { vis: [from(PROJ)], hl: [one(PROJ), one(UW), one(FINAL)] }),
        box('', ax - 8, y1, 16, y2 - y1, { vis: [[UW, REG]],
          html: `<svg width="16" height="${y2 - y1}" style="position:absolute;left:0;top:0;overflow:visible">`
            + `<path d="M8,0 V${y2 - y1 - 1} M2,${y2 - y1 - 9} L8,${y2 - y1 - 1} L14,${y2 - y1 - 9}" fill="none" stroke="${COL.c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` }),
        // dimmed with a filter: an inline opacity would override .is-off
        act(XC, YP2, DC, COL.c, 'c', { vis: [[UW, REG]], hl: [one(UW), one(UP)], style: 'filter:brightness(.7) saturate(.7)' }),
        box('', XC - 4, YP2 - 4, DC + 8, n + 8, { vis: [[UW, REG]], style: `border:2px dashed ${COL.c}; border-radius:4px` }));
    }

    // the H + 2 KV slices: weight slice above its product slice, both move from fused to regrouped
    QKV.forEach(([nm, color], m) => (m ? groups : heads).forEach((k) => {
      const up = LAT && m, end = m ? REG : REGQ;
      const e = box('at-box hd-slice', fxF(m, k), YP + fyF(m) - g - wh(m), dh, wh(m) + g + n,
        { vis: [from(up ? UW : PROJ)], hl: k === 0 ? [one(SLICE)] : [] },
        h('div', 'at-w hd-w', { style: `height:${wh(m)}px; --hd-c:${color}` },
          name(sup('W', up ? `U${nm}` : nm, `(${k + 1})`), { cls: 'hd-sm', vis: [from(end)] })),
        h('div', 'hd-act', { style: `top:${wh(m) + g}px; height:${n}px`, vis: [from(up ? UP : PROJ)] }, ...rowsOf(dh, color),
          name(`${nm}<sub>${k + 1}</sub>`, { cls: 'hd-sm', vis: [from(end)] })));
      els.push(e);
      moves.push([e, end, sx(m, k) - fxF(m, k), -fyF(m)]);
    }));
    // names and braces of the side-by-side layout
    QKV.forEach(([nm], m) => {
      // st: the product shows; sw: its weights show (latent: one step earlier); end: regrouped
      const up = LAT && m, st = up ? UP : PROJ, sw = up ? UW : PROJ, end = m ? REG : REGQ;
      const w = W[m], x0 = fxF(m, 0), y0 = YP + fyF(m), top = y0 - g - wh(m);
      els.push(box('at-box hd-name', x0, top, w, wh(m) + g + n, { vis: [[st, end]], hl: [one(st)] }),
        box('hd-name', x0, top, w, wh(m), { vis: [[sw, end]] }, name(`W<sub>${up ? 'U' : ''}${nm}</sub>`)),
        box('hd-name', x0, y0, w, n, { vis: [[st, end]] }, name(nm)),
        brace('top', x0, x0 + w, top, w === d ? 'd' : `${KV} ${DH}`, [[sw, st + 1]]));
      if (up && m === 2) els.push(brace('right', top, top + wh(m), x0 + w, 'd<sub>c</sub>', [[sw, st + 1]]));
    });
    // with a latent, W_DKV's brace says d: the ones of W_Q would sit on W_DKV
    if (!LAT) els.push(brace('left', YW, YW + d, fx(0, 0), 'd', [[PROJ, REG]]), brace('left', YW, YW + d, sx(0, 0), 'd', [from(REG)]));
    els.push(...heads.map((k) => brace('top', fxF(0, k), fxF(0, k) + dh, YW, DH, [[SLICE, REGQ]])),
      brace('top', sx(0, 0), sx(0, 0) + dh, YW, DH, [from(REGQ)]));

    // per head, on its row of its column: A_h under Q_h and K, Z_h under V
    heads.forEach((k) => {
      const P = pattern(k, N), PW = Wn && pattern(k, N, Wn), cells = [], j0 = Math.floor(k / R), rr = Math.floor((k % R) / LN), cc = k % LN;
      P.forEach((row, i) => P.forEach((_, j) => {
        const pos = `left:${j * u}px; top:${i * u}px; width:${u - 2}px; height:${u - 2}px;`;
        const a = (w, vis) => h('div', 'at-cell', { style: `${pos} background:rgba(143,197,250,${(0.15 + 0.85 * w).toFixed(2)})`, vis });
        if (j > i) cells.push(h('div', 'at-cell at-mask', { style: pos }));
        else if (!Wn) cells.push(a(row[j]));
        else {  // causal weights until the window step, then the windowed ones, or masked
          cells.push(a(row[j], [[ATT, WIN]]));
          cells.push(j <= i - Wn ? h('div', 'at-cell at-mask sw-drop', { style: pos, vis: [from(WIN)] }) : a(PW[i][j], [from(WIN)]));
        }
      }));
      const ax = hx(j0) + ((R + 1) * dh + R * sg - LN * n - (LN - 1) * 16) / 2 + cc * (n + 16);  // centred under the Q and K slices
      els.push(box('at-box', ax, ya(rr), n - 2, n - 2, { vis: [from(ATT)], hl: Wn ? [one(ATT), one(WIN)] : [one(ATT)] },
        ...cells, name(`A<sub>${k + 1}</sub>`, { cls: 'hd-sm' })));
      const z = act(sx(2, j0) + cc * (dh + sg), ya(rr), dh, COL.z, `Z<sub>${k + 1}</sub>`,
        { vis: [from(ZS)], hl: [one(ZS), one(SUM[k])], nm: { cls: 'hd-sm' } });
      els.push(z);
      moves.push([z, CAT, ZX + k * dh - sx(2, j0) - cc * (dh + sg), YA - ya(rr)]);
    });
    els.push(box('at-box hd-name', ZX, YA, d, n, { vis: [from(CAT)], hl: [one(CAT)] }),
      box('hd-name', ZX, YA - 30, d, 26, { vis: [from(CAT)] }, name('Z', { cls: 'hd-sm' })),
      brace('bottom', ZX, ZX + d, YA + n, 'd', [from(CAT)]));

    // O = Z · W_O: row slice k of W_O meets column slice k of Z; O builds up head by head
    els.push(box('at-w', OXO, YWO, d, d, { vis: [from(WO)], hl: [one(WO)] },
      ...heads.map((k) => h('div', `hd-sl${k ? ' hd-cut hd-rows' : ''}`,
        { hl: [one(SUM[k])], style: `left:0; width:${d}px; top:${k * dh}px; height:${dh}px` })),
      name('W<sub>O</sub>')),
      brace('top', OXO, OXO + d, YWO, 'd', [from(WO)]),
      ...heads.map((k) => brace('right', YWO + k * dh, YWO + (k + 1) * dh, OXO + d, DH, [from(WO)])));
    // one faint layer per head, the last one opaque: O fills in as the heads add up
    const layers = heads.map((k) => h('div', 'hd-layer', { vis: [from(SUM[k])] },
      h('div', 'hd-fill', { style: `opacity:${k === H - 1 ? 1 : 0.4}` }, ...rowsOf(d, COL.o))));
    els.push(box('at-box', OXO, YA, d, n, { vis: [from(SUM[0])], hl: SUM.map(one) }, ...layers, name('O')),
      brace('bottom', OXO, OXO + d, YA + n, 'd', [from(SUM[0])]));

    // the moving slices sit against each other: their outlines go inside
    moves.forEach(([e]) => e.classList.add('hd-mv', 'hd-in'));
    AD.mount(root, ctx, FINAL, els, (st) => moves.forEach(([e, step, dx, dy]) => {
      e.style.translate = st >= step ? `${dx}px ${dy}px` : '0 0';
    }));
  }

  AD.run('heads', build);
})();
