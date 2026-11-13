// « Megakernels », section « RMSNorm Layer » (tasks/hopper/rmsnorm_hopper.cuh, 256 threads, a 2048-bf16 row).
// Two figures, both stepped with steps.js (load it first):
//  - <div class="mk" data-rn="lanes">: the layer, one task per token, as lanes over time (read, compute,
//    write); x in line with the lanes, w above with one bus to all; the read goes one task per step,
//    then all 8. Caption in <div class="gq-cap" data-rn-cap="lanes">.
//  - <div class="mk" data-rn="zoom" data-ids="1">: one task, time left to right, with an animated zoom
//    between the 8 warps and warp 0. Every buffer (x, w, their SMEM copies x_s, w_s, out_s, out) is its own
//    grid, folded into 8 columns of 256 (element e at row e mod 256, column e ÷ 256), so row t faces
//    thread t; braces give the sizes (4 KB / 512 B with the zoom, 512 B per warp, 16 B per lane); a gold
//    border marks the data the current step reads, green the data written; the two butterflies go one stage at a time (one
//    pair, then all lanes) with the tree feeding the current pair in dim gold; a GMEM / SMEM / REG strip on
//    top shows where the data is. data-ids="1": lane numbers on the left when zoomed on warp 0.
//    Caption in <div class="rn-cap" data-rn-cap="zoom">.

