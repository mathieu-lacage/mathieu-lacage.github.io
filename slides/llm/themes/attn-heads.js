// « Megakernels », « One request, one task per head »: request 2 at decode (1 new token, 1024 keys of
// context), one layer of Qwen3-1.7B: 16 query heads, 8 KV heads, so 8 tasks, one per KV head, each with
// its 2 query heads (GQA).
//   step 0  attn_in, the QKV linear's output for the token: one row of 4096, 8 groups of
//           [Q 2h | Q 2h+1 | K h | V h] (the weights are shuffled by KV head at build time)
//   step 1  each group flies to its task: 2 rows of Q, the new key (last column of Kᵀ_h), the new value
//           (last row of V_h); the rest of Kᵀ_h and V_h is the KV cache
//   step 2  task (r2, KV 0) alone, steps 3 the 8 tasks at once, each at its own pace: A's 2 rows fill
//           left to right as the task streams its 1024 keys, O = Σ P·V / Σ P recomputed every frame
//   step 4  the final state
// In each panel: Q left of A, Kᵀ_h above A; A left of O, V_h above O. The scores and values are made up
// (a sink at key 0, recent keys, a few peaks); O is computed from them with the real formula.
// « One request, one task per head: S, P, d » (data-mkd="heads-spd"): the same tasks, Q already in place;
// per query head the running scores S, P = exp(S − m) with m the running max, d = Σ P, and O written once
// at the end (4 steps: empty, task 0, all 8, O).
// Builds the figure inside every <div class="mk" data-mkd="heads…">; its caption goes to the
// <div class="gq-cap" data-mkd-cap="heads…"> next to it. Uses steps.js (load it first).
(() => {
  const C = { slide: '#0f1829', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', gold: '#f5c451', hatch: '#1d2c44' };
  const SMIN = -1.5, SMAX = 4;                                   // the range of the scores, for S's heatmap
  const COL = { Q: '#ff9f43', K: '#7cc47a', V: '#d97fd0', O: '#6d86ff' };
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const NKV = 8, NCELL = 64;                                     // A's row drawn as 64 cells of 16 keys
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 7.3) * 43758.5453; return x - Math.floor(x); };
  // scores of query head q against key cell c: mostly low, a few peaks (the first key, the recent keys)
  const score = (q, c) => (c === 0 ? 2.2 : c >= NCELL - 2 ? 3 + rnd(q * 7 + c) : rnd(q * 97 + c) > 0.88 ? 1.2 + 2.6 * rnd(q * 13 + c) : -1.5 + 2 * rnd(q * 31 + c));
  // V_h's values, per key cell c and O column cell j (16 of the 128 columns), in [-1, 1]
  const OC = 8, vval = (h, c, j) => 2 * rnd(h * 1009 + c * 17 + j * 3 + 0.5) - 1;

  // panel geometry: 2 columns × 4 rows of tasks
  const PW = 530, PH = 104;
  const g = (h, detail) => {
    const x = 100 + (h % 2) * (PW + 20), y = 154 + Math.floor(h / 2) * PH;
    return detail ? { x, y, QX: x + 52, KX: x + 84, KW: 320, KY: y + 18, KH: 22, AY: y + 46, RH: 9, VX: x + 470, VW: 26, VY: y + 2 }
      : { x, y, QX: x + 52, KX: x + 84, KW: 352, KY: y + 20, KH: 34, AY: y + 60, RH: 10, VX: x + 446, VW: 48, VY: y + 4 };
  };
  // where a group's slices go in its task: its 2 Q rows, the new key (last column of Kᵀ), the new value (last row of V)
  const dest = (m) => ({ q: [0, 1].map((b) => [m.QX, m.AY + b * m.RH, 26, m.RH - 1]),
    k: [m.KX + m.KW - 4, m.KY, 4, m.KH], v: [m.VX, m.AY - 8, m.VW, 4] });
  // attn_in: one row of 4096, 8 groups of [Q 2h | Q 2h+1 | K h | V h], 128 each
  const SX = 100, SY = 132;
  const src = (h, j) => [SX + h * 136 + j * 32, SY, 30, 10];
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  const CAPS = [
    '<b>attn_in</b>, from the QKV linear: request 2\'s new token, one row of 16 Q, 8 K, 8 V heads, grouped by KV head',
    'Each KV head\'s group goes to <b>its task</b>: 2 Q rows, the new key (end of Kᵀ), the new value (end of V)',
    'Task (r2, KV 0): its 2 rows of Q read the <b>same 1024 keys</b> (loaded once from the cache), each fills <b>its own row</b> of A',
    'The 8 tasks run at the same time on 8 SMs, each with its own K, V: <b>16 rows</b>, filled independently',
    'Each row: softmax over all 1024 keys (no mask at decode: every past key is visible), then O = A V',
  ];
  const CAPS_SPD = [
    'Request 2 decodes 1 token. One layer: <b>8 tasks</b>, one per KV head; each serves <b>2 query heads</b>',
    'Task (r2, KV 0), per query head: <b>S</b> = q·kᵀ/√d<sub>h</sub>, <b>P</b> = exp(S − m), m the running max, <b>d</b> = Σ P',
    'The 8 tasks run at the same time on 8 SMs: 16 query heads, each its own S, P, d, filled as the keys stream',
    'Once all 1024 keys are in: <b>O = (Σ P·V) / d</b>, written once per head',
  ];

  // one task: prog = the share of its keys streamed (0 … 1), lit = not dimmed, split = attn_in has reached it
  const panel = (h, prog, lit, split, detail) => {
    const m = g(h, detail), tile = Math.min(Math.floor(prog * 16), 15), n = Math.floor(prog * NCELL + 1e-6);
    let o = `<g opacity="${lit ? 1 : 0.25}">`;
    o += T(m.x, m.y + 12, `task (r2, KV ${h})`, `font-size="13" fill="${C.ink}" font-weight="600"`);
    // Kᵀ_h: 128 × 1024 keys; the tile being read is lit
    o += R(m.KX, m.KY, m.KW, m.KH, `fill="${COL.K}" fill-opacity=".35"`);
    if (prog > 0) o += R(m.KX, m.KY, m.KW * prog, m.KH, `fill="${COL.K}" fill-opacity=".8"`);
    if (prog > 0 && prog < 1) o += R(m.KX + (m.KW * tile) / 16, m.KY - 2, m.KW / 16, m.KH + 4, `fill="none" stroke="${C.gold}" stroke-width="1.5"`);
    o += T(m.KX + m.KW / 2, m.KY + m.KH / 2 + 5, `K<tspan font-size="10" dy="-6">T</tspan><tspan font-size="10" dy="9">${h}</tspan>`, `font-size="13" font-weight="600" fill="${C.ink}" text-anchor="middle" paint-order="stroke" stroke="${C.slide}" stroke-width="3"`);
    // V_h above O (keys squeezed down), the same tile lit
    const vh = m.AY - 4 - m.VY;
    o += R(m.VX, m.VY, m.VW, vh, `fill="${COL.V}" fill-opacity="${prog > 0 ? 0.8 : 0.35}"`);
    if (prog > 0 && prog < 1) o += R(m.VX - 2, m.VY + (vh * tile) / 16, m.VW + 4, vh / 16, `fill="none" stroke="${C.gold}" stroke-width="1.5"`);
    o += T(m.VX + m.VW / 2, m.VY + 24, `V<tspan font-size="9" dy="3">${h}</tspan>`, `font-size="13" font-weight="600" fill="${C.ink}" text-anchor="middle" paint-order="stroke" stroke="${C.slide}" stroke-width="3"`);
    if (detail) return o + spd(h, m, prog, n) + '</g>';
    // the new token's key and value, from attn_in: the last column of Kᵀ, the last row of V
    if (split) { const d = dest(m); o += R(...d.k, `fill="${C.gold}"`) + R(...d.v, `fill="${C.gold}"`); }
    // per query head: Q, its row of A (the final weights, revealed as the keys stream), O so far
    for (let b = 0; b < 2; b++) {
      const q = 2 * h + b, y = m.AY + b * m.RH;
      const all = Array.from({ length: NCELL }, (_, c) => score(q, c)), mx = Math.max(...all);
      o += T(m.QX - 6, y + 8, `Q ${q}`, `font-size="11" fill="${C.slate}" text-anchor="end"`)
        + R(m.QX, y, 26, m.RH - 1, split ? `fill="${COL.Q}"` : `fill="none" stroke="${C.dim}" stroke-dasharray="2 2"`)
        + R(m.KX, y, m.KW, m.RH - 1, `fill="${C.hatch}"`);
      for (let c = 0; c < n; c++) o += R(m.KX + (c * m.KW) / NCELL, y, m.KW / NCELL - 0.3, m.RH - 1,
        `fill="rgb(143,197,250)" fill-opacity="${Math.max(Math.exp(all[c] - mx), 0.08).toFixed(2)}"`);
      // O = Σ P·V / Σ P over the keys seen so far: 8 cells of 16 of its 128 columns
      o += R(m.VX, y, m.VW, m.RH - 1, `fill="${C.hatch}"`);
      if (n) {
        let d = 0;
        const acc = Array(OC).fill(0);
        for (let c = 0; c < n; c++) {
          const w = Math.exp(all[c] - mx);
          d += w;
          for (let j = 0; j < OC; j++) acc[j] += w * vval(h, c, j);
        }
        for (let j = 0; j < OC; j++) o += R(m.VX + (j * m.VW) / OC, y, m.VW / OC - 0.4, m.RH - 1,
          `fill="${COL.O}" fill-opacity="${(0.1 + 0.9 * (acc[j] / d + 1) / 2).toFixed(2)}"`);
      }
    }
    return o + '</g>';
  };

  // « S, P, d »: per query head, S and P over the keys seen so far, the running d, and O at the end
  const spd = (h, m, prog, n) => {
    let o = '';
    for (let b = 0; b < 2; b++) {
      const q = 2 * h + b, y = m.AY + b * (2 * m.RH + 3);
      const sc = Array.from({ length: n }, (_, c) => score(q, c));
      const mx = n ? Math.max(...sc) : 0;
      const P = sc.map((v) => Math.exp(v - mx)), d = P.reduce((a, v) => a + v, 0);
      o += T(m.QX - 6, y + m.RH + 3, `Q ${q}`, `font-size="11" fill="${C.slate}" text-anchor="end"`)
        + R(m.QX, y, 18, 2 * m.RH, `fill="${COL.Q}"`)
        + R(m.KX, y, m.KW, m.RH - 1, `fill="${C.hatch}"`) + R(m.KX, y + m.RH, m.KW, m.RH - 1, `fill="${C.hatch}"`);
      for (let c = 0; c < n; c++) {
        const x = m.KX + (c * m.KW) / NCELL, w = m.KW / NCELL - 0.3;
        o += R(x, y, w, m.RH - 1, `fill="rgb(143,197,250)" fill-opacity="${(0.1 + 0.9 * (sc[c] - SMIN) / (SMAX - SMIN)).toFixed(2)}"`)
          + R(x, y + m.RH, w, m.RH - 1, `fill="${C.gold}" fill-opacity="${Math.max(P[c], 0.04).toFixed(2)}"`);
      }
      if (b === 0) o += T(m.KX - 3, y + m.RH - 1, 'S', `font-size="10" fill="${C.slate}" text-anchor="end"`) + T(m.KX - 3, y + 2 * m.RH - 1, 'P', `font-size="10" fill="${C.slate}" text-anchor="end"`);
      // d: the running sum, a cell whose brightness follows it
      const dx = m.KX + m.KW + 6;
      o += R(dx, y, 34, 2 * m.RH - 1, `fill="${C.gold}" fill-opacity="${n ? Math.min(0.15 + d / 12, 1).toFixed(2) : 0}" stroke="${C.dim}"`)
        + T(dx + 17, y + m.RH + 4, n ? d.toFixed(1) : '', `font-size="10" fill="${C.ink}" text-anchor="middle" font-weight="600" paint-order="stroke" stroke="${C.slide}" stroke-width="2"`);
      if (b === 0) o += T(dx + 17, y - 3, 'd', `font-size="10" fill="${C.slate}" text-anchor="middle"`);
      // O: written once, at the end
      o += R(m.VX, y, m.VW, 2 * m.RH - 1, `fill="${prog >= 1 ? COL.O : C.hatch}" stroke="${C.dim}"`);
    }
    return o;
  };

  // sp: the split of attn_in into the tasks, 0 (not yet) … 1 (done)
  const draw = (svg, progs, lits, sp = 1, detail = false) => {
    let o = '';
    for (let h = 0; h < NKV; h++) o += panel(h, progs[h], lits[h], sp >= 1, detail);
    if (detail) {
      svg.innerHTML = o + T(100, 144, 'each task: Q (2 rows) left of A, Kᵀ above A · A left of O, V above O · 1024 keys from the KV cache', `font-size="13" fill="${C.slate}"`);
      return;
    }
    const cols = [COL.Q, COL.Q, COL.K, COL.V];
    o += T(SX - 8, SY + 9, 'attn_in', `font-size="12" fill="${C.slate}" text-anchor="end"`);
    for (let h = 0; h < NKV; h++) for (let j = 0; j < 4; j++) o += R(...src(h, j), `fill="${cols[j]}" fill-opacity="${sp > 0 ? 0.25 : 1}"`);
    if (sp > 0 && sp < 1) {                                      // the slices in flight
      const t = ease(sp);
      for (let h = 0; h < NKV; h++) {
        const d = dest(g(h));
        [d.q[0], d.q[1], d.k, d.v].forEach((to, j) => { o += R(...lerp(src(h, j), to, t), `fill="${cols[j]}"`); });
      }
    }
    svg.innerHTML = o;
  };

  document.querySelectorAll('div.mk[data-mkd="heads"], div.mk[data-mkd="heads-spd"]').forEach((root) => {
    const detail = root.dataset.mkd === 'heads-spd', caps = detail ? CAPS_SPD : CAPS;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector(`[data-mkd-cap="${root.dataset.mkd}"]`);
    let raf = 0;
    const DUR = 2600, SPEED = [1, 0.93, 1.06, 0.88, 0.97, 1.1, 0.91, 1.02];   // each SM at its own pace
    const all = (v) => Array(NKV).fill(v);
    const play = (dur, frame) => {
      const t0 = performance.now();
      const tick = (now) => { const t = Math.min((now - t0) / dur, 1); if (frame(t) !== false && t < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    };
    steps(root, caps.length - 1, (st) => {
      cancelAnimationFrame(raf);
      if (st === null) st = caps.length - 1;
      cap.innerHTML = caps[st];
      if (detail) {                                             // empty, task 0, all 8, O
        if (st === 0) return draw(svg, all(0), all(true), 1, true);
        if (st === 1) return play(DUR, (t) => draw(svg, [t, ...all(0).slice(1)], [true, ...all(false).slice(1)], 1, true));
        if (st === 2) return play(DUR / Math.min(...SPEED), (t) => draw(svg, SPEED.map((v) => Math.min((t * v) / Math.min(...SPEED), 1)), all(true), 1, true));
        return draw(svg, all(1), all(true), 1, true);
      }
      if (st === 0) return draw(svg, all(0), all(true), 0);
      if (st === 1) return play(1200, (t) => draw(svg, all(0), all(true), t));
      if (st === 2) return play(DUR, (t) => draw(svg, [t, ...all(0).slice(1)], [true, ...all(false).slice(1)]));
      if (st === 3) return play(DUR / Math.min(...SPEED), (t) => draw(svg, SPEED.map((v) => Math.min((t * v) / Math.min(...SPEED), 1)), all(true)));
      draw(svg, all(1), all(true));
    });
  });
})();
