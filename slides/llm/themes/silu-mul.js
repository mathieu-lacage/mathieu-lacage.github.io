// « Megakernels », section « SiLU-mul Layer » (tasks/ampere/silu_mul.cuh, 48 tasks, 256-thread worker, batch 4).
// Two figures, both stepped with steps.js (load it first):
//  - <div class="mk" data-sl="layer">: in (4 × 12288, 48 chunks of 128 gate | 128 up) and out (4 × 6144)
//    at the same scale; task 0, task 1, then all 48 own one column slice of each.
//  - <div class="mk" data-sl="task">: task 0's slice cut into 32-column warp segments, pass by pass; zoom on
//    warp 0: 32 lanes × 2 B per buffer, lane 0's silu(g) · u.
// Caption in <div class="rn-cap" data-sl-cap>.
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
  const curly = (x1, y1, x2, y2, w, q = 0.6) => {
    const len = Math.hypot(x1 - x2, y1 - y2), dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(.25, 1 - q)} T${tip} M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(.75, 1 - q)} T${tip}`;
  };
  // brace: side, from a to b along the edge e; fs = label size
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
  const legend = (y = 140) => [[C.blue, 'read', 960], [C.gold, 'compute', 1030], [C.green, 'write', 1120]]
    .map(([c, s, x]) => dot(x + 5, y - 4, 5, c) + sm(x + 14, y, s)).join('');
  const G_OP = .34, U_OP = .14;                       // gate / up tints of unread data

  /* ================= A1: rows, in and out sliced across the 48 tasks ================= */
  const A1 = (() => {
    const X0 = 170, CW = 20, OCW = 10, RH = 24;        // same scale: an in chunk = 256 cols, an out chunk = 128
    const IY = (b) => 200 + b * 30, OY = (b) => 430 + b * 30;
    const ix = (j) => X0 + j * CW + CW / 2, ox = (j) => X0 + j * OCW + OCW / 2;
    const link = (j, a) => P(`M${ix(j)},${IY(3) + RH + 3} C${ix(j)},${IY(3) + RH + 60} ${ox(j)},${OY(0) - 60} ${ox(j)},${OY(0) - 3}`, C.ink, 1.2, a);
    // focus: -1 none, j = task j, 48 = all
    const S = [-1, 0, 1, 48];
    const draw = (st) => {
      const f = S[st];
      let o = '';
      o += nm(80, IY(1) + 28, 'in') + nm(80, OY(1) + 28, 'out');
      for (let b = 0; b < 4; b++) {
        o += T(X0 - 10, IY(b) + 16, `token ${b}`, `font-size="12" fill="${C.slate}" text-anchor="end"`) + box(X0, IY(b), 48 * CW, RH);
        for (let j = 0; j < 48; j++)
          o += fill(X0 + j * CW, IY(b), CW / 2, RH, C.blue, .6) + fill(X0 + j * CW + CW / 2, IY(b), CW / 2, RH, C.blue, .3);
        for (let j = 1; j < 48; j++) o += L(X0 + j * CW, IY(b), X0 + j * CW, IY(b) + RH, `stroke="${C.bg}" stroke-width="1.2"`);
        o += T(X0 - 10, OY(b) + 16, `token ${b}`, `font-size="12" fill="${C.slate}" text-anchor="end"`)
          + box(X0, OY(b), 48 * OCW, RH) + fill(X0, OY(b), 48 * OCW, RH, C.green, .45);
        for (let j = 1; j < 48; j++) o += L(X0 + j * OCW, OY(b), X0 + j * OCW, OY(b) + RH, `stroke="${C.bg}" stroke-width="1"`);
      }
      o += brace('top', X0, X0 + 960, IY(0), '48 × 128 × 2 = 6144 × 2 = 12288 · 24 KB / token') + brace('right', OY(0), OY(3) + RH, X0 + 480, '48 × 128 = 6144 · 12 KB / token');
      if (f === 48) {
        for (let j = 0; j < 48; j++) o += link(j, 'stroke-opacity=".3"');
        [0, 1, 2, 47].forEach((j) => o += mo(ox(j), OY(3) + RH + 16, j, C.ink, 'text-anchor="middle" font-size="10"'));
        o += mo(ox(24), OY(3) + RH + 16, '⋯', C.slate, 'text-anchor="middle"');
        o += mo(X0 + 500, OY(3) + RH + 16, 'task', C.slate);
      } else if (f >= 0) {
        o += own(X0 + f * CW, IY(0), CW, IY(3) + RH - IY(0)) + own(X0 + f * OCW, OY(0), OCW, OY(3) + RH - OY(0)) + link(f);
        o += T(X0 + (f + 1) * CW + 10, IY(3) + RH + 18, '128 gate | 128 up · 512 B / token', `font-size="12" fill="${C.ink}" class="mono"`)
          + T(X0 + (f + 1) * OCW + 10, OY(0) - 10, '128 · 256 B / token', `font-size="12" fill="${C.ink}" class="mono"`);
        o += mo(ix(f), IY(0) - 30, `task ${f}`, C.ink, 'text-anchor="middle" font-size="12"');
      }
      return o;
    };
    const caps = [
      '<b>in</b>: 4 tokens × 12288 bf16, laid out as <b>48 chunks</b> of 128 gate | 128 up. <b>out</b> = silu(gate) · up: 4 × 6144',
      '<b>Task 0</b> owns chunk 0 of every token in, and the matching 128 columns of out',
      '<b>Task 1</b>: the next chunk, 512 B further along each row',
      '<b>48 tasks</b> on 48 SMs: 2 KB in, 1 KB out each — no overlap, nothing shared'];
    return [draw, caps];
  })();

  /* ================= B1: the slice, warp segments, then one warp's lanes ================= */
  const B1 = (() => {
    const IX = 250, OX = 860, PX = 2, RY = (b) => 214 + b * 32, RH = 24;    // 2 px per column
    const SEG = 32 * PX;
    const ZY = 436, ZH = 26, LW = 8;                                         // zoom strips: 8 px per lane
    // [pass, phase] phase: 0 slice, 1 read, 2 zoom read, 3 zoom write, 4 write
    const S = [[-1, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 1], [1, 4]];
    const draw = (st) => {
      const [p, ph] = S[st];
      let o = legend();
      o += nm(IX + 256, RY(0) - 46, 'in') + nm(OX + 128, RY(0) - 46, 'out');
      const passOf = (b) => b >> 1;
      for (let b = 0; b < 4; b++) {
        const y = RY(b);
        o += T(IX - 10, y + 16, `token ${b}`, `font-size="12" fill="${C.slate}" text-anchor="end"`);
        o += box(IX, y, 512, RH) + fill(IX, y, 256, RH, C.blue, G_OP) + fill(IX + 256, y, 256, RH, C.blue, U_OP) + box(OX, y, 256, RH);
        const done = p >= 0 && (passOf(b) < p || (passOf(b) === p && ph >= 4));
        const act = p >= 0 && passOf(b) <= p && !(passOf(b) < p && false);
        if (act && (passOf(b) < p || ph >= 1)) o += fill(IX, y, 256, RH, C.blue, .45) + fill(IX + 256, y, 256, RH, C.blue, .3);
        if (done) o += fill(OX, y, 256, RH, C.green, .7);
        for (let s = 1; s < 8; s++) o += L(IX + s * SEG, y, IX + s * SEG, y + RH, `stroke="${C.bg}" stroke-width="${s === 4 ? 2 : 1}"`);
        for (let s = 1; s < 4; s++) o += L(OX + s * SEG, y, OX + s * SEG, y + RH, `stroke="${C.bg}" stroke-width="1"`);
        // warp labels for the current pass
        if (p >= 0 && passOf(b) === p && ph >= 1) for (let s = 0; s < 4; s++) {
          const w = 4 * (b & 1) + s, lab = (x) => mo(x + SEG / 2, y + 16, `w${w}`, C.ink, 'text-anchor="middle" font-size="12"');
          o += lab(IX + s * SEG) + lab(IX + 256 + s * SEG) + (ph >= 3 ? lab(OX + s * SEG) : '');
        }
        if (p >= 0 && passOf(b) === p && ph === 1) o += gold(IX, y, 512, RH);
      }
      o += brace('top', IX, IX + 256, RY(0), 'gate · 256 B', 8, 13) + brace('top', IX + 256, IX + 512, RY(0), 'up · 256 B', 8, 13)
        + brace('top', OX, OX + 256, RY(0), '256 B', 8, 13);
      // zoom on warp 0 (pass 0): its three 64 B segments open into 32 lanes
      if (ph === 2 || ph === 3) {
        const y0 = RY(0) + RH, strips = [[IX, IX - 10, 'g', 1], [IX + 256, IX + 266, 'u', 1], [OX, OX, 'out', 0]];
        o += gold(IX, RY(0), SEG, RH) + gold(IX + 256, RY(0), SEG, RH);
        if (ph === 3) o += R(OX - 1, RY(0) - 1, SEG + 2, RH + 2, `fill="none" stroke="${C.green}" stroke-width="2"`);
        strips.forEach(([sx, zx, s, isIn]) => {
          o += P(`M${sx},${y0 + 2} L${zx},${ZY - 4} M${sx + SEG},${y0 + 2} L${zx + 32 * LW},${ZY - 4}`, C.ink, 1, 'stroke-dasharray="2 4" stroke-opacity=".45"');
          o += box(zx, ZY, 32 * LW, ZH);
          if (isIn) o += fill(zx, ZY, 32 * LW, ZH, C.blue, s === 'g' ? .75 : .55) + gold(zx, ZY, 32 * LW, ZH);
          else if (ph === 3) o += fill(zx, ZY, 32 * LW, ZH, C.green, .8);
          for (let l = 1; l < 32; l++) o += L(zx + l * LW, ZY, zx + l * LW, ZY + ZH, `stroke="${C.bg}" stroke-width="${l === 16 ? 2 : .8}"`);
          [0, 8, 16, 24, 31].forEach((l) => o += mo(zx + l * LW + LW / 2, ZY + ZH + 14, l, C.slate, 'text-anchor="middle" font-size="10"'));
          o += brace('bottom', zx, zx + 32 * LW, ZY + ZH + 18, '64 B', 8, 13);
        });
        o += T(IX - 20, ZY + 17, 'warp 0', `font-size="13" fill="${C.ink}" text-anchor="end"`)
          + T(IX - 20, ZY + ZH + 14, 'lane', `font-size="11" fill="${C.slate}" text-anchor="end"`);
        if (ph === 3) {
          // per lane: g and u → silu(g)·u → out; lane 0 in gold, the others faint
          const cx = 790, cy = ZY - 26;
          for (let l = 31; l >= 0; l--) {
            const col = l ? C.cyan : C.gold, op = l ? .14 : 1, w = l ? .8 : 1.6;
            const gx = IX - 10 + l * LW + LW / 2, ux = IX + 266 + l * LW + LW / 2, ox = OX + l * LW + LW / 2;
            o += P(`M${gx},${ZY} Q${gx},${cy} ${cx},${cy}`, col, w, `stroke-opacity="${op}"`)
              + P(`M${ux},${ZY} Q${ux},${cy} ${cx},${cy}`, col, w, `stroke-opacity="${op}"`)
              + P(`M${cx},${cy} Q${ox},${cy} ${ox},${ZY}`, l ? C.green : C.gold, w, `stroke-opacity="${l ? .2 : 1}"`);
          }
          o += dot(cx, cy, 5, C.gold) + T(cx, cy - 10, 'silu(g) · u', `font-size="12" fill="${C.gold}" text-anchor="middle" class="mono"`);
        }
      }
      return o;
    };
    const caps = [
      'Task 0\'s slice: per token, 128 gate + 128 up columns in, 128 columns out. 256 threads = 8 warps',
      '<b>Pass 0</b> (i = t): warps 0–3 take token 0, warps 4–7 token 1, 32 columns per warp',
      'Warp 0: lane l reads column l of g and of u, 2 B each — <b>64 B</b> per warp, one request',
      'Each lane computes silu(g) · u and stores 2 B: 64 B per warp',
      'Pass 0 done: tokens 0 and 1',
      '<b>Pass 1</b> (i = t + 256): the same warps, same columns, tokens 2 and 3',
      'Each thread handled 2 elements; no SMEM, no synchronisation'];
    return [draw, caps];
  })();

  const FIGS = { layer: A1, task: B1 };
  document.querySelectorAll('div.mk[data-sl]').forEach((root) => {
    const [draw, caps] = FIGS[root.dataset.sl];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector('[data-sl-cap]');
    steps(root, caps.length - 1, (st) => {
      if (st === null) st = caps.length - 1;
      svg.innerHTML = draw(st);
      cap.innerHTML = caps[st];
    });
  });
})();
