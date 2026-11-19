// Kimi Delta Attention (KDA), one head, prefill token by token. Same convention as attention.js
// and heads.js: every product A · B = C has A to the left of C and B above it.
//   1. x · [W_Q | W_K | W_V | W_α | W_β] = [Q | K | V | α | β]: the usual Q, K, V, plus a decay
//      α_t ∈ (0, 1) per key channel and a write strength β_t per token;
//   2. a state S, d_k × d_v, starts empty (S₀ = 0);
//   3. each token t, in order: the update written out, Diag(α_t) S_{t−1} + k_t u_tᵀ = S_t, with
//      u_t = β_t (v_t − k_tᵀ Diag(α_t) S_{t−1}) (β_t and v_t drawn above u_t); then its query,
//      z_t = q_tᵀ S_t, row t of Z;
//   4. a strip at the bottom left keeps S₀ → S₁ → … as they are built; decode keeps only the last.
//
// Builds the animation inside every <div class="viz" data-anim="kda"> from:
//   data-tokens  the rows, "Paris ␣is …" (4 tokens: the simulation below has 4)
// Its <p> children are the captions, one per step, in order: x, Q K V, α β, S₀, then for each
// token its update and its query, then the last one.
// Positions are slide coordinates (the root sits at 72, 150). The numbers are made up, but the
// recurrence is computed from them: S, u, z are consistent.
// Uses viz-core.js (load it first) and braces.js (load it after); styles: decoding.css (.at-*, .hd-*, .kv-*).
(() => {
  const { one, from, parseTokens } = window.AD;
  const OX = 72, OY = 150;
  const COL = { x: '#4aa8ff', q: '#ff9f43', k: '#7cc47a', v: '#d97fd0', a: '#4fd1c5', b: '#e9d66b', z: '#a46cf5', s: '#8fc5fa', neg: '#ff6b6b' };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const R4 = [0, 1, 2, 3];

  // ---- the recurrence, d_k = d_v = 4: S_t = Diag(α_t) S_{t−1} + k_t u_tᵀ, u_t = β_t (v_t − k_tᵀ Diag(α_t) S_{t−1})
  const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
  const TOK = [
    { k: [0.2, 0.9, 0.3, 0.2], v: [0.9, 0.3, 0.7, 0.2], a: [0.9, 0.6, 0.9, 0.5], b: 0.9, q: [0.6, 0.2, 0.5, 0.3] },
    { k: [0.8, 0.2, 0.1, 0.5], v: [0.2, 0.8, 0.3, 0.9], a: [0.9, 0.7, 0.95, 0.6], b: 0.7, q: [0.4, 0.7, 0.2, 0.3] },
    { k: [0.3, 0.3, 0.9, 0.2], v: [0.6, 0.4, 0.9, 0.5], a: [0.95, 0.5, 0.9, 0.4], b: 0.6, q: [0.2, 0.4, 0.8, 0.3] },
    { k: [0.9, 0.15, 0.35, 0.1], v: [0.9, 0.95, 1.0, 0.7], a: [0.95, 0.35, 0.9, 0.15], b: 0.8, q: [0.3, 0.8, 0.2, 0.5] },
  ].map((t) => ({ ...t, k: norm(t.k) }));   // keys are L2-normalized, as in KDA
  let S = R4.map(() => R4.map(() => 0));
  const SIM = TOK.map((t) => {
    const prev = S, dec = prev.map((row, i) => row.map((s) => s * t.a[i]));          // Diag(α_t) S_{t−1}
    const rd = R4.map((j) => R4.reduce((acc, i) => acc + t.k[i] * dec[i][j], 0));   // k_tᵀ Diag(α_t) S_{t−1}
    const u = R4.map((j) => t.b * (t.v[j] - rd[j]));
    const dS = R4.map((i) => R4.map((j) => t.k[i] * u[j]));                          // k_t u_tᵀ
    S = dec.map((row, i) => row.map((s, j) => s + dS[i][j]));
    const z = R4.map((j) => R4.reduce((acc, i) => acc + t.q[i] * S[i][j], 0));      // q_tᵀ S_t
    return { prev, dS, u, next: S, z };
  });
  const SMAX = Math.max(...SIM.flatMap((s) => [...s.next.flat(), ...s.dS.flat()].map(Math.abs)));
  const ZMAX = 0.8;

  function build(root) {
    const toks = parseTokens(root.dataset.tokens).map((t) => t.tok.trim()), N = toks.length;

    // timeline
    let s = 0;
    const next = () => ++s;
    const PROJ = next(), GATE = next(), ST = next(), UPD = [], QR = [];
    SIM.forEach(() => { UPD.push(next()); QR.push(next()); });
    const MEM = next(), FINAL = s;

    // geometry: the projections on the left, the update on the right, the strip at the bottom left
    const u = 22, n = N * u, d = 6 * u, dh = 4 * u, g = 10, su = 28, sd = 4 * su;
    const XX = 110, YP = 316, YW = YP - g - d;
    const px = (m) => XX + d + g + m * (dh + g);        // Q, K, V, α at m = 0 … 3, β at 4
    const W = [dh, dh, dh, dh, u];
    const SY = 214, VY = SY - g - su, V2 = VY - g - su;  // S, the row above it (u_t), and above that (β_t, v_t)
    const PX = 784, DX = 966, SX = 1110, KX = DX - g - su;  // S_{t−1}, k_t u_tᵀ, S_t
    const RY = SY + sd + g, ZY = RY + su + 18;          // q_tᵀ and z_t under S_t; Z under them

    const ctx = AD.context();
    const { h } = ctx;
    const at = (x, y, w, hh) => `left:${x - OX}px; top:${y - OY}px; width:${w}px; height:${hh}px;`;
    const box = (cls, x, y, w, hh, opt = {}, ...kids) => h('div', `at-b ${cls}`, { ...opt, style: at(x, y, w, hh) + (opt.style || '') }, ...kids);
    const name = (html, opt = {}) => h('span', `at-nm ${opt.cls || ''}`, { ...opt, html });
    const text = (x, y, w, html, opt = {}) => box(`kv-tx ${opt.cls || ''}`, x, y, w, 26, opt, h('span', '', { html }));
    const rowsOf = (w, color) => Array.from({ length: N }, (_, i) => h('div', 'at-row', {
      style: `top:${i * u}px; height:${u - 2}px; background-color:${color}; background-position-x:${(i * 36 + w) % 84}px` }));
    const act = (x, y, w, color, label, o = {}) => box('at-box', x, y, w, n, o, ...rowsOf(w, color), name(label, o.nm));
    const brace = (side, a, b, e, label, vis) => {
      const BW = 14, G = 3;
      const rr = { left: [e - G - BW, a, BW, b - a], right: [e + G, a, BW, b - a], top: [a, e - G - BW, b - a, BW], bottom: [a, e + G, b - a, BW] }[side];
      return box('at-br', ...rr, { vis, html: `<svg class="viz-brace" data-side="${side}"><path/></svg>` }, h('span', `at-bl at-bl-${side}`, { html: label }));
    };
    // a cell: its colour's intensity is |value| / max, red when negative
    const cell = (x, y, c, val, max, color) => h('div', 'at-cell', {
      style: `left:${x}px; top:${y}px; width:${c - 2}px; height:${c - 2}px; background:rgba(${rgb(val < 0 ? COL.neg : color)},${(0.12 + 0.8 * Math.min(1, Math.abs(val) / max)).toFixed(2)})` });
    const vec = (x, y, vals, color, label, opt = {}) => {
      const col = opt.col, max = opt.max || Math.max(1e-9, ...vals.map(Math.abs));
      return box('at-box', x, y, col ? su : vals.length * su, col ? vals.length * su : su, opt,
        ...vals.map((v, i) => cell(col ? 0 : i * su, col ? i * su : 0, su, v, max, color)), name(label, { cls: 'hd-sm' }));
    };
    const grid = (x, y, M, label, opt = {}) => {
      const c = opt.c || su;
      return box('at-box', x, y, 4 * c, 4 * c, { ...opt, style: 'background:#0f1829' },
        ...M.flatMap((row, i) => row.map((v, j) => cell(j * c, i * c, c, v, SMAX, COL.s))), label ? name(label) : null);
    };
    const sb = (t) => `S<sub>${t}</sub>`, ix = (t) => `<sub>${t}</sub>`;
    const els = [];

    // x · [W_Q | W_K | W_V | W_α | W_β] = [Q | K | V | α | β]
    els.push(act(XX, YP, d, COL.x, 'x', { hl: [one(0), one(PROJ), one(GATE)] }),
      brace('left', YP, YP + n, XX, 'n'), brace('top', XX, XX + d, YP, 'd'), brace('left', YW, YW + d, px(0), 'd', [from(PROJ)]));
    [['Q', COL.q, 'W<sub>Q</sub>'], ['K', COL.k, 'W<sub>K</sub>'], ['V', COL.v, 'W<sub>V</sub>'], ['α', COL.a, 'W<sub>α</sub>'], ['β', COL.b, 'W<sub>β</sub>']]
      .forEach(([nm, color, wn], m) => {
        const st = m < 3 ? PROJ : GATE, sm = m === 4 ? 'hd-sm' : '';
        els.push(box('at-w', px(m), YW, W[m], d, { vis: [from(st)], hl: [one(st)] },
          h('div', 'hd-w', { style: `height:${d}px; --hd-c:${color}` }), name(wn, { cls: sm })),
          act(px(m), YP, W[m], color, nm, { vis: [from(st)], hl: [one(st)], nm: { cls: sm } }),
          brace('bottom', px(m), px(m) + W[m], YP + n, ['d<sub>k</sub>', 'd<sub>k</sub>', 'd<sub>v</sub>', 'd<sub>k</sub>', '1'][m], [from(st)]));
      });
    // token t's rows of K, V, α, β, outlined during its update; its row of Q during its query
    SIM.forEach((_, t) => {
      [1, 2, 3, 4].forEach((m) => els.push(box('at-box', px(m), YP + t * u, W[m], u, { hl: [one(UPD[t])] })));
      els.push(box('at-box', px(0), YP + t * u, W[0], u, { hl: [one(QR[t])] }));
    });

    // S₀ = 0, then each token's update: Diag(α_t) S_{t−1} + k_t u_tᵀ = S_t
    els.push(grid(SX, SY, SIM[0].prev, sb(0), { vis: [[ST, UPD[0]]], hl: [one(ST)] }),
      brace('right', SY, SY + sd, SX + sd, 'd<sub>k</sub>', [from(ST)]), brace('top', SX, SX + sd, SY, 'd<sub>v</sub>', [from(ST)]));
    SIM.forEach((sm, t) => {
      const st = UPD[t], tk = TOK[t], last = t === SIM.length - 1, k = ix(t + 1), vis = [one(st)];
      els.push(vec(PX - g - su, SY, tk.a, COL.a, `α${k}`, { col: true, vis, max: 1 }),
        grid(PX, SY, sm.prev, sb(t), { vis }),
        text(PX + sd, SY + sd / 2 - 13, KX - PX - sd, '+', { vis }),
        vec(KX, SY, tk.k, COL.k, `k${k}`, { col: true, vis, max: 1 }),
        grid(DX, SY, sm.dS, `k${k}u${k}<sup>T</sup>`, { vis, hl: [one(st)] }),
        vec(DX, VY, sm.u, COL.v, `u${k}`, { vis, max: 1 }),
        vec(DX, V2, tk.v, COL.v, `v${k}`, { vis, max: 1 }),
        vec(DX - g - su, V2, [tk.b], COL.b, `β${k}`, { vis, max: 1 }),
        text(DX + sd, SY + sd / 2 - 13, SX - DX - sd, '=', { vis }),
        grid(SX, SY, sm.next, sb(t + 1), { vis: [last ? from(st) : [st, UPD[t + 1]]], hl: [one(st), ...(last ? [one(MEM)] : [])] }));
    });

    // each token's query right after its update: z_t = q_tᵀ S_t, under S_t; z_t is row t of Z
    SIM.forEach((sm, t) => els.push(
      vec(SX - g - sd, RY, TOK[t].q, COL.q, `q${ix(t + 1)}<sup>T</sup>`, { vis: [one(QR[t])], hl: [one(QR[t])], max: 1 }),
      vec(SX, RY, sm.z, COL.z, `z${ix(t + 1)}`, { vis: [one(QR[t])], hl: [one(QR[t])], max: ZMAX })));
    els.push(box('at-box', SX, ZY, sd, N * su, { vis: [from(QR[0])], style: 'background:#0f1829' },
      ...SIM.map((sm, t) => h('div', 'at-b at-box', { vis: [from(QR[t])], hl: [one(QR[t])], style: `left:0; top:${t * su}px; width:${sd}px; height:${su}px` },
        ...sm.z.map((v, j) => cell(j * su, 0, su, v, ZMAX, COL.z)))), name('Z')),
      brace('left', ZY, ZY + N * su, SX, 'n', [from(QR[0])]), brace('bottom', SX, SX + sd, ZY + N * su, 'd<sub>v</sub>', [from(QR[0])]));

    // the strip of states, bottom left: S₀ → S₁ → … as they are built
    const lc = 15, lw = 4 * lc, gap = 66, LY = 480, lx = (t) => XX - 30 + t * (lw + gap);
    [SIM[0].prev, ...SIM.map((sm) => sm.next)].forEach((M, t) => {
      const st = t === 0 ? ST : UPD[t - 1];
      els.push(grid(lx(t), LY, M, '', { c: lc, vis: [from(st)], hl: [one(st), ...(t ? [one(QR[t - 1])] : [])] }),
        text(lx(t) - 20, LY + lw + 2, lw + 40, `${sb(t)}${t ? ` « ${toks[t - 1]} »` : ''}`, { vis: [from(st)], cls: 'kv-dim' }));
      if (t) els.push(text(lx(t) - gap, LY + lw / 2 - 13, gap, '→', { vis: [from(st)] }));
    });

    AD.mount(root, ctx, FINAL, els);
  }

  AD.run('kda', build);
})();
