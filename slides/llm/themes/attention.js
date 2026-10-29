// One self-attention head, drawn with the matrix-multiplication convention: every product
// A · B = C has A to the left of C and B above it, so shared dimensions line up.
// The last row (the last token) goes first: its scores one by one, shown again in a small
// table under the title, its softmax, its row of Z; then the other rows all at once.
//
// Builds the animation inside every <div class="viz" data-anim="attention"> from:
//   data-tokens  the rows, "Paris ␣is …" (␣ = leading space; ":id" suffixes are ignored)
//   data-scores  the scores of the last row against every row, "2.10 0.60 …"
//   data-unit    pixels per unit: n = N, d = 5 and d_h = 3 units (26)
// Its <p> children are the captions, one per step, in order.
// Positions are slide coordinates (the root sits at 72, 150): the drawing starts in the
// title band, to the right of the title.
// Uses viz-core.js (load it first) and braces.js (load it after).
(() => {
  const { one, from, parseTokens, rand } = window.AD;
  const NS = 'http://www.w3.org/2000/svg';
  const OX = 72, OY = 150;                              // the root's position on the slide
  const COL = { x: '#4aa8ff', q: '#ff9f43', k: '#7cc47a', v: '#d97fd0', z: '#a46cf5', o: '#6d86ff' };
  const softmax = (v) => {
    const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), sum = e.reduce((a, b) => a + b);
    return e.map((x) => x / sum);
  };
  let roots = 0;

  function build(root) {
    const toks = parseTokens(root.dataset.tokens).map((t) => t.tok), N = toks.length, L = N - 1;
    const last = (i) => i === L;
    // scores: the last row from data-scores, earlier rows made up; then their softmax
    const given = (root.dataset.scores || '').trim().split(/\s+/).map(Number);
    const SC = toks.map((_, i) => (last(i) ? given : Array.from({ length: i + 1 }, (_, j) => 0.3 + 1.6 * rand(i, j))));
    const WT = SC.map(softmax), SMAX = Math.max(...SC.flat());

    // timeline
    let s = 0;
    const next = () => ++s;
    const Q = next(), K = next(), KT = next();
    const CELL = toks.map(next);                        // CELL[j]: last row of Q · column j of Kᵀ
    const SM = next(), V = next(), Z = next(), REST = next(), O = next();
    const FINAL = s;

    // geometry
    const u = +(root.dataset.unit || 26), n = N * u, d = 5 * u, dh = 3 * u, g = 10, SG = 130;
    const X0 = 380, X1 = X0 + d + g, X2 = X1 + dh + g, X3 = X2 + n + SG, X4 = X3 + n + g, X5 = X4 + dh + g;
    const XV = X3 + n - d;                              // x copy left of V, right-aligned with A
    const YWK = 62, YK = YWK + d + g, YWQ = YK + n + g, YQ = YWQ + d + g;
    const YKT = YQ - g - dh, YV = YQ - g - n, YWV = YV - g - d, YWO = YQ - g - dh;

    const ctx = AD.context();
    const { h } = ctx;
    const at = (x, y, w, hh) => `left:${x - OX}px; top:${y - OY}px; width:${w}px; height:${hh}px;`;
    const box = (cls, x, y, w, hh, opt = {}, ...kids) => h('div', `at-b ${cls}`, { ...opt, style: at(x, y, w, hh) + (opt.style || '') }, ...kids);
    const name = (html) => h('span', 'at-nm', { html });

    // n × w activations, one row per token; a ghost is a copy of x, faded and dashed
    const act = (x, y, w, color, label, o = {}) => box(`at-box${o.ghost ? ' at-ghost' : ''}`, x, y, w, n, o,
      ...toks.map((_, i) => h('div', 'at-row', { vis: o.rowVis && o.rowVis(i), hl: o.rowHl && o.rowHl(i),
        style: `top:${i * u}px; height:${u - 2}px; background-color:${color}; background-position-x:${(i * 36) % 84}px` })),
      name(label));
    const weight = (x, y, w, hh, label, o) => box('at-w', x, y, w, hh, o, name(label));
    const keysT = (x, y, o) => box('at-box at-kt', x, y, n - 2, dh, o,
      ...toks.map((_, j) => h('div', 'at-col', { hl: o.colHl(j), style: `left:${j * u}px; width:${u - 2}px` })),
      name('K<sup>T</sup>'));
    // causal n × n: empty cells keep the shape; each value cell and the masked half have their own steps
    const tri = (x, y, kind, label, o) => {
      const cells = [];
      toks.forEach((_, i) => toks.forEach((_, j) => {
        const pos = `left:${j * u}px; top:${i * u}px; width:${u - 2}px; height:${u - 2}px;`;
        cells.push(h('div', 'at-cell at-empty', { style: pos }));
        if (j > i) { cells.push(h('div', 'at-cell at-mask', { vis: o.maskVis, style: pos })); return; }
        const a = kind === 'score' ? 0.15 + 0.75 * SC[i][j] / SMAX : 0.15 + 0.85 * WT[i][j];
        const rgb = kind === 'score' ? '142,149,162' : '143,197,250';
        cells.push(h('div', 'at-cell', { vis: o.cellVis(i, j), hl: o.cellHl(i, j), style: `${pos} background:rgba(${rgb},${a.toFixed(2)})` }));
      }));
      return box('at-box at-tri', x, y, n - 2, n - 2, { vis: o.vis }, ...cells, name(label));
    };
    const op = (cx, cy, rx, ry, label, o) => box('at-op', cx - rx, cy - ry, 2 * rx, 2 * ry, { ...o, html: label });
    // a curly brace (drawn by braces.js) on one side of the span a..b of the edge at coordinate e
    const brace = (side, a, b, e, label, vis) => {
      const W = 14, G = 3;
      const r = { left: [e - G - W, a, W, b - a], right: [e + G, a, W, b - a],
        top: [a, e - G - W, b - a, W], bottom: [a, e + G, b - a, W] }[side];
      return box('at-br', ...r, { vis, html: `<svg class="viz-brace" data-side="${side}"><path/></svg>` },
        h('span', `at-bl at-bl-${side}`, { html: label }));
    };
    const DH = 'd<sub>h</sub>';

    // wires: one SVG in slide coordinates, behind the matrices
    const id = `at-ar-${roots++}`;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'at-wires');
    svg.setAttribute('viewBox', '0 0 1280 720');
    svg.innerHTML = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"`
      + ` orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>`;
    const wire = (pts, vis, hl = [], dashed = false) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + pts.map((q) => q.join(',')).join(' L'));
      p.setAttribute('marker-end', `url(#${id})`);
      p.setAttribute('class', `viz-v at-wire${dashed ? ' at-dash' : ''}`);
      svg.append(p);
      ctx.items.push({ e: p, vis, hl, dim: [], anim: [] });
    };

    const els = [];
    // Q = x · W_Q
    els.push(act(X0, YQ, d, COL.x, 'x', { hl: [one(Q)] }),
      brace('left', YQ, YQ + n, X0, 'n'), brace('bottom', X0, X0 + d, YQ + n, 'd'),
      weight(X1, YWQ, dh, d, 'W<sub>Q</sub>', { vis: [from(Q)], hl: [one(Q)] }),
      brace('left', YWQ, YWQ + d, X1, 'd', [from(Q)]),
      act(X1, YQ, dh, COL.q, 'Q', { vis: [from(Q)], hl: [one(Q), one(REST)],
        rowHl: (i) => (last(i) ? [[CELL[0], CELL[L] + 1]] : []) }),
      brace('bottom', X1, X1 + dh, YQ + n, DH, [from(Q)]));
    // K = x · W_K, from a ghost copy of x
    wire([[X0 + d / 2, YQ], [X0 + d / 2, YK + n + 4]], [from(K)], [], true);
    els.push(act(X0, YK, d, COL.x, 'x', { ghost: true, vis: [from(K)], hl: [one(K)] }),
      brace('left', YK, YK + n, X0, 'n', [from(K)]),
      weight(X1, YWK, dh, d, 'W<sub>K</sub>', { vis: [from(K)], hl: [one(K)] }),
      brace('left', YWK, YWK + d, X1, 'd', [from(K)]),
      act(X1, YK, dh, COL.k, 'K', { vis: [from(K)], hl: [one(K), one(KT)] }));
    // Kᵀ, then Q · Kᵀ for the last row, one cell per step
    const tc = [X2 + n / 2, YK + n / 2];
    wire([[X1 + dh, tc[1]], [tc[0] - 19, tc[1]]], [from(KT)], [one(KT)]);
    wire([[tc[0], tc[1] + 17], [tc[0], YKT - 2]], [from(KT)], [one(KT)]);
    els.push(op(tc[0], tc[1], 17, 17, 'T', { vis: [from(KT)], hl: [one(KT)] }),
      keysT(X2, YKT, { vis: [from(KT)], hl: [one(KT), one(REST)], colHl: (j) => [one(CELL[j])] }),
      brace('right', YKT, YKT + dh, X2 + n, DH, [from(KT)]),
      tri(X2, YQ, 'score', 'Q·K<sup>T</sup>', { vis: [from(CELL[0])], maskVis: [from(REST)],
        cellVis: (i, j) => [from(last(i) ? CELL[j] : REST)],
        cellHl: (i, j) => (last(i) ? [one(CELL[j]), one(SM)] : [one(REST)]) }),
      brace('bottom', X2, X2 + n, YQ + n, 'n', [from(CELL[0])]));
    // softmax: a new matrix A
    const sx = X2 + n + SG / 2, sy = YQ + n / 2;
    wire([[X2 + n + 2, sy], [sx - 44, sy]], [from(SM)], [one(SM), one(REST)]);
    wire([[sx + 42, sy], [X3 - 2, sy]], [from(SM)], [one(SM), one(REST)]);
    els.push(op(sx, sy, 42, 22, 'softmax', { vis: [from(SM)], hl: [one(SM), one(REST)] }),
      tri(X3, YQ, 'weight', 'A', { vis: [from(SM)], maskVis: [from(REST)],
        cellVis: (i) => [from(last(i) ? SM : REST)], cellHl: (i) => (last(i) ? [one(SM), one(Z)] : [one(REST)]) }),
      brace('bottom', X3, X3 + n, YQ + n, 'n', [from(SM)]));
    // V = x · W_V, from a second ghost copy of x
    wire([[X0 + d / 2, YK], [X0 + d / 2, YWK - 16], [XV + d / 2, YWK - 16], [XV + d / 2, YV - 5]], [from(V)], [], true);
    els.push(act(XV, YV, d, COL.x, 'x', { ghost: true, vis: [from(V)], hl: [one(V)] }),
      brace('left', YV, YV + n, XV, 'n', [from(V)]),
      weight(X4, YWV, dh, d, 'W<sub>V</sub>', { vis: [from(V)], hl: [one(V)] }),
      brace('left', YWV, YWV + d, X4, 'd', [from(V)]),
      act(X4, YV, dh, COL.v, 'V', { vis: [from(V)], hl: [one(V), one(Z), one(REST)] }));
    // Z = A · V (last row first), O = Z · W_O
    els.push(act(X4, YQ, dh, COL.z, 'Z', { vis: [from(Z)], hl: [one(O)],
        rowVis: (i) => [from(last(i) ? Z : REST)], rowHl: (i) => [one(last(i) ? Z : REST)] }),
      brace('bottom', X4, X4 + dh, YQ + n, DH, [from(Z)]),
      weight(X5, YWO, d, dh, 'W<sub>O</sub>', { vis: [from(O)], hl: [one(O)] }),
      brace('top', X5, X5 + d, YWO, 'd', [from(O)]), brace('right', YWO, YWO + dh, X5 + d, DH, [from(O)]),
      act(X5, YQ, d, COL.o, 'O', { vis: [from(O)], hl: [one(O)] }),
      brace('bottom', X5, X5 + d, YQ + n, 'd', [from(O)]), brace('right', YQ, YQ + n, X5 + d, 'n', [from(O)]));

    // the last row's scores and softmax, under the title; gone once V comes in
    const tv = (st) => [[st, V]];
    const BW = 180;                                     // bar length of a 100 % weight
    const tab = [
      box('at-t at-tt', 72, 150, 300, 26, { vis: tv(CELL[0]), html: `row ${N} · « ${toks[L].trim()} »` }),
      box('at-t at-th', 124, 180, 80, 22, { vis: tv(CELL[0]), html: `q<sub>${N}</sub>·k<sub>j</sub>` }),
      box('at-t at-th at-left', 212, 180, 100, 22, { vis: tv(SM), html: 'softmax' }),
    ];
    toks.forEach((t, j) => {
      const y = 208 + j * 34, p = WT[L][j];
      tab.push(box('at-t at-tok', 0, y, 116, 26, { vis: tv(CELL[j]), html: t.replace(/ /g, '␣') }),
        box('at-t at-sc', 124, y, 80, 26, { vis: tv(CELL[j]), hl: [one(CELL[j]), one(SM)], html: SC[L][j].toFixed(2) }),
        box('at-bar', 212, y, Math.max(2, p * BW), 26, { vis: tv(SM), hl: [one(SM)] }),
        box('at-t at-pct', 218 + p * BW, y, 50, 26, { vis: tv(SM), html: `${Math.round(p * 100)}%` }));
    });

    AD.mount(root, ctx, FINAL, [svg, ...els, ...tab]);
  }

  AD.run('attention', build);
})();
