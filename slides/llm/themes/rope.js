// RoPE on one matrix Q (n × d_h), two formulations of the same result Q′.
//   data-anim="rope-matmul": the textbook one, q′_i = q_i · R_i, R_i a d_h × d_h block-diagonal
//     rotation, a different matrix for every row (A · B = C convention: q_i left, R_i above);
//   data-anim="rope-ew": the one implementations run, Q′ = Q ⊙ cos + rot(Q) ⊙ sin, elementwise,
//     with n × d_h cos / sin tables and rot (a, b) → (−b, a) inside each pair.
// Pairs are adjacent columns (a_k, b_k) in both, so R_i is visibly block-diagonal.
// Its <p> children are the captions, one per step. Uses viz-core.js.
(() => {
  const { one, from, rand } = window.AD;
  const OX = 72, OY = 150;
  const N = 4, DH = 6, P = DH / 2, SPEED = [40, 15, 5];   // degrees per position, pair k
  const TOK = ['Paris', '␣is', '␣the', '␣capital'];
  const ORANGE = [255, 159, 67];
  const ang = (i, k) => (i + 1) * SPEED[k] * Math.PI / 180;           // row i is position i + 1
  const Q = Array.from({ length: N }, (_, i) => Array.from({ length: DH }, (_, c) => 2 * rand(i + 31, c + 5) - 1));
  const rotRow = (i) => Q[i].map((_, c) => {                          // q_i · R_i, pair by pair
    const k = c >> 1, a = Q[i][2 * k], b = Q[i][2 * k + 1], co = Math.cos(ang(i, k)), si = Math.sin(ang(i, k));
    return c % 2 ? a * si + b * co : a * co - b * si;
  });
  const QR = Q.map((_, i) => rotRow(i));
  const act = (v) => `rgba(${ORANGE},${(0.15 + 0.85 * Math.abs(v)).toFixed(2)})`;
  const div = (v) => (v >= 0 ? `rgba(143,197,250,${(0.1 + 0.9 * v).toFixed(2)})` : `rgba(255,122,122,${(0.1 - 0.9 * v).toFixed(2)})`);
  const sub = (s, k) => `${s}<sub>${k}</sub>`;
  const HQ = Array.from({ length: DH }, (_, c) => sub(c % 2 ? 'b' : 'a', (c >> 1) + 1));

  function kit(ctx) {
    const { h } = ctx;
    const at = (x, y, w, hh) => `left:${x - OX}px; top:${y - OY}px; width:${w}px; height:${hh}px;`;
    const box = (cls, x, y, w, hh, opt = {}, ...kids) => h('div', `at-b ${cls}`, { ...opt, style: at(x, y, w, hh) + (opt.style || '') }, ...kids);
    // rows × cols cells of size c; cell(i, j) → { bg, html, cls, vis, hl, style }
    const grid = (x, y, rows, cols, c, cell, opt = {}) => box('at-box rm-grid', x, y, cols * c, rows * c, opt,
      ...Array.from({ length: rows * cols }, (_, t) => {
        const i = Math.floor(t / cols), j = t % cols, e = cell(i, j) || {};
        return h('div', `rm-c ${e.cls || ''}`, { vis: e.vis, hl: e.hl, html: e.html || '',
          style: `left:${j * c}px; top:${i * c}px; width:${c - 2}px; height:${c - 2}px; background:${e.bg || 'none'};${e.style || ''}` });
      }));
    const text = (cls, x, y, w, hh, html, opt = {}) => box(`at-t ${cls}`, x, y, w, hh, { ...opt, html });
    const heads = (x, y, c, labels, opt = {}) => labels.map((t, j) => text('rm-hd', x + j * c - 6, y - 22, c + 12, 20, t, opt));
    return { h, box, grid, text, heads };
  }

  // ---------------------------------------------------------------- the textbook matmul
  function matmul(root) {
    const ctx = AD.context(), { box, grid, text, heads } = kit(ctx);
    let s = 0;
    const ROW = TOK.map(() => ++s), ZERO = ++s, FINAL = s;
    const C = 30, XQ = 190, YQ = 440, XR = XQ + DH * C + 20, YR = YQ - 20 - DH * C, TC = 18, XT = 690, YT = 300;
    const els = [];

    // Q, and its tokens
    els.push(grid(XQ, YQ, N, DH, C, (i, j) => ({ bg: act(Q[i][j]), hl: [one(ROW[i])] })),
      ...heads(XQ, YQ, C, HQ), text('rm-lab', XQ, YQ + N * C + 4, DH * C, 24, 'Q'),
      ...TOK.map((t, i) => text('rm-tok', XQ - 150, YQ + i * C, 140, C, `${t} · ${i + 1}`)));
    // R_i above Q′, one per row step; the last one stays
    const rcell = (i) => (r, c) => {
      const k = r >> 1;
      if (k !== c >> 1) return { cls: 'rm-zero', html: '0', hl: [one(ZERO)] };
      const co = Math.cos(ang(i, k)), si = Math.sin(ang(i, k));
      const [v, l] = [[co, 'c'], [si, 's'], [-si, '−s'], [co, 'c']][2 * (r % 2) + (c % 2)];
      return { bg: div(v), html: sub(l, k + 1) };
    };
    TOK.forEach((_, i) => {
      const vis = i === N - 1 ? [from(ROW[i])] : [one(ROW[i])];
      els.push(grid(XR, YR, DH, DH, C, rcell(i), { vis, hl: [one(ROW[i])] }),
        text('rm-big', XR - 150, YR + DH * C / 2 - 20, 136, 40, `R<sub>${i + 1}</sub>`, { vis }),
        text('rm-note', XR - 150, YR + DH * C / 2 + 18, 136, 22, `angles ${i + 1} · θ<sub>k</sub>`, { vis }));
    });
    els.push(...heads(XR, YR, C, HQ.map((t) => `${t}′`), { vis: [from(ROW[0])] }));
    // Q′ fills row by row
    els.push(grid(XR, YQ, N, DH, C, (i, j) => ({ bg: act(QR[i][j]), vis: [from(ROW[i])], hl: [one(ROW[i])] }), { vis: [from(ROW[0])] }),
      text('rm-lab', XR, YQ + N * C + 4, DH * C, 24, 'Q′', { vis: [from(ROW[0])] }));
    // every R_i so far, small, on the right
    TOK.forEach((_, i) => els.push(
      grid(XT + i * (DH * TC + 22), YT, DH, DH, TC, (r, c) => {
        const e = rcell(i)(r, c);
        return { ...e, html: '' };
      }, { vis: [from(ROW[i])] }),
      text('rm-lab', XT + i * (DH * TC + 22), YT + DH * TC + 4, DH * TC, 24, `R<sub>${i + 1}</sub>`, { vis: [from(ROW[i])] })));
    els.push(text('rm-note rm-left', XT, YT - 34, 520, 24, 'one matrix per position', { vis: [from(ROW[1])] }),
      text('rm-cost', XT, YT + DH * TC + 44, 520, 60,
        `per row: d<sub>h</sub><sup>2</sup> = ${DH * DH} multiply-adds, ${DH * DH - 2 * DH} by 0<br>Qwen3, d<sub>h</sub> = 128: 16 384, 256 useful`,
        { vis: [from(ZERO)], hl: [one(ZERO)] }));
    AD.mount(root, ctx, FINAL, els);
  }

  // ---------------------------------------------------------------- the elementwise form
  function elementwise(root) {
    const ctx = AD.context(), { box, grid, text, heads } = kit(ctx);
    let s = 0;
    const COS = ++s, MUL1 = ++s, ROT = ++s, SIN = ++s, ADD = ++s, ONE = ++s, COST = ++s, FINAL = s;
    const C = 30, W = DH * C, Y = 300, GAP = 44;
    const X = [100, 100 + W + GAP, 100 + 2 * (W + GAP), 100 + 3 * (W + GAP), 100 + 4 * (W + GAP)];  // Q, cos, rot, sin, Q′
    const pick = (i, j) => i === N - 1 && j < 2;                         // row 4, pair 1
    const pickHl = (i, j) => (pick(i, j) ? [one(ONE)] : []);
    const TH = Array.from({ length: DH }, (_, c) => sub('θ', (c >> 1) + 1));
    const els = [];
    const op = (x, t, vis, hl) => text('rm-op', x, Y, GAP, N * C, t, { vis, hl });

    els.push(grid(X[0], Y, N, DH, C, (i, j) => ({ bg: act(Q[i][j]), hl: pickHl(i, j) }), { hl: [one(MUL1), one(ROT)] }),
      ...heads(X[0], Y, C, HQ), text('rm-lab', X[0], Y + N * C + 4, W, 24, 'Q'),
      ...TOK.map((_, i) => text('rm-pos', X[0] - 28, Y + i * C, 22, C, `${i + 1}`)), text('rm-pos', X[0] - 28, Y - 22, 22, 20, 'i'));
    // cos table
    els.push(op(X[0] + W, '⊙', [from(MUL1)], [one(MUL1)]),
      grid(X[1], Y, N, DH, C, (i, j) => ({ bg: div(Math.cos(ang(i, j >> 1))), hl: pickHl(i, j) }), { vis: [from(COS)], hl: [one(COS), one(MUL1)] }),
      ...heads(X[1], Y, C, TH, { vis: [from(COS)] }), text('rm-lab', X[1], Y + N * C + 4, W, 24, 'cos', { vis: [from(COS)] }));
    // rot(Q): the cells appear in place, then swap inside each pair; the first of each pair negated
    const moving = [];
    const rot = grid(X[2], Y, N, DH, C, (i, j) => ({ bg: act(Q[i][j]), cls: j % 2 ? 'rm-mv rm-neg' : 'rm-mv', hl: pickHl(i, j ^ 1) }),
      { vis: [from(ROT)], hl: [one(ROT)] });
    rot.querySelectorAll('.rm-mv').forEach((e, t) => moving.push([e, (t % DH) % 2 ? -C : C]));
    els.push(op(X[1] + W, '+', [from(ROT)]), rot,
      ...heads(X[2], Y, C, Array.from({ length: DH }, (_, c) => (c % 2 ? sub('a', (c >> 1) + 1) : `−${sub('b', (c >> 1) + 1)}`)), { vis: [from(ROT)] }),
      text('rm-lab', X[2], Y + N * C + 4, W, 24, 'rot(Q)', { vis: [from(ROT)] }));
    // sin table
    els.push(op(X[2] + W, '⊙', [from(SIN)], [one(SIN)]),
      grid(X[3], Y, N, DH, C, (i, j) => ({ bg: div(Math.sin(ang(i, j >> 1))), hl: pickHl(i, j) }), { vis: [from(SIN)], hl: [one(SIN)] }),
      ...heads(X[3], Y, C, TH, { vis: [from(SIN)] }), text('rm-lab', X[3], Y + N * C + 4, W, 24, 'sin', { vis: [from(SIN)] }));
    // Q′
    els.push(op(X[3] + W, '=', [from(ADD)], [one(ADD)]),
      grid(X[4], Y, N, DH, C, (i, j) => ({ bg: act(QR[i][j]), hl: pickHl(i, j) }), { vis: [from(ADD)], hl: [one(ADD)] }),
      ...heads(X[4], Y, C, HQ.map((t) => `${t}′`), { vis: [from(ADD)] }), text('rm-lab', X[4], Y + N * C + 4, W, 24, 'Q′', { vis: [from(ADD)] }));
    // the cost, under the matrices
    els.push(text('rm-cost', X[0], Y + N * C + 50, 1000, 60,
      `per number: 2 multiplies, 1 add · per row: 3 d<sub>h</sub> = ${3 * DH} (matmul: ${DH * DH})<br>Qwen3, d<sub>h</sub> = 128: 384 per row instead of 16 384; cos, sin shared by every head and layer`,
      { vis: [from(COST)], hl: [one(COST)] }));

    AD.mount(root, ctx, FINAL, els, (st) => moving.forEach(([e, dx]) => { e.style.translate = st >= ROT ? `${dx}px 0` : '0 0'; }));
  }

  AD.run('rope-matmul', matmul);
  AD.run('rope-ew', elementwise);
})();
