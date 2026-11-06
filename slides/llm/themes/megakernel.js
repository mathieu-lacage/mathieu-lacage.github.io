// « Megakernels »: inside one linear task of the Mirage persistent kernel
// (mirage/persistent_kernel/tasks/blackwell/linear_sm100_mpk.cuh, SM100).
//
// Each figure is a <div class="mk" data-mk="…"> drawn here as an SVG over the whole slide, in
// slide coordinates (1280 × 720):
// The layer is Qwen3-1.7B's gate + up projection at batch 8, as Mirage's demo/qwen3 runs it on
// B200: C (12288 × 8) = A (12288 × 2048) · B (2048 × 8), 96 tasks of 128 output features.
//   layer  the whole layer, cut in 96 tasks of 128 rows of A and C: the 96 tasks sweep K in
//          parallel, each at its own pace, then each stores its block of C. Step 1 starts them,
//          step 2 auto-plays the rest.
//   ring   task 5's 32 K-strips of 64 through the 8-slot SMEM ring: the TMA warp (5) writes
//          at wr = smem_wr_buffer, the MMA warp (4) reads at rd = smem_rd_buffer and issues
//          4 × tcgen05.mma per strip, each adding into the TMEM accumulator (the C heatmap);
//          strips 0–2 step by step, 3–31 auto-play. Then A, B and the ring fade out, C slides
//          to the left edge and the epilogue (warps 0–3) scrolls in from the right, C magnified:
//          TMEM → registers (→ bf16) → SMEM C stage → TMA store into task 5's slice of out,
//          in 4 steps.
// Every step is an action: a state change plus the animation that leads to it. Stepping
// forward plays the animation; any other jump (back, overview, PDF) draws the state directly.
// Uses steps.js. Styles: themes/megakernel.css.
(() => {
  const C = { slide: '#0f1829', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', blue: '#4aa8ff',
    gold: '#f5c451', cyan: '#8fc5fa', green: '#7cc47a', magenta: '#d97fd0', hatch: '#1d2c44' };
  const NS = 'http://www.w3.org/2000/svg';
  const el = (p, tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    p.appendChild(e);
    return e;
  };
  // a curly brace from (x1,y1) to (x2,y2), bulging by w to the left of that direction (themes/braces.js)
  const curly = (x1, y1, x2, y2, w, q = 0.6) => {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(0.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(0.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(0.75, 1 - q)} T${tip}`;
  };
  // a brace on one side of the span a..b of the edge at coordinate e, label outside (as in themes/prefill.js)
  const brace = (p, side, a, b, e, text, W = 14) => {
    const G = 3, st = { fill: 'none', stroke: C.cyan, 'stroke-width': 1.5 };
    const t = (x, y, anchor) => el(p, 'text', { x, y, class: 'bl', 'text-anchor': anchor }, text);
    if (side === 'left') { el(p, 'path', { d: curly(e - G, a, e - G, b, W - 2), ...st }); t(e - G - W - 6, (a + b) / 2 + 7, 'end'); }
    else if (side === 'right') { el(p, 'path', { d: curly(e + G, b, e + G, a, W - 2), ...st }); t(e + G + W + 6, (a + b) / 2 + 7, 'start'); }
    else if (side === 'top') { el(p, 'path', { d: curly(b, e - G, a, e - G, W - 2), ...st }); t((a + b) / 2, e - G - W - 4, 'middle'); }
    else { el(p, 'path', { d: curly(a, e + G, b, e + G, W - 2), ...st }); t((a + b) / 2, e + G + W + 18, 'middle'); }
  };
  const name = (p, x, y, text) => el(p, 'text', { x, y, class: 'nm' }, text);

  /* ---------- the layer: 96 tasks in parallel ---------- */
  const layer = (svg) => {
    const NTASK = 96, NK = 32, NSLOT = 8, SW = 4, RH = 3, EPI = 3, RATE = 7, DONE = '#2b5a3a';
    // K drawn the same length in A and B; M squeezed 2.5 × (to scale, A would be 128 × 768)
    const K = NK * SW;
    const B = { x: 690, y: 150, w: 40, h: K };
    const A = { x: B.x - 38 - K, y: B.y + K + 14, w: K, h: NTASK * RH };
    const CB = { x: B.x, y: A.y, w: 40, h: A.h };

    const defs = el(svg, 'defs');
    const wl = el(defs, 'pattern', { id: 'mk-layer-wl', width: 10, height: 5, patternUnits: 'userSpaceOnUse' });
    el(wl, 'rect', { width: 10, height: 2, fill: C.dim });
    el(svg, 'rect', { x: A.x, y: A.y, width: A.w, height: A.h, fill: 'url(#mk-layer-wl)', stroke: C.blue, 'stroke-width': 2 });
    el(svg, 'rect', { x: B.x, y: B.y, width: B.w, height: B.h, fill: 'url(#mk-layer-wl)', stroke: C.blue, 'stroke-width': 2 });
    el(svg, 'rect', { x: CB.x, y: CB.y, width: CB.w, height: CB.h, fill: C.slide, stroke: C.blue, 'stroke-width': 2 });
    // per task: in A the consumed strips (green), the strips in its ring (faint blue), the one under the tensor core (gold)
    const rowA = [], cRows = [], bStrips = [];
    for (let i = 0; i < NTASK; i++) {
      const y = A.y + i * RH;
      rowA.push({
        done: el(svg, 'rect', { x: A.x, y, height: RH, width: 0, fill: DONE }),
        ring: el(svg, 'rect', { x: A.x, y, height: RH, width: 0, fill: C.blue, opacity: 0.45 }),
        cur: el(svg, 'rect', { x: A.x, y, height: RH, width: SW, fill: C.gold, opacity: 0 }),
      });
      const cells = [];
      for (let c = 0; c < 8; c++) cells.push(el(svg, 'rect', { x: CB.x + c * 5, y, width: 5, height: RH, fill: C.gold, opacity: 0 }));
      cRows.push({ cells, solid: el(svg, 'rect', { x: CB.x, y, width: CB.w, height: RH, fill: C.gold, opacity: 0 }) });
    }
    for (let k = 0; k < NK; k++) bStrips.push(el(svg, 'rect', { x: B.x, y: B.y + k * SW, width: B.w, height: SW, opacity: 0 }));
    name(svg, A.x + A.w / 2, A.y + A.h / 2, 'A');
    name(svg, B.x + B.w / 2, B.y + B.h / 2, 'B');
    name(svg, CB.x + CB.w / 2, CB.y + CB.h / 2, 'C');
    brace(svg, 'left', A.y, A.y + A.h, A.x, 'M = 12288');
    brace(svg, 'bottom', A.x, A.x + A.w, A.y + A.h, 'K = 2048');
    brace(svg, 'left', B.y, B.y + B.h, B.x, 'K = 2048');
    brace(svg, 'top', B.x, B.x + B.w, B.y, 'N = 8');
    brace(svg, 'bottom', CB.x, CB.x + CB.w, CB.y + CB.h, 'N = 8');
    el(svg, 'text', { x: CB.x + CB.w + 14, y: CB.y + 12, fill: C.slate, 'font-size': 15 }, 'task 0');
    el(svg, 'text', { x: CB.x + CB.w + 14, y: CB.y + A.h / 2 + 6, fill: C.slate, 'font-size': 15 }, '96 tasks × 128 rows');
    el(svg, 'text', { x: CB.x + CB.w + 14, y: CB.y + A.h, fill: C.slate, 'font-size': 15 }, 'task 95');

    // memory-bound tasks: each consumes a strip as soon as it lands, its TMA 8 strips ahead;
    // each starts a little late and runs at its own pace (dispatch, HBM contention)
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const tasks = Array.from({ length: NTASK }, () => ({ start: rnd() * 4, v: 0.88 + 0.14 * rnd() }));
    const T_END = Math.max(...tasks.map((t) => t.start + NK / t.v + EPI)) + 1;
    const at = (i, t) => {
      const tk = tasks[i];
      if (t < 0) return { phase: 'idle' };
      const L = Math.max(0, (t - tk.start) * tk.v);
      if (L >= NK) return { phase: t - tk.start - NK / tk.v < EPI ? 'epi' : 'stored', cons: NK, issued: NK };
      const cons = Math.floor(L);
      return { phase: 'run', cons, issued: Math.min(cons + NSLOT, NK) };
    };
    const render = (t) => {
      const use = new Array(NK).fill(0), curK = new Set();
      for (let i = 0; i < NTASK; i++) {
        const s = at(i, t), r = rowA[i], c = cRows[i];
        if (s.phase === 'idle') {
          r.done.setAttribute('width', 0); r.ring.setAttribute('width', 0); r.cur.setAttribute('opacity', 0);
        } else {
          r.done.setAttribute('width', s.cons * SW);
          r.ring.setAttribute('x', A.x + s.cons * SW); r.ring.setAttribute('width', (s.issued - s.cons) * SW);
          r.cur.setAttribute('opacity', s.phase === 'run' ? 1 : 0);
          if (s.phase === 'run') { r.cur.setAttribute('x', A.x + s.cons * SW); curK.add(s.cons); }
          for (let k = s.cons; k < s.issued; k++) use[k]++;
        }
        // C: the accumulator warms up with the strips consumed, then the epilogue stores the block
        const fill = s.phase === 'run' ? s.cons / NK : s.phase === 'idle' ? 0 : 1;
        c.cells.forEach((e, j) => e.setAttribute('opacity', fill ? (fill * (0.45 + 0.1 * ((j * 7 + i * 3) % 5))).toFixed(2) : 0));
        c.solid.setAttribute('opacity', s.phase === 'stored' ? 0.9 : s.phase === 'epi' ? 0.5 : 0);
      }
      // B: the strips some ring holds, brighter where several hold the same strip; gold under a tensor core
      bStrips.forEach((e, k) => {
        if (curK.has(k)) { e.setAttribute('fill', C.gold); e.setAttribute('opacity', 1); }
        else { e.setAttribute('fill', C.blue); e.setAttribute('opacity', use[k] ? (0.2 + 0.05 * use[k]).toFixed(2) : 0); }
      });
    };

    const T = [-1, 0.2, T_END];
    let raf = 0, shown = 0;
    const onStep = (st) => {
      cancelAnimationFrame(raf);
      if (st === null) st = T.length - 1;                    // PDF: the final state
      const from = shown;
      shown = st;
      if (st !== 2 || from !== 1) { render(T[st]); return; }
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(T[1] + (now - t0) / 1000 * RATE, T_END);
        render(t);
        if (t < T_END) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    return { n: T.length - 1, onStep };
  };

  /* ---------- the epilogue of one task (warps 0–3), in slide coordinates ---------- */
  // C (the TMEM accumulator: 128 lanes × 16 columns, 8 of them padding) magnified ×3.
  // tcgen05.ld into registers, warp w reaching lanes 32w…32w+31 only, thread t = row t; → bf16;
  // st.shared into the SMEM C stage (128 × 16 bf16); TMA store into task 5's slice of
  // out (12288 × 8), every buffer drawn like TMEM. Gate + up has no residual: the
  // plain linear_sm100 task (NOBIAS), one tile per task, so one TMEM stage and one C stage.
  const epilogue = (outer) => {
    const NTASK = 96, TASK = 5;
    const CI = { x: 70, y: 335, w: 36, h: 50.4 };          // C, at its size on the ring slide
    // every buffer is drawn like TMEM: 128 rows (features) × 16 columns (tokens, 8 of them padding)
    const COL = (x) => ({ x, y: 160, w: 96, h: 384 });
    const TM = COL(170), R32 = COL(330), R16 = COL(490), SM = COL(680);
    const GAP = 6, BH = (TM.h - 3 * GAP) / 4;
    const OUT = { x: 920, y: 160, w: 48, h: 432 };         // 12288 × 8: 96 slices of 128 rows
    const slice = [OUT.x, OUT.y + TASK * OUT.h / NTASK, OUT.w, OUT.h / NTASK];
    const tmBand = (w) => [TM.x, TM.y + w * TM.h / 4, TM.w / 2, TM.h / 4];
    const regBand = (R, w) => [R.x, R.y + w * (BH + GAP), R.w / 2, BH];
    const smBand = (w) => [SM.x, SM.y + w * SM.h / 4, SM.w / 2, SM.h / 4];
    const rect = (p, x, y, w, h, a = {}) => el(p, 'rect', { x, y, width: w, height: h, ...a });
    const lab = (p, x, y, s, anchor = 'start', size = 17, fill = C.slate) => el(p, 'text', { x, y, fill, 'font-size': size, 'text-anchor': anchor }, s);
    const op = (p, x, y, s, rot) => el(p, 'text', { x, y, fill: C.slate, 'font-size': 15, class: 'mono', 'text-anchor': rot ? 'middle' : 'start',
      ...(rot ? { transform: `rotate(-90 ${x} ${y})` } : {}) }, s);
    const arrow = (p, pts) => el(p, 'path', { d: 'M' + pts.map((q) => q.join(',')).join(' L'), fill: 'none', stroke: C.slate, 'stroke-width': 2, 'marker-end': 'url(#mk-ar)' });
    const dash = (p, a, b) => el(p, 'line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.slate, 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0.7 });
    let seed = 3;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const HEAT = Array.from({ length: 4096 }, () => 0.45 + 0.5 * rnd());
    const heat = (p, x, y, w, h, rows, cols, idx, fill) => {
      const g = el(p, 'g', { fill });
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
        rect(g, x + c * w / cols, y + r * h / rows, w / cols + 0.3, h / rows + 0.3, { 'fill-opacity': HEAT[idx(r, c) % HEAT.length].toFixed(2) });
      return g;
    };

    const defs = el(outer, 'defs');
    const mk = el(defs, 'marker', { id: 'mk-ar', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    el(mk, 'path', { d: 'M0 0L10 5L0 10z', fill: C.slate });
    const hp = el(defs, 'pattern', { id: 'mk-pad', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    rect(hp, 0, 0, 5, 5, { fill: '#141a25' });
    el(hp, 'line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: C.dim, 'stroke-width': 2 });
    const g = el(outer, 'g');
    // C as it ends the ring slide, magnified into TMEM
    rect(g, CI.x, CI.y, CI.w, CI.h, { fill: C.slide, stroke: C.blue, 'stroke-width': 2 });
    const ci = heat(g, CI.x, CI.y, CI.w, CI.h, 8, 8, (r, c) => r * 8 + c, C.gold);
    name(g, CI.x + CI.w / 2, CI.y + CI.h / 2, 'C');
    dash(g, [CI.x + CI.w, CI.y], [TM.x, TM.y]); dash(g, [CI.x + CI.w, CI.y + CI.h], [TM.x, TM.y + TM.h]);

    // TMEM
    lab(g, TM.x, 146, 'TMEM, fp32');
    rect(g, TM.x + TM.w / 2, TM.y, TM.w / 2, TM.h, { fill: 'url(#mk-pad)' });
    const tm = heat(g, TM.x, TM.y, TM.w / 2, TM.h, 128, 8, (r, c) => r * 8 + c, C.gold);
    rect(g, TM.x, TM.y, TM.w, TM.h, { fill: 'none', stroke: C.blue, 'stroke-width': 2 });
    for (let w = 1; w < 4; w++) el(g, 'line', { x1: TM.x, x2: TM.x + TM.w, y1: TM.y + w * TM.h / 4, y2: TM.y + w * TM.h / 4, stroke: C.slide, 'stroke-width': 2 });
    ['w0', 'w1', 'w2', 'w3'].forEach((s, w) => lab(g, TM.x - 10, TM.y + (w + 0.5) * TM.h / 4 + 6, s, 'end', 15));
    brace(g, 'bottom', TM.x, TM.x + TM.w / 2, TM.y + TM.h, '8', 10);
    lab(g, TM.x + TM.w * 0.75, TM.y + TM.h + 27, 'pad', 'middle', 15);
    const status = op(g, TM.x, 604, '');
    // registers: thread t holds row t, 16 values; the bf16 copy is a second, separate set
    const regs = (R, title, note, col) => {
      lab(g, R.x, 146, title);
      const bands = [0, 1, 2, 3].map((w) => {
        const [x, y, , h] = regBand(R, w);
        rect(g, x, y, R.w, h, { fill: '#141a25', stroke: C.dim, 'stroke-dasharray': '3 3' });
        rect(g, x + R.w / 2, y, R.w / 2, h, { fill: 'url(#mk-pad)' });
        return heat(g, x, y, R.w / 2, h, 32, 8, (r, c) => (w * 32 + r) * 8 + c, col);
      });
      lab(g, R.x, R.y + R.h + 27, note, 'start', 15);
      return bands;
    };
    const r32 = regs(R32, 'registers, fp32', '16 × 4 B / thread', C.gold);
    const r16 = regs(R16, 'registers, bf16', '16 × 2 B / thread', C.green);
    const mid = (a, b) => (a.x + a.w + b.x) / 2;
    arrow(g, [[TM.x + TM.w + 6, 352], [R32.x - 8, 352]]); op(g, mid(TM, R32) + 5, 290, 'tcgen05.ld', true);
    arrow(g, [[R32.x + R32.w + 6, 352], [R16.x - 8, 352]]); op(g, mid(R32, R16) + 5, 290, 'fp32 → bf16', true);
    // SMEM C: the same 128 × 16 tile, bf16
    lab(g, SM.x, 146, 'SMEM C, bf16');
    rect(g, SM.x, SM.y, SM.w, SM.h, { fill: '#141a25', stroke: C.dim, 'stroke-dasharray': '3 3' });
    rect(g, SM.x + SM.w / 2, SM.y, SM.w / 2, SM.h, { fill: 'url(#mk-pad)' });
    const sm = heat(g, SM.x, SM.y, SM.w / 2, SM.h, 128, 8, (r, c) => r * 8 + c, C.green);
    for (let w = 1; w < 4; w++) el(g, 'line', { x1: SM.x, x2: SM.x + SM.w, y1: SM.y + w * SM.h / 4, y2: SM.y + w * SM.h / 4, stroke: C.slide, 'stroke-width': 1.5 });
    brace(g, 'bottom', SM.x, SM.x + SM.w / 2, SM.y + SM.h, '8', 10);
    lab(g, SM.x + SM.w * 0.75, SM.y + SM.h + 27, 'pad', 'middle', 15);
    arrow(g, [[R16.x + R16.w + 6, 352], [SM.x - 8, 352]]); op(g, mid(R16, SM) + 5, 290, 'st.shared', true);
    // out in GMEM: 12288 rows, 96 slices of 128, task 5's outlined in gold
    lab(g, OUT.x, 146, 'out (GMEM), bf16');
    rect(g, OUT.x, OUT.y, OUT.w, OUT.h, { fill: '#141a25', stroke: C.blue, 'stroke-width': 2 });
    for (let i = 1; i < NTASK; i++) { const y = OUT.y + i * OUT.h / NTASK; el(g, 'line', { x1: OUT.x, x2: OUT.x + OUT.w, y1: y, y2: y, stroke: C.dim, 'stroke-width': 0.6, opacity: 0.6 }); }
    const [ox, oy, ow, oh] = slice;
    const out = heat(g, ox, oy, ow, oh, 1, 8, (r, c) => c, C.green);
    rect(g, ox - 1, oy - 1, ow + 2, oh + 2, { fill: 'none', stroke: C.gold, 'stroke-width': 2.5 });
    brace(g, 'right', OUT.y, OUT.y + OUT.h, OUT.x + OUT.w, '12288', 10);
    brace(g, 'bottom', OUT.x, OUT.x + OUT.w, OUT.y + OUT.h, '8', 10);
    lab(g, OUT.x + OUT.w + 16, oy + oh / 2 + 6, `task ${TASK}: 128 rows`, 'start', 15, C.gold);
    const xe = OUT.x - 40;
    arrow(g, [[SM.x + SM.w + 6, 352], [xe, 352], [xe, oy + oh / 2], [OUT.x - 8, oy + oh / 2]]);
    op(g, SM.x + SM.w + 10, 380, 'TMA store'); op(g, SM.x + SM.w + 10, 400, '1 thread');
    const gFly = el(g, 'g');

    // e = 0 (accumulator in TMEM), 1 fp32 registers, 2 bf16 registers, 3 SMEM, 4 stored
    const render = (e) => {
      tm.setAttribute('opacity', e === 0 ? 1 : 0.12);
      ci.setAttribute('opacity', e === 0 ? 1 : 0.12);
      r32.forEach((b) => b.setAttribute('opacity', e < 1 ? 0 : e === 1 ? 1 : 0.3));
      r16.forEach((b) => b.setAttribute('opacity', e < 2 ? 0 : e === 2 ? 1 : 0.3));
      sm.setAttribute('opacity', e >= 3 ? 1 : 0);
      out.setAttribute('opacity', e >= 4 ? 1 : 0);
      status.textContent = e === 0 ? 'acc_full: 128 MMAs done' : 'acc_empty: TMEM free';
      status.setAttribute('fill', e >= 1 ? C.green : C.slate);
    };
    const ghost = (from, to, col, dur, delay = 0) => {
      const r = rect(gFly, 0, 0, 1, 1, { fill: col, opacity: 0 });
      const tf = ([x, y, w, h]) => `translate(${x}px, ${y}px) scale(${w}, ${h})`;
      r.animate([{ transform: tf(from), opacity: 0.9 }, { transform: tf(to), opacity: 0.9 }], { duration: dur, delay, easing: 'ease-in-out', fill: 'both' })
        .onfinish = () => r.remove();
    };
    const W4 = [0, 1, 2, 3];
    const ANIM = {
      1: () => W4.forEach((w) => ghost(tmBand(w), regBand(R32, w), C.gold, 700, w * 60)),
      2: () => W4.forEach((w) => ghost(regBand(R32, w), regBand(R16, w), C.green, 700, w * 60)),
      3: () => W4.forEach((w) => ghost(regBand(R16, w), smBand(w), C.green, 700, w * 60)),
      4: () => ghost([SM.x, SM.y, SM.w / 2, SM.h], slice, C.green, 900),
    };
    const N = 4, DELAY = 950;
    let shown = 0, timer = null;
    const onStep = (st) => {
      clearTimeout(timer); gFly.innerHTML = '';
      if (st === null) st = N;                                 // PDF: the final state
      const from = shown;
      shown = st;
      if (st === from + 1) { render(from); ANIM[st](); timer = setTimeout(() => render(st), DELAY); }
      else render(st);
    };
    return { n: N, onStep };
  };

  /* ---------- the SMEM ring, 4 MMAs per strip ---------- */
  const ring = (fig) => {
    const NT = 32, NSLOT = 8, NMMA = 4, MANUAL = 3, TICK = 260, SW = 12.25;
    const A = { x: 110, y: 556, w: NT * SW, h: 56 }, B = { x: 560, y: 150, w: 40, h: NT * SW }, CB = { x: 560, y: 556, w: 40, h: 56 };
    // ring slots at 0.625 px / element: A part 128×64 = 4 bands of 128×16, B part 64×8 = 4 bands of 16×8
    const FX = 40, FY = 162, PITCH = 60, SLW = 56, SLH = 92;
    const slotX = (s) => FX + s * PITCH;
    const partA = (s) => [slotX(s) + 24, FY + 46, 40, 80];
    const partB = (s) => [slotX(s) + 50.5, FY + 26, 5, 40];
    const bandA = (s, j) => [slotX(s) + 9 + 10 * j, FY + 46, 10, 80];
    const bandB = (s, j) => [slotX(s) + 50.5, FY + 11 + 10 * j, 5, 10];
    // one tcgen05.mma at 1.25 px / element, in the C = A × B corner layout
    const ST_A = [310, 426, 20, 160], ST_B = [345, 328, 10, 20], ST_C = [345, 426, 10, 160];
    const CBOX = [CB.x + 20, CB.y + 28, 40, 56];
    const svg = el(fig, 'g'), gC = el(fig, 'g');

    const defs = el(svg, 'defs');
    const pat = el(defs, 'pattern', { id: 'mk-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    el(pat, 'rect', { width: 6, height: 6, fill: C.hatch });
    el(pat, 'line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: C.blue, 'stroke-width': 2 });

    // matrices in GMEM (striped like the weights of the earlier decks): A = task 5's weight slice,
    // B = the input; C = the output block, its heatmap the TMEM accumulator
    const wl = el(defs, 'pattern', { id: 'mk-wl', width: 10, height: 5, patternUnits: 'userSpaceOnUse' });
    el(wl, 'rect', { width: 10, height: 2, fill: C.dim });
    el(svg, 'rect', { x: A.x, y: A.y, width: A.w, height: A.h, fill: 'url(#mk-wl)', stroke: C.blue, 'stroke-width': 2 });
    el(svg, 'rect', { x: B.x, y: B.y, width: B.w, height: B.h, fill: 'url(#mk-wl)', stroke: C.blue, 'stroke-width': 2 });
    el(gC, 'rect', { x: CB.x, y: CB.y, width: CB.w, height: CB.h, fill: C.slide, stroke: C.blue, 'stroke-width': 2 });
    const tilesA = [], tilesB = [];
    const gA = el(svg, 'g'), gB = el(svg, 'g');
    for (let k = 0; k < NT; k++) {
      tilesA.push(el(gA, 'rect', { x: A.x + k * SW, y: A.y, width: SW, height: A.h, opacity: 0 }));
      tilesB.push(el(gB, 'rect', { x: B.x, y: B.y + k * SW, width: B.w, height: SW, opacity: 0 }));
    }
    const heat = el(gC, 'g');
    const heatCells = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++)
      heatCells.push(el(heat, 'rect', { x: CB.x + c * 5, y: CB.y + r * 7, width: 5, height: 7, fill: C.gold, opacity: 0 }));
    name(svg, A.x + A.w / 2, A.y + A.h / 2, 'A');
    name(svg, B.x + B.w / 2, B.y + B.h / 2, 'B');
    name(gC, CB.x + CB.w / 2, CB.y + CB.h / 2, 'C');
    brace(svg, 'left', A.y, A.y + A.h, A.x, 'M = 128');
    brace(svg, 'bottom', A.x, A.x + A.w, A.y + A.h, 'K = 2048');
    brace(svg, 'left', B.y, B.y + B.h, B.x, 'K = 2048');
    brace(svg, 'top', B.x, B.x + B.w, B.y, 'N = 8');
    brace(svg, 'bottom', CB.x, CB.x + CB.w, CB.y + CB.h, 'N = 8');
    el(svg, 'text', { x: CB.x + CB.w + 14, y: CB.y + CB.h / 2 + 6, fill: C.slate, 'font-size': 18 }, 'TMEM accumulator');

    // the tensor-core stage
    el(svg, 'rect', { x: 230, y: 290, width: 220, height: 256, rx: 10, fill: 'none', stroke: C.dim, 'stroke-dasharray': '6 5' });
    el(svg, 'text', { x: 242, y: 314, fill: C.slate, 'font-size': 17, class: 'mono' }, 'tcgen05.mma');
    const gStage = el(svg, 'g');
    const gStageBr = el(svg, 'g', { opacity: 0 });
    brace(gStageBr, 'left', 346, 506, 300, '128', 10);
    brace(gStageBr, 'bottom', 300, 320, 506, '16', 10);
    brace(gStageBr, 'right', 318, 338, 350, '16', 10);
    brace(gStageBr, 'bottom', 340, 350, 506, '8', 10);
    brace(gStageBr, 'right', 346, 506, 350, '128', 10);
    const gRing = el(svg, 'g');
    const gFly = el(fig, 'g');

    // ---- state: slots (empty / loading = in flight / full = landed / reading), cursors, MMA progress ----
    const S0 = () => ({ slots: Array.from({ length: NSLOT }, () => ({ st: 'empty', k: -1 })),
      wr: 0, rd: 0, acc: 0, mj: 0, stageJ: -1, out: false, litT: [], litM: -1 });
    const clone = (s) => JSON.parse(JSON.stringify(s));
    const opIssue = (S, k) => { S.slots[k % NSLOT] = { st: 'loading', k }; S.wr = k + 1; };
    const opLand = (S, k) => { S.slots[k % NSLOT].st = 'full'; };
    const opRead = (S, k) => { S.slots[k % NSLOT].st = 'reading'; S.litM = k; S.litT = []; S.mj = 0; S.stageJ = -1; };
    const opMma = (S, j) => { S.mj = j + 1; S.acc++; S.stageJ = j; S.out = false; };
    const opRelease = (S, k) => { S.slots[k % NSLOT] = { st: 'empty', k: -1 }; S.rd = k + 1; S.litM = -1; S.mj = 0; S.stageJ = -1; };

    const rect = ([cx, cy, w, h], attrs) => `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" ${attrs}/>`;
    const renderRing = (S) => {
      let h = '';
      for (let i = 0; i < NSLOT; i++) {
        const sl = S.slots[i], x = slotX(i);
        h += `<rect x="${x}" y="${FY}" width="${SLW}" height="${SLH}" rx="4" fill="#141a25" stroke="${C.dim}" stroke-dasharray="3 3"/>`;
        if (sl.st !== 'empty') {
          const fl = sl.st === 'loading';
          for (let j = 0; j < NMMA; j++) {
            // a band stays landed-blue until its MMA takes it, then dims to gold (in SMEM until the slot is released)
            const [fill, op] = fl ? ['url(#mk-hatch)', 0.95] : sl.st === 'reading' && j < S.mj ? [C.gold, 0.3] : [C.blue, 0.95];
            const a = `fill="${fill}" opacity="${op}" stroke="${fl ? C.blue : C.slide}" stroke-width="${fl ? 1 : 0.8}"`;
            h += rect(bandA(i, j), a) + rect(bandB(i, j), a);
          }
          const [ax, ay] = partA(i);
          h += `<text x="${ax}" y="${ay + 5}" font-size="15" font-weight="700" text-anchor="middle" fill="${fl ? '#cfe3ff' : C.slide}"` +
            ` paint-order="stroke" stroke="${fl ? C.hatch : C.blue}" stroke-width="3">k=${sl.k}</text>`;
        }
        h += `<text x="${x + 50}" y="${FY + SLH - 6}" font-size="14" fill="${C.slate}" text-anchor="middle">${i}</text>`;
      }
      const cur = (k, col, down, lab) => {
        if (k >= NT) return '';
        const x = slotX(k % NSLOT) + SLW / 2, apex = down ? FY - 3 : FY + SLH + 4;
        return `<path d="M${x} ${apex} l-7 ${down ? -10 : 10} h14 z" fill="${col}"/>` +
          `<text x="${x}" y="${down ? apex - 15 : apex + 30}" font-size="17" font-weight="600" fill="${col}" text-anchor="middle">${lab}</text>`;
      };
      h += cur(S.wr, C.blue, true, `wr k=${S.wr}`) + cur(S.rd, C.gold, false, `rd k=${S.rd}`);
      gRing.innerHTML = h;
    };
    const renderStage = (S) => {
      const on = S.stageJ >= 0, g = `fill="${C.gold}" opacity=".95"`;
      gStage.innerHTML = on ? rect(ST_A, g) + rect(ST_B, g) +
        rect(ST_C, S.out ? g : `fill="none" stroke="${C.gold}" stroke-dasharray="2 2" opacity=".6"`) : '';
      gStageBr.setAttribute('opacity', on ? 1 : 0);
    };
    const renderLit = (S) => {
      const inRing = new Set(S.slots.filter((o) => o.st === 'loading' || o.st === 'full').map((o) => o.k));
      for (let k = 0; k < NT; k++) {
        const [col, op] = k === S.litM ? [C.gold, 1] : S.litT.includes(k) ? [C.blue, 1] : inRing.has(k) ? [C.blue, 0.4] : [null, 0];
        for (const t of [tilesA[k], tilesB[k]]) { t.setAttribute('opacity', op); if (col) t.setAttribute('fill', col); }
      }
    };
    const render = (S) => {
      renderRing(S); renderStage(S); renderLit(S);
      heatCells.forEach((c) => c.setAttribute('opacity', S.acc > 0 ? (0.5 + 0.45 * Math.random()).toFixed(2) : 0));
    };

    // ---- flying ghosts: a rect from one [cx, cy, w, h] box to another ----
    let gen = 0, timers = [];
    const later = (fn, ms) => { const my = gen; timers.push(setTimeout(() => { if (my === gen) fn(); }, ms)); };
    const ghost = (from, to, col, dur, done) => {
      const g = el(gFly, 'rect', { x: -0.5, y: -0.5, width: 1, height: 1, fill: col, opacity: 0.95 });
      const tf = ([x, y, w, h]) => `translate(${x}px, ${y}px) scale(${w}, ${h})`;
      const my = gen;
      g.animate([{ transform: tf(from) }, { transform: tf(to) }], { duration: dur, easing: 'ease-in-out', fill: 'forwards' })
        .onfinish = () => { g.remove(); if (my === gen && done) done(); };
    };
    const stripA = (k) => [A.x + (k + 0.5) * SW, A.y + A.h / 2, SW, A.h];
    const stripB = (k) => [B.x + B.w / 2, B.y + (k + 0.5) * SW, B.w, SW];
    const flyTma = (k, dur, done) => { ghost(stripA(k), partA(k % NSLOT), C.blue, dur); ghost(stripB(k), partB(k % NSLOT), C.blue, dur, done); };
    // one MMA j on strip k from state W (mutated): band j flies down, the 128×8 output appears, then flies into C
    const animMma = (W, k, j, fast, done) => {
      const s = k % NSLOT, f = fast ? 0.6 : 1;
      W.mj = j + 1; W.stageJ = -1; render(W);
      ghost(bandA(s, j), ST_A, C.gold, 550 * f); ghost(bandB(s, j), ST_B, C.gold, 550 * f);
      later(() => { W.stageJ = j; W.out = true; render(W); }, 600 * f);
      later(() => { W.out = false; render(W); ghost(ST_C, CBOX, C.gold, 550 * f, () => { W.acc++; render(W); done(); }); }, 950 * f);
    };

    // ---- the actions: state change + the animation that leads to it ----
    const ACTIONS = [];
    const act = (apply, anim) => ACTIONS.push({ apply, anim });
    act((S) => { opIssue(S, 0); S.litT = [0]; },
      (Sa, Sb, done) => { render({ ...Sb, slots: Sa.slots }); flyTma(0, 700, done); });
    act((S) => { for (let k = 1; k < NSLOT; k++) opIssue(S, k); S.litT = [1, 2, 3, 4, 5, 6, 7]; },
      (Sa, Sb, done) => { render({ ...Sb, slots: Sa.slots });
        for (let k = 1; k < NSLOT; k++) later(() => flyTma(k, 600, k === NSLOT - 1 ? done : null), (k - 1) * 90); });
    for (let k = 0; k < MANUAL; k++) {
      act((S) => { opLand(S, k); opRead(S, k); },
        (Sa, Sb, done) => { const L = clone(Sa); opLand(L, k); render(L); later(() => { render(Sb); done(); }, 450); });
      if (k === 0) {
        for (let j = 0; j < NMMA; j++) act((S) => opMma(S, j), (Sa, Sb, done) => animMma(clone(Sa), k, j, false, done));
      } else {
        act((S) => { for (let j = 0; j < NMMA; j++) opMma(S, j); },
          (Sa, Sb, done) => { const W = clone(Sa); const go = (j) => (j === NMMA ? done() : animMma(W, k, j, true, () => go(j + 1))); go(0); });
      }
      act((S) => { opRelease(S, k); opIssue(S, k + NSLOT); S.litT = [k + NSLOT]; },
        (Sa, Sb, done) => { const R = clone(Sa); opRelease(R, k); render(R);
          later(() => { render({ ...Sb, slots: R.slots }); flyTma(k + NSLOT, 700, done); }, 350); });
    }
    const tick = (W, k) => { opLand(W, k); opRead(W, k); for (let j = 0; j < NMMA; j++) opMma(W, j); opRelease(W, k);
      W.litM = k; W.litT = []; if (k + NSLOT < NT) { opIssue(W, k + NSLOT); W.litT = [k + NSLOT]; } };
    act((S) => { for (let k = MANUAL; k < NT; k++) tick(S, k); S.litM = -1; S.litT = []; },
      (Sa, Sb, done) => { const W = clone(Sa); let t = 0;
        for (let k = MANUAL; k < NT; k++) {
          later(() => { tick(W, k); render(W); }, t);
          t += TICK;
        }
        later(done, t); });

    const STATES = [S0()];
    for (const a of ACTIONS) { const s = clone(STATES[STATES.length - 1]); a.apply(s); STATES.push(s); }
    let shown = 0;
    const onStep = (st) => {
      gen++; timers.forEach(clearTimeout); timers = []; gFly.innerHTML = '';
      if (st === null) st = ACTIONS.length;                   // PDF: the final state
      const from = shown;
      shown = st;
      if (st === from + 1) ACTIONS[from].anim(clone(STATES[from]), clone(STATES[st]), () => render(STATES[st]));
      else render(STATES[st]);
    };
    return { n: ACTIONS.length, onStep };
  };

  document.querySelectorAll('div.mk[data-mk]:not(.mk-built)').forEach((root) => {
    root.classList.add('mk-built');
    const svg = el(root, 'svg', { viewBox: '0 0 1280 720' });
    let r;
    if (root.dataset.mk === 'layer') r = layer(svg);
    // the ring figure is drawn in its own coordinates, then scaled to fit between title and footer, centered
    else if (root.dataset.mk === 'ring') r = ring(el(svg, 'g', { transform: 'translate(288 31) scale(0.9)' }));
    else if (root.dataset.mk === 'epilogue') r = epilogue(svg);
    if (r) steps(root, r.n, r.onStep);
  });
})();