/* ================= the layer: one task per token ================= */
(() => {
  const C = { dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', gold: '#f5c451', cyan: '#8fc5fa', hatch: '#1d2c44', green: '#7cc47a', blue: '#4aa8ff', panel: '#141a25' };
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const L = (x1, y1, x2, y2, a = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a}/>`;
  const lab = (x, y, s, a = '') => T(x, y, s, `font-size="13" font-weight="600" fill="${C.slate}" letter-spacing=".06em" ${a}`);
  // curly brace (themes/megakernel.js), label outside
  const curly = (x1, y1, x2, y2, w, q = 0.6) => {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(.75, 1 - q)} T${tip}`;
  };
  const brace = (side, a, b, e, text, W = 14) => {
    const G = 3, st = `fill="none" stroke="${C.cyan}" stroke-width="1.5"`;
    const t = (x, y, an) => T(x, y, text, `class="bl" text-anchor="${an}"`);
    if (side === 'left') return `<path d="${curly(e - G, a, e - G, b, W - 2)}" ${st}/>` + t(e - G - W - 6, (a + b) / 2 + 7, 'end');
    if (side === 'right') return `<path d="${curly(e + G, b, e + G, a, W - 2)}" ${st}/>` + t(e + G + W + 6, (a + b) / 2 + 7, 'start');
    if (side === 'top') return `<path d="${curly(b, e - G, a, e - G, W - 2)}" ${st}/>` + t((a + b) / 2, e - G - W - 4, 'middle');
    return `<path d="${curly(a, e + G, b, e + G, W - 2)}" ${st}/>` + t((a + b) / 2, e + G + W + 18, 'middle');
  };

  /* ---------- 8 task lanes over time ---------- */
  // x, w and out drawn at the same scale: a 2048-element row is 120 × 26 px. x is in line with the
  // lanes (row i of x feeds task i with a straight wire: private), w sits above and drops one bus
  // that joins every lane's wire (shared). Gold border: the data the current step reads.
  const JT = [0, 40, 15, 60, 25, 50, 10, 35];
  const XX = 160, OX = 1000, RW = 120, RH = 26;
  const WX = 300, WY = 186, BUS = WX + RW / 2;          // w above the rows, its bus drops at x = BUS
  const S0 = 440, RD = 160, CO = 130, WR = 170;
  const rowY = (i) => 272 + i * 30, rowC = (i) => rowY(i) + 13;

  // ph: 0 tasks, 1 read, 2 compute, 3 write, 4 done; only: tasks 0..only shown, only the current one bright, or -1 (all)
  const figA = (ph, only) => {
    const on = (i) => only < 0 || i <= only, cur = (i) => only < 0 || i === only;
    let o = '';
    [[C.blue, 'read', 860], [C.gold, 'compute', 950], [C.green, 'write', 1070]].forEach(([c, s, x]) =>
      o += R(x, 187, 18, 10, `fill="${c}" fill-opacity=".8"`) + T(x + 24, 196, s, `font-size="13" fill="${C.slate}"`));
    for (let i = 0; i < 8; i++)
      o += T(64, rowC(i) + 4, `task ${i} / SM ${i}`, `font-size="13" fill="${C.slate}" opacity="${on(i) ? 1 : .35}"`)
        + L(XX + RW + 4, rowC(i), OX - 4, rowC(i), `stroke="${C.dim}" stroke-width="1" stroke-dasharray="1 4" opacity=".6"`);
    // x: row i lights when task i reads it
    for (let i = 0; i < 8; i++) {
      o += R(XX, rowY(i), RW, RH, `fill="${C.hatch}" stroke="${C.dim}"`);
      if (ph >= 1 && on(i)) o += R(XX, rowY(i), RW, RH, `fill="${C.blue}" fill-opacity="${ph === 1 && cur(i) ? .55 : .2}" stroke="${C.blue}"`);
    }
    o += T(XX + RW / 2, rowY(0) - 18, 'x', 'class="nm"') + brace('bottom', XX, XX + RW, rowY(7) + RH, '2048 · 4 KB', 12);
    // w: one row above, shared
    o += R(WX, WY, RW, RH, `fill="${C.blue}" fill-opacity="${ph >= 1 ? (ph === 1 ? .55 : .2) : .0}" stroke="${ph >= 1 ? C.blue : C.dim}"`)
      + (ph >= 1 ? '' : R(WX, WY, RW, RH, `fill="${C.hatch}" stroke="${C.dim}"`))
      + T(WX - 22, WY + RH / 2, 'w', 'class="nm"') + brace('top', WX, WX + RW, WY, '2048 · 4 KB', 12);
    // gold border: the data the current step reads (as on the next slide)
    const used = (x, y) => R(x - 1, y - 1, RW + 2, RH + 2, `fill="none" stroke="${C.gold}" stroke-width="2.5"`);
    if (ph === 1) {
      o += used(WX, WY);
      for (let i = 0; i < 8; i++) if (cur(i)) o += used(XX, rowY(i));
    }
    // out
    for (let i = 0; i < 8; i++) {
      o += R(OX, rowY(i), RW, RH, `fill="${C.hatch}" stroke="${C.dim}"`);
      const f = ph >= 4 ? .85 : ph === 3 ? .35 : 0;
      if (f) o += R(OX, rowY(i), RW, RH, `fill="${C.green}" fill-opacity="${f}"`);
    }
    o += T(OX + RW / 2, rowY(0) - 18, 'out', 'class="nm"')
      + brace('bottom', OX, OX + RW, rowY(7) + RH, '2048 · 4 KB', 12);
    // lanes
    for (let i = 0; i < 8; i++) {
      if (!on(i)) continue;
      const y = rowC(i), S = S0 + JT[i], hot = ph === 1 && cur(i);
      if (ph >= 1) {
        const op = hot ? .8 : .3;
        // own row of x: straight, horizontal
        o += L(XX + RW, y, S, y, `stroke="${C.blue}" stroke-width="1.6" stroke-opacity="${op}"`)
        // shared w: the bus drops and joins the lane's wire
          + `<path d="M${BUS},${WY + RH} V${y - 16} Q${BUS},${y} ${BUS + 16},${y}" fill="none" stroke="${C.blue}" stroke-width="1.6" stroke-opacity="${op}"/>`
          + L(S, y, S + RD, y, `stroke="${C.blue}" stroke-width="7" stroke-linecap="round" stroke-opacity="${hot ? .95 : .5}"`);
      }
      if (ph >= 2) o += L(S + RD + 8, y, S + RD + 8 + CO, y, `stroke="${C.gold}" stroke-width="7" stroke-linecap="round" stroke-opacity="${ph === 2 ? .95 : .5}"`);
      if (ph >= 3) {
        const x1 = S + RD + CO + 16;
        o += L(x1, y, x1 + WR, y, `stroke="${C.green}" stroke-width="7" stroke-linecap="round" stroke-opacity="${ph === 3 ? .95 : .5}"`)
          + L(x1 + WR, y, OX - 6, y, `stroke="${C.green}" stroke-width="1.5" stroke-opacity=".9"`);
      }
    }
    if (ph >= 1) o += T(S0 + RD / 2, 250, 'read x row + w', `font-size="14" fill="${C.blue}" text-anchor="middle"`);
    if (ph >= 2) o += T(S0 + RD + 8 + CO / 2, 250, 'Σ x², rsqrt, scale', `font-size="14" fill="${C.gold}" text-anchor="middle"`);
    if (ph >= 3) o += T(S0 + RD + CO + 16 + WR / 2, 250, 'store out', `font-size="14" fill="${C.green}" text-anchor="middle"`);
    return o;
  };
  // [phase, only, caption]: the read goes one task per step, then all 8 at once
  const STA = [[0, -1, 'Decode batch 8: <b>one task per token</b>, task i owns row i of x and row i of out'],
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [1, i, `<b>Read</b>: task ${i} copies <b>row ${i}</b> of x and <b>all</b> of w, 8 KB`]),
    [1, -1, '<b>Read</b>: each task copies <b>its own</b> row of x and the <b>shared</b> row of w, 8 KB'],
    [2, -1, '<b>Compute</b>: Σ x², rsqrt(Σ/2048 + ε), scale by w'],
    [3, -1, '<b>Write</b>: each task stores its 4 KB row of out'],
    [4, -1, '']];

  document.querySelectorAll('div.mk[data-rn="lanes"]').forEach((root) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector('[data-rn-cap="lanes"]');
    steps(root, STA.length - 1, (st) => {
      if (st === null) st = STA.length - 1;
      svg.innerHTML = figA(STA[st][0], STA[st][1]);
      cap.innerHTML = STA[st][2];
    });
  });
})();

