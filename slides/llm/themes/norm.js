// Normalization slides: « Pre-norm, post-norm », « LayerNorm → RMSNorm », « QK-norm » and
// « Sandwich norm ».
//
// Each slide is a <div class="norm" data-norm="name"> whose <p> children are its captions,
// one per step. The figure is one SVG in slide coordinates (1280 × 720), built once by
// FIG[name](); its elements carry their visibility as attributes:
//   data-s / data-e  first / last step the element shows (default: always)
//   data-play        the step whose entry replays the element's CSS animation (class pop,
//                    hop): only when stepping forward by one, otherwise the end state shows
// Colours: x blue, attention blue, FFN magenta, norms cyan, adds / γ / highlights gold,
// outputs violet (as on the transformer and FFN slides). Connectors: straight runs and
// filleted elbows, a bow on the diagonals, all with the notched (stealth) head of
// themes/attn-merge.js. Uses steps.js (load it first). Styles: themes/norm.css.
(() => {
  const C = { blue: '#4aa8ff', magenta: '#d97fd0', green: '#7cc47a', gold: '#f5c451', cyan: '#8fc5fa',
              slate: '#8e95a2', ink: '#e3e9f3', panel: '#18233a', dim: '#3d4a63', red: '#ff6b6b',
              slide: '#0f1829', brace: '#8fc5fa', violet: '#5b74e8', row2: '#2b5a94' };
  const A = (o = {}) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => ` data-${k}="${v}"`).join('');
  const rect = (x, y, w, h, fill, o = {}, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}${A(o)}/>`;
  const text = (x, y, t, o = {}, style = '') => `<text x="${x}" y="${y}" style="${style}"${A(o)}>${t}</text>`;
  const line = (x1, y1, x2, y2, stroke, o = {}, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" ${extra}${A(o)}/>`;
  const g = (inner, o = {}, extra = '') => `<g ${extra}${A(o)}>${inner}</g>`;
  const sub = (t) => `<tspan baseline-shift="sub" font-size="70%">${t}</tspan>`;
  const sup = (t) => `<tspan baseline-shift="super" font-size="70%">${t}</tspan>`;

  let uid = 0;
  const svg = (inner) => {
    const id = `norm${uid++}`;
    // the notched (stealth) head of themes/attn-merge.js, one marker per colour
    const defs = ['ink', 'slate', 'gold', 'cyan'].map((k) =>
      `<marker id="${id}-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0.5,1.2 L9,5 L0.5,8.8 L3,5 Z" fill="${C[k]}" stroke="${C[k]}" stroke-width=".6" stroke-linejoin="round"/></marker>`).join('');
    return `<svg width="1280" height="720" viewBox="0 0 1280 720"><defs>${defs}</defs>${inner.replaceAll('url(#AH-', `url(#${id}-`)}</svg>`;
  };
  // a connector: straight when axis-aligned, a gentle bow when it runs diagonally
  const arrow = (x1, y1, x2, y2, k, o = {}, w = 2, dash = false) => {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    let d = `M${x1},${y1} L${x2},${y2}`;
    if (Math.abs(dx) > 1 && Math.abs(dy) > 1) {
      const bend = Math.min(16, len * .12), ux = dx / len, uy = dy / len;
      const c1x = x1 + ux * len / 3 - uy * bend, c1y = y1 + uy * len / 3 + ux * bend;
      const c2x = x2 - ux * len / 3 - uy * bend, c2y = y2 - uy * len / 3 + ux * bend;
      d = `M${x1},${y1} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2},${y2}`;
    }
    return `<path d="${d}" fill="none" stroke="${C[k]}" stroke-width="${w}" stroke-opacity=".9"${dash ? ' stroke-dasharray="5 4"' : ''}${A(o)} marker-end="url(#AH-${k})"/>`;
  };
  // a connector through several points: filleted elbows, straight into its target
  const route = (pts, k, o = {}, w = 2) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], [nx, ny] = pts[i + 1];
      const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
      const rr = Math.min(14, l1 / 2, l2 / 2);
      d += ` L${(x - (x - px) / l1 * rr).toFixed(1)},${(y - (y - py) / l1 * rr).toFixed(1)}` +
        ` Q${x},${y} ${(x + (nx - x) / l2 * rr).toFixed(1)},${(y + (ny - y) / l2 * rr).toFixed(1)}`;
    }
    const [ex, ey] = pts[pts.length - 1];
    d += ` L${ex},${ey}`;
    return `<path d="${d}" fill="none" stroke="${C[k]}" stroke-width="${w}" stroke-opacity=".9"${A(o)} marker-end="url(#AH-${k})"/>`;
  };

  // a labelled box, horizontal text (blocks are wide and short here)
  const hblock = (x, y, w, h, label, color, o = {}, fs = 19) => g(
    rect(x, y, w, h, '#1a2a4a', {}, `stroke="${color}" stroke-width="3"`) +
    `<text x="${x + w / 2}" y="${y + h / 2 + fs * .36}" style="font-size:${fs}px;text-anchor:middle;fill:${C.ink}">${label}</text>`, o);
  const HL = (x, y, w, h, o = {}) => rect(x, y, w, h, 'none', o, `stroke="${C.gold}" stroke-width="3" rx="4"`);
  // a row of cells with a value in each
  const row = (x, y, vals, cw, ch, fill, o = {}, fs = 13) => g(vals.map((v, j) =>
    rect(x + j * cw, y, cw - 1, ch, fill) +
    text(x + j * cw + (cw - 1) / 2, y + ch / 2 + fs * .36, v, {},
      `font-size:${fs}px;font-family:'IBM Plex Mono',monospace;text-anchor:middle`)).join(''), o);
  // a row of γ: the learned scale, one per coordinate
  const gammaRow = (x, y, n, cw, ch) => g([...Array(n)].map((_, j) =>
    rect(x + j * cw, y, cw - 1, ch, C.gold, {}, 'opacity=".35"') +
    text(x + j * cw + (cw - 1) / 2, y + ch / 2 + 4, 'γ', {}, `font-size:12px;text-anchor:middle;fill:${C.gold}`)).join(''));
  const plus = (cx, cy) => g(`<circle cx="${cx}" cy="${cy}" r="15" fill="${C.panel}" stroke="${C.gold}" stroke-width="2.5"/>` +
    text(cx, cy + 7, '+', {}, `font-size:20px;text-anchor:middle;fill:${C.gold}`));
  function brace(x1, x2, y, label, color, o = {}, below = true) {
    const d = below ? 8 : -8, m = (x1 + x2) / 2;
    return g(`<path d="M${x1} ${y} q0 ${d} 8 ${d} H${m - 8} q8 0 8 ${d} q0 ${-d} 8 ${-d} H${x2 - 8} q8 0 8 ${-d}" fill="none" stroke="${color}" stroke-width="1.5"/>` +
      text(m, y + (below ? 2 * d + 20 : 2 * d - 8), label, {}, `font-size:18px;fill:${color};text-anchor:middle;font-style:italic`), o);
  }
  const dash = (x, y, w, h, color) => rect(x, y, w, h, 'none', {}, `stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4"`);

  const FS22 = 'font-size:22px';
  const FIG = {};

  // ── Pre-norm vs post-norm: the same block twice, the norm in the branch or on the stream ──
  // Steps: 0 both panels · 1 pre-norm: norm in the branch · 2 the stream goes straight
  // through · 3 same for the FFN · 4 post-norm: norm after the add · 5 FFN branch,
  // renormalized · 6 why pre-norm won · 7 the final norm
  FIG.prepost = () => {
    let s = '';
    s += text(96, 150, 'pre-norm', {}, 'font-size:24px;font-weight:600') +
      text(216, 150, 'GPT-2 · Llama · Qwen3', {}, `font-size:16px;fill:${C.slate}`);
    s += text(96, 390, 'post-norm', {}, 'font-size:24px;font-weight:600') +
      text(246, 390, 'Transformer 2017 · BERT', {}, `font-size:16px;fill:${C.slate}`);
    // pre-norm: the stream is x → ⊕ → ⊕; each sub-block reads a normalized copy
    s += text(98, 328, 'x', {}, 'font-size:22px;font-style:italic;text-anchor:end');
    s += arrow(108, 320, 600, 320, 'ink');
    s += plus(620, 320);
    s += arrow(637, 320, 940, 320, 'ink');
    s += plus(960, 320);
    s += g(arrow(977, 320, 1020, 320, 'ink') + hblock(1028, 302, 70, 36, 'norm', C.cyan, {}, 16) +
      arrow(1100, 320, 1140, 320, 'ink') + text(1150, 326, 'unembedding', {}, `font-size:15px;fill:${C.slate}`), { s: 7 });
    // branch 1: Norm → Attention, added back at ⊕1
    s += route([[210, 320], [210, 200], [236, 200]], 'ink');
    s += hblock(240, 182, 60, 36, 'Norm', C.cyan, {}, 16);
    s += arrow(302, 200, 326, 200, 'ink');
    s += hblock(330, 174, 140, 52, 'Attention', C.blue);
    s += route([[470, 200], [620, 200], [620, 298]], 'ink');
    // branch 2: Norm → FFN, added back at ⊕2
    s += route([[660, 320], [660, 200], [686, 200]], 'ink');
    s += hblock(690, 182, 60, 36, 'Norm', C.cyan, {}, 16);
    s += arrow(752, 200, 776, 200, 'ink');
    s += hblock(780, 174, 90, 52, 'FFN', C.magenta);
    s += route([[870, 200], [960, 200], [960, 298]], 'ink');
    // post-norm: the stream is x → ⊕ → Norm → ⊕ → Norm; skips pass through the norms
    s += text(98, 528, 'x', {}, 'font-size:22px;font-style:italic;text-anchor:end');
    s += arrow(108, 520, 246, 520, 'ink');
    s += hblock(250, 494, 140, 52, 'Attention', C.blue);
    s += arrow(392, 520, 431, 520, 'ink');
    s += plus(450, 520);
    s += route([[210, 520], [210, 460], [450, 460], [450, 498]], 'ink');
    s += arrow(467, 520, 492, 520, 'ink');
    s += hblock(496, 502, 60, 36, 'Norm', C.cyan, {}, 16);
    s += arrow(558, 520, 856, 520, 'ink');
    s += route([[620, 520], [620, 430], [686, 430]], 'ink');
    s += hblock(690, 404, 90, 52, 'FFN', C.magenta);
    s += route([[780, 430], [880, 430], [880, 498]], 'ink');
    s += plus(880, 520);
    s += arrow(897, 520, 936, 520, 'ink');
    s += hblock(940, 502, 60, 36, 'Norm', C.cyan, {}, 16);
    s += arrow(1002, 520, 1046, 520, 'ink');
    s += text(1056, 527, 'out', {}, `font-size:16px;fill:${C.slate}`);
    // dim the panel that is not being discussed
    s += rect(84, 130, 1100, 240, C.slide, { s: 4, e: 5 }, 'opacity=".6"');
    s += rect(84, 370, 1100, 200, C.slide, { s: 1, e: 3 }, 'opacity=".6"');
    s += rect(84, 370, 1100, 200, C.slide, { s: 7, e: 7 }, 'opacity=".6"');
    s += HL(226, 168, 250, 66, { s: 1, e: 1 });
    s += HL(100, 298, 545, 44, { s: 2, e: 2 });
    s += HL(650, 168, 230, 66, { s: 3, e: 3 });
    s += HL(430, 490, 132, 62, { s: 4, e: 4 });
    s += HL(610, 396, 402, 152, { s: 5, e: 5 });
    s += HL(1020, 294, 88, 50, { s: 7, e: 7 });
    return svg(s);
  };

  // ── LayerNorm → RMSNorm: the same x through both, concrete d = 8 numbers ──
  // x = [1, 2, −1, 0, 3, −2, 1, 0]: μ = 0.5, σ = 1.5, RMS = √2.5 ≈ 1.58.
  // Steps: 0 x, the two norms · 1 −μ · 2 ÷σ, x̂ · 3 γ, β · 4 RMSNorm, drops μ and β ·
  // 5 x / RMS, × γ · 6 Qwen3's numbers
  FIG.rms = () => {
    let s = '';
    const XR = 110, YR = 280, cw = 26, ch = 36;
    s += text(XR + 4 * cw, YR - 18, 'x « Paris »', {}, `font-size:17px;fill:${C.slate};text-anchor:middle`);
    s += row(XR, YR, ['1', '2', '−1', '0', '3', '−2', '1', '0'], cw, ch, C.blue);
    s += text(XR + 4 * cw, YR + ch + 24, 'd = 8', {}, `font-size:15px;fill:${C.slate};text-anchor:middle`);
    // taps: up to LayerNorm, down to RMSNorm
    s += route([[XR + 8 * cw, YR + 10], [352, YR + 10], [352, 190], [410, 190]], 'ink');
    s += route([[XR + 8 * cw, YR + 26], [376, YR + 26], [376, 400], [410, 400]], 'ink');
    // LayerNorm: y = γ ⊙ (x − μ) / √(σ² + ε) + β   (γ gold, y violet, everywhere)
    s += text(420, 150, 'LayerNorm', {}, `font-size:22px;font-weight:600;fill:${C.cyan}`);
    s += text(420, 190, `<tspan style="fill:${C.violet}">y</tspan> = <tspan style="fill:${C.gold}">γ</tspan> ⊙ `, {}, FS22);
    s += text(516, 190, '(x − μ)', { s: 1, play: 1 }, FS22);
    s += text(604, 190, '/ √(σ² + ε)', { s: 2, play: 2 }, FS22);
    s += text(752, 190, '+ β', { s: 3, play: 3 }, FS22);
    s += text(516, 216, 'μ = 0.5', { s: 1 }, `font-size:17px;fill:${C.slate}`);
    s += text(604, 216, 'σ = 1.5', { s: 2 }, `font-size:17px;fill:${C.slate}`);
    s += g(gammaRow(420, 236, 8, 20, 24) + text(592, 253, 'γ: learned, one per coordinate', {}, `font-size:15px;fill:${C.slate}`), { s: 3, play: 3 });
    s += text(752, 216, 'β: learned', { s: 3 }, `font-size:15px;fill:${C.slate}`);
    s += text(822, 195, 'x̂', { s: 2 }, 'font-size:18px;font-style:italic;text-anchor:end');
    s += row(830, 172, ['0.33', '1.00', '−1.00', '−0.33', '1.67', '−1.67', '0.33', '−0.33'], 40, 36, C.row2, { s: 2, play: 2 }, 12);
    s += line(514, 182, 596, 182, C.red, { s: 4 }, 'stroke-width="2.5"');
    s += line(750, 182, 786, 182, C.red, { s: 4 }, 'stroke-width="2.5"');
    // RMSNorm: y = γ ⊙ x / √(mean(x²) + ε)
    s += text(420, 360, 'RMSNorm', { s: 0 }, `font-size:22px;font-weight:600;fill:${C.cyan}`);
    s += text(420, 400, `<tspan style="fill:${C.violet}">y</tspan> = <tspan style="fill:${C.gold}">γ</tspan> ⊙ `, { s: 0 }, FS22);
    s += text(516, 400, 'x', { s: 4, play: 4 }, FS22);
    s += text(544, 400, '/ √(mean(x²) + ε)', { s: 4, play: 4 }, FS22);
    s += text(544, 426, 'RMS = √2.5 ≈ 1.58', { s: 4 }, `font-size:17px;fill:${C.slate}`);
    s += g(gammaRow(420, 446, 8, 20, 24) + text(592, 463, 'γ: learned — no β', {}, `font-size:15px;fill:${C.slate}`), { s: 5, play: 5 });
    s += text(822, 405, 'y', { s: 5 }, `font-size:18px;font-style:italic;text-anchor:end;fill:${C.violet}`);
    s += row(830, 382, ['0.63', '1.26', '−0.63', '0.00', '1.90', '−1.26', '0.63', '0.00'], 40, 36, C.violet, { s: 5, play: 5 }, 12);
    return svg(s);
  };

  // ── QK-norm: one head's q, k, v; Qwen3 puts an RMSNorm on q and k, before RoPE ──
  // Steps: 0 q, k, v from x · 1 RMSNorm on q and k · 2 per head, γ of d_h · 3 RoPE, then
  // the attention · 4 why: bounded logits · 5 Qwen2's bias, replaced
  FIG.qk = () => {
    let s = '';
    s += g(rect(830, 56, 440, 50, C.panel, {}, `stroke="${C.dim}" stroke-width="1.5"`) +
      text(846, 76, 'Qwen2: a learned bias on q, k, v', {}, 'font-size:15px') +
      text(846, 96, 'Qwen3: biases dropped — q_norm, k_norm instead', {}, `font-size:15px;fill:${C.gold}`), { s: 5, play: 5 });
    const wb = (y, l) => hblock(150, y, 56, 36, `W${sub(l)}`, C.blue, {}, 16);
    s += wb(147, 'Q') + wb(327, 'K') + wb(507, 'V');
    s += arrow(208, 165, 516, 165, 'ink') + arrow(208, 345, 516, 345, 'ink') + arrow(208, 525, 516, 525, 'ink');
    s += row(520, 150, ['0.4', '−1.1', '2.0', '0.3', '−0.8', '1.5', '−0.2', '0.9'], 24, 30, C.row2, {}, 10);
    s += row(520, 330, ['−0.3', '0.8', '1.2', '−1.4', '0.5', '0.2', '−0.9', '1.1'], 24, 30, C.row2, {}, 10);
    s += row(520, 510, ['1.3', '−0.6', '0.2', '0.9', '−1.2', '0.4', '0.7', '−0.3'], 24, 30, C.violet, {}, 10);
    // labels above the rows, clear of the incoming arrows
    s += text(522, 144, 'q', {}, 'font-size:18px;font-style:italic');
    s += text(522, 324, 'k', {}, 'font-size:18px;font-style:italic');
    s += text(522, 504, 'v', {}, 'font-size:18px;font-style:italic');
    // RMSNorm on q and k, v untouched
    s += g(arrow(716, 165, 746, 165, 'ink') + hblock(750, 150, 92, 30, 'RMSNorm', C.cyan, {}, 14), { s: 1, play: 1 });
    s += g(arrow(716, 345, 746, 345, 'ink') + hblock(750, 330, 92, 30, 'RMSNorm', C.cyan, {}, 14), { s: 1, play: 1 });
    s += g(arrow(716, 525, 744, 525, 'slate', {}, 1.5) + text(720, 548, 'untouched', {}, `font-size:15px;font-style:italic;fill:${C.slate}`), { s: 1 });
    s += text(750, 142, 'one γ of d_h per head', { s: 2, play: 2 }, `font-size:14px;fill:${C.gold}`);
    s += text(750, 322, 'one γ of d_h per head', { s: 2 }, `font-size:14px;fill:${C.gold}`);
    s += brace(520, 712, 188, `d${sub('h')}`, C.brace, { s: 2 });
    // then RoPE (Position section), then the attention: square elbows, one curved angle
    s += g(arrow(844, 165, 872, 165, 'slate') + dash(876, 150, 70, 30, C.dim) +
      text(911, 170, 'RoPE', {}, `font-size:14px;text-anchor:middle;fill:${C.slate}`), { s: 3 });
    s += g(arrow(844, 345, 872, 345, 'slate') + dash(876, 330, 70, 30, C.dim) +
      text(911, 350, 'RoPE', {}, `font-size:14px;text-anchor:middle;fill:${C.slate}`), { s: 3 });
    s += g(route([[948, 165], [1050, 165], [1050, 214]], 'slate') +
      route([[948, 345], [1010, 345], [1010, 290]], 'slate') +
      hblock(980, 220, 290, 64, `A = softmax(q k${sup('T')} / √d${sub('h')} + M)`, C.blue, {}, 17), { s: 3, play: 3 });
    // v joins the attention from below: O = A · v — one turn
    s += g(route([[716, 525], [1130, 525], [1130, 290]], 'ink') +
      text(1142, 430, '× A', {}, `font-size:15px;font-style:italic;fill:${C.slate}`), { s: 3 });
    s += HL(970, 212, 310, 80, { s: 4, e: 4 });
    return svg(s);
  };

  // ── Sandwich norm: a second norm on the branch output. Why it might be needed:
  // the pre-norm stream is never normalized and its norm grows without bound —
  // measured on Qwen3-1.7B « Paris » (data/Qwen3-1.7B.json, residual_norm):
  // 1.3 after the embeddings, 3296 after layer 27, 110 after the final norm.
  // Steps: 0 pre-norm recap · 1 the second norm: x + Norm(Attn(Norm(x))) ·
  // 2 why: ‖x‖ grows without bound (chart) · 3 every add is a normalized vector ·
  // 4 the final norm is the one-off fix · 5 who uses it, who doesn't
  FIG.sandwich = () => {
    const NRM = [1, 9, 17, 18, 26, 26, 29, 30, 34, 34, 41, 44, 52, 53, 60, 61, 65, 69, 78, 79,
      87, 89, 109, 120, 133, 130, 145, 145, 158, 169, 178, 186, 206, 216, 270, 300, 370, 412,
      465, 500, 620, 680, 846, 877, 997, 1086, 1327, 1371, 1660, 1768, 2016, 2142, 2583, 2704,
      3185, 3296, 110];
    let s = '';
    // the block: pre-norm with the extra norm in the branch
    s += text(98, 258, 'x', {}, 'font-size:22px;font-style:italic;text-anchor:end');
    s += arrow(108, 250, 600, 250, 'ink');
    s += plus(620, 250);
    s += arrow(637, 250, 900, 250, 'ink');
    s += text(910, 256, 'out', {}, `font-size:16px;fill:${C.slate}`);
    s += route([[210, 250], [210, 180], [236, 180]], 'ink');
    s += hblock(240, 162, 60, 36, 'Norm', C.cyan, {}, 16);
    s += arrow(302, 180, 326, 180, 'ink');
    s += hblock(330, 154, 140, 52, 'Attention', C.blue);
    s += arrow(472, 180, 496, 180, 'ink');
    s += g(hblock(500, 162, 60, 36, 'Norm', C.cyan, {}, 16), { s: 1, play: 1 });
    s += route([[560, 180], [620, 180], [620, 233]], 'ink');
    s += HL(492, 154, 78, 52, { s: 1, e: 1 });
    s += HL(588, 158, 96, 112, { s: 3, e: 3 });
    // chart: ‖x‖ after every stage of the 28-layer block stack
    const PX = 250, PY = 545, W = 820, H = 175, MAX = 3400;
    const px = (i) => PX + i * (W / (NRM.length - 1)), py = (v) => PY - (v / MAX) * H;
    s += g(text(PX - 14, 372, '‖x « Paris »‖ through the 28 layers — Qwen3-1.7B, measured', {}, `font-size:16px;fill:${C.slate}`) +
      text(PX - 14, 396, '× 2 500', { s: 2 }, `font-size:16px;fill:${C.red};font-weight:600`), { s: 2 });
    s += g(line(PX, PY, PX + W, PY, C.dim, {}, 'stroke-width="1.5"') +
      line(PX, PY, PX, PY - H, C.dim, {}, 'stroke-width="1.5"') +
      text(PX - 12, PY + 5, '0', {}, `font-size:13px;fill:${C.slate};text-anchor:end`) +
      text(PX + W / 2, PY + 22, 'layer 0 → 28, then the final norm', {}, `font-size:14px;fill:${C.slate};text-anchor:middle`), { s: 2 });
    const path = NRM.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
    s += g(`<path d="${path}" fill="none" stroke="${C.blue}" stroke-width="2.5" stroke-linejoin="round"/>` +
      NRM.map((v, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="2.5" fill="${i === NRM.length - 1 ? C.gold : C.blue}"/>`).join('') +
      text(px(0) + 8, py(NRM[0]) - 10, '1.3', {}, `font-size:13px;fill:${C.slate}`) +
      text(px(NRM.length - 2) - 8, py(3296) - 12, '3296', {}, `font-size:14px;fill:${C.blue};text-anchor:end`) +
      text(px(NRM.length - 1) + 8, py(110) + 16, '110', {}, `font-size:14px;fill:${C.gold}`), { s: 2 });
    return svg(s);
  };

  function apply(root, k, play) {
    root.querySelectorAll('[data-s],[data-e]').forEach((el) => {
      const s = el.dataset.s != null ? +el.dataset.s : 0, e = el.dataset.e != null ? +el.dataset.e : 1e9;
      el.classList.toggle('off', k < s || k > e);
    });
    root.querySelectorAll('[data-play]').forEach((el) => {
      el.classList.remove('play');
      if (play && +el.dataset.play === k) { void el.getBoundingClientRect(); el.classList.add('play'); }
    });
  }

  document.querySelectorAll('div.norm[data-norm]:not(.norm-built)').forEach((root) => {
    root.classList.add('norm-built');
    const caps = [...root.querySelectorAll(':scope > p')];
    const body = document.createElement('div'), box = document.createElement('div');
    body.className = 'norm-body'; box.className = 'norm-caps';
    body.innerHTML = FIG[root.dataset.norm]();
    box.append(...caps);
    root.replaceChildren(body, box);
    let prev = null;
    steps(root, caps.length - 1, (st) => {
      const play = st !== null && prev !== null && st === prev + 1;
      if (st === null) st = caps.length - 1;
      prev = st;
      apply(body, st, play);
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    });
  });
})();
