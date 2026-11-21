// Kimi Delta Attention, eq. 1 as matrices (Kimi Linear, §3), one token t, d_k = d_v = 4:
//   S_t = (I − β_t k_t k_tᵀ) Diag(α_t) S_{t−1} + β_t k_t v_tᵀ
// read left to right as written: I − β_t k_t k_tᵀ (the identity minus a rank-1 matrix), times
// Diag(α_t) gives A_t, then A_t S_{t−1}, then + B_t = β_t k_t v_tᵀ gives S_t. Every product
// A · B = C has A left of C and B above it (as attention.js).
//
// Builds the animation inside every <div class="viz" data-anim="kda-matrices">. Its <p> children are
// the captions, one per step: the equation, the erase matrix, × Diag(α_t), A_t S_{t−1}, the write.
// The equation is TeX (MathJax typesets it at startup); its terms carry \class{ke-t ke-<name>} and
// are dimmed per step through data-st on the root (decoding.css).
// Same numbers as themes/kda.js: tokens 1–3 give S_{t−1}, token 4 is t; S_t equals S_4 there.
// Uses viz-core.js (load it first); styles: decoding.css (.ke-*, .kv-tx, .at-*).
(() => {
  const { one, from } = window.AD;
  const COL = { k: '#7cc47a', v: '#d97fd0', a: '#4fd1c5', b: '#e9d66b', s: '#8fc5fa', neg: '#ff6b6b' };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const tc = (hex, s) => `{\\color{${hex}}{${s}}}`;
  const T = {
    a: tc(COL.a, '\\alpha_t'), b: tc(COL.b, '\\beta_t'), k: tc(COL.k, 'k_t'), kT: tc(COL.k, 'k_t^{\\top}'),
    v: tc(COL.v, 'v_t'), vT: tc(COL.v, 'v_t^{\\top}'),
  };
  const cl = (name, s) => `\\class{ke-t ke-${name}}{${s}}`;
  const ub = (s, lab) => `\\underbrace{${s}}_{${lab}}`;

  function kit() {
    const ctx = AD.context(), { h } = ctx;
    const pos = (x, y, w, hh) => `left:${x}px; top:${y}px;${w != null ? ` width:${w}px;` : ''}${hh != null ? ` height:${hh}px;` : ''}`;
    const box = (cls, x, y, w, hh, opt = {}, ...kids) => h('div', `at-b ${cls}`, { ...opt, style: pos(x, y, w, hh) + (opt.style || '') }, ...kids);
    const tex = (x, y, w, src, opt = {}) => box(`ke-tex ${opt.cls || ''}`, x, y, w, null, opt, h('span', '', { html: `\\(\\displaystyle ${src}\\)` }));
    const text = (x, y, w, html, opt = {}) => box(`kv-tx ${opt.cls || ''}`, x, y, w, 26, opt, h('span', '', { html }));
    return { ctx, h, box, tex, text };
  }

  function buildMatrices(root) {
    const { ctx, h, box, tex, text } = kit();
    const R4 = [0, 1, 2, 3];
    const norm = (x) => { const n = Math.hypot(...x); return x.map((c) => c / n); };
    // themes/kda.js, tokens 1–3 give S_{t−1}; token 4 is t
    const TOK = [
      { k: [0.2, 0.9, 0.3, 0.2], v: [0.9, 0.3, 0.7, 0.2], a: [0.9, 0.6, 0.9, 0.5], b: 0.9 },
      { k: [0.8, 0.2, 0.1, 0.5], v: [0.2, 0.8, 0.3, 0.9], a: [0.9, 0.7, 0.95, 0.6], b: 0.7 },
      { k: [0.3, 0.3, 0.9, 0.2], v: [0.6, 0.4, 0.9, 0.5], a: [0.95, 0.5, 0.9, 0.4], b: 0.6 },
      { k: [0.9, 0.15, 0.35, 0.1], v: [0.9, 0.95, 1.0, 0.7], a: [0.95, 0.35, 0.9, 0.15], b: 0.8 },
    ].map((t) => ({ ...t, k: norm(t.k) }));
    const mm = (A, B) => A.map((row) => R4.map((j) => R4.reduce((acc, l) => acc + row[l] * B[l][j], 0)));
    const outer = (x, y) => x.map((xi) => y.map((yj) => xi * yj));
    const plus = (A, B) => A.map((row, i) => row.map((a, j) => a + B[i][j]));
    const scale = (s, A) => A.map((row) => row.map((a) => s * a));
    const I = R4.map((i) => R4.map((j) => +(i === j)));
    const diag = (a) => R4.map((i) => R4.map((j) => (i === j ? a[i] : 0)));
    const E = (t) => plus(I, scale(-t.b, outer(t.k, t.k)));                 // I − β k kᵀ
    const step = (t, S) => plus(mm(E(t), mm(diag(t.a), S)), scale(t.b, outer(t.k, t.v)));
    let S = R4.map(() => R4.map(() => 0));
    TOK.slice(0, 3).forEach((t) => { S = step(t, S); });
    const t = TOK[3], Sp = S;
    const KK = scale(t.b, outer(t.k, t.k)), Et = E(t);                      // I − β k kᵀ
    const Dg = diag(t.a), At = mm(Et, Dg);                                  // A_t = (I − β k kᵀ) Diag(α)
    const AS = mm(At, Sp), B = scale(t.b, outer(t.k, t.v)), St = plus(AS, B);
    // the same S_t as the u form of themes/kda.js
    const S1 = mm(Dg, Sp);
    const u = R4.map((j) => t.b * (t.v[j] - R4.reduce((acc, i) => acc + t.k[i] * S1[i][j], 0)));
    console.assert(St.every((row, i) => row.every((s, j) => Math.abs(s - S1[i][j] - t.k[i] * u[j]) < 1e-9)), 'kda-matrices: ≠ u form');

    const EQ = 0, EMAT = 1, AMAT = 2, PROD = 3, WRITE = 4, FINAL = WRITE;

    const cs = 24, M = 4 * cs, g = 10;
    const MAX = Math.max(...[Sp, AS, B, St, KK].flat(2).map(Math.abs));
    const cell = (x, y, val, max, color) => h('div', 'at-cell', {
      style: `left:${x}px; top:${y}px; width:${cs - 2}px; height:${cs - 2}px; background:rgba(${rgb(val < 0 ? COL.neg : color)},${(0.12 + 0.8 * Math.min(1, Math.abs(val) / max)).toFixed(2)})` });
    const grid = (x, y, Mx, color, opt = {}) => box('at-box ke-grid', x, y, Mx[0].length * cs, Mx.length * cs, opt,
      ...Mx.flatMap((row, i) => row.map((val, j) => cell(j * cs, i * cs, val, opt.max || MAX, color))));
    const under = (x, w, y, src, opt) => tex(x - 40, y, w + 80, src, { ...opt, cls: 'ke-under' });
    const op = (x0, x1, y, s, vis) => text(x0, y + M / 2 - 13, x1 - x0, s, { vis });

    // one row, in the order of eq. 1: S_t = (I − β k kᵀ) · Diag(α) · S_{t−1} + B_t, products chained as
    // (I − β k kᵀ) · Diag(α) = A_t, A_t · S_{t−1}; then, after « where », I − β k kᵀ built from I and β k kᵀ.
    // Every product A · B = C has A left of C and B above it.
    const Y = 262, YU = Y - g - M, YL = Y + M + 4;
    // as the equation: S_t = E_t · Diag(α_t) · S_{t−1} + B_t, with E_t = I − β_t k_t k_tᵀ defined on the right
    const X = { S: 0 };
    X.E = X.S + M + 44; X.A = X.E + M + 50; X.P = X.A + M + 50; X.B = X.P + M + 44;
    X.w = X.B + M + 24; X.I = X.w + 62; X.k = X.I + M + 28; X.kk = X.k + cs + g; X.E2 = X.kk + M + 28;
    const els = [];
    const ob = (s, lab) => `\\overbrace{${s}}^{${lab}}`;
    els.push(tex(0, 0, 1136, `S_t = ${cl('A', ob(`${cl('erase', ub(`(I-${T.b}\\,${T.k}${T.kT})`, '\\text{erase at }k_t'))}\\,\\,${cl('forget', ub(`\\mathrm{Diag}(${T.a})`, '\\text{forget}'))}`, 'A_t'))}\\,\\,`
      + `${cl('s', 'S_{t-1}')} + ${cl('B', ob(cl('write', ub(`${T.b}\\,${T.k}${T.vT}`, '\\text{write at }k_t')), 'B_t'))}`, { cls: 'ke-eq' }));

    // I − β k kᵀ, from I and the rank-1 β k kᵀ (k left, kᵀ above)
    els.push(grid(X.I, Y, I, COL.s, { vis: [from(EMAT)], max: 1 }),
      under(X.I, M, YL, 'I', { vis: [from(EMAT)] }),
      op(X.I + M, X.k, Y, '−', [from(EMAT)]),
      grid(X.k, Y, t.k.map((x) => [x]), COL.k, { vis: [from(EMAT)], max: 1 }),
      grid(X.kk, Y - g - cs, [t.k], COL.k, { vis: [from(EMAT)], max: 1 }),
      grid(X.kk, Y, KK, COL.k, { vis: [from(EMAT)] }),
      under(X.k, X.kk + M - X.k, YL, `${T.b}\\,${T.k}${T.kT}`, { vis: [from(EMAT)] }),
      op(X.kk + M, X.E2, Y, '=', [from(EMAT)]),
      grid(X.E2, Y, Et, COL.k, { vis: [from(EMAT)], hl: [one(EMAT)], max: 1 }),
      under(X.E2, M, YL, `I-${T.b}\\,${T.k}${T.kT}`, { vis: [from(EMAT)] }),
      text(X.w, Y + M / 2 - 13, X.I - X.w, 'where', { vis: [from(EMAT)], cls: 'kv-dim' }),
      // the same matrix, in its place in the product
      grid(X.E, Y, Et, COL.k, { vis: [from(EMAT)], hl: [one(EMAT), one(AMAT)], max: 1 }),
      under(X.E, M, YL, `I-${T.b}\\,${T.k}${T.kT}`, { vis: [from(EMAT)] }));
    // A_t = (I − β k kᵀ) · Diag(α_t): column j times α_{t,j}
    els.push(grid(X.A, YU, Dg, COL.a, { vis: [from(AMAT)], hl: [one(AMAT)], max: 1 }),
      tex(X.A - 210, YU + M / 2 - 14, 200, `\\mathrm{Diag}(${T.a})`, { vis: [from(AMAT)], cls: 'ke-under ke-right' }),
      grid(X.A, Y, At, COL.a, { vis: [from(AMAT)], hl: [one(AMAT), one(PROD)], max: 1 }),
      under(X.A, M, YL, 'A_t', { vis: [from(AMAT)] }));
    // A_t · S_{t−1}
    els.push(grid(X.P, YU, Sp, COL.s, { vis: [from(PROD)], hl: [one(PROD)] }),
      tex(X.P + M + 10, YU + M / 2 - 14, 200, 'S_{t-1}', { vis: [from(PROD)], cls: 'ke-under ke-left' }),
      grid(X.P, Y, AS, COL.s, { vis: [from(PROD)], hl: [one(PROD)] }),
      under(X.P, M, YL, 'A_t S_{t-1}', { vis: [from(PROD)] }));
    // + β k vᵀ = S_t
    els.push(op(X.P + M, X.B, Y, '+', [from(WRITE)]),
      grid(X.B, Y, B, COL.v, { vis: [from(WRITE)], hl: [one(WRITE)] }),
      under(X.B, M, YL, `B_t = ${T.b}\\,${T.k}${T.vT}`, { vis: [from(WRITE)] }),
      grid(X.S, Y, St, COL.s, { vis: [from(WRITE)], hl: [one(WRITE)] }),
      under(X.S, M, YL, 'S_t', { vis: [from(WRITE)] }),
      op(X.S + M, X.E, Y, '=', [from(WRITE)]));

    AD.mount(root, ctx, FINAL, els, (st) => { root.dataset.st = Math.min(st, FINAL); });
  }

  AD.run('kda-matrices', buildMatrices);
})();
