// Linear attention (Katharopoulos et al. 2020), one head, prefill token by token, drawn as Kimi
// Delta Attention (themes/kda.js) without decay and without delta rule:
//   1. x · [W_Q | W_K | W_V] = [Q | K | V];
//   2. a state S, d_k × d_v, starts empty (S₀ = 0);
//   3. each token t, in order: S_{t−1} + k_t v_tᵀ = S_t, then its query z_t = q_tᵀ S_t, row t of Z;
//   4. a strip at the bottom left keeps S₀ → S₁ → … as they are built: nothing ever leaves.
//
// Builds the animation inside every <div class="viz" data-anim="lin"> from:
//   data-tokens  the rows, "Paris ␣is …" (4 tokens: the simulation below has 4)
// Its <p> children are the captions, one per step, in order: x, Q K V, S₀, then for each token
// its update and its query, then the last one.
// Same tokens and numbers as themes/kda.js (k, v, q), α and β left out.
// Uses viz-core.js (load it first) and braces.js (load it after); styles: decoding.css (.at-*, .hd-*, .kv-*).
(() => {
  const { one, from, parseTokens } = window.AD;
  const OX = 72, OY = 150;
  const COL = { x: '#4aa8ff', q: '#ff9f43', k: '#7cc47a', v: '#d97fd0', z: '#a46cf5', s: '#8fc5fa', neg: '#ff6b6b' };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const R4 = [0, 1, 2, 3];

  // ---- the recurrence, d_k = d_v = 4: S_t = S_{t−1} + k_t v_tᵀ (themes/kda.js's tokens, α = 1, β = 1, no delta)
  const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
  const TOK = [
    { k: [0.2, 0.9, 0.3, 0.2], v: [0.9, 0.3, 0.7, 0.2], q: [0.6, 0.2, 0.5, 0.3] },
    { k: [0.8, 0.2, 0.1, 0.5], v: [0.2, 0.8, 0.3, 0.9], q: [0.4, 0.7, 0.2, 0.3] },
    { k: [0.3, 0.3, 0.9, 0.2], v: [0.6, 0.4, 0.9, 0.5], q: [0.2, 0.4, 0.8, 0.3] },
    { k: [0.9, 0.15, 0.35, 0.1], v: [0.9, 0.95, 1.0, 0.7], q: [0.3, 0.8, 0.2, 0.5] },
  ].map((t) => ({ ...t, k: norm(t.k) }));
  let S = R4.map(() => R4.map(() => 0));
  const SIM = TOK.map((t) => {
    const prev = S, dS = R4.map((i) => R4.map((j) => t.k[i] * t.v[j]));            // k_t v_tᵀ
    S = prev.map((row, i) => row.map((s, j) => s + dS[i][j]));
    const z = R4.map((j) => R4.reduce((acc, i) => acc + t.q[i] * S[i][j], 0));     // q_tᵀ S_t
    return { prev, dS, next: S, z };
  });
  const SMAX = Math.max(...SIM.flatMap((s) => [...s.next.flat(), ...s.dS.flat()].map(Math.abs)));
  const ZMAX = Math.max(...SIM.flatMap((s) => s.z));

  // shared drawing kit, as in themes/kda.js
  function kit(N, u = 22) {
    const ctx = AD.context(), { h } = ctx, su = 28, n = N * u;
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
        ...M.flatMap((row, i) => row.map((v, j) => cell(j * c, i * c, c, v, opt.max || SMAX, opt.color || COL.s))), label ? name(label) : null);
    };
    return { ctx, h, su, n, u, box, name, text, act, brace, cell, vec, grid };
  }
  const sb = (t) => `S<sub>${t}</sub>`, ix = (t) => `<sub>${t}</sub>`;

  // ---- token by token ----
  function build(root) {
    const toks = parseTokens(root.dataset.tokens).map((t) => t.tok.trim()), N = toks.length;
    let s = 0;
    const next = () => ++s;
    const PROJ = next(), ST = next(), UPD = [], QR = [];
    SIM.forEach(() => { UPD.push(next()); QR.push(next()); });
    const MEM = next(), FINAL = s;

    const K = kit(N), { ctx, h, su, n, u, box, text, act, brace, cell, vec, grid } = K;
    const d = 6 * u, dh = 4 * u, g = 10, sd = 4 * su;
    const XX = 110, YP = 316, YW = YP - g - d;
    const px = (m) => XX + d + g + m * (dh + g);        // Q, K, V at m = 0 … 2
    const SY = 214, VY = SY - g - su;                   // S, and v_t above k_t v_tᵀ
    const PX = 784, DX = 966, SX = 1110, KX = DX - g - su;
    const RY = SY + sd + g, ZY = RY + su + 18;
    const els = [];

    // x · [W_Q | W_K | W_V] = [Q | K | V]
    els.push(act(XX, YP, d, COL.x, 'x', { hl: [one(0), one(PROJ)] }),
      brace('left', YP, YP + n, XX, 'n'), brace('top', XX, XX + d, YP, 'd'), brace('left', YW, YW + d, px(0), 'd', [from(PROJ)]));
    [['Q', COL.q, 'W<sub>Q</sub>'], ['K', COL.k, 'W<sub>K</sub>'], ['V', COL.v, 'W<sub>V</sub>']].forEach(([nm, color, wn], m) => {
      els.push(box('at-w', px(m), YW, dh, d, { vis: [from(PROJ)], hl: [one(PROJ)] },
        h('div', 'hd-w', { style: `height:${d}px; --hd-c:${color}` }), K.name(wn)),
        act(px(m), YP, dh, color, nm, { vis: [from(PROJ)], hl: [one(PROJ)] }),
        brace('bottom', px(m), px(m) + dh, YP + n, ['d<sub>k</sub>', 'd<sub>k</sub>', 'd<sub>v</sub>'][m], [from(PROJ)]));
    });
    SIM.forEach((_, t) => {
      [1, 2].forEach((m) => els.push(box('at-box', px(m), YP + t * u, dh, u, { hl: [one(UPD[t])] })));
      els.push(box('at-box', px(0), YP + t * u, dh, u, { hl: [one(QR[t])] }));
    });

    // S₀ = 0, then each token: S_{t−1} + k_t v_tᵀ = S_t
    els.push(grid(SX, SY, SIM[0].prev, sb(0), { vis: [[ST, UPD[0]]], hl: [one(ST)] }),
      brace('right', SY, SY + sd, SX + sd, 'd<sub>k</sub>', [from(ST)]), brace('top', SX, SX + sd, SY, 'd<sub>v</sub>', [from(ST)]));
    SIM.forEach((sm, t) => {
      const st = UPD[t], tk = TOK[t], last = t === SIM.length - 1, k = ix(t + 1), vis = [one(st)];
      els.push(grid(PX, SY, sm.prev, sb(t), { vis }),
        text(PX + sd, SY + sd / 2 - 13, KX - PX - sd, '+', { vis }),
        vec(KX, SY, tk.k, COL.k, `k${k}`, { col: true, vis, max: 1 }),
        grid(DX, SY, sm.dS, `k${k}v${k}<sup>T</sup>`, { vis, hl: [one(st)] }),
        vec(DX, VY, tk.v, COL.v, `v${k}<sup>T</sup>`, { vis, max: 1 }),
        text(DX + sd, SY + sd / 2 - 13, SX - DX - sd, '=', { vis }),
        grid(SX, SY, sm.next, sb(t + 1), { vis: [last ? from(st) : [st, UPD[t + 1]]], hl: [one(st), ...(last ? [one(MEM)] : [])] }));
    });

    // each token's query right after its update: z_t = q_tᵀ S_t
    SIM.forEach((sm, t) => els.push(
      vec(SX - g - sd, RY, TOK[t].q, COL.q, `q${ix(t + 1)}<sup>T</sup>`, { vis: [one(QR[t])], hl: [one(QR[t])], max: 1 }),
      vec(SX, RY, sm.z, COL.z, `z${ix(t + 1)}`, { vis: [one(QR[t])], hl: [one(QR[t])], max: ZMAX })));
    els.push(box('at-box', SX, ZY, sd, N * su, { vis: [from(QR[0])], style: 'background:#0f1829' },
      ...SIM.map((sm, t) => h('div', 'at-b at-box', { vis: [from(QR[t])], hl: [one(QR[t])], style: `left:0; top:${t * su}px; width:${sd}px; height:${su}px` },
        ...sm.z.map((v, j) => cell(j * su, 0, su, v, ZMAX, COL.z)))), K.name('Z')),
      brace('left', ZY, ZY + N * su, SX, 'n', [from(QR[0])]), brace('bottom', SX, SX + sd, ZY + N * su, 'd<sub>v</sub>', [from(QR[0])]));

    // the strip of states: S₀ → S₁ → …, each one darker than the last: nothing ever leaves
    const lc = 15, lw = 4 * lc, gap = 66, LY = 480, lx = (t) => XX - 30 + t * (lw + gap);
    [SIM[0].prev, ...SIM.map((sm) => sm.next)].forEach((M, t) => {
      const st = t === 0 ? ST : UPD[t - 1];
      els.push(grid(lx(t), LY, M, '', { c: lc, vis: [from(st)], hl: [one(st), ...(t ? [one(QR[t - 1])] : [])] }),
        text(lx(t) - 20, LY + lw + 2, lw + 40, `${sb(t)}${t ? ` « ${toks[t - 1]} »` : ''}`, { vis: [from(st)], cls: 'kv-dim' }));
      if (t) els.push(text(lx(t) - gap, LY + lw / 2 - 13, gap, '→', { vis: [from(st)] }));
    });

    AD.mount(root, ctx, FINAL, els);
  }

  AD.run('lin', build);
})();
