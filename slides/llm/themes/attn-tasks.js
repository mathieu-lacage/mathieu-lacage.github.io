// « Megakernels », the attention tasks of one layer for a small mixed batch, drawn from « Grouped-Query
// Attention » (architecture deck): 4 query heads, 2 KV heads; 3 requests, 5 new tokens (r0 decodes on top
// of 4 cached tokens, r1 prefills a 3-token prompt, r2 decodes on top of 2). One task per (request, KV
// head), as MPK's paged_attention_layer: grid (3, 2) here, (R, 8) for Qwen3-1.7B.
//
// Builds the figure inside every <div class="mk" data-gq="tasks">; its caption goes to the
// <div class="gq-cap" data-gq-cap="tasks"> next to it. Each task: A = softmax(Q Kᵀ) with Q to its left and
// Kᵀ above it, Z = A V with V above it; Q stacks the task's 2 query heads token by token. The KV cache is
// two pools of 8 pages of 2 slots (K and V), one page table per request. Each block that moves travels
// along a curve, with an arrow growing behind it (requestAnimationFrame, see arrows below).
// Uses steps.js (load it first).
(() => {
  const C = { slide: '#0f1829', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', gold: '#f5c451', cyan: '#8fc5fa' };
  const COL = { Q: '#ff9f43', K: '#7cc47a', V: '#d97fd0', Z: '#a46cf5' };
  const U = 12, DH = 24, NKV = 2, PS = 2;                     // a token row, a head's width; PS: slots per page
  // the batch: r0 decodes on top of 4 cached tokens, r1 prefills a 3-token prompt, r2 decodes on top of 2
  const REQ = [{ kind: 'decode', cache: 4, nw: 1, pages: [5, 2, 7] }, { kind: 'prefill', cache: 0, nw: 3, pages: [0, 4] },
    { kind: 'decode', cache: 2, nw: 1, pages: [3, 6] }];
  const NPAGES = 8;
  let q0 = 0, k0 = 0;
  REQ.forEach((r) => { r.ctx = r.cache + r.nw; r.q0 = q0; r.k0 = k0; q0 += r.nw; k0 += r.ctx; });
  const TOK = REQ.flatMap((r, i) => Array.from({ length: r.nw }, (_, j) => ({ r: i, pos: r.cache + j })));
  const KEY = REQ.flatMap((r, i) => Array.from({ length: r.ctx }, (_, j) => ({ r: i, pos: j, cached: j < r.cache })));

  // ---- svg strings ----
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const frame = (x, y, w, h, c = C.gold, sw = 2.5) => R(x - 2, y - 2, w + 4, h + 4, `fill="none" stroke="${c}" stroke-width="${sw}" rx="2"`);
  const dash = (x, y, w, h) => R(x - 1.5, y - 1.5, w + 3, h + 3, `fill="none" stroke="${C.slate}" stroke-dasharray="3 3"`);
  // n rows × (w / 7) cells
  const rows = (x, y, n, w, color, seed) => {
    let o = '';
    const nc = Math.round(w / 7), cw = w / nc;
    for (let i = 0; i < n; i++) for (let j = 0; j < nc; j++) {
      const op = 0.4 + 0.6 * rnd(seed + i * 17 + j);
      o += R(x + j * cw, y + i * U, cw - 1, U - 2, `fill="${color}" fill-opacity="${op.toFixed(2)}"`);
    }
    return o;
  };
  // the same, transposed: n columns of (h / 7) cells
  const cols = (x, y, n, h, color, seed) => {
    let o = '';
    const nc = Math.round(h / 7), ch = h / nc;
    for (let i = 0; i < n; i++) for (let j = 0; j < nc; j++) {
      const op = 0.4 + 0.6 * rnd(seed + i * 17 + j);
      o += R(x + i * U, y + j * ch, U - 2, ch - 1, `fill="${color}" fill-opacity="${op.toFixed(2)}"`);
    }
    return o;
  };
  // causal attention weights of one query token over its request's keys
  const weight = (head, t, k) => {
    const tok = TOK[t], key = KEY[k];
    if (key.pos > tok.pos) return null;
    const tgt = [Math.max(tok.pos - 1, 0), 0, tok.pos, Math.max(tok.pos - 2, 0)][head % 4];
    return key.pos === tgt ? 0.8 : 0.15 + 0.15 * rnd(head * 31 + t * 7 + k);
  };
  const acell = (x, y, w) => w === null
    ? R(x, y, U - 2, U - 2, `fill="none" stroke="${C.dim}" stroke-width="1"`)
    : R(x, y, U - 2, U - 2, `fill="rgb(143,197,250)" fill-opacity="${w.toFixed(2)}"`);

  // a group, visible from step s0 to s1, fading in when reached, optionally flying in from (dx, dy)
  const mk = (S) => (s0, body, o = {}) => {
    if (S.st < s0 || S.st > (o.s1 ?? 99)) return '';
    let cls = '', style = '';
    if (S.play && S.st === s0) cls += ' ap';
    if (o.fly && S.play && S.st === o.fly[0]) { cls = ' fly'; style = `--dx:${o.fly[1]}px;--dy:${o.fly[2]}px;--rot:${o.fly[3] || 0}deg`; }
    // moved at this step: remember where from, for the arrows
    const from = o.fly && S.st === o.fly[0] ? ` data-from="${o.fly[1]},${o.fly[2]},${o.fly[3] || 0}" data-key="${o.key || ''}"` : '';
    return `<g class="${cls}" style="${style}" opacity="${o.dim ? 0.18 : 1}"${from}>${body}</g>`;
  };
  const DEFS = `<defs><pattern id="gq-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="#141f33"/><line x1="0" y1="0" x2="0" y2="6" stroke="#2a3954" stroke-width="2"/></pattern></defs>`;
  const reqLabel = (i) => `r${i} · ${REQ[i].kind}`;

  // where a request's key j lives: page table entry j / PS, slot j % PS
  const pageOf = (i, j) => [REQ[i].pages[Math.floor(j / PS)], j % PS];
  const owner = (p) => REQ.findIndex((r) => r.pages.includes(p));
  // one task's geometry, A = softmax(Q Kᵀ) then Z = A V: Q to the left of A, Kᵀ above it; A to the left of Z, V above it.
  // Q stacks the 2 query heads token by token (row 2t + b), as attention_sm100.cuh does.
  const geo = (i, cx, cy) => {
    const r = REQ[i], slots = r.ctx, L = slots * U;
    const QX = cx + 12, AX = QX + DH + 6, ZX = AX + L + 6, VY = cy + 22, KY = VY + L - DH, RY = VY + L + 6;
    return { r, slots, L, QX, AX, ZX, VY, KY, RY, kx: (j) => AX + j * U, vy: (j) => VY + j * U,
      qy: (k) => RY + k * U, W: 12 + DH + 6 + L + 6 + DH + 12, H: 22 + L + 6 + 2 * r.nw * U + 10 };
  };
  // centre offsets: a row is DH × (U - 2), a column (U - 2) × DH
  const rowC = ([x, y]) => [x + DH / 2, y + (U - 2) / 2], colC = ([x, y]) => [x + (U - 2) / 2, y + DH / 2];
  const d2 = (a, b) => [a[0] - b[0], a[1] - b[1]];

  // one task's content. src: where its rows come from (attn_in, the pages); out: attn_out
  //   src.q(t, b), src.k(t), src.v(t): attn_in rows (top-left); src.kc(j), src.vc(j): page slots or null
  // the steps at which things happen
  const PS0 = { q: () => 1, k: () => 1, v: () => 1, ck: () => 2, cv: () => 2, comp: 3, out: 4, wk: 4, wv: 4 };
  const task = (G, st, i, g, m, src, o = {}) => {
    const r = REQ[i], dim = o.dim ? o.dim(i, g) : false, ps = o.ps || PS0;
    let s = G(0, R(m.QX - 12, m.VY - 22, m.W, o.H || m.H, `fill="#131d30" stroke="${C.dim}" rx="6"`)
      + T(m.QX - 2, m.VY - 8, `task (r${i}, KV ${g + 1})`, `class="gl" font-size="11"`), { dim });
    for (let t = 0; t < r.nw; t++) {
      const j = r.cache + t;
      [0, 1].forEach((b) => {
        const d = [m.QX, m.qy(2 * t + b)];
        const sq = ps.q(2 * g + b);
        s += G(sq, rows(d[0], d[1], 1, DH, COL.Q, (2 * g + b) * 100 + r.q0 + t), { dim, key: `q${i}-${g}-${b}`, fly: [sq, ...d2(src.q(t, b), d)] });
      });
      const dk = [m.kx(j), m.KY], dv = [m.ZX, m.vy(j)];
      const sk = ps.k(g), sv = ps.v(g);
      s += G(sk, cols(dk[0], dk[1], 1, DH, COL.K, 500 + g * 50 + r.k0 + j), { dim, key: `k${i}-${g}`, fly: [sk, ...d2(rowC(src.k(t)), colC(dk)), 90] });
      s += G(sv, rows(dv[0], dv[1], 1, DH, COL.V, 900 + g * 50 + r.k0 + j), { dim, key: `v${i}-${g}`, fly: [sv, ...d2(src.v(t), dv)] });
    }
    for (let j = 0; j < r.cache; j++) {
      const dk = [m.kx(j), m.KY], dv = [m.ZX, m.vy(j)], kc = src.kc(j), vc = src.vc(j);
      const sk = ps.ck(i, g), sv = ps.cv(i, g);
      s += G(sk, cols(dk[0], dk[1], 1, DH, COL.K, 500 + g * 50 + r.k0 + j), { dim, key: `ck${i}-${g}-${pageOf(i, j)[0]}`, fly: kc && [sk, ...d2(rowC(kc), colC(dk)), 90] });
      s += G(sv, rows(dv[0], dv[1], 1, DH, COL.V, 900 + g * 50 + r.k0 + j), { dim, key: `cv${i}-${g}-${pageOf(i, j)[0]}`, fly: vc && [sv, ...d2(vc, dv)] });
    }
    if (r.cache) s += G(ps.ck(i, g), dash(m.kx(0), m.KY, m.kx(r.cache - 1) + U - 2 - m.kx(0), DH - 1), { dim })
      + G(ps.cv(i, g), dash(m.ZX, m.vy(0), DH - 1, m.vy(r.cache - 1) + U - 2 - m.vy(0)), { dim });
    // A = softmax(Q Kᵀ) (causal), Z = A V
    let a = '', z = '';
    for (let k = 0; k < 2 * r.nw; k++) {
      const t = k >> 1, h = 2 * g + (k & 1);
      for (let j = 0; j < r.ctx; j++) a += acell(m.kx(j), m.qy(k), weight(h, r.q0 + t, r.k0 + j));
      z += rows(m.ZX, m.qy(k), 1, DH, COL.Z, 1300 + h * 40 + r.q0 + t);
    }
    s += G(ps.comp, a, { dim }) + G(ps.comp, z, { dim });
    // names
    const sm = (x, y, b, sb) => T(x, y, sb === undefined ? b : `${b}<tspan font-size="9" dy="3">${sb}</tspan>`, 'class="gn" style="font-size:12px"');
    const qlab = sm(m.QX + DH / 2, m.KY + DH / 2 - 2, 'Q');
    s += G(ps.q(2 * g), qlab, { dim });
    s += G(ps.k(g), sm(m.kx(0) + (m.kx(m.slots - 1) + U - m.kx(0)) / 2, m.KY + DH / 2, 'K', `${g + 1}ᵀ`), { dim })
      + G(ps.v(g), sm(m.ZX + DH / 2, m.VY + m.L / 2, 'V', g + 1), { dim });
    s += G(ps.comp, sm(m.kx(0) + (m.kx(r.ctx - 1) + U - m.kx(0)) / 2, m.RY + r.nw * U, 'A') + sm(m.ZX + DH / 2, m.RY + r.nw * U, 'Z'), { dim });
    return s;
  };
  // attn_in: 5 rows × [Q Q K V] per KV head; attn_out: 5 rows × 4 heads
  const attnIn = (G, st, IX, IY, ps = PS0) => {
    const x = (g, m) => IX + g * 112 + m * 26;
    const sb = (n, k) => `${n}<tspan font-size="8" dy="3">${k}</tspan>`;
    let s = G(0, T(IX, IY - 22, 'ATTN_IN', `class="gh"`) + [0, 1].map((g) => [sb('Q', 2 * g + 1), sb('Q', 2 * g + 2), sb('K', g + 1), sb('V', g + 1)]
      .map((l, m) => T(x(g, m) + DH / 2, IY - 8, l, `class="gl" text-anchor="middle" font-size="11"`)).join('')).join(''));
    TOK.forEach((t, i) => { s += G(0, T(IX - 6, IY + i * U + 9, `r${t.r} · t${t.pos}`, `class="gl" text-anchor="end" font-size="10"`)); });
    for (let g = 0; g < NKV; g++) [COL.Q, COL.Q, COL.K, COL.V].forEach((c, m) => {
      let body = '';
      REQ.forEach((r) => {
        const seed = m < 2 ? (2 * g + m) * 100 + r.q0 : (m === 2 ? 500 : 900) + g * 50 + r.k0 + r.cache;
        for (let t = 0; t < r.nw; t++) body += rows(x(g, m), IY + (r.q0 + t) * U, 1, DH, c, seed + t);
      });
      // solid until the slice has flown to the tasks, a ghost after
      const mv = m < 2 ? ps.q(2 * g + m) : m === 2 ? ps.k(g) : ps.v(g);
      s += G(0, body, { s1: mv - 1 }) + G(mv, `<g opacity=".3">${body}</g>`);
    });
    return { s, q: (i, g, t, b) => [x(g, b), IY + (REQ[i].q0 + t) * U], k: (i, g, t) => [x(g, 2), IY + (REQ[i].q0 + t) * U],
      v: (i, g, t) => [x(g, 3), IY + (REQ[i].q0 + t) * U] };
  };
  const attnOut = (G, st, OX, OY, from, so = 4) => {
    const x = (h) => OX + h * DH + (h > 1 ? 6 : 0);
    let s = G(so, T(OX, OY - 22, 'ATTN_OUT', `class="gh"`) + [0, 1, 2, 3].map((h) => T(x(h) + DH / 2, OY - 8, `Z${h + 1}`, `class="gl" text-anchor="middle" font-size="11"`)).join(''));
    REQ.forEach((r, i) => [0, 1].forEach((g) => {
      for (let t = 0; t < r.nw; t++) [0, 1].forEach((b) => {
        const h = 2 * g + b, d = [x(h), OY + (r.q0 + t) * U];
        s += G(so, rows(d[0], d[1], 1, DH, COL.Z, 1300 + h * 40 + r.q0 + t), { key: `z${i}-${g}`, fly: [so, ...d2(from(i, g, t, b), d)] });
      });
    }));
    return s;
  };

  // one thing at a time: Q1 … Q4, the new K and V, the cache task by task (r1 has none), the products, out, write
  const CACHED = [[0, 0], [0, 1], [2, 0], [2, 1]];
  const PS2 = { q: (h) => 1 + h, k: (g) => 5 + 2 * g, v: (g) => 6 + 2 * g,
    ck: (i, g) => 9 + 2 * CACHED.findIndex(([a, b]) => a === i && b === g), cv: (i, g) => 10 + 2 * CACHED.findIndex(([a, b]) => a === i && b === g),
    comp: 17, out: 18, wk: (i, g) => 19 + 2 * (2 * i + g), wv: (i, g) => 20 + 2 * (2 * i + g) };   // write back task by task
  const b2 = (S) => {
    const G = mk(S), st = S.st;
    let o = DEFS;
    // the grid of tasks: KV heads down, requests across
    const W = REQ.map((r, i) => geo(i, 0, 0).W), H = Math.max(...REQ.map((r, i) => geo(i, 0, 0).H));
    const cx = (i) => 196 + W.slice(0, i).reduce((a, b) => a + b + 14, 0), cy = (g) => 220 + g * (H + 10);
    const M = (i, g) => geo(i, cx(i), cy(g));
    // the KV cache of this layer: a K lane and a V lane of 8 pages, each 2 slots × (2 KV heads × d_h)
    const PX = 684, KPY = 318, VPY = 392, px = (p) => PX + p * 60;
    const slot = (Y, p, s, g) => [px(p) + g * DH, Y + s * U];
    o += G(0, T(PX, KPY - 30, 'KV CACHE · THIS LAYER · PAGES OF 2 SLOTS', `class="gh"`)
      + T(PX - 8, KPY + U, 'K', `class="gl" text-anchor="end"`) + T(PX - 8, VPY + U, 'V', `class="gl" text-anchor="end"`));
    for (let p = 0; p < NPAGES; p++) {
      const i = owner(p);
      o += G(0, T(px(p) + DH, KPY - 8, `${p}`, `class="gl" text-anchor="middle" font-size="11"`)
        + T(px(p) + DH, VPY + 2 * U + 14, i < 0 ? 'free' : `r${i}`, `class="gl" text-anchor="middle" font-size="11"`)
        + [KPY, VPY].map((Y) => R(px(p) - 2, Y - 2, 2 * DH + 3, PS * U + 2, `fill="none" stroke="${C.dim}" rx="2"`)
          + `<line x1="${px(p) + DH - 0.5}" x2="${px(p) + DH - 0.5}" y1="${Y}" y2="${Y + PS * U - 2}" stroke="${C.dim}"/>`).join(''));
      if (i < 0) continue;
      const r = REQ[i];
      for (let s = 0; s < PS; s++) {
        const j = r.pages.indexOf(p) * PS + s;
        for (let g = 0; g < NKV; g++) {
          const [kx, ky] = slot(KPY, p, s, g), [vx, vy] = slot(VPY, p, s, g);
          if (j < r.cache) o += G(0, rows(kx, ky, 1, DH, COL.K, 500 + g * 50 + r.k0 + j) + rows(vx, vy, 1, DH, COL.V, 900 + g * 50 + r.k0 + j));
          else if (j < r.ctx) {
            // allocated before the iteration, written by the task (step 4)
            o += G(0, R(kx, ky, DH - 1, U - 2, `fill="none" stroke="${C.slate}" stroke-dasharray="2 2"`), { s1: PS2.wk(i, g) - 1 })
              + G(0, R(vx, vy, DH - 1, U - 2, `fill="none" stroke="${C.slate}" stroke-dasharray="2 2"`), { s1: PS2.wv(i, g) - 1 });
            const m = M(i, g), ck = [m.kx(j), m.KY], cv = [m.ZX, m.vy(j)];
            o += G(PS2.wk(i, g), rows(kx, ky, 1, DH, COL.K, 500 + g * 50 + r.k0 + j), { key: `wk${i}-${g}-${p}`, fly: [PS2.wk(i, g), ...d2(colC(ck), rowC([kx, ky])), -90] })
              + G(PS2.wv(i, g), rows(vx, vy, 1, DH, COL.V, 900 + g * 50 + r.k0 + j), { key: `wv${i}-${g}-${p}`, fly: [PS2.wv(i, g), ...d2(cv, [vx, vy])] });
          }
        }
      }
    }
    const IN = attnIn(G, st, 684, 190, PS2);
    o += IN.s;
    for (let g = 0; g < NKV; g++) o += G(0, T(cx(0) - 12, cy(g) + 20, `KV HEAD ${g + 1}`, `class="gh" text-anchor="end"`)
      + T(cx(0) - 12, cy(g) + 36, `Q heads ${2 * g + 1}, ${2 * g + 2}`, `class="gl" text-anchor="end" font-size="11"`));
    REQ.forEach((r, i) => {
      o += G(0, T(cx(i), cy(0) - 44, reqLabel(i), `class="gl" font-size="12"`)
        + T(cx(i), cy(0) - 30, r.cache ? `${r.cache} cached + ${r.nw} new` : `${r.nw} new`, `class="gl" font-size="11"`)
        + T(cx(i), cy(0) - 16, `page table [${r.pages.join(', ')}]`, `class="gl" font-size="11" fill="${C.cyan}"`));
      for (let g = 0; g < NKV; g++) {
        const m = M(i, g);
        o += task(G, st, i, g, m, {
          q: (t, b) => IN.q(i, g, t, b), k: (t) => IN.k(i, g, t), v: (t) => IN.v(i, g, t),
          kc: (j) => slot(KPY, ...pageOf(i, j), g), vc: (j) => slot(VPY, ...pageOf(i, j), g),
        }, { ps: PS2, H, dim: (i2, g2) => ((st >= 9 && st <= 16) || st >= 19) && ![PS2.ck, PS2.cv, PS2.wk, PS2.wv].some((f) => f(i2, g2) === st) });
      }
    });
    // the pages being copied from: the cached ones of the current task's request, in the K or the V pool
    CACHED.forEach(([i, g]) => [[PS2.ck(i, g), KPY], [PS2.cv(i, g), VPY]].forEach(([sp, Y]) => {
      if (st !== sp) return;
      REQ[i].pages.slice(0, Math.ceil(REQ[i].cache / PS)).forEach((p) => {
        o += G(sp, frame(px(p) + g * DH, Y, DH - 2, PS * U - 2, C.gold, 2));
      });
    }));
    // the pages being written to: those holding the request's new slots
    REQ.forEach((r, i) => [0, 1].forEach((g) => [[PS2.wk(i, g), KPY], [PS2.wv(i, g), VPY]].forEach(([sp, Y]) => {
      if (st !== sp) return;
      const pg = new Set();
      for (let j = r.cache; j < r.ctx; j++) pg.add(pageOf(i, j)[0]);
      pg.forEach((p) => { o += G(sp, frame(px(p) + g * DH, Y, DH - 2, PS * U - 2, C.gold, 2)); });
    })));
    o += attnOut(G, st, 950, 190, (i, g, t, b) => [M(i, g).ZX, M(i, g).qy(2 * t + b)], PS2.out);
    return o;
  };
  const CAP_B2 = [
    'Two inputs: <b>attn_in</b>, this iteration\'s 5 tokens, and the layer\'s <b>KV cache</b>, in pages',
    '<b>Q₁</b> goes to the 3 tasks of KV head 1: each takes its request\'s rows',
    '<b>Q₂</b> too: in each task, Q stacks the 2 query heads token by token',
    '<b>Q₃</b> goes to the 3 tasks of KV head 2',
    '<b>Q₄</b> too: every task now has 2 n<sub>r</sub> rows of Q',
    'The new <b>K₁</b> goes to the 3 tasks of KV head 1: each new key becomes a column of K₁ᵀ',
    'The new <b>V₁</b>: each new value becomes a row of V₁',
    'The new <b>K₂</b>, to the 3 tasks of KV head 2, as columns of K₂ᵀ',
    'The new <b>V₂</b>, as rows of V₂',
    'Task (r0, KV 1) gathers its <b>4 cached keys</b> through page table [5, 2, 7]: KV head 1\'s half of pages 5 and 2',
    'Task (r0, KV 1): its <b>4 cached values</b>, from the same slots of the V pages',
    'Task (r0, KV 2): the same 4 cached keys, <b>KV head 2\'s half</b> of pages 5 and 2',
    'Task (r0, KV 2): its 4 cached values',
    'Task (r2, KV 1): its <b>2 cached keys</b>, page 3 (r1 is a new prompt: nothing cached)',
    'Task (r2, KV 1): its 2 cached values, page 3',
    'Task (r2, KV 2): KV head 2\'s half of page 3, keys',
    'Task (r2, KV 2): and values',
    '<b>A</b> = softmax(Q Kᵀ) (Q to the left, Kᵀ above), Z = A V (A to the left, V above). Empty cells: future keys',
    'Each task writes its <b>Z</b> to its block of attn_out: its request\'s rows × its 2 query heads',
    'Task (r0, KV 1) writes its new <b>key</b> to KV head 1\'s half of page 7, slot 0, allocated before the iteration',
    'Task (r0, KV 1): its new <b>value</b>, the same slot of the V pages',
    'Task (r0, KV 2) writes its new <b>key</b> to KV head 2\'s half of page 7, slot 0',
    'Task (r0, KV 2): its new <b>value</b>, the same slot of the V pages',
    'Task (r1, KV 1) writes its new <b>keys</b> to KV head 1\'s half of pages 0 and 4',
    'Task (r1, KV 1): its new <b>values</b>, the same slots of the V pages',
    'Task (r1, KV 2) writes its new <b>keys</b> to KV head 2\'s half of pages 0 and 4',
    'Task (r1, KV 2): its new <b>values</b>, the same slots of the V pages',
    'Task (r2, KV 1) writes its new <b>key</b> to KV head 1\'s half of page 6, slot 0',
    'Task (r2, KV 1): its new <b>value</b>, the same slot of the V pages',
    'Task (r2, KV 2) writes its new <b>key</b> to KV head 2\'s half of page 6, slot 0',
    'Task (r2, KV 2): its new <b>value</b>, the same slot of the V pages',
];

  // the blocks moved at this step travel along a curve, one per block (the groups sharing a data-key),
  // and an arrow grows behind each, its head just behind the block. Jumping to a step: the arrows only.
  const bez = (P, t) => {                                           // a point of the cubic P, and its split
    const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const a = L(P[0], P[1]), b = L(P[1], P[2]), c = L(P[2], P[3]), d = L(a, b), e = L(b, c), f = L(d, e);
    return { pt: f, left: [P[0], a, d, f], right: [f, e, c, P[3]] };
  };
  const seg = (P, t0, t1) => {                                      // the part of P between t0 and t1
    const l = bez(P, t1).left;
    return t1 > 0 ? bez(l, t0 / t1).right : [P[0], P[0], P[0], P[0]];
  };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let anim = 0;
  const arrows = (svg, play) => {
    const id = ++anim, NS = 'http://www.w3.org/2000/svg';
    const blocks = new Map();
    svg.querySelectorAll('g[data-from]').forEach((g, n) => {
      const [dx, dy, rot] = g.dataset.from.split(',').map(Number), b = g.getBBox();
      const c = [b.x + b.width / 2, b.y + b.height / 2], k = g.dataset.key || `#${n}`;
      g.classList.remove('fly');
      g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
      if (!blocks.has(k)) blocks.set(k, []);
      blocks.get(k).push({ g, c, b, s: [c[0] + dx, c[1] + dy], rot });
    });
    const layer = document.createElementNS(NS, 'g');
    layer.innerHTML = `<defs><marker id="gq-ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="${C.cyan}"/></marker></defs>`;
    svg.appendChild(layer);                                           // on top: the arrows stop short of the blocks
    const items = [];
    blocks.forEach((ms) => {
      const mean = (f) => [0, 1].map((a) => ms.reduce((acc, m) => acc + f(m)[a], 0) / ms.length);
      const S = mean((m) => m.s), D = mean((m) => m.c), dx = D[0] - S[0], dy = D[1] - S[1];
      const len = Math.hypot(dx, dy);
      if (len < 20) return;
      // horizontal tangents for mostly sideways moves, vertical ones otherwise
      const side = Math.abs(dx) >= Math.abs(dy) * 0.5;
      const P = side
        ? [S, [S[0] + dx * 0.55, S[1]], [D[0] - dx * 0.55, D[1]], D]
        : [S, [S[0], S[1] + dy * 0.55], [D[0], D[1] - dy * 0.55], D];
      // the block's half extent along the curve's ends (swapped at the source if it arrives rotated)
      const x0 = Math.min(...ms.map((m) => m.b.x)), x1 = Math.max(...ms.map((m) => m.b.x + m.b.width));
      const y0 = Math.min(...ms.map((m) => m.b.y)), y1 = Math.max(...ms.map((m) => m.b.y + m.b.height));
      const hw = (x1 - x0) / 2, hh = (y1 - y0) / 2, turned = ms[0].rot % 180 !== 0;
      const endGap = (side ? hw : hh) + 5, startGap = (side !== turned ? hw : hh) + 4;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', C.cyan);
      path.setAttribute('stroke-width', '1.4'); path.setAttribute('stroke-opacity', '.8');
      path.setAttribute('marker-end', 'url(#gq-ah)');
      layer.appendChild(path);
      items.push({ ms, P, D, path, t0: startGap / len, back: endGap / len });
    });
    const draw = (e) => items.forEach(({ ms, P, D, path, t0, back }) => {
      const at = bez(P, e).pt, off = [at[0] - D[0], at[1] - D[1]];
      ms.forEach((m) => { m.g.style.transform = e < 1 ? `translate(${off[0]}px, ${off[1]}px) rotate(${m.rot * (1 - e)}deg)` : ''; });
      const t1 = Math.min(e, 1) - back;
      if (t1 <= t0) { path.setAttribute('d', ''); return; }
      const q = seg(P, t0, t1);
      path.setAttribute('d', `M${q[0]} C${q[1]} ${q[2]} ${q[3]}`);
    });
    if (!play || matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(1); return; }
    const T0 = performance.now(), DUR = 1100;
    draw(0);
    const tick = (now) => {
      if (id !== anim) return;
      const t = Math.min((now - T0) / DUR, 1);
      draw(ease(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const FIG = { tasks: [b2, CAP_B2] };
  document.querySelectorAll('div.mk[data-gq]').forEach((root) => {
    const [fig, caps] = FIG[root.dataset.gq];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector(`[data-gq-cap="${root.dataset.gq}"]`);
    let prev = null;
    steps(root, caps.length - 1, (st) => {
      const play = st !== null && prev !== null && st === prev + 1;
      if (st === null) st = caps.length - 1;
      prev = st;
      svg.innerHTML = fig({ st, play });
      cap.innerHTML = caps[st];
      arrows(svg, play);
    });
  });
})();