/* ================= one task: all warps, then one warp ================= */
(() => {
  const C = { dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', gold: '#f5c451', cyan: '#8fc5fa', hatch: '#1d2c44',
    green: '#7cc47a', blue: '#4aa8ff', bg: '#0f1829' };
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const L = (x1, y1, x2, y2, a = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a}/>`;
  const Q = (x1, y1, cx, cy, x2, y2, col, w = 1.5, op = 1) =>
    `<path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="${col}" stroke-width="${w}" stroke-opacity="${op}"/>`;
  const dot = (x, y, r, col, op = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col}" fill-opacity="${op}"/>`;
  const sm = (x, y, s, col = C.slate, a = '') => T(x, y, s, `font-size="12" fill="${col}" ${a}`);
  const KC = { r: C.blue, w: C.green, c: C.gold };

  // the steps: [group, sub-step (butterfly stages shown), zoom (0 = all 8 warps, 1 = warp 0), caption]
  const STEPS = [
    [1, 0, 0, '<code>cp.async</code> of 16 B move x and w GMEM → SMEM, bypassing the registers'],
    [2, 0, 1, 'Sum square per lane'],
    [3, [1, 'pair'], 1, 'Pairwise sum 16 lanes apart'],
    [3, [1, 'a'], 1, ''],
    [3, [2, 'pair'], 1, 'Pairwise sum 8 lanes apart'],
    [3, [2, 'a'], 1, ''],
    [3, [3, 'pair'], 1, 'Pairwise sum 4 lanes apart'],
    [3, [3, 'a'], 1, ''],
    [3, [4, 'pair'], 1, 'Pairwise sum 2 lanes apart'],
    [3, [4, 'a'], 1, ''],
    [3, [5, 'pair'], 1, 'Pairwise sum 1 lane apart'],
    [3, [5, 'a'], 1, ''],
    [4, 0, 0, 'Lane 0 of each warp writes back its partial sum to SMEM'],
    [5, [0, 'a'], 1, 'Lanes 0–7 of warp 0 read back the partial sums from SMEM'],
    [5, [1, 'pair'], 1, 'Pairwise sum 4 lanes apart'],
    [5, [1, 'a'], 1, ''],
    [5, [2, 'pair'], 1, 'Pairwise sum 2 lanes apart'],
    [5, [2, 'a'], 1, ''],
    [5, [3, 'pair'], 1, 'Pairwise sum 1 lane apart'],
    [5, [3, 'a'], 1, ''],
    [5, [3, 'w'], 1, 'Lane 0 of warp 0 writes back the sum to SMEM'],
    [6, 0, 1, 'Every lane of every warp reads back the sum from SMEM, computes rms_rcp = rsqrt(Σ/2048 + ε)'],
    [7, 0, 1, 'Every lane of every warp computes out_s = x · rms_rcp · w'],
    [8, 0, 1, 'Read back the final result into registers and write it back to GMEM'],
    [9, 0, 0, '']];
  const CAPS = STEPS.map((x) => x[3]), ZOOM = STEPS.map((x) => x[2]);
  const NS = STEPS.length - 1;
  let zz = 0;                                             // the current zoom
  let IDS = '', CLIP = '';

  /* ---- the vertical axis: thread t (= row t of every folded buffer) ---- */
  const Y0 = 262, H = 272, SPM = H / 256, SPS = H / 32;
  let sp = SPM;
  const Y = (t) => Y0 + (t + .5) * sp;
  const nv = () => Math.min(256, Math.ceil(H / sp));     // threads in view: 0 … nv-1
  const big = () => sp >= 3;

  /* ---- x layout ---- */
  // x and w, and their SMEM copies x_s and w_s, are two grids each, 40 px wide (5 px columns)
  const CW = 5, GW = 8 * CW;
  const X = { xg: 96, wg: 140, xs: 206, ws: 250, sq: 326, b: [366, 404, 442, 480, 518], rw: 554, rd: 626, b8: [662, 698, 734],
    r0: 774, bc: 816, sx: 852, sw: 896, sop: 966, os: 998, st: 1072, og: 1104 };
  const TRK = { G: 178, S: 202, R: 226 };
  const GROUPS = [null,
    [88, 296, 'load', [['G', 'r'], ['S', 'w']]],
    [296, 342, 'Σ x²', [['S', 'r'], ['R', 'c']]],
    [344, 526, 'warp butterfly', [['R', 'c'], ['R', 'c']]],
    [526, 570, 'lane 0', [['R', 'r'], ['S', 'w']]],
    [570, 788, 'block butterfly', [['S', 'r'], ['R', 'c'], ['S', 'w']]],
    [788, 838, 'rsqrt', [['S', 'r'], ['R', 'c']]],
    [842, 1048, 'scale', [['S', 'r'], ['R', 'c'], ['S', 'w']]],
    [1048, 1152, 'store', [['S', 'r'], ['R', 'r'], ['G', 'w']]]];

  /* ---- drawing primitives that follow the zoom ---- */
  // a folded buffer: 256 rows × 8 columns; hl = [{r: [a, b], c: [c0, c1], fill, op, stroke, dash}]
  const grid = (x, name, hl = []) => {
    let o = R(x, Y0, GW, 256 * sp, `fill="${C.hatch}" stroke="${C.dim}"`);
    for (const h of hl) {
      const a = `fill="${h.fill || 'none'}" fill-opacity="${h.op ?? 1}" stroke="${h.stroke || 'none'}" stroke-width="${h.sw || 1.6}" ${h.dash ? 'stroke-dasharray="3 2"' : ''}`;
      o += R(x + h.c[0] * CW, Y0 + h.r[0] * sp, (h.c[1] - h.c[0]) * CW, (h.r[1] - h.r[0]) * sp, a);
    }
    for (let c = 1; c < 8; c++) o += L(x + c * CW, Y0, x + c * CW, Y0 + 256 * sp, `stroke="${C.bg}" stroke-width="1"`);
    if (big()) for (let r = 1; r < nv(); r++) o += L(x, Y0 + r * sp, x + GW, Y0 + r * sp, `stroke="${C.bg}" stroke-width=".8" stroke-opacity=".8"`);
    else for (let w = 1; w < 8; w++) o += L(x, Y0 + 32 * w * sp, x + GW, Y0 + 32 * w * sp, `stroke="${C.bg}" stroke-width="1.2"`);
    // the gold annotations go on top of the separators
    for (const h of hl) if (h.top) o += R(x + h.c[0] * CW, Y0 + h.r[0] * sp, (h.c[1] - h.c[0]) * CW, (h.r[1] - h.r[0]) * sp,
      `fill="none" stroke="${h.top}" stroke-width="1.8" ${h.dash ? 'stroke-dasharray="3 2"' : ''}`);
    return o;
  };
  const ALL = { r: [0, 256], c: [0, 8] };
  const USED = { ...ALL, top: C.gold };                  // the data the current step reads: a gold border
  const WROTE = { ...ALL, fill: C.green, op: .45 }, HELD = { ...ALL, fill: C.green, op: .2 };
  // a brace under a grid; its size follows the zoom: the whole buffer zoomed out, rows 0–31 zoomed in
  const curly = (x1, y1, x2, y2, w, q = 0.6) => {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(.75, 1 - q)} T${tip}`;
  };
  const size = (x) => {
    const y = Y0 + H + 3;
    return `<path d="${curly(x, y, x + GW, y, 7)}" fill="none" stroke="${C.cyan}" stroke-width="1.2"/>`
      + T(x + GW / 2, y + 20, '4 KB', `font-size="12" fill="${C.cyan}" text-anchor="middle" opacity="${1 - zz}"`)
      + T(x + GW / 2, y + 20, '512 B', `font-size="12" fill="${C.cyan}" text-anchor="middle" opacity="${zz}"`);
  };
  const wires = (x1, x2, a = 0, b = 256, op = .45, col = C.cyan, w) => {
    let o = '';
    for (let t = a; t < Math.min(b, nv()); t++) o += L(x1, Y(t), x2, Y(t), `stroke="${col}" stroke-width="${w ?? (big() ? 1 : .5)}" stroke-opacity="${op}"`);
    return o;
  };
  const dots = (x, col, a = 0, b = 256) => {
    const e = Math.min(b, nv());
    if (e <= a) return '';
    if (!big()) return R(x - 2, Y0 + a * sp, 4, (e - a) * sp, `fill="${col}" fill-opacity=".9"`);
    let o = '';
    for (let t = a; t < e; t++) o += dot(x, Y(t), Math.min(2.4, sp / 3.2), col);
    return o;
  };
  // phase 'pair': only lane 0 and its partner (gold: own value + received value, a + b / b + a)
  // phase 'a' / 'full': every lane — own value (faint straight), received value (crossing), the add (dots)
  // pair: the partner of lane 0, drawn in gold for the current stage
  const bfly = (x1, x2, off, a, b, phase = 'full', pair = 0) => {
    let o = '';
    const sw = big() ? 1 : .45;
    if (phase !== 'pair') {
      for (let t = a; t < Math.min(b, nv()); t++)
        o += L(x1, Y(t), x2, Y(t), `stroke="${C.cyan}" stroke-width="${sw}" stroke-opacity=".35"`)
          + L(x1, Y(t ^ off), x2, Y(t), `stroke="${C.cyan}" stroke-width="${sw * 1.2}"`);
      o += dots(x2, C.gold, a, b);
    }
    if (pair) {
      for (const t of [0, pair])
        o += L(x1, Y(t), x2, Y(t), `stroke="${C.gold}" stroke-width="1.6" stroke-opacity=".55"`)
          + L(x1, Y(t ^ off), x2, Y(t), `stroke="${C.gold}" stroke-width="2.4"`) + dot(x2, Y(t), 3.6, C.gold);
      if (phase === 'pair') o += Y(pair) - Y(0) < 14   // neighbours: one label for both
        ? sm(x2 + 7, (Y(0) + Y(pair)) / 2 + 4, 'a + b, b + a', C.gold)
        : sm(x2 + 7, Y(0) + 4, 'a + b', C.gold) + sm(x2 + 7, Y(pair) + 4, 'b + a', C.gold);
    }
    return o;
  };
  // a reduce_smem cell: green once written; a gold border when the current step reads it
  const cell = (x, y, used) => {
    const h = Math.max(5, Math.min(sp - 1, 8));
    return R(x - 4, y - h / 2, 8, h, `fill="${C.green}" fill-opacity=".85" stroke="${used ? C.gold : 'none'}" stroke-width="1.6"`);
  };
  const head = (x, s, col = C.slate) => T(x, Y0 - 9, s, `font-size="11" fill="${col}" text-anchor="middle" class="mono"`);

  // the tree that feeds lane 0 and its partner at the current stage n (0-based index n - 1):
  // walking back, stage i must have produced the lanes stage i + 1 reads (t and t ⊕ offset)
  const tree = (x0, xs, offs, n) => {
    let need = new Set([0, offs[n - 1]]), o = '';
    const sets = [];
    for (let i = n - 2; i >= 0; i--) {
      sets[i] = need;                                    // lanes stage i outputs that the tree needs
      need = new Set([...need].flatMap((t) => [t, t ^ offs[i]]));
    }
    for (let i = 0; i < n - 1; i++) {
      const x1 = i ? xs[i - 1] : x0, x2 = xs[i];
      for (const t of sets[i])
        o += L(x1, Y(t), x2, Y(t), `stroke="${C.gold}" stroke-width="1.2" stroke-opacity=".3"`)
          + L(x1, Y(t ^ offs[i]), x2, Y(t), `stroke="${C.gold}" stroke-width="1.6" stroke-opacity=".5"`)
          + dot(x2, Y(t), 2.6, C.gold, .8);
    }
    return [o, need];                                    // need: the lanes read by the first stage
  };

  /* ---- the 8 groups ---- */
  const group = (g, S) => {                              // S = [current group, sub-step]
    let o = '', h = '';                                   // o: clipped to the lane area, h: headers
    const cur = S[0] === g;
    if (g === 1) {
      o += grid(X.xg, 'x', cur ? [USED] : []) + grid(X.wg, 'w', cur ? [USED] : [])
        + R(X.wg + GW, Y0, X.xs - X.wg - GW, 256 * sp, `fill="${C.blue}" fill-opacity=".14"`)
        + grid(X.xs, 'x_s', [WROTE]) + grid(X.ws, 'w_s', [WROTE]);
      h += T(X.wg + GW + 13, Y0 - 22, 'cp.async', `font-size="11" fill="${C.blue}" text-anchor="middle"`)
        + head(X.xg + GW / 2, 'x') + head(X.wg + GW / 2, 'w') + head(X.xs + GW / 2, 'x_s') + head(X.ws + GW / 2, 'w_s')
        + size(X.xg) + size(X.wg) + size(X.xs) + size(X.ws);
    }
    if (g === 2) {
      // Σ x² reads x_s only: its wires pass behind w_s
      o += grid(X.xs, 'x_s', cur ? [HELD, USED] : [HELD])
        + wires(X.xs + GW, X.sq, 0, 256, .6, C.blue)
        + grid(X.ws, 'w_s', [HELD])
        + dots(X.sq, C.gold);
      h += head(X.sq - 8, 'Σv²', C.gold);
    }
    if (g === 3) {
      const n = cur ? S[1][0] : 5;
      let xp = X.sq;
      [16, 8, 4, 2, 1].slice(0, n).forEach((off, i) => {
        const now = cur && i === n - 1;
        o += `<g opacity="${cur && !now ? .4 : 1}">${bfly(xp, X.b[i], off, 0, 256, now ? S[1][1] : 'full', now ? off : 0)}</g>`;
        h += head(X.b[i] + (i ? 0 : 6), `⊕${off}`, now ? C.gold : C.cyan);
        xp = X.b[i];
      });
      if (cur && n > 1) o += tree(X.sq, X.b, [16, 8, 4, 2, 1], n)[0];
    }
    if (g === 4) {
      // reduce_smem: cell w faces lane 0 of warp w when zoomed out, lane w of warp 0 when zoomed in
      for (let w = 0; w < 8; w++) {
        const cy = Y(32 * w) + (Y(w) - Y(32 * w)) * zz;
        o += L(X.b[4], Y(32 * w), X.rw - 4, cy, `stroke="${C.gold}" stroke-width="1.6"`) + cell(X.rw, cy);
      }
      h += head(X.rw, 'red');
    }
    if (g === 5) {
      o += wires(X.rw + 4, X.b8[2], 8, 256, .15, C.slate);
      const n = cur ? S[1][0] : 3, done = n === 3 && (!cur || S[1][1] === 'w');
      for (let w = 0; w < 8; w++) {
        const cy = Y(32 * w) + (Y(w) - Y(32 * w)) * zz;
        o += cell(X.rw, cy, cur && n === 0) + L(X.rw + 4, cy, X.rd, Y(w), `stroke="${C.blue}" stroke-width="1.4"`);
      }
      o += dots(X.rd, C.gold, 0, 8);
      let xp = X.rd;
      [4, 2, 1].slice(0, n).forEach((off, i) => {
        const now = cur && i === n - 1;
        o += `<g opacity="${cur && !now ? .4 : 1}">${bfly(xp, X.b8[i], off, 0, 8, now ? S[1][1] : 'full', now ? off : 0)}</g>`;
        h += head(X.b8[i], `⊕${off}`, now ? C.gold : C.cyan);
        xp = X.b8[i];
      });
      if (cur && n > 1) {
        const [tr, need] = tree(X.rd, X.b8, [4, 2, 1], n);
        o += tr;
        for (const w of need) o += L(X.rw + 4, Y(w), X.rd, Y(w), `stroke="${C.gold}" stroke-width="1.6" stroke-opacity=".5"`);
      }
      if (done) o += L(X.b8[2], Y(0), X.r0 - 4, Y(0), `stroke="${C.gold}" stroke-width="1.6"`) + cell(X.r0, Y(0));
      if (done) h += head(X.r0, 'red[0]');
    }
    if (g === 6) {
      o += cell(X.r0, Y(0), cur);
      for (let t = 0; t < 256; t += big() && t >= 32 ? 16 : 1) o += Q(X.r0 + 4, Y(0), X.r0 + 18, Y(t), X.bc, Y(t), C.blue, big() ? .9 : .5, .55);
      o += dots(X.bc, C.gold);
      h += head(X.bc, 'rsqrt', C.gold);
    }
    if (g === 7) {
      // scale reads x_s and w_s (the wires from x_s pass behind w_s), writes out_s
      o += wires(X.bc, X.sx, 0, 256, .25, C.slate)
        + grid(X.sx, 'x_s', cur ? [HELD, USED] : [HELD]) + wires(X.sx + GW, X.sw, 0, 256, .6, C.blue)
        + grid(X.sw, 'w_s', cur ? [HELD, USED] : [HELD]) + wires(X.sw + GW, X.sop, 0, 256, .6, C.blue)
        + dots(X.sop, C.gold) + wires(X.sop, X.os, 0, 256, .6, C.green)
        + grid(X.os, 'out_s', [WROTE]);
      h += head(X.sx + GW / 2, 'x_s') + head(X.sw + GW / 2, 'w_s') + head(X.sop, '×', C.gold) + head(X.os + GW / 2, 'out_s')
        + size(X.sx) + size(X.sw) + size(X.os);
    }
    if (g === 8) {
      o += grid(X.os, 'out_s', cur ? [HELD, USED] : [HELD])
        + R(X.os + GW, Y0, X.og - X.os - GW, 256 * sp, `fill="${C.green}" fill-opacity=".14"`)
        + R(X.st - 3, Y0, 6, 256 * sp, `fill="${C.slate}" fill-opacity=".5"`)
        + grid(X.og, 'out', [WROTE]);
      h += head(X.st, 'regs') + head(X.og + GW / 2, 'out') + size(X.og);
    }
    return [o, h];
  };

  /* ---- the figure ---- */
  const fig = (st, showCur) => {
    let o = '<defs><clipPath id="lanes' + CLIP + '"><rect x="0" y="' + (Y0 - 1) + '" width="1280" height="' + (H + 2) + '"/></clipPath></defs>';
    // subway tracks + legend
    [['G', 'GMEM'], ['S', 'SMEM'], ['R', 'REG']].forEach(([k, s]) =>
      o += T(70, TRK[k] + 4, s, `font-size="12" font-weight="600" letter-spacing=".06em" fill="${C.slate}" text-anchor="end"`)
        + L(80, TRK[k], 1152, TRK[k], `stroke="${C.dim}" stroke-dasharray="1 4"`));
    [[C.blue, 'read', 960], [C.gold, 'compute', 1030], [C.green, 'write', 1120]].forEach(([c, s, x]) =>
      o += dot(x + 5, 136, 5, c) + sm(x + 14, 140, s));
    let lanes = '', heads = '';
    const S = STEPS[st];
    for (let g = 1; g <= Math.min(S[0], 8); g++) {
      if (g === S[0] && !showCur) {
        if (g === 1) { lanes += grid(X.xg, 'x') + grid(X.wg, 'w'); heads += head(X.xg + GW / 2, 'x') + head(X.wg + GW / 2, 'w') + size(X.xg) + size(X.wg); }
        break;
      }
      const [x0, x1, lab, hops] = GROUPS[g], cur = g === S[0];
      const [lo, ho] = group(g, S);
      let gg = '';
      if (cur) gg += R(x0, 148, x1 - x0, Y0 + H + 4 - 148, `fill="${C.gold}" fill-opacity=".05" rx="4"`);
      gg += T((x0 + x1) / 2, 160, lab, `font-size="12" font-weight="600" fill="${cur ? C.gold : C.slate}" text-anchor="middle"`);
      const n = hops.length, xs = hops.map((hp, i) => x0 + 10 + (x1 - x0 - 20) * (hp[3] ?? (n === 1 ? .5 : i / (n - 1))));
      gg += `<polyline points="${hops.map(([t], i) => `${xs[i]},${TRK[t]}`).join(' ')}" fill="none" stroke="${C.ink}" stroke-width="1.5" stroke-opacity=".6"/>`;
      hops.forEach(([t, k, m = 1], i) => {
        if (m === 1) gg += dot(xs[i], TRK[t], 5, KC[k]);
        else for (let j = 0; j < m; j++) gg += dot(xs[i] + (j - (m - 1) / 2) * 4.6, TRK[t], 2.2, KC[k]);   // one dot per warp
      });
      o += `<g opacity="${cur ? 1 : .5}">${gg}${ho}</g>`;
      lanes += `<g opacity="${cur ? 1 : .5}">${lo}</g>`;
    }
    o += heads + `<g clip-path="url(#lanes${CLIP})">${lanes}</g>`;
    // warp labels, on the left; they follow the zoom (warps 1–7 slide out at the bottom)
    const z = Math.log(sp / SPM) / Math.log(SPS / SPM);
    const ids1 = IDS.includes('1');
    for (let w = 0; w < 8; w++) {
      const y = Y(32 * w + 16);
      if (y < Y0 + H) o += sm(ids1 ? 62 : 88, y - 2, `warp ${w}`, C.slate, 'text-anchor="end"')
        + T(ids1 ? 62 : 88, y + 11, '512 B', `font-size="11" fill="${C.cyan}" text-anchor="end" opacity="${1 - z}"`);
    }
    // option 1: lane numbers when zoomed on warp 0 (lane = thread id in warp 0)
    if (ids1 && z > .5) {
      const op = Math.min(1, (z - .5) * 2);
      let g = sm(88, Y0 - 9, 'lane', C.slate, 'text-anchor="end"')
        + T(88, Y0 + H + 20, '16 B / lane', `font-size="11" fill="${C.cyan}" text-anchor="end"`);
      for (let l = 0; l < 32; l++) {
        g += `<line x1="90" y1="${Y(l)}" x2="94" y2="${Y(l)}" stroke="${C.slate}" stroke-width=".8"/>`;
        if (l % 4 === 0 || l === 31) g += T(87, Y(l) + 3.5, l, `font-size="10" fill="${C.ink}" text-anchor="end" class="mono"`);
      }
      o += `<g opacity="${op}">${g}</g>`;
    }
    return o;
  };

  let nfig = 0;
  document.querySelectorAll('div.mk[data-rn="zoom"]').forEach((root) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector('[data-rn-cap="zoom"]');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let curSt = 0, curZ = ZOOM[0], raf = 0;
    const mode = root.dataset.ids || '';
    const clip = `-${++nfig}`;
    const draw = (st, z, showCur) => { IDS = mode; CLIP = clip; zz = z; sp = SPM * Math.pow(SPS / SPM, z); svg.innerHTML = fig(st, showCur); };
    steps(root, NS, (st) => {
      cancelAnimationFrame(raf);
      if (st === null) { cap.innerHTML = CAPS[NS]; draw(NS, ZOOM[NS], true); return; }
      const prev = curSt, z0 = curZ, z1 = ZOOM[st];
      curSt = st;
      cap.innerHTML = CAPS[st];
      if (z0 === z1 || reduce) { curZ = z1; draw(st, z1, true); return; }
      // zoom first (the new step's drawing appears when the zoom lands), 900 ms ease-in-out
      const t0 = performance.now(), D = 900;
      const tick = (now) => {
        const f = Math.min(1, (now - t0) / D), e = f < .5 ? 2 * f * f : 1 - (2 - 2 * f) ** 2 / 2;
        curZ = z0 + (z1 - z0) * e;
        draw(st, curZ, f === 1 || st < prev);
        if (f < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  });
})();
