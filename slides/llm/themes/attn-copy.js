// « Megakernels », « Accumulate from GMEM into registers »: task (r2, KV 5) of the attention layer
// (tasks/blackwell/attention_sm100.cuh), drawn like the linear task's ring slide (themes/megakernel.js), top to
// bottom: GMEM (attn_in's slice of the task, the K and V page pools), SMEM (Q once, a double buffer of 64-key
// K and V tiles, cp.async by all 128 threads), registers (mma.sync: per warp its 16 keys of the tile, S_w and
// the partial O_w). Bottom right, the same work as matrices: request 2's 16 query heads, this task's rows
// 10, 11. 1024 keys in 4 pages of 256 (6, 2, 9, 0), 16 tiles. One step per tile, no animation; each step's
// moves are drawn as curved arrows (copy, compute, and at tile 15 the store of the new K, V to page 0).
// Builds the figure inside every <div class="mk" data-mkc="copy">; its caption goes to the
// <div class="gq-cap" data-mkc-cap="copy"> next to it. Uses steps.js (load it first).
(() => {
  const C = { slide: '#0f1829', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', blue: '#4aa8ff', gold: '#f5c451',
    cyan: '#8fc5fa', hatch: '#1d2c44' };
  const COL = { Q: '#ff9f43', K: '#7cc47a', V: '#d97fd0', O: '#6d86ff' };
  const WARP = ['#4aa8ff', '#2fc6b8', '#a46cf5', '#c9d1dd'];
  const NS = 'http://www.w3.org/2000/svg';
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const sm = (x, y, s, a = '') => T(x, y, s, `font-size="13" fill="${C.slate}" ${a}`);
  const hd = (x, y, s) => T(x, y, s, `font-size="13" font-weight="600" fill="${C.slate}" letter-spacing=".08em"`);
  const TABLE = [6, 2, 9, 0], NT = 16, NPOOL = 12, OTHER = [1, 3, 4, 7, 8, 10];

  // ---- geometry ----
  // SMEM: Q (16 rows × 128), two slots of [Kᵀ tile (128 × 64) | V tile (64 × 128)], 4 bands of 16 keys each
  const SY = 302, Qs = { x: 160, y: SY + 14, w: 64, h: 64 };
  const slotX = (b) => 330 + b * 180, SLW = 160, SLH = 92;
  const kPart = (b) => [slotX(b) + 12, SY + 16, 48, 64];
  const vPart = (b) => [slotX(b) + 80, SY + 28, 64, 48];
  const kBand = (b, w) => [kPart(b)[0] + w * 12, kPart(b)[1], 12, 64];
  const vBand = (b, w) => [vPart(b)[0], vPart(b)[1] + w * 12, 64, 12];
  // the stage: per warp, S_w (16 × 16) and O_w (16 × 128) in registers
  const ST = { x: 330, y: 428, w: 340, h: 134 };
  const sW = (w) => [ST.x + 64, ST.y + 28 + w * 21, 14, 14];
  const oW = (w) => [ST.x + 92, ST.y + 28 + w * 21, 112, 14];
  // per warp, per Q head: max(S) and ΣP, 2 columns after O_w
  const vCol = (i) => ST.x + 214 + i * 44;
  // GMEM: attn_in's slice of the task (token 1023: Q10 Q11 K5 V5), the K and V page pools
  const AI = { x: 160, y: 186, s: 32, h: 14 };
  const aiSeg = (m) => [AI.x + m * AI.s, AI.y, AI.s - 1, AI.h];
  const PX = 330, PP = 62, PW = 56, KPY = 172, VPY = 212, PH = 26;
  const tileAt = (Y, t) => [PX + TABLE[t >> 2] * PP + (t & 3) * (PW / 4), Y, PW / 4, PH];
  const ctr = ([x, y, w, h]) => [x + w / 2, y + h / 2, w, h];

  const CAPS = [
    'Q and the new K, V are in <b>attn_in</b>, the 1023 cached keys in the <b>K and V pages</b>, all in GMEM',
    'Q first, once: 2 rows (Q heads 10, 11) into a 16-row SMEM tile, then RMSNorm + RoPE in SMEM',
    'Tile 0 = keys 0–63 = page 6, slots 0–63: all 128 threads <b>cp.async</b> its K and V into buffer 0',
    'Tile 1 is issued into buffer 1 <b>before</b> tile 0 is used: cp_async_wait&lt;1&gt; only waits for tile 0',
    'The 4 warps read tile 0 from SMEM: warp w takes its <b>16 keys</b>, S<sub>w</sub> = Q K<sub>w</sub>ᵀ, then O<sub>w</sub> += P<sub>w</sub> V<sub>w</sub> (mma.sync)',
    'Buffer 0 is free: tile 2 goes in while the warps work on tile 1',
    'Tiles 2 … 14: two buffers, one landing while the other is read. Page 2, 9, 0: only the page table changes',
    'Tile 15: K₅ gets RMSNorm + RoPE in SMEM; K₅, V₅ are <b>stored to page 0, slot 255</b>, then the 4 warps compute',
  ];

  const S0 = () => ({ q: false, buf: [{ t: -1, st: 'empty' }, { t: -1, st: 'empty' }], wr: 0, rd: -1, acc: 0, comp: -1,
    lit: {}, written: false });
  const clone = (s) => JSON.parse(JSON.stringify(s));
  // ev: what moves at this step, drawn as arrows (copy: GMEM → SMEM, mma: SMEM → registers, store: SMEM → GMEM)
  const issue = (S, t) => { S.buf[t % 2] = { t, st: 'loading' }; S.wr = t + 1; S.lit[t] = 'flight'; (S.ev ||= []).push(['copy', t]); };
  const land = (S, t) => { S.buf[t % 2].st = 'full'; };
  const read = (S, t) => { S.buf[t % 2].st = 'reading'; S.rd = t; S.comp = -1; S.lit[t] = 'read'; };
  const compute = (S, t) => { S.acc = t + 1; S.comp = t; (S.ev ||= []).push(['mma', t]); };
  const release = (S, t) => { S.buf[t % 2] = { t: -1, st: 'empty' }; S.lit[t] = 'done'; };

  // ---- the same work as matrices, for the whole task (bottom right): Q left of A = softmax(Q Kᵀ),
  // Kᵀ above A; A left of O, V above O. 1 key = ¼ px: a tile is 16 px, a warp's slice 4 px. Drawn from
  // the same state as GMEM / SMEM / registers, so the same tile lights up everywhere.
  // VK px per key, VH px for d_h = 128, VR px per Q row (the request's 16 query heads), X0 left edge, VY top
  const VK = 0.25, VH = 48, VR = 2, RR = 14, X0 = 760, VY = 252;   // RR: the task's 2 rows, enlarged
  const VQ = { x: X0, w: VH }, VA = { x: X0 + VH + 10, w: 1024 * VK }, VO = { x: X0 + VH + 10 + 1024 * VK + 10, w: VH };
  const VKT = VY + 1024 * VK - VH, VAY = VY + 1024 * VK + 8, VAH = 14 * VR + 2 * RR;
  // the task's rows among the request's 16 query heads: heads 10, 11 (KV head 5)
  const ROWS = [10, 11], ry = (r) => VAY + Math.min(r, 10) * VR + Math.max(0, Math.min(r, 12) - 10) * RR + Math.max(0, r - 12) * VR;
  const rh = (r) => (ROWS.includes(r) ? RR : VR);
  // O's heatmap: 8 cells per row, the mean of made-up values over the tiles done so far
  const ov = (r, j, t) => { const x = Math.sin(r * 131.1 + j * 17.3 + t * 7.7) * 43758.5453; return 2 * (x - Math.floor(x)) - 1; };
  const heat = (v) => (0.2 + 0.8 * Math.min(1, Math.max(0, (v + 1.5) / 3))).toFixed(2);
  const virt = (S) => {
    let o = '';
    const tileCol = (t, w) => {                                   // the colour of warp w's slice of tile t
      const st = S.lit[t];
      if (st === 'read') return [WARP[w], 1];
      if (st === 'flight') return ['url(#mc-hatch)', 1];       // in flight: the buffer's hatch
      if (st === 'done') return ['#35553a', 1];
      return [C.hatch, 1];
    };
    for (let t = 0; t < NT; t++) for (let w = 0; w < 4; w++) {
      const k0 = t * 64 + w * 16, [c, op] = tileCol(t, w), loaded = S.lit[t] === 'read' || S.lit[t] === 'done';
      // Kᵀ: 16 columns; V: 16 rows
      o += R(VA.x + k0 * VK, VKT, 16 * VK - 0.4, VH, `fill="${loaded ? COL.K : c}" fill-opacity="${loaded ? (S.lit[t] === 'read' ? 1 : 0.45) : op}"`)
        + R(VO.x, VY + k0 * VK, VH, 16 * VK - 0.4, `fill="${loaded ? COL.V : c}" fill-opacity="${loaded ? (S.lit[t] === 'read' ? 1 : 0.45) : op}"`);
      if (S.lit[t] === 'read') o += R(VA.x + k0 * VK, VKT + VH - 3, 16 * VK - 0.4, 3, `fill="${WARP[w]}"`) + R(VO.x + VH - 3, VY + k0 * VK, 3, 16 * VK - 0.4, `fill="${WARP[w]}"`);
      // A: the task's rows; this tile's 16 columns per warp once computed
      const done = t < S.acc, cur = t === S.comp;
      for (const r of ROWS) o += R(VA.x + k0 * VK, ry(r), 16 * VK - 0.4, RR - 1, `fill="${cur ? WARP[w] : done ? C.cyan : C.hatch}" fill-opacity="${cur ? 1 : done ? 0.45 : 1}"`);
    }
    // the other rows of Q, A and O: the other tasks' query heads, dim
    for (let r = 0; r < 16; r++) {
      if (ROWS.includes(r)) continue;
      for (const [x, w] of [[VQ.x, VQ.w], [VA.x, VA.w], [VO.x, VO.w]]) o += R(x, ry(r), w, rh(r) - 0.3, `fill="${C.hatch}" fill-opacity=".5"`);
    }
    // the task's rows: Q as a heatmap; O as the 4 warps' partials O_w = Σ P·V (not yet divided by ΣP) (one thin layer each, its colour on
    // the left), every layer updated at every tile; they become O only when merged, after the loop
    for (const r of ROWS) {
      o += R(VQ.x, ry(r), VQ.w, RR - 1, `fill="${C.hatch}"`) + R(VO.x, ry(r), VO.w, RR - 1, `fill="${C.hatch}"`);
      if (S.q) for (let j = 0; j < 8; j++) o += R(VQ.x + (j * VQ.w) / 8, ry(r), VQ.w / 8 - 0.4, RR - 1, `fill="${COL.Q}" fill-opacity="${heat(ov(r + 40, j, 0) * 1.5)}"`);
      for (let w = 0; w < 4; w++) {
        const y = ry(r) + (w * (RR - 1)) / 4, h = (RR - 1) / 4 - 0.3;
        o += R(VO.x - 3, y, 2, h, `fill="${WARP[w]}"`);
        if (S.acc) for (let j = 0; j < 8; j++) {
          let v = 0;
          for (let t = 0; t < S.acc; t++) v += ov(r * 4 + w, j, t);
          o += R(VO.x + (j * VO.w) / 8, y, VO.w / 8 - 0.4, h, `fill="${COL.O}" fill-opacity="${heat(v / Math.sqrt(S.acc))}"`);
        }
      }
    }
    [10, 11].forEach((r) => { o += T(VQ.x - 5, ry(r) + RR / 2 + 4, `h ${r}`, `font-size="10" fill="${S.q ? COL.Q : C.slate}" text-anchor="end"`); });
    // the new key: last column of Kᵀ, last row of V
    if (S.written || S.lit[15] === 'read') o += R(VA.x + 1023 * VK - 0.5, VKT, 1.5, VH, `fill="${C.gold}"`) + R(VO.x, VY + 1023 * VK - 0.5, VH, 1.5, `fill="${C.gold}"`);
    // pages: boundaries every 256 keys, page ids from the page table
    for (let p = 0; p < 4; p++) {
      const x = VA.x + p * 256 * VK, y = VY + p * 256 * VK;
      o += `<line x1="${x}" x2="${x}" y1="${VKT - 4}" y2="${VKT + VH}" stroke="${C.cyan}" stroke-opacity=".6"/>`
        + `<line x1="${VO.x}" x2="${VO.x + VH + 4}" y1="${y}" y2="${y}" stroke="${C.cyan}" stroke-opacity=".6"/>`
        + T(x + 32, VKT - 6, `page ${TABLE[p]}`, `font-size="10" fill="${C.cyan}" text-anchor="middle"`)
        + T(VO.x + VH + 6, y + 36, `p${TABLE[p]}`, `font-size="10" fill="${C.cyan}"`);
    }
    // frames and names
    const fr = (x, y, w, h) => R(x, y, w, h, `fill="none" stroke="${C.dim}"`);
    o += fr(VQ.x, VAY, VQ.w, VAH) + fr(VA.x, VKT, VA.w, VH) + fr(VO.x, VY, VO.w, 1024 * VK) + fr(VA.x, VAY, VA.w, VAH) + fr(VO.x, VAY, VO.w, VAH);
    const nm = (x, y, b) => T(x, y, b, `font-size="13" font-weight="600" fill="${C.ink}" text-anchor="middle" dominant-baseline="central" paint-order="stroke" stroke="${C.slide}" stroke-width="3"`);
    const ny = VAY + 4 * VR;                                       // the names, off the task's rows (above them)
    o += nm(VQ.x + VQ.w / 2, ny, 'Q') + nm(VA.x + VA.w / 2, VKT + VH / 2, 'Kᵀ') + nm(VO.x + VO.w / 2, VY + 128 * VK * 4 / 2 - 30, 'V')
      + nm(VA.x + VA.w / 2, ny, 'S') + T(VO.x + VO.w / 2, ny + 4, 'O<tspan font-size="8" dy="3">w</tspan>', `font-size="11" font-weight="600" fill="${C.ink}" text-anchor="middle" paint-order="stroke" stroke="${C.slide}" stroke-width="3"`);
    return o;
  };

  // ---- this step's moves as curved arrows: a cubic with vertical ends, from the bottom of the source
  // to the top of the target (or the reverse, going up), the head at the target ----
  const curve = (x1, y1, x2, y2, col, bend = 0) => {
    const dy = y2 - y1, k = Math.max(Math.abs(dy) * 0.55, 40) * Math.sign(dy || 1);
    return `<path d="M${x1},${y1} C${x1 + bend},${y1 + k} ${x2 + bend},${y2 - k} ${x2},${y2}" fill="none" stroke="${col}" stroke-width="2"
      stroke-opacity=".9" marker-end="url(#mc-ah-${col === C.gold ? 'g' : 'b'})"/>`;
  };
  const bot = ([x, y, w, h]) => [x + w / 2, y + h + 3], top = ([x, y, w]) => [x + w / 2, y - 4];
  const arrows = (S) => {
    let o = `<defs>${[['b', C.cyan], ['g', C.gold]].map(([n, c]) => `<marker id="mc-ah-${n}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="${c}"/></marker>`).join('')}</defs>`;
    for (const [kind, t] of S.ev || []) {
      if (kind === 'q') [0, 1].forEach((m) => { o += curve(...bot(aiSeg(m)), Qs.x + 16 + 32 * m, Qs.y - 4, C.cyan, 45 - 30 * m); });
      if (kind === 'copy') {
        // K leaves its page from the left side, so that its arrow goes round the V pool
        const [kx, ky, , kh] = tileAt(KPY, t);
        o += `<path d="M${kx - 3},${ky + kh / 2} C${kx - 60},${ky + kh / 2} ${top(kPart(t % 2))[0] - 40},${top(kPart(t % 2))[1] - 70} ${top(kPart(t % 2)).join(',')}" fill="none" stroke="${C.cyan}" stroke-width="2" stroke-opacity=".9" marker-end="url(#mc-ah-b)"/>`
          + curve(...bot(tileAt(VPY, t)), ...top(vPart(t % 2)), C.cyan, 30);
        if (t === 15) o += curve(...bot(aiSeg(2)), ...top(kPart(1)), C.cyan, -40) + curve(...bot(aiSeg(3)), ...top(vPart(1)), C.cyan, 40);
      }
      if (kind === 'mma') {
        // from the buffer's Kᵀ and V, down into the warps' rows, away from the read cursor
        const [kx, ky, kw, kh] = kPart(t % 2), [vx, vy, vw, vh] = vPart(t % 2);
        o += curve(kx + kw / 2, ky + kh + 3, ST.x + 70, ST.y + 20, C.cyan, -50) + curve(vx + vw / 2, vy + vh + 3, ST.x + 170, ST.y + 20, C.cyan, 50);
      }
      if (kind === 'store') {
        const [kx, ky, kw, kh] = tileAt(KPY, 15), [vx, vy, vw, vh] = tileAt(VPY, 15), [ax, ay] = top(kPart(1)), [bx, by] = top(vPart(1));
        o += curve(ax + 14, ay, kx + kw - 2, ky + kh + 3, C.gold, 40) + curve(bx + 20, by, vx + vw - 2, vy + vh + 3, C.gold, 60);
      }
    }
    return o;
  };

  const fig = (S) => {
    let o = `<defs><pattern id="mc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="${C.hatch}"/><line x1="0" y1="0" x2="0" y2="6" stroke="${C.blue}" stroke-width="2"/></pattern></defs>`;
    // ---- SMEM ----
    o += hd(160, SY - 8, 'SMEM');
    o += sm(Qs.x, Qs.y - 6, 'Q (16 × 128)');
    for (let r = 0; r < 16; r++) o += R(Qs.x, Qs.y + r * (Qs.h / 16), Qs.w, Qs.h / 16 - 0.5, `fill="${S.q && r < 2 ? COL.Q : C.hatch}"`);
    o += R(Qs.x - 2, Qs.y - 2, Qs.w + 4, Qs.h + 4, `fill="none" stroke="${C.dim}" stroke-dasharray="3 3"`);
    for (let b = 0; b < 2; b++) {
      const sl = S.buf[b], x = slotX(b);
      o += R(x, SY, SLW, SLH, `rx="4" fill="#141a25" stroke="${C.dim}" stroke-dasharray="3 3"`)
        + sm(x + SLW - 6, SY + SLH - 6, `buffer ${b}`, 'text-anchor="end" font-size="11"');
      if (sl.st === 'empty') continue;
      const fl = sl.st === 'loading';
      for (let w = 0; w < 4; w++) {
        const [kx, ky, kw, kh] = kBand(b, w), [vx, vy, vw, vh] = vBand(b, w);
        const fk = fl ? 'url(#mc-hatch)' : COL.K, fv = fl ? 'url(#mc-hatch)' : COL.V;
        o += R(kx, ky, kw - 1, kh, `fill="${fk}"`) + R(vx, vy, vw, vh - 1, `fill="${fv}"`);
        if (!fl) o += R(kx, ky + kh - 3, kw - 1, 3, `fill="${WARP[w]}"`) + R(vx + vw - 3, vy, 3, vh - 1, `fill="${WARP[w]}"`);
      }
      if (sl.t === 15 && !fl) {                                  // the new key: last column of Kᵀ, last row of V
        const [kx, ky, kw, kh] = kBand(b, 3), [vx, vy, vw, vh] = vBand(b, 3);
        o += R(kx + kw - 3, ky, 2, kh, `fill="${C.gold}"`) + R(vx, vy + vh - 3, vw, 2, `fill="${C.gold}"`);
      }
      o += T(x + 36, SY + 12, `Kᵀ, tile ${sl.t}`, `font-size="11" fill="${C.ink}" text-anchor="middle"`)
        + T(x + 112, SY + 22, `V, tile ${sl.t}`, `font-size="11" fill="${C.ink}" text-anchor="middle"`);
    }
    // cursors: wr = next tile issued by cp.async, rd = tile the warps read
    const cur = (t, col, lab, down) => (t < 0 || t >= NT ? '' : (() => {
      const x = slotX(t % 2) + SLW / 2, apex = down ? SY - 3 : SY + SLH + 3;
      return `<path d="M${x} ${apex} l-7 ${down ? -10 : 10} h14 z" fill="${col}"/>`
        + T(x, down ? apex - 14 : apex + 26, lab, `font-size="15" font-weight="600" fill="${col}" text-anchor="middle"`);
    })());
    o += cur(S.wr, C.blue, `cp.async t=${S.wr}`, true) + cur(S.rd, C.gold, `read t=${S.rd}`, false);

    // ---- the stage: per warp, 2 rows (Q heads 10, 11) of S_w, O_w, max(S), ΣP ----
    o += R(ST.x, ST.y, ST.w, ST.h, `rx="10" fill="none" stroke="${C.dim}" stroke-dasharray="6 5"`)
      + T(ST.x + 12, ST.y + 16, 'mma.sync m16n16k16', `font-size="13" fill="${C.slate}" class="mono"`) + hd(160, ST.y + 8, 'REGISTERS');
    for (let w = 0; w < 4; w++) {
      const [sx, sy, sw, sh] = sW(w), [ox, oy, ow, oh] = oW(w), hh = sh / 2;
      o += T(ST.x + 14, sy + 12, `warp ${w}`, `font-size="13" fill="${WARP[w]}"`);
      for (let b = 0; b < 2; b++) {
        const y = sy + b * hh;
        // S_w: its 16 keys of the tile, for this head; O_w: all 128 columns, changed by every tile
        o += R(sx, y, sw, hh - 0.8, `fill="${S.comp >= 0 ? C.gold : C.hatch}" fill-opacity="${S.comp >= 0 ? 0.8 : 1}"`)
          + R(ox, y, ow, hh - 0.8, `fill="${C.hatch}" stroke="${WARP[w]}" stroke-width=".8"`);
        if (S.acc) for (let j = 0; j < 16; j++) {
          let v = 0;
          for (let t = 0; t < S.acc; t++) { const x = Math.sin(w * 71.3 + b * 41.9 + j * 13.1 + t * 5.9) * 43758.5453; v += 2 * (x - Math.floor(x)) - 1; }
          v /= Math.sqrt(S.acc);
          o += R(ox + 1 + (j * (ow - 2)) / 16, y + 0.8, (ow - 2) / 16 - 0.5, hh - 2.4, `fill="${COL.O}" fill-opacity="${(0.2 + 0.8 * Math.min(1, Math.max(0, (v + 1.5) / 3))).toFixed(2)}"`);
        }
        // its running max(S) and ΣP for this head: no values, only that they are kept (and updated)
        for (let i = 0; i < 2; i++) o += R(vCol(i), y, 38, hh - 0.8, `fill="${C.gold}" fill-opacity="${S.acc ? (S.comp >= 0 ? 0.55 : 0.3) : 0}" stroke="${C.dim}"`);
      }
    }
    // headers: the two scalars (each warp's 2 rows: Q heads 10, 11)
    [['max(S)', 0], ['ΣP', 1]].forEach(([nm, i]) => {
      o += T(vCol(i) + 19, ST.y + 20, nm, `font-size="12" fill="${C.ink}" font-weight="600" text-anchor="middle"`);
    });
    o += sm(ST.x + 72, ST.y + ST.h - 8, 'S<tspan font-size="8" dy="2">w</tspan>', 'font-size="11" text-anchor="middle"')
      + sm(ST.x + 92, ST.y + ST.h - 8, `O<tspan font-size="8" dy="2">w</tspan><tspan dy="-2">: ${16 * S.acc} / 256 keys accumulated</tspan>`, 'font-size="11"');

    // ---- GMEM ----
    o += hd(160, AI.y - 32, 'GMEM');
    o += sm(AI.x, AI.y - 8, 'attn_in, token 1023');
    [['Q₁₀', COL.Q], ['Q₁₁', COL.Q], ['K₅', COL.K], ['V₅', COL.V]].forEach(([l, c], m) => {
      const [x, y, w, h] = aiSeg(m);
      // K5, V5 travel with tile 15: in flight while it is copied
      const fl = m >= 2 && S.lit[15] === 'flight';
      o += R(x, y, w, h, `fill="${fl ? 'url(#mc-hatch)' : c}"`) + T(x + w / 2, y + h + 13, l, `font-size="11" fill="${C.slate}" text-anchor="middle"`);
    });
    // request 2's page table: its 4 pages, in order; the page being read is gold, the one being copied hatched
    const PTY = AI.y + 56, rdPage = S.rd >= 0 && S.rd < NT ? S.rd >> 2 : -1;
    const flPage = Object.entries(S.lit).filter(([, st]) => st === 'flight').map(([t]) => +t >> 2);
    o += sm(AI.x, PTY - 6, 'page table, request 2');
    TABLE.forEach((p, n) => {
      const x = AI.x + n * 32, rd = n === rdPage, fl = flPage.includes(n);
      o += R(x, PTY, 30, 20, `fill="${fl && !rd ? 'url(#mc-hatch)' : C.slide}" stroke="${rd ? C.gold : C.cyan}" stroke-width="${rd ? 2 : 1}"`)
        + T(x + 15, PTY + 15, `${p}`, `font-size="13" fill="${C.ink}" text-anchor="middle" font-weight="600" paint-order="stroke" stroke="${C.slide}" stroke-width="3"`);
    });
    o += sm(PX, KPY - 8, 'pages of 256 slots × 8 KV heads; the task reads KV head 5') + sm(PX - 8, KPY + 18, 'K', 'text-anchor="end"')
      + sm(PX - 8, VPY + 18, 'V', 'text-anchor="end"');
    for (let p = 0; p < NPOOL; p++) {
      const mine = TABLE.includes(p), x = PX + p * PP;
      for (const Y of [KPY, VPY]) {
        o += R(x, Y, PW, PH, `fill="${OTHER.includes(p) ? '#27344d' : C.slide}" stroke="${mine ? C.cyan : C.dim}" stroke-width="${mine ? 1.5 : 1}"`);
        if (mine) for (let s = 1; s < 4; s++) o += `<line x1="${x + s * PW / 4}" x2="${x + s * PW / 4}" y1="${Y}" y2="${Y + PH}" stroke="${C.dim}"/>`;
      }
      o += T(x + PW / 2, VPY + PH + 15, mine ? `${p} · r2` : OTHER.includes(p) ? `${p}` : `${p} free`, `font-size="11" text-anchor="middle" fill="${mine ? C.cyan : C.slate}"`);
    }
    // the task's tiles in the pools: in flight (hatched, as in the buffers), being read (gold), done (dim)
    for (const [t, st] of Object.entries(S.lit)) {
      const col = st === 'flight' ? 'url(#mc-hatch)' : st === 'read' ? C.gold : '#35553a';
      for (const Y of [KPY, VPY]) { const [x, y, w, h] = tileAt(Y, +t); o += R(x + 1, y + 1, w - 2, h - 2, `fill="${col}" fill-opacity="${st === 'done' ? 0.8 : st === 'flight' ? 1 : 0.9}"`); }
    }
    if (S.written) for (const Y of [KPY, VPY]) { const [x, y, w, h] = tileAt(Y, 15); o += R(x + w - 3, y, 2, h, `fill="${C.gold}"`); }
    return o + virt(S) + arrows(S);
  };

  document.querySelectorAll('div.mk[data-mkc="copy"]').forEach((root) => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const base = document.createElementNS(NS, 'g');
    svg.append(base);
    const cap = root.parentElement.querySelector('[data-mkc-cap="copy"]');
    const render = (S) => { base.innerHTML = fig(S); };

    // ---- the steps: one state each, no animation; one step per tile ----
    const tick = (S, t) => { release(S, t - 1); if (t + 1 < NT) issue(S, t + 1); land(S, t); read(S, t); compute(S, t); };
    const APPLY = [
      (S) => { S.q = true; S.ev = [['q']]; },
      (S) => issue(S, 0),
      (S) => { issue(S, 1); land(S, 0); },
      (S) => { read(S, 0); compute(S, 0); },
      ...Array.from({ length: 14 }, (_, n) => (S) => tick(S, n + 1)),
      (S) => { tick(S, 15); S.written = true; S.ev.push(['store', 15]); },
    ];
    const STEP_CAPS = [...CAPS.slice(0, 5),
      ...Array.from({ length: 14 }, (_, n) => {
        const t = n + 1;
        if (t === 1) return CAPS[5];
        if (t % 4 === 0) return `Tile ${t}: <b>page ${TABLE[t >> 2]}</b> begins; only the page table lookup changes. Tile ${t + 1} goes into the other buffer`;
        if (t === 14) return 'Tile 14 is read while tile 15 is copied: keys 960–1022 from page 0, <b>K₅, V₅ (key 1023) from attn_in</b>';
        return `Tile ${t} (page ${TABLE[t >> 2]}) is read from buffer ${t % 2} while tile ${t + 1} is copied into buffer ${(t + 1) % 2}`;
      }),
      CAPS[7]];
    const STATES = [S0()];
    for (const f of APPLY) { const s = clone(STATES[STATES.length - 1]); s.ev = []; f(s); STATES.push(s); }
    steps(root, APPLY.length, (st) => {
      if (st === null) st = APPLY.length;
      cap.innerHTML = STEP_CAPS[st];
      render(STATES[st]);
    });
  });
})();
