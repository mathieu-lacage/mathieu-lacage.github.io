// Linear attention's state update, one token t, d_k = d_v = 4, in the style of
// « KDA: State Update » (themes/kda-matrices.js):
//   S_t = S_{t−1} + k_t v_tᵀ
// the write k_t v_tᵀ (k_t left of it, v_tᵀ above: every product A · B = C has A left of C and
// B above it), then S_{t−1} + k_t v_tᵀ = S_t.
// Builds the animation inside every <div class="viz" data-anim="lin-matrices">. Its <p> children are
// the captions, one per step: the equation, the write, the sum. The equation's terms carry
// \class{ke-t ke-<name>} and are dimmed per step through data-st on the root.
// Same numbers as themes/linear.js: tokens 1–3 give S_{t−1}, token 4 is t.
// Uses viz-core.js (load it first); styles: decoding.css (.ke-*, .kv-tx, .at-*).
(() => {
  const { one, from } = window.AD;
  const COL = { k: '#7cc47a', v: '#d97fd0', s: '#8fc5fa', neg: '#ff6b6b' };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const tc = (hex, s) => `{\\color{${hex}}{${s}}}`;
  const k = tc(COL.k, 'k_t'), vT = tc(COL.v, 'v_t^{\\top}');
  const cl = (name, s) => `\\class{ke-t ke-${name}}{${s}}`;

  function build(root) {
    const ctx = AD.context(), { h } = ctx;
    const pos = (x, y, w, hh) => `left:${x}px; top:${y}px;${w != null ? ` width:${w}px;` : ''}${hh != null ? ` height:${hh}px;` : ''}`;
    const box = (cls, x, y, w, hh, opt = {}, ...kids) => h('div', `at-b ${cls}`, { ...opt, style: pos(x, y, w, hh) + (opt.style || '') }, ...kids);
    const tex = (x, y, w, src, opt = {}) => box(`ke-tex ${opt.cls || ''}`, x, y, w, null, opt, h('span', '', { html: `\\(\\displaystyle ${src}\\)` }));
    const text = (x, y, w, html, opt = {}) => box('kv-tx', x, y, w, 26, opt, h('span', '', { html }));

    // themes/kda.js's tokens, linear recurrence: tokens 1–3 give S_{t−1}, token 4 is t
    const R4 = [0, 1, 2, 3];
    const norm = (x) => { const n = Math.hypot(...x); return x.map((c) => c / n); };
    const TOK = [
      { k: [0.2, 0.9, 0.3, 0.2], v: [0.9, 0.3, 0.7, 0.2] },
      { k: [0.8, 0.2, 0.1, 0.5], v: [0.2, 0.8, 0.3, 0.9] },
      { k: [0.3, 0.3, 0.9, 0.2], v: [0.6, 0.4, 0.9, 0.5] },
      { k: [0.9, 0.15, 0.35, 0.1], v: [0.9, 0.95, 1.0, 0.7] },
    ].map((t) => ({ ...t, k: norm(t.k) }));
    const outer = (x, y) => x.map((xi) => y.map((yj) => xi * yj));
    const plus = (A, B) => A.map((row, i) => row.map((a, j) => a + B[i][j]));
    const Sp = TOK.slice(0, 3).reduce((S, t) => plus(S, outer(t.k, t.v)), R4.map(() => R4.map(() => 0)));
    const t = TOK[3], W = outer(t.k, t.v), St = plus(Sp, W);

    const EQ = 0, WRITE = 1, SUM = 2, FINAL = SUM;
    const cs = 24, M = 4 * cs, g = 10;
    const MAX = Math.max(...[Sp, W, St].flat(2).map(Math.abs));
    const cell = (x, y, val, max, color) => h('div', 'at-cell', {
      style: `left:${x}px; top:${y}px; width:${cs - 2}px; height:${cs - 2}px; background:rgba(${rgb(val < 0 ? COL.neg : color)},${(0.12 + 0.8 * Math.min(1, Math.abs(val) / max)).toFixed(2)})` });
    const grid = (x, y, Mx, color, opt = {}) => box('at-box ke-grid', x, y, Mx[0].length * cs, Mx.length * cs, opt,
      ...Mx.flatMap((row, i) => row.map((val, j) => cell(j * cs, i * cs, val, opt.max || MAX, color))));
    const under = (x, w, y, src, opt) => tex(x - 40, y, w + 80, src, { ...opt, cls: 'ke-under' });
    const op = (x0, x1, y, s, vis) => text(x0, y + M / 2 - 13, x1 - x0, s, { vis });

    // one row, as the equation: S_t = S_{t−1} + k_t v_tᵀ, the write built as k_t (left) times v_tᵀ (above)
    const Y = 190, YU = Y - g - cs, YL = Y + M + 4;
    const X = { S: 300 };
    X.P = X.S + M + 60; X.k = X.P + M + 60; X.W = X.k + cs + g;
    const els = [];
    els.push(tex(0, 0, 1136, `S_t = ${cl('s', 'S_{t-1}')} + ${cl('write', `\\underbrace{${k}${vT}}_{\\text{write at }k_t}`)}`, { cls: 'ke-eq' }));
    // the write: k_t v_tᵀ, row i is v_tᵀ scaled by k_{t,i}
    els.push(grid(X.k, Y, t.k.map((x) => [x]), COL.k, { vis: [from(WRITE)], hl: [one(WRITE)], max: 1 }),
      under(X.k, cs, YL, k, { vis: [from(WRITE)] }),
      grid(X.W, YU, [t.v], COL.v, { vis: [from(WRITE)], hl: [one(WRITE)], max: 1 }),
      tex(X.W + M + 10, YU - 4, 120, vT, { vis: [from(WRITE)], cls: 'ke-under ke-left' }),
      grid(X.W, Y, W, COL.v, { vis: [from(WRITE)], hl: [one(WRITE), one(SUM)] }),
      under(X.W, M, YL, `${k}${vT}`, { vis: [from(WRITE)] }));
    // S_t = S_{t−1} + k_t v_tᵀ
    els.push(grid(X.S, Y, St, COL.s, { vis: [from(SUM)], hl: [one(SUM)] }),
      under(X.S, M, YL, 'S_t', { vis: [from(SUM)] }),
      op(X.S + M, X.P, Y, '=', [from(SUM)]),
      grid(X.P, Y, Sp, COL.s, { vis: [from(SUM)], hl: [one(SUM)] }),
      under(X.P, M, YL, 'S_{t-1}', { vis: [from(SUM)] }),
      op(X.P + M, X.k, Y, '+', [from(SUM)]));

    AD.mount(root, ctx, FINAL, els, (st) => { root.dataset.st = Math.min(st, FINAL); });
  }

  AD.run('lin-matrices', build);
})();
