// « Megakernels », section « Split-K Linear Layer »: Qwen3-1.7B's down_proj on B200, batch 4
// (mpk/models/qwen3/builder.py: splitk_linear_layer, grid 16 × 8; tasks/blackwell/linear_sm100_mpk.cuh
// with SplitK: the epilogue ends with a TMA reduce-add into x). Two figures, stepped with steps.js:
//  - <div class="mk" data-sk="layer">: C = A · B in the canonical layout (B above x, A left of x), the
//    128 tasks one at a time: one A cell and one K slice of B read (gold), one row block of x written
//    (green), x a heatmap of the partial sums; steps 1–2 by hand, step 3 plays the other 126.
//  - <div class="mk" data-sk="task">: one task, (0, 2): its 12 K-strips through the 8-slot SMEM ring
//    (warp 5 copies, warp 4 runs the 4 MMAs per slot into TMEM; strips 5–11 in one step), then the
//    epilogue: TMEM → REG fp32 → REG bf16 → SMEM C stage → x, warps 0–3 one colour each, thread t on
//    row t, a zoom on warp 1 and thread 37 (warp 1, lane 5) traced; data flies between buffers.
// Captions: in the slide, <div class="sk-caps" data-sk-cap> holding one <p data-step="i"> per step
// (4 for the layer, 34 for the task). Heatmap values are illustrative.
(() => {
  const C = { dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', gold: '#f5c451', cyan: '#8fc5fa', hatch: '#1d2c44',
    green: '#7cc47a', blue: '#4aa8ff', bg: '#0f1829' };
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const L = (x1, y1, x2, y2, a = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a}/>`;
  const P = (d, col, w = 1.5, a = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" ${a}/>`;
  const dot = (x, y, r, col, op = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" fill-opacity="${op}"/>`;
  const sm = (x, y, s, col = C.slate, a = '') => T(x, y, s, `font-size="12" fill="${col}" ${a}`);
  const mo = (x, y, s, col = C.slate, a = '') => T(x, y, s, `font-size="11" fill="${col}" class="mono" ${a}`);
  const nm = (x, y, s) => T(x, y, s, 'class="nm"');
  const halo = `paint-order="stroke" stroke="${C.bg}" stroke-width="4"`;
  const curly = (x1, y1, x2, y2, w, q = 0.6) => {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(.75, 1 - q)} T${tip}`;
  };
  const brace = (side, a, b, e, text, W = 10, fs = 15) => {
    const G = 3, st = `fill="none" stroke="${C.cyan}" stroke-width="1.3"`;
    const t = (x, y, an) => T(x, y, text, `font-size="${fs}" font-style="italic" fill="${C.cyan}" text-anchor="${an}"`);
    if (side === 'left') return `<path d="${curly(e - G, a, e - G, b, W - 2)}" ${st}/>` + t(e - G - W - 5, (a + b) / 2 + fs / 3, 'end');
    if (side === 'right') return `<path d="${curly(e + G, b, e + G, a, W - 2)}" ${st}/>` + t(e + G + W + 5, (a + b) / 2 + fs / 3, 'start');
    if (side === 'top') return `<path d="${curly(b, e - G, a, e - G, W - 2)}" ${st}/>` + t((a + b) / 2, e - G - W - 4, 'middle');
    return `<path d="${curly(a, e + G, b, e + G, W - 2)}" ${st}/>` + t((a + b) / 2, e + G + W + fs, 'middle');
  };
  const box = (x, y, w, h) => R(x, y, w, h, `fill="${C.hatch}" stroke="${C.dim}"`);
  const gold = (x, y, w, h, sw = 2) => R(x - 1, y - 1, w + 2, h + 2, `fill="none" stroke="${C.gold}" stroke-width="${sw}"`);
  const own = (x, y, w, h) => R(x - 2, y - 2, w + 4, h + 4, `fill="none" stroke="${C.ink}" stroke-width="1.3" stroke-dasharray="4 3"`);
  const fill = (x, y, w, h, col, op) => R(x, y, w, h, `fill="${col}" fill-opacity="${op}"`);
  const legend = (y = 140) => [[C.blue, 'read', 960], [C.gold, 'compute', 1030], [C.green, 'reduce-add', 1120]]
    .map(([c, s, x]) => dot(x + 5, y - 4, 5, c) + sm(x + 14, y, s)).join('');


  /* ================= L1c: canonical layout, task by task, x as a heatmap ================= */
  const L1c = (() => {
    const K = 192, SW = K / 8, M = 160, BH = M / 16;
    const AX = 470, AY = 362, CX = AX + K + 14, CW = 32, BY = AY - 14 - K;
    const GX = 840, GC = 9, SUB = 3;                                  // x: 4 tokens × 3 sub-rows per block
    // a fixed pseudo-random generator: the partials and the shuffled order are the same every time
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const part = [...Array(16)].map(() => [...Array(8)].map(() => [...Array(4 * SUB)].map(() => 2 * rnd() - 1)));
    const rest = [];
    for (let m = 0; m < 16; m++) for (let k = 0; k < 8; k++) if (!(m === 0 && (k === 2 || k === 5))) rest.push([m, k]);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const ORDER = [[0, 2], [0, 5], ...rest];
    let VMAX = 0;
    for (let m = 0; m < 16; m++) for (let c = 0; c < 4 * SUB; c++) VMAX = Math.max(VMAX, Math.abs(part[m].reduce((a, p) => a + p[c], 0)));
    const mix = (t) => {                                             // hatch → gold
      const a = [0x1d, 0x2c, 0x44], b = [0xf5, 0xc4, 0x51];
      return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    };
    // n tasks done (ORDER[0 … n-1]); cur = index of the highlighted task, or -1
    const draw = (n, cur) => {
      const done = new Set(ORDER.slice(0, n).map(([m, k]) => m * 8 + k));
      const [cm, ck] = cur >= 0 ? ORDER[cur] : [-1, -1];
      let o = '';
      // B
      o += box(CX, BY, CW, K) + fill(CX, BY, CW, K, C.blue, .3);
      for (let b = 1; b < 4; b++) o += L(CX + b * 8, BY, CX + b * 8, BY + K, `stroke="${C.bg}" stroke-width=".8"`);
      for (let k = 1; k < 8; k++) o += L(CX, BY + k * SW, CX + CW, BY + k * SW, `stroke="${C.bg}" stroke-width="3"`);
      o += T(CX + CW / 2, BY + K / 2 + 8, 'B', `class="nm" ${halo}`) + brace('right', BY, BY + K, CX + CW, '6144')
        + sm(CX + CW + 20, BY + K / 2 + 26, 'silu_mul_out', C.slate) + brace('top', CX, CX + CW, BY, 'N = 4', 6, 13)
        + brace('left', BY, BY + SW, CX, '768', 6, 13);
      // A: one cell per task, back to the empty colour once used
      o += box(AX, AY, K, M);
      for (let m = 0; m < 16; m++) for (let k = 0; k < 8; k++)
        if (!done.has(m * 8 + k) || (m === cm && k === ck)) o += fill(AX + k * SW, AY + m * BH, SW, BH, C.blue, .3);
      for (let m = 1; m < 16; m++) o += L(AX, AY + m * BH, AX + K, AY + m * BH, `stroke="${C.bg}" stroke-width="1"`);
      for (let k = 1; k < 8; k++) o += L(AX + k * SW, AY, AX + k * SW, AY + M, `stroke="${C.bg}" stroke-width="3"`);
      o += T(AX + K / 2, AY + M / 2 + 8, 'A', `class="nm" ${halo}`)
        + brace('left', AY, AY + M, AX - 40, '2048') + sm(AX - 58, AY + M / 2 + 26, 'down_proj · 24 MB', C.slate, 'text-anchor="end"')
        + brace('bottom', AX, AX + K, AY + M, '6144')
        + brace('left', AY + 15 * BH, AY + M, AX, '128', 6, 13)          // one row block: 128 high
        + brace('top', AX + 7 * SW, AX + K, AY, '768', 6, 13);           // one K slice: 768 wide
      // x: the running sum of the partials added so far, as a heatmap
      o += box(CX, AY, CW, M);
      for (let m = 0; m < 16; m++) {
        const ks = [...Array(8).keys()].filter((k) => done.has(m * 8 + k));
        if (!ks.length) continue;
        for (let c = 0; c < 4 * SUB; c++) {
          const v = ks.reduce((a, k) => a + part[m][k][c], 0);
          o += R(CX + (c % 4) * 8, AY + m * BH + Math.floor(c / 4) * BH / SUB, 8, BH / SUB, `fill="${mix(Math.sqrt(Math.min(1, Math.abs(v) / VMAX)))}"`);
        }
      }
      for (let m = 1; m < 16; m++) o += L(CX, AY + m * BH, CX + CW, AY + m * BH, `stroke="${C.bg}" stroke-width="1"`);
      if (n === 0) o += T(CX + CW / 2, AY + M / 2 + 8, 'x', `class="nm" ${halo}`);
      // workers: pending blue, current gold, finished back to the empty colour
      o += sm(GX + 4 * (GC + 2), AY - 12, '128 workers', C.slate, 'text-anchor="middle"');
      for (let m = 0; m < 16; m++) for (let k = 0; k < 8; k++) {
        const hot = m === cm && k === ck, fin = done.has(m * 8 + k) && !hot;
        o += R(GX + k * (GC + 2), AY + m * BH + 1, GC, GC, `fill="${hot ? C.gold : fin ? C.hatch : C.blue}" fill-opacity="${hot ? .95 : fin ? 1 : .6}" stroke="${C.dim}" stroke-width=".6"`);
      }
      // the current task: A cell and B slice read (gold), x row block written (green)
      if (cur >= 0) {
        o += gold(AX + ck * SW, AY + cm * BH, SW, BH) + gold(CX, BY + ck * SW, CW, SW)
          + R(CX - 1, AY + cm * BH - 1, CW + 2, BH + 2, `fill="none" stroke="${C.green}" stroke-width="2"`)
          + R(GX + ck * (GC + 2) - 2, AY + cm * BH - 1, GC + 4, GC + 4, `fill="none" stroke="${C.gold}" stroke-width="1.5"`);
        if (n <= 2) o += mo(AX - 66, AY + cm * BH + 9, `task (${cm}, ${ck})`, C.ink, 'text-anchor="end" font-size="12"');
        // sizes, on the hand-stepped tasks only: what one task reads and writes
        if (n <= 2) {
          const lab = (x, y, t, col, an) => T(x, y, t, `font-size="12" fill="${col}" class="mono" text-anchor="${an}" ${halo}`);
          o += lab(AX + ck * SW + SW / 2, AY - 10, '192 KB', C.gold, 'middle')
            + lab(CX - 10, BY + ck * SW + SW / 2 + 4, '6 KB', C.gold, 'end')
            + lab(CX + CW + 10, AY + cm * BH + 9, '1 KB', C.green, 'start');
        }
      }
      return o;
    };
    return { draw, N: ORDER.length };
  })();

  /* ================= T2 / T3: T1 + the SMEM ring, warps 5 and 4 at different steps ================= */
  // QUAD = false: one step per copy and per strip's MMAs (T2); true: the 4 MMAs of a strip, one per step (T3)
  // EPI (T5): the epilogue in 4 steps, TMEM → REG fp32 → REG bf16 → SMEM C stage → x
  // OPT.lay6 (T6): the buffers in line with TMEM's rows, the warp grid at the top right
  // OPT.map (T6a–c): 1 = one colour per warp + a column of threads facing the rows; 2 = + thread 37 traced;
  //   3 = + an animated zoom on warp 0 around the conversion and the st.shared
  const ringFig = (QUAD, EPI = false, OPT = {}) => {
    // map 4 (T7): the zoom of map 3 on warp 1, with thread 37 (warp 1, lane 5) traced as in map 2
    const MAP = OPT.map || 0, L6 = !!OPT.lay6, ZOOM = MAP === 3 || MAP === 4, TRACE = MAP === 2 || MAP === 4, ZW = MAP === 4 ? 1 : 0;
    const EPH = !EPI ? ['ld', 'red'] : ZOOM ? ['ld', 'zin', 'cvt', 'st', 'zout', 'red'] : ['ld', 'cvt', 'st', 'red'];
    const PHB = { ld: 0, zin: 0, cvt: 1, st: 2, zout: 2, red: 3 };
    const NK = 12, NS = 8, KD = 216, SK = KD / NK, AH = 128;
    const AX = L6 ? 330 : 400, AY = 400, CX = AX + KD + 14, CW = 32, TW = 128, BY = AY - 14 - KD;
    const EW = 128, EX = L6 ? [CX + TW + 40, CX + TW + 182, CX + TW + 324] : [730, 880, 1030], EY = L6 ? AY : 214;
    const XX = L6 ? EX[2] + EW + 22 : CX + TW + 36, GX = L6 ? 800 : 880, GY = L6 ? 226 : AY, LW = 6, WH = 12;
    const RX = L6 ? 230 : 300, RP = 38, RY = 214, RBH = SK, RAH = AH;
    const TCX = CX + TW + 12, TCW = 16;                                // the column of threads (map ≥ 1)
    const HUE = ['#8fc5fa', '#d97fd0', '#f09a6b', '#b39ddb'], TR = 37;   // one colour per warp; the traced thread
    const slotX = (i) => RX + i * RP;
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // OPT.perRow (T8): one value per row and token; otherwise one per group of 8 rows
    const RG = OPT.perRow ? 128 : 16, GR = 128 / RG;
    const part = [...Array(NK)].map(() => [...Array(4)].map(() => [...Array(RG * 4)].map(() => 2 * rnd() - 1)));
    let VMAX = 0;
    for (let c = 0; c < RG * 4; c++) VMAX = Math.max(VMAX, Math.abs(part.reduce((a, p) => a + p.reduce((b, q) => b + q[c], 0), 0)));
    const mix = (t) => {
      const a = [0x1d, 0x2c, 0x44], b = [0xf5, 0xc4, 0x51];
      return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    };
    // zoom z on warp ZW: row r at rowY(r, z) below the top of a buffer; [y0, y1) of rows r0 … r1 − 1, clipped, or null
    const rowY = (r, z) => (r - 32 * ZW * z) * (1 + 3 * z);
    const span = (by, r0, r1, z) => {
      const y0 = Math.max(by, by + rowY(r0, z)), y1 = Math.min(by + AH, by + rowY(r1, z));
      return y1 > y0 ? [y0, y1 - y0] : null;
    };
    const heat = (x, y, units, z = 0) => {                           // units: [k, j] MMAs done
      let o = '';
      for (let c = 0; c < RG * 4; c++) {
        const g = Math.floor(c / 4), sp = span(y, g * GR, g * GR + GR, z);
        if (!sp) continue;
        const v = units.reduce((a, [k, j]) => a + part[k][j][c], 0);
        o += R(x + (c % 4) * 8, sp[0], 8, sp[1], `fill="${mix(Math.sqrt(Math.min(1, Math.abs(v) / VMAX)))}"`);
      }
      return o;
    };
    // events: ['T', k] warp 5 copies strip k into slot k mod 8; ['M', k, j] warp 4's MMA j of strip k (j = -1: all 4)
    const EV = [];
    for (let k = 0; k < NS; k++) EV.push(['T', k]);
    for (let k = 0; k < NK; k++) {
      if (QUAD) for (let j = 0; j < 4; j++) EV.push(['M', k, j]); else EV.push(['M', k, -1]);
      if (k + NS < NK) EV.push(['T', k + NS]);
    }
    // steps: [events applied, events highlighted]; T1–7 share a step, every other event has its own
    // OPT.merge (T9): the MMAs of strips 5–11 (the drain) in one step
    const STEPS = [[0, 0], [1, 1], [NS, NS - 1]];
    const E5 = EV.findIndex(([t, k, j]) => t === 'M' && k === 5 && j <= 0);
    for (let e = NS; e < EV.length; e++) {
      if (OPT.merge && e === E5) { STEPS.push([EV.length, EV.length - E5]); break; }
      STEPS.push([e + 1, 1]);
    }
    // pending: the events of this step have left their source but not reached their destination yet (T4's flights)
    const draw = (n, nHot, ph = 'main', pending = false, z = 0) => {
      const epi = ph !== 'main', hues = MAP >= 1 && epi && ph !== 'red', sc = 1 + 3 * z;
      // thread 37's row, outlined, at the current zoom
      const trace = (x, by, w, op) => {
        const sp = span(by, TR, TR + 1, z);
        return sp ? R(x, sp[0] - 1.5, w, sp[1] + 3, `fill="none" stroke="${C.ink}" stroke-width="1.3" stroke-opacity="${op}"`) : '';
      };
      const slots = Array(NS).fill(-1), used = Array(NS).fill(0), copied = new Set(), units = [];
      EV.slice(0, n).forEach(([t, k, j], e) => {
        if (pending && e >= n - nHot) { if (t === 'T') copied.add(k); return; }
        if (t === 'T') { slots[k % NS] = k; used[k % NS] = 0; copied.add(k); return; }
        if (j < 0) { for (let q = 0; q < 4; q++) units.push([k, q]); slots[k % NS] = -1; return; }
        units.push([k, j]); used[k % NS] = j + 1;
        if (j === 3) slots[k % NS] = -1;
      });
      const hot = ph === 'main' ? EV.slice(n - nHot, n) : [];
      const hotT = hot.filter(([t]) => t === 'T').map(([, k]) => k), hotM0 = hot.filter(([t]) => t === 'M');
      // a merged step reads whole slots: one entry per strip, as if its 4 MMAs were one
      const hotM = hotM0.length > 4 ? [...new Set(hotM0.map(([, k]) => k))].map((k) => ['M', k, -1]) : hotM0;
      const lab = n === 1;
      const tag = (x, y, t, col, an) => T(x, y, t, `font-size="12" fill="${col}" class="mono" text-anchor="${an}" ${halo}`);
      let o = '';
      // B: strips go to the empty colour once copied into SMEM
      o += box(CX, BY, CW, KD);
      for (let k = 0; k < NK; k++) if (!copied.has(k) || hotT.includes(k)) o += fill(CX, BY + k * SK, CW, SK, C.blue, .3);
      for (let b = 1; b < 4; b++) o += L(CX + b * 8, BY, CX + b * 8, BY + KD, `stroke="${C.bg}" stroke-width=".8"`);
      for (let k = 1; k < NK; k++) o += L(CX, BY + k * SK, CX + CW, BY + k * SK, `stroke="${C.bg}" stroke-width="2"`);
      o += T(CX + CW / 2, BY + KD / 2 + 8, 'B', `class="nm" ${halo}`) + brace('right', BY, BY + KD, CX + CW, '768')
        + brace('top', CX, CX + CW, BY, '4', 6, 13);
      // A: same
      o += box(AX, AY, KD, AH);
      for (let k = 0; k < NK; k++) if (!copied.has(k) || hotT.includes(k)) o += fill(AX + k * SK, AY, SK, AH, C.blue, .3);
      for (let k = 1; k < NK; k++) o += L(AX + k * SK, AY, AX + k * SK, AY + AH, `stroke="${C.bg}" stroke-width="2"`);
      o += T(AX + KD / 2, AY + AH / 2 + 8, 'A', `class="nm" ${halo}`) + brace('left', AY, AY + AH, AX, '128')
        + brace('bottom', AX, AX + KD, AY + AH, '768') + sm(AX - 32, AY + AH / 2 + 26, 'cell (0, 2)', C.slate, 'text-anchor="end"');
      // the SMEM ring: B part (4 × 64) over A part (64 × 128); in T3, the 16-wide K quarters already used are dimmed
      o += sm(RX, RY - 14, 'SMEM ring · 8 slots × 18 KB', C.slate);
      for (let i = 0; i < NS; i++) {
        const x = slotX(i), ax = x + 7, ay = RY + RBH + 4;
        const m = hotM.find(([, k]) => k % NS === i), wr = hotT.some((t) => t % NS === i);
        const k = slots[i] >= 0 ? slots[i] : m ? m[1] : -1;
        o += R(x - 3, RY - 3, CW + 6, RBH + RAH + 10, `rx="3" fill="${C.bg}" stroke="${C.dim}" stroke-dasharray="3 3"`);
        if (k >= 0) {
          for (let q = 0; q < 4; q++) {
            // the band being read stays bright under its gold border; bands already used are dimmed
            const op = m ? (m[2] < 0 ? .3 : q < m[2] ? .15 : .6) : q < used[i] ? .15 : .6;
            o += fill(x, RY + q * RBH / 4, CW, RBH / 4, C.blue, op) + fill(ax + q * SK / 4, ay, SK / 4, RAH, C.blue, op);
          }
          o += T(ax + SK / 2, ay + RAH / 2 + 4, k, `font-size="11" fill="${C.ink}" text-anchor="middle" class="mono" ${halo}`);
        }
        if (m && m[2] < 0) o += gold(x, RY, CW, RBH + RAH + 4);
        if (m && m[2] >= 0) o += gold(x, RY + m[2] * RBH / 4, CW, RBH / 4, 1.5) + gold(ax + m[2] * SK / 4, ay, SK / 4, RAH, 1.5);
        if (wr) o += R(x - 1, RY - 1, CW + 2, RBH + RAH + 6, `fill="none" stroke="${C.green}" stroke-width="2"`);
        o += T(x + CW / 2, RY + RBH + RAH + 22, i, `font-size="11" fill="${C.slate}" text-anchor="middle"`);
      }
      // a 128 × 16 buffer (TMEM, the registers, the SMEM C stage): 4 tokens + 12 of padding; zoomed, rows 0–31 fill it
      const buf = (bx, by, filled, kind) => {
        let b = box(bx, by, EW, AH) + R(bx + CW, by, EW - CW, AH, `fill="${C.bg}" fill-opacity=".55"`);
        if (filled) b += heat(bx, by, units, z);
        if (hues) for (let w = 0; w < 4; w++) {
          const sp = span(by, 32 * w, 32 * w + 32, z);
          if (sp) b += R(bx, sp[0], EW, sp[1], `fill="${HUE[w]}" fill-opacity=".14"`) + R(bx - 4, sp[0], 3, sp[1], `fill="${HUE[w]}"`);
        }
        // columns: one register each (fp32), two values per register (bf16)
        for (let q = 1; q < 16; q++) b += L(bx + q * 8, by, bx + q * 8, by + AH,
          `stroke="${C.bg}" stroke-width="${q === 4 ? 1.5 : kind === 'b16' ? (q % 2 ? .25 : 1.1) : .6}"`);
        if (z > 0) for (let r = 32 * ZW + 1; r < 32 * ZW + 32; r++) {
          const y = by + rowY(r, z);
          if (y > by && y < by + AH) b += L(bx, y, bx + EW, y, `stroke="${C.bg}" stroke-width=".5" stroke-opacity="${z}"`);
        }
        return b;
      };
      // TMEM
      o += buf(CX, AY, units.length > 0, 'tmem');
      if (ph === 'main' || ph === 'red') o += sm(CX + CW + (TW - CW) / 2, AY + AH / 2 + 4, 'padding', C.slate, 'text-anchor="middle"');
      o += brace('bottom', CX, CX + TW, AY + AH, '16 · TMEM fp32', 8, 13);
      if (hotM.length) o += R(CX - 1, AY - 1, CW + 2, AH + 2, `fill="none" stroke="${C.green}" stroke-width="2"`);
      const bands = (bx, by) => {                                       // warp w ↔ rows 32w … 32w + 31
        let b = '';
        for (let w = 0; w < 4; w++) {
          if (w) b += L(bx - 4, by + w * 32, bx + TW + 4, by + w * 32, `stroke="${C.ink}" stroke-width="1.2" stroke-dasharray="3 3"`);
          b += tag(bx + CW + 14, by + w * 32 + 20, `w${w}`, C.ink, 'start');
        }
        return b;
      };
      if (ph === 'ld') o += gold(CX, AY, TW, AH) + (MAP ? '' : bands(CX, AY));
      // T5: the registers and the SMEM C stage, 128 rows × 16 columns each (4 tokens + 12 of padding)
      if (EPI) {
        const pi = PHB[ph] ?? -1, act = ['ld', 'cvt', 'st', 'red'].includes(ph), have = (b) => pi > b || (pi === b && !pending);
        [['REG fp32', '8 KB · 64 B / thread', 'f32'], ['REG bf16', '4 KB · 32 B / thread', 'b16'], ['SMEM C stage', '4 KB', 'smem']].forEach(([nm, sz, kind], b) => {
          const bx = EX[b];
          o += buf(bx, EY, have(b), kind);
          o += T(bx + EW / 2, EY - 10, nm, `font-size="13" fill="${C.ink}" text-anchor="middle" font-weight="600"`)
            + T(bx + EW / 2, EY + AH + 18, sz, `font-size="11" fill="${C.slate}" text-anchor="middle"`);
          if (act && pi === b) o += R(bx - 1, EY - 1, EW + 2, AH + 2, `fill="none" stroke="${C.green}" stroke-width="2"`) + (MAP ? '' : bands(bx, EY));
          if (act && pi === b + 1) o += gold(bx, EY, b === 2 ? CW : EW, AH) + (b < 2 && !MAP ? bands(bx, EY) : '');
          // thread 37's row, in every buffer that holds it
          if (TRACE && hues && have(b)) o += trace(bx - 2, EY, EW + 4, 1);
        });
        if (TRACE && hues) o += trace(CX - 2, AY, TW + 4, .6);
        // the column of threads facing the rows: thread t on row t, one colour per warp
        if (MAP >= 1 && hues) {
          o += T(TCX + TCW / 2, AY - 10, 'thread', `font-size="11" fill="${C.slate}" text-anchor="middle"`);
          for (let w = 0; w < 4; w++) {
            const sp = span(AY, 32 * w, 32 * w + 32, z);
            if (!sp) continue;
            o += R(TCX, sp[0], TCW, sp[1], `fill="${HUE[w]}" fill-opacity=".85" stroke="${C.bg}" stroke-width="1"`);
            if (z < .5 && sp[1] > 14) o += T(TCX + TCW / 2, sp[0] + sp[1] / 2 + 4, `w${w}`, `font-size="10" fill="${C.bg}" text-anchor="middle" font-weight="600" opacity="${1 - 2 * z}"`);
          }
          if (z > 0) [0, 8, 16, 24, 31].forEach((l) => {
            const y = AY + rowY(32 * ZW + l + .5, z) + 3.5;
            if (y > AY && y < AY + AH + 2) o += T(TCX + TCW / 2, Math.min(AY + AH - 2, y), l, `font-size="9" fill="${C.bg}" text-anchor="middle" font-weight="600" opacity="${z}"`);
          });
          if (z > 0) for (let r = 32 * ZW + 1; r < 32 * ZW + 32; r++) {
            const y = AY + rowY(r, z);
            if (y > AY && y < AY + AH) o += L(TCX, y, TCX + TCW, y, `stroke="${C.bg}" stroke-width=".5" stroke-opacity="${z}"`);
          }
          if (TRACE) o += trace(TCX - 2, AY, TCW + 4, 1);
        }
      }
      // x
      o += box(XX, AY, CW, AH) + T(XX + CW / 2, AY - 10, 'x', `font-size="16" font-weight="600" fill="${C.ink}" text-anchor="middle"`);
      if (ph === 'red' && !pending) o += heat(XX, AY, units);
      if (ph === 'red') o += R(XX - 1, AY - 1, CW + 2, AH + 2, `fill="none" stroke="${C.green}" stroke-width="2"`)
        + tag(XX + CW / 2, AY + AH + 18, '1 KB', C.green, 'middle');
      // threads
      o += sm(GX + 16 * LW, GY - 12, '256 threads', C.slate, 'text-anchor="middle"');
      for (let w = 0; w < 8; w++) {
        o += T(GX - 8, GY + w * WH + 9, `warp ${w}`, `font-size="11" fill="${C.slate}" text-anchor="end"`);
        for (let l = 0; l < 32; l++) {
          const on = (l === 0 && ((w === 5 && hotT.length) || (w === 4 && hotM.length))) || (['ld', 'zin', 'cvt', 'st', 'zout'].includes(ph) && w < 4) || (ph === 'red' && w === 0 && l === 0);
          const col = on && hues && w < 4 ? HUE[w] : on ? C.gold : C.hatch;
          o += R(GX + l * LW, GY + w * WH + 1, LW - 1, WH - 2, `fill="${col}" fill-opacity="${on ? .95 : 1}"`);
        }
      }
      if (TRACE && hues) o += R(GX + 5 * LW - 1.5, GY + WH - .5, LW + 2, WH + 1, `fill="none" stroke="${C.ink}" stroke-width="1.5"`);
      o += brace('right', GY, GY + 4 * WH, GX + 32 * LW, 'epilogue', 6, 13)
        + sm(GX + 32 * LW + 8, GY + 4 * WH + 9, 'MMA') + sm(GX + 32 * LW + 8, GY + 5 * WH + 9, 'TMA')
        + brace('right', GY + 6 * WH, GY + 8 * WH, GX + 32 * LW, 'idle', 6, 13);
      // the copies of this step: A and B strips read from GMEM (gold)
      hotT.forEach((k) => { o += gold(AX + k * SK, AY, SK, AH) + gold(CX, BY + k * SK, CW, SK); });
      if (lab) o += tag(AX + SK / 2, AY + AH + 34, '16 KB', C.gold, 'middle') + tag(CX + CW + 10, BY + SK / 2 + 4, '512 B', C.gold, 'start');
      return o;
    };
    const NST = STEPS.length;
    const zoomOf = (st) => ZOOM && st >= NST && ['zin', 'cvt', 'st'].includes(EPH[st - NST]) ? 1 : 0;
    const drawStep = (st, pending = false, z = zoomOf(st)) => st >= NST ? draw(EV.length, 0, EPH[st - NST], pending, z)
      : draw(...STEPS[st], 'main', pending);
    // T4: what flies at step st, as [from, to, colour, delay]; boxes are [x, y, w, h]
    const flights = (st) => {
      if (st >= NST) {
        if (!EPI) return [];
        const src = [[CX, AY, TW, AH], [EX[0], EY, EW, AH], [EX[1], EY, EW, AH], [EX[2], EY, CW, AH]];
        const dst = [[EX[0], EY, EW, AH], [EX[1], EY, EW, AH], [EX[2], EY, EW, AH], [XX, AY, CW, AH]];
        const e = { ld: 0, cvt: 1, st: 2, red: 3 }[EPH[st - NST]];
        return e === undefined ? [] : [[src[e], dst[e], C.gold, 0]];
      }
      if (st < 1) return [];
      const [n, nHot] = STEPS[st], out = [];
      EV.slice(n - nHot, n).forEach(([t, k, j], d) => {
        const sx = slotX(k % NS), ax = sx + 7, ay = RY + RBH + 4, dm = nHot > 1 ? d * 70 : 0;
        if (t === 'T') out.push([[AX + k * SK, AY, SK, AH], [ax, ay, SK, RAH], C.blue, d * 90],
          [[CX, BY + k * SK, CW, SK], [sx, RY, CW, RBH], C.blue, d * 90]);
        else out.push([[ax + j * SK / 4, ay, SK / 4, RAH], [CX, AY, CW, AH], C.gold, dm],
          [[sx, RY + j * RBH / 4, CW, RBH / 4], [CX, AY, CW, AH], C.gold, dm]);
      });
      return out;
    };
    const fig = [drawStep];
    fig.nSteps = NST + EPH.length; fig.flights = flights; fig.NST = NST; fig.zoomOf = zoomOf;
    return fig;
  };
  const TASK = ringFig(true, true, { lay6: true, map: 4, perRow: true, merge: true });

  // the captions are in the slide: one <p data-step="i"> per step in <div class="sk-caps">, shown at step i
  const showCap = (cap, st) => cap.querySelectorAll('[data-step]').forEach((e) => e.classList.toggle('is-off', +e.dataset.step !== st));

  // L1c: steps 0–2 by hand, step 3 plays the 126 other tasks, then shows the final state
  document.querySelectorAll('div.mk[data-sk="layer"]').forEach((root) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector('[data-sk-cap]'), { draw, N } = L1c, DT = 70;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let prev = null, raf = 0;
    steps(root, 3, (st) => {
      cancelAnimationFrame(raf);
      if (st === null) st = 3;
      showCap(cap, st);
      const from = prev; prev = st;
      if (st < 3) { svg.innerHTML = st === 0 ? draw(0, -1) : draw(st, st - 1); return; }
      if (from !== 2 || reduce) { svg.innerHTML = draw(N, -1); return; }
      const t0 = performance.now();
      const tick = (now) => {
        const i = 2 + Math.floor((now - t0) / DT);
        if (i >= N) { svg.innerHTML = draw(N, -1); return; }
        svg.innerHTML = draw(i + 1, i);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  });

  // T1: steps 0–2 by hand, step 3 plays strips 2–11, steps 4–5 the epilogue
  // the task: stepping forward draws the step with its destinations not updated yet, flies ghost
  // rectangles from the sources to the destinations, then draws the step; a step that changes the
  // zoom animates it; any other jump draws the step directly
  document.querySelectorAll('div.mk[data-sk="task"]').forEach((root) => {
    const FIG = TASK;
    const NSV = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NSV, 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    const gMain = document.createElementNS(NSV, 'g'), gFly = document.createElementNS(NSV, 'g');
    svg.append(gMain, gFly);
    root.appendChild(svg);
    const cap = root.parentElement.querySelector('[data-sk-cap]'), [draw] = FIG, NC = FIG.nSteps;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let prev = null, gen = 0, raf = 0;
    const fly = ([x0, y0, w0, h0], [x1, y1, w1, h1], col, delay, dur, done) => {
      const g = document.createElementNS(NSV, 'rect');
      g.setAttribute('width', 1); g.setAttribute('height', 1);
      g.setAttribute('fill', col); g.setAttribute('fill-opacity', '.9');
      gFly.appendChild(g);
      const tf = (x, y, w, h) => `translate(${x}px, ${y}px) scale(${w}, ${h})`;
      g.animate([{ transform: tf(x0, y0, w0, h0) }, { transform: tf(x1, y1, w1, h1) }],
        { duration: dur, delay, easing: 'ease-in-out', fill: 'both' }).onfinish = () => { g.remove(); done(); };
    };
    steps(root, NC - 1, (st) => {
      gen++; gFly.innerHTML = ''; cancelAnimationFrame(raf);
      if (st === null) st = NC - 1;
      showCap(cap, st);
      const from = prev; prev = st;
      const z0 = from === null ? FIG.zoomOf(st) : FIG.zoomOf(from), z1 = FIG.zoomOf(st);
      if (from !== null && Math.abs(st - from) === 1 && z0 !== z1 && !reduce) {
        const t0 = performance.now(), D = 800;
        const tick = (now) => {
          const f = Math.min(1, (now - t0) / D), e = f < .5 ? 2 * f * f : 1 - (2 - 2 * f) ** 2 / 2;
          gMain.innerHTML = draw(st, false, z0 + (z1 - z0) * e);
          if (f < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return;
      }
      const fl = FIG.flights(st);
      if (st !== from + 1 || reduce || !fl.length) { gMain.innerHTML = draw(st); return; }
      gMain.innerHTML = draw(st, true);
      const my = gen, dur = fl[0][2] === C.blue ? 750 : 600;
      let left = fl.length;
      fl.forEach(([a, b, col, delay]) => fly(a, b, col, delay, dur, () => { if (--left === 0 && my === gen) gMain.innerHTML = draw(st); }));
    });
  });
})();
