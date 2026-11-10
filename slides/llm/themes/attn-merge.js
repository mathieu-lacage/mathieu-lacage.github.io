// « Megakernels », « Merge from registers into GMEM »: the end of attention task (r2, KV 5)
// (tasks/blackwell/attention_sm100.cuh, after the KV loop). One column per warp, the stages going down:
// registers (each warp's max(S), ΣP and O_w for Q heads 10, 11), the spill to SMEM (s_m, s_d, s_o) and a
// barrier, the merge (the same 128 threads, elem_idx = threadIdx.x + k · 128: thread t takes column t of
// both rows, so warp w merges columns 32w … 32w + 31 from all 4 partials), and the store to attn_out (plain
// stores, KV head 5's 256 columns of token 1023's row). The O_w values are made up.
// Builds the figure inside every <div class="mk" data-mg="flowv">; its caption goes to the
// <div class="gq-cap" data-mg-cap="flowv"> next to it. Uses steps.js (load it first).
(() => {
  const C = { slide: '#0f1829', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', gold: '#f5c451', cyan: '#8fc5fa', hatch: '#1d2c44' };
  const COL = { O: '#6d86ff' };
  const WARP = ['#4aa8ff', '#2fc6b8', '#a46cf5', '#c9d1dd'];
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const sm = (x, y, s, a = '') => T(x, y, s, `font-size="12" fill="${C.slate}" ${a}`);
  const hd = (x, y, s) => T(x, y, s, `font-size="13" font-weight="600" fill="${C.slate}" letter-spacing=".06em"`);
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 3.7) * 43758.5453; return x - Math.floor(x); };

  const band = (c) => Math.floor(c / 32);              // the warp that merges column c

  /* ---------- one column per warp, the stages going down ---------- */
  const flowV = (st) => {
    const CX = (w) => 250 + w * 232;                            // a warp's column
    const FR = 14, FU = 1.1, FW = 128 * FU, BU = 3;              // O_w at 1.1 px per column; bands at 3 px
    const Y = { reg: 178, mem: 262, out: 366, gm: 438, row: 520 };
    const blockAt = (x0, y0, w, keepBand) => {
      let o = '';
      for (let b = 0; b < 2; b++) {
        const y = y0 + b * FR;
        o += R(x0, y, 22, FR - 2, `fill="${C.gold}" fill-opacity=".55"`) + R(x0 + 25, y, 22, FR - 2, `fill="${C.gold}" fill-opacity=".55"`);
        for (let c = 0; c < 128; c += 4) {
          const v = 0.25 + 0.6 * rnd(w * 977 + b * 311 + c), on = keepBand === null || band(c) === keepBand;
          o += R(x0 + 52 + c * FU, y, 4 * FU - 0.3, FR - 2, `fill="${COL.O}" fill-opacity="${(on ? v : v * 0.2).toFixed(2)}"`);
        }
        o += R(x0 + 52, y, FW, FR - 2, `fill="none" stroke="${WARP[w]}" stroke-width=".8"`);
      }
      return o;
    };
    const bandX = (w) => CX(w) + 52 + FW / 2 - 16 * BU;           // a warp's 32 columns, centred under its block
    // arrowheads: a notched (stealth) head in the arrow's own colour, oriented along the curve's last tangent
    const heads = new Map();
    const head = (col) => { if (!heads.has(col)) heads.set(col, `am-ah-${heads.size}`); return heads.get(col); };
    // every arrow ends with a short straight drop, so its head points straight down into the target
    const down = (x1, y1, x2, y2, col, k = 0.5, bend = 0) => {
      const tail = Math.min(12, (y2 - y1) / 3), ye = y2 - tail, dy = ye - y1;
      return `<path d="M${x1},${y1} C${x1 + bend},${y1 + dy * k} ${x2},${ye - dy * k} ${x2},${ye} L${x2},${y2}" fill="none" stroke="${col}"
        stroke-width="1.6" stroke-opacity=".9" marker-end="url(#${head(col)})"/>`;
    };
    const w0 = st >= 2 && st <= 5 ? st - 2 : -1;
    let o = '';
    // each warp's column, in a dotted box
    for (let w = 0; w < 4; w++) o += R(CX(w) - 10, Y.reg - 32, 52 + FW + 20, Y.gm + 2 * FR + 12 - (Y.reg - 32),
      `rx="8" fill="none" stroke="${WARP[w]}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="2 4"`);
    // the stage labels, on the left
    [['REGISTERS', Y.reg], ['SMEM', Y.mem], ['MERGED', Y.out], ['GMEM', Y.gm]].forEach(([t, y], i) => {
      if (i === 0 || (i === 1 && st >= 1) || (i === 2 && st >= 2) || (i === 3 && st >= 6)) o += hd(90, y + 18, t);
    });
    for (let w = 0; w < 4; w++) {
      o += T(CX(w) + 52 + FW / 2, Y.reg - 14, `warp ${w}`, `font-size="14" fill="${WARP[w]}" text-anchor="middle"`);
      o += `<g opacity="${st >= 1 ? 0.45 : 1}">${blockAt(CX(w), Y.reg, w, null)}</g>`;
      if (st === 1) o += down(CX(w) + 52 + FW - 10, Y.reg + 2 * FR + 3, CX(w) + 52 + FW - 10, Y.mem - 4, C.cyan, 0.5, 34);
      if (st >= 1) o += `<g opacity="${st >= 6 ? 0.45 : 1}">${blockAt(CX(w), Y.mem, w, w0 >= 0 ? w0 : null)}</g>`;
    }
    o += sm(CX(0) - 8, Y.reg + 11, 'h 10', 'text-anchor="end" font-size="10"') + sm(CX(0) - 8, Y.reg + FR + 11, 'h 11', 'text-anchor="end" font-size="10"');
    o += sm(CX(0) + 11, Y.reg + 2 * FR + 12, 'max(S)', 'text-anchor="middle" font-size="9"') + sm(CX(0) + 36, Y.reg + 2 * FR + 12, 'ΣP', 'text-anchor="middle" font-size="9"')
      + sm(CX(0) + 52 + FW / 2, Y.reg + 2 * FR + 12, 'O_w (128 columns)', 'text-anchor="middle" font-size="9"');
    // merged: each warp's 32 columns of o_smem, in its column
    if (st >= 2) for (let w = 0; w < 4; w++) {
      const done = st >= 6 || w <= w0;
      for (let b = 0; b < 2; b++) o += R(bandX(w), Y.out + b * FR, 32 * BU, FR - 2, `fill="${done ? WARP[w] : C.hatch}" fill-opacity="${w === w0 ? 0.95 : done ? 0.6 : 1}" stroke="${C.dim}" stroke-width=".6"`);
      o += sm(bandX(w) + 16 * BU, Y.out + 2 * FR + 10, `cols ${32 * w}–${32 * w + 31}`, 'text-anchor="middle" font-size="10"');
    }
    if (w0 >= 0) for (let w = 0; w < 4; w++) {
      // warp w0 reads its band from all 4 columns of SMEM
      const bx = CX(w) + 52 + 32 * w0 * FU, bw = 32 * FU;
      o += R(bx - 1, Y.mem - 1, bw + 2, 2 * FR, `fill="none" stroke="${WARP[w0]}" stroke-width="2"`)
        + R(CX(w) - 1, Y.mem - 1, 49, 2 * FR, `fill="none" stroke="${C.gold}" stroke-width="1.5"`)
        + down(bx + bw / 2, Y.mem + 2 * FR + 2, bandX(w0) + 16 * BU - 30 + 20 * w, Y.out - 4, WARP[w0]);
    }
    // GMEM: each warp stores its 2 × 32 values, then (last step) where they land in token 1023's row
    if (st >= 6) for (let w = 0; w < 4; w++) {
      for (let b = 0; b < 2; b++) o += R(bandX(w), Y.gm + b * FR, 32 * BU, FR - 2, `fill="${WARP[w]}" fill-opacity=".85" stroke="${C.dim}" stroke-width=".6"`)
        + sm(bandX(w) - 6, Y.gm + b * FR + 10, `${1280 + 128 * b + 32 * w}–${1280 + 128 * b + 32 * w + 31}`, 'text-anchor="end" font-size="9"');
      if (st === 6) o += down(bandX(w) + 32 * BU - 6, Y.out + 2 * FR + 2, bandX(w) + 32 * BU - 6, Y.gm - 4, WARP[w], 0.5, 30);
    }
    if (st >= 7) {
      // KV 5's 256 columns of the row: head 10 | head 11, each 4 warp bands; drawn wide, under the 4 columns
      const g5 = CX(0) + 40, W5 = CX(3) + 52 + FW - 40 - g5, BW = W5 / 8, GW = 40;
      o += sm(g5 + W5 / 2, Y.row + 40, "attn_out, token 1023's row: KV 5's 256 columns (KV 0–4 to the left, 6–7 to the right)", 'font-size="11" text-anchor="middle"');
      for (let b = 0; b < 2; b++) for (let w = 0; w < 4; w++) o += R(g5 + b * W5 / 2 + w * BW, Y.row, BW - 0.8, 14, `fill="${WARP[w]}" fill-opacity=".85"`);
      o += R(g5, Y.row, W5, 14, `fill="none" stroke="${C.cyan}"`) + R(g5 - GW - 2, Y.row, GW, 14, `fill="${C.hatch}" stroke="${C.dim}"`)
        + R(g5 + W5 + 2, Y.row, GW, 14, `fill="${C.hatch}" stroke="${C.dim}"`)
        + sm(g5 - GW / 2 - 2, Y.row + 26, 'KV 4', 'text-anchor="middle" font-size="10"') + sm(g5 + W5 + 2 + GW / 2, Y.row + 26, 'KV 6', 'text-anchor="middle" font-size="10"')
        + sm(g5 + W5 / 4, Y.row + 26, 'h 10 · cols 1280–1407', 'text-anchor="middle" font-size="10"') + sm(g5 + 3 * W5 / 4, Y.row + 26, 'h 11 · cols 1408–1535', 'text-anchor="middle" font-size="10"');
      for (let w = 0; w < 4; w++) for (let b = 0; b < 2; b++)
        o += down(bandX(w) + (b ? 64 : 32), Y.gm + 2 * FR + 2, g5 + b * W5 / 2 + w * BW + BW / 2, Y.row - 3, WARP[w], 0.6);
    }
    const defs = [...heads].map(([col, id]) => `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10"
      markerUnits="userSpaceOnUse" orient="auto"><path d="M0.5,1.2 L9,5 L0.5,8.8 L3,5 Z" fill="${col}" stroke="${col}" stroke-width=".6" stroke-linejoin="round"/></marker>`).join('');
    return `<defs>${defs}</defs>` + o;
  };
  const CAP_FLOW = ['End of the loop: each warp holds, per Q head, its max(S), ΣP and O_w, in registers',
    '<b>Spill</b>: each warp copies them to SMEM, then a barrier: now every warp can read every partial',
    ...[0, 1, 2, 3].map((w) => `<b>Warp ${w}</b> merges columns ${32 * w}–${32 * w + 31}: that band of all 4 partials, and their max(S), ΣP`),
    '<b>Store</b>: each warp writes its 2 × 32 values to attn_out (one 2-byte store per thread and row)',
    'Together: KV head 5\'s 256 columns of token 1023\'s row, 512 B; then the task\'s event fires'];

  document.querySelectorAll('div.mk[data-mg="flowv"]').forEach((root) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector('[data-mg-cap="flowv"]');
    steps(root, CAP_FLOW.length - 1, (st) => {
      if (st === null) st = CAP_FLOW.length - 1;
      svg.innerHTML = flowV(st);
      cap.innerHTML = CAP_FLOW[st];
    });
  });
})();
