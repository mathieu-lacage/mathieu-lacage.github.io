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
//                its K and V: one row A_h, Z_h per query head, Z_h under the shared V
//   data-unit    pixels per unit: n = N, d_h = 2 and d = H · d_h units (18)
// Its <p> children are the captions, one per step, in order.
// Positions are slide coordinates (the root sits at 72, 150), as in attention.js; its
// styles (.at-*) are reused. The attention patterns are illustrative: head 1 reads the
// previous token, head 2 the first token, head 3 itself, head 4 two tokens back, and so on round.
// Uses viz-core.js (load it first) and braces.js (load it after).
(() => {
  const { one, from, parseTokens } = window.AD;
  const OX = 72, OY = 150;                              // the root's position on the slide
  const COL = { x: '#4aa8ff', q: '#ff9f43', k: '#7cc47a', v: '#d97fd0', z: '#a46cf5', o: '#6d86ff' };
  const QKV = [['Q', COL.q], ['K', COL.k], ['V', COL.v]];

  // causal attention weights of head k for N tokens: most of each row on one target
  const pattern = (k, N) => Array.from({ length: N }, (_, i) => {
    const t = [Math.max(i - 1, 0), 0, i, Math.max(i - 2, 0)][k % 4];
    return Array.from({ length: i + 1 }, (_, j) => (i === 0 ? 1 : j === t ? 0.75 : 0.25 / i));
  });

  function build(root) {
    const N = parseTokens(root.dataset.tokens).length, H = +(root.dataset.heads || 4);
    const KV = +(root.dataset.kv || H), R = H / KV;     // R query heads per key / value head
    const heads = Array.from({ length: H }, (_, k) => k), groups = Array.from({ length: KV }, (_, j) => j);

    // timeline
    let s = 0;
    const next = () => ++s;
    const PROJ = next(), SLICE = next(), REG = next(), ATT = next(), ZS = next(), CAT = next(), WO = next();
    const SUM = heads.map(next);                        // SUM[k]: head k adds Z_k · W_O^(k) to O
    const FINAL = s;

    // geometry
    const u = +(root.dataset.unit || 18), n = N * u, dh = 2 * u, d = H * dh, dk = KV * dh, g = 10, sg = 6;
    const XX = 80, YW = 160, YP = YW + d + g, YA = YP + n + 16;
    const ya = (r) => YA + r * (n + 16);                 // row of the r-th query head of a column
    const W = [d, dk, dk];                               // widths of W_Q, W_K, W_V
    const fx = (m, k) => 250 + (m > 0) * (d + g) + (m > 1) * (dk + g) + k * dh;  // slice k of W_m, side by side (one product)
    const CW = (R + 2) * dh + (R + 1) * sg;              // a column: R query slices, then K and V
    const hx = (j) => 250 + j * (CW + 36);               // column j, of key / value head j
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
    groups.forEach((j) => els.push(box('hd-panel', hx(j) - 12, YW - 12, CW + 24, ya(R - 1) + n - YW + 24,
      { vis: [from(REG)], hl: [one(REG)] }, h('span', 'hd-ht',
        { html: R === 1 ? `head ${j + 1}` : `heads ${Array.from({ length: R }, (_, r) => j * R + r + 1).join(', ')}` }))));
    // x, and a faint rail: the same x feeds every head
    els.push(box('hd-rail', XX + d + 8, YP + n / 2 - 1, hx(KV - 1) - 14 - (XX + d + 8), 2, { vis: [from(REG)] }),
      act(XX, YP, d, COL.x, 'x', { hl: [one(0), one(PROJ)] }),
      brace('left', YP, YP + n, XX, 'n'), brace('top', XX, XX + d, YP, 'd'));

    // the H + 2 KV slices: weight slice above its product slice, both move from fused to regrouped
    QKV.forEach(([nm, color], m) => (m ? groups : heads).forEach((k) => {
      const e = box('at-box hd-slice', fx(m, k), YW, dh, d + g + n,
        { vis: [from(PROJ)], hl: k === 0 ? [one(SLICE)] : [] },
        h('div', 'at-w hd-w', { style: `height:${d}px; --hd-c:${color}` },
          name(sup('W', nm, `(${k + 1})`), { cls: 'hd-sm', vis: [from(REG)] })),
        h('div', 'hd-act', { style: `top:${d + g}px; height:${n}px` }, ...rowsOf(dh, color),
          name(`${nm}<sub>${k + 1}</sub>`, { cls: 'hd-sm', vis: [from(REG)] })));
      els.push(e);
      moves.push([e, REG, sx(m, k) - fx(m, k), 0]);
    }));
    // names and braces of the side-by-side layout
    QKV.forEach(([nm], m) => {
      const vis = [[PROJ, REG]], w = W[m];
      els.push(box('at-box hd-name', fx(m, 0), YW, w, d + g + n, { vis, hl: [one(PROJ)] }),
        box('hd-name', fx(m, 0), YW, w, d, { vis }, name(`W<sub>${nm}</sub>`)),
        box('hd-name', fx(m, 0), YP, w, n, { vis }, name(nm)),
        brace('top', fx(m, 0), fx(m, 0) + w, YW, w === d ? 'd' : `${KV} ${DH}`, [one(PROJ)]));
    });
    els.push(brace('left', YW, YW + d, fx(0, 0), 'd', [[PROJ, REG]]),
      ...heads.map((k) => brace('top', fx(0, k), fx(0, k) + dh, YW, DH, [[SLICE, REG]])),
      brace('top', sx(0, 0), sx(0, 0) + dh, YW, DH, [from(REG)]),
      brace('left', YW, YW + d, sx(0, 0), 'd', [from(REG)]));

    // per head, on its row of its column: A_h under Q_h and K, Z_h under V
    heads.forEach((k) => {
      const P = pattern(k, N), cells = [], j0 = Math.floor(k / R), r = k % R;
      P.forEach((row, i) => P.forEach((_, j) => {
        const pos = `left:${j * u}px; top:${i * u}px; width:${u - 2}px; height:${u - 2}px;`;
        cells.push(j > i ? h('div', 'at-cell at-mask', { style: pos })
          : h('div', 'at-cell', { style: `${pos} background:rgba(143,197,250,${(0.15 + 0.85 * row[j]).toFixed(2)})` }));
      }));
      els.push(box('at-box', hx(j0) + ((R + 1) * dh + R * sg - n) / 2, ya(r), n - 2, n - 2, { vis: [from(ATT)], hl: [one(ATT)] },
        ...cells, name(`A<sub>${k + 1}</sub>`, { cls: 'hd-sm' })));
      const z = act(sx(2, j0), ya(r), dh, COL.z, `Z<sub>${k + 1}</sub>`,
        { vis: [from(ZS)], hl: [one(ZS), one(SUM[k])], nm: { cls: 'hd-sm' } });
      els.push(z);
      moves.push([z, CAT, ZX + k * dh - sx(2, j0), YA - ya(r)]);
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
