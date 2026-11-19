// Sliding-window attention slides: « A KV cache that stops growing » and « Local and global
// layers » (the window itself is drawn by themes/heads.js, data-window).
//
// Each slide is a <div class="swa" data-swa="name"> whose <p> children are its captions, one
// per step. The figure is one SVG in slide coordinates (1280 × 720), built once by FIG[name]();
// its elements carry their visibility as attributes, as in themes/norm.js:
//   data-s / data-e  first / last step the element shows (default: always)
// Colours as on the attention slides: K green, V magenta, local layers blue, global layers and
// highlights gold, dropped entries orange. Uses steps.js (load it first). Styles: themes/swa.css.
(() => {
  const C = { blue: '#4aa8ff', magenta: '#d97fd0', green: '#7cc47a', gold: '#f5c451', cyan: '#8fc5fa',
              orange: '#ff9f43', slate: '#8e95a2', ink: '#e3e9f3', panel: '#18233a', dim: '#3d4a63',
              slide: '#0f1829', code: '#0b1120', line: '#2a3550' };
  const A = (o = {}) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => ` data-${k}="${v}"`).join('');
  const rect = (x, y, w, h, fill, o = {}, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}${A(o)}/>`;
  const text = (x, y, t, style = '', o = {}) => `<text x="${x}" y="${y}" style="${style}"${A(o)}>${t}</text>`;
  const line = (x1, y1, x2, y2, stroke, o = {}, extra = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" ${extra}${A(o)}/>`;
  const g = (inner, o = {}) => `<g${A(o)}>${inner}</g>`;
  const svg = (inner) => `<svg width="1280" height="720" viewBox="0 0 1280 720">${inner}</svg>`;
  const HL = (x, y, w, h, o = {}) => rect(x, y, w, h, 'none', o, `stroke="${C.gold}" stroke-width="2.5" rx="6"`);

  const TOK = ['The', '␣city', '␣of', '␣Paris', '␣is', '␣the', '␣capital', '␣of'];
  const N = TOK.length;

  const FIG = {};

  // Decoding token by token: the full cache appends one K / V pair per token, the window cache
  // (W slots) writes slot t mod W and overwrites the oldest pair. Step t generates token t;
  // the last step only has a caption (Mistral 7B's numbers).
  FIG.cache = (W = 2) => {
    const x = (j) => 150 + j * 130, bw = 110, yT = 190, yF = 305, yW = 430;
    const lab = (t, c = C.slate) => `font-size:16px;fill:${c}`;
    const kv = (xx, yy) =>
      rect(xx, yy, bw / 2 - 1, 44, C.green, {}, 'rx="3" fill-opacity=".75"') +
      rect(xx + bw / 2 + 1, yy, bw / 2 - 1, 44, C.magenta, {}, 'rx="3" fill-opacity=".75"') +
      text(xx + bw / 4, yy + 28, 'K', 'font-size:17px;font-weight:600;text-anchor:middle') +
      text(xx + 3 * bw / 4, yy + 28, 'V', 'font-size:17px;font-weight:600;text-anchor:middle');
    let s = text(150, yT - 14, 'generated tokens', lab()) +
      text(150, yF - 14, 'full KV cache: one entry per token', lab()) +
      text(150, yW - 14, `sliding-window KV cache: W = ${W} slots`, lab(0, C.cyan));
    for (let k = 0; k < W; k++) s += rect(x(k), yW, bw, 44, 'none', {}, `rx="4" stroke="${C.dim}" stroke-dasharray="4 4"`);
    for (let t = 0; t < N; t++) {
      const k = t % W, last = t + W >= N;                // last: still in the window at the end
      s += g(rect(x(t), yT, bw, 40, C.panel, {}, `rx="4" stroke="${C.blue}" stroke-width="1.5"`) +
        text(x(t) + bw / 2, yT + 27, TOK[t], 'font-size:18px;text-anchor:middle') + kv(x(t), yF), { s: t });
      // out of the window: the token is crossed out
      if (!last) s += g(rect(x(t) - 1, yT - 1, bw + 2, 42, C.slide, {}, 'rx="4" fill-opacity=".7"') +
        line(x(t) + 10, yT + 20, x(t) + bw - 10, yT + 20, C.orange, {}, 'stroke-width="2"'), { s: t + W });
      // its window slot, until overwritten
      s += g(kv(x(k), yW) + text(x(k) + bw / 2, yW + 70, `slot ${k}: ${TOK[t]}`, 'font-size:15px;text-anchor:middle'),
        { s: t, e: last ? null : t + W - 1 });
      // the newest token, its entry and its slot
      s += g(HL(x(t) - 4, yT - 4, bw + 8, 48) + HL(x(t) - 4, yF - 4, bw + 8, 52) + HL(x(k) - 4, yW - 4, bw + 8, 52), { s: t, e: t });
      // counters
      const n = (c) => `${c} ${c > 1 ? 'entries' : 'entry'}`;
      s += g(text(1170, yF - 14, n(t + 1), 'font-size:18px;text-anchor:end;font-variant-numeric:tabular-nums') +
        text(1170, yW - 14, n(Math.min(t + 1, W)), `font-size:18px;text-anchor:end;fill:${C.cyan};font-variant-numeric:tabular-nums`),
        { s: t, e: t === N - 1 ? null : t });
    }
    s += text(x(W) + 20, yW + 30, 'slot = position mod W', 'font-size:20px', { s: W + 1 });
    return svg(s);
  };

  // One row per model: six consecutive layer masks (local blue, global gold) and the KV cache of
  // that pattern at a 32 K context, relative to all-global attention. Band widths are schematic.
  FIG.layers = () => {
    const rows = [
      { name: 'Mistral 7B', sub: 'W = 4 096, every layer', pat: 'LLLLLL', band: 3, kv: 12.5, s: 0, kvS: 1 },
      { name: 'Gemma 2', sub: 'W = 4 096, 1 local : 1 global', pat: 'LGLGLG', band: 3, kv: 56.3, s: 2, kvS: 2 },
      { name: 'Gemma 3', sub: 'W = 1 024, 5 local : 1 global', pat: 'LLLLLG', band: 2, kv: 19.3, s: 3, kvS: 3 },
      { name: 'gpt-oss', sub: 'W = 128, 1 local : 1 global', pat: 'LGLGLG', band: 1, kv: 50.2, s: 4, kvS: 4 },
    ];
    const mx = 352, pitch = 72, ms = 56, cs = ms / N, bx = 840, bw = 330, y = (r) => 178 + r * 98;
    let s = text(mx, 160, 'masks of 6 consecutive layers', `font-size:15px;fill:${C.slate}`) +
      text(bx, 160, 'KV cache at a 32 K context, vs all global', `font-size:15px;fill:${C.slate}`);
    rows.forEach((r, ri) => {
      const yy = y(ri);
      let m = text(72, yy + 24, r.name, 'font-size:22px;font-weight:600') + text(72, yy + 48, r.sub, `font-size:15px;fill:${C.slate}`);
      [...r.pat].forEach((p, k) => {
        const x0 = mx + k * pitch, col = p === 'G' ? C.gold : C.blue;
        m += rect(x0 - 2, yy - 2, ms + 4, ms + 4, C.code, {}, `rx="3" stroke="${C.line}"`);
        for (let i = 0; i < N; i++) for (let j = 0; j <= i; j++) {
          if (p === 'L' && j <= i - r.band) continue;
          m += rect(x0 + j * cs + .5, yy + i * cs + .5, cs - 1, cs - 1, col, {}, 'fill-opacity=".8"');
        }
        m += text(x0 + ms / 2, yy + ms + 18, p === 'G' ? 'global' : 'local', `font-size:12px;text-anchor:middle;fill:${p === 'G' ? C.gold : C.slate}`);
      });
      s += g(m, { s: r.s }) + g(
        rect(bx, yy + 14, bw, 26, C.code, {}, `rx="3" stroke="${C.line}"`) +
        rect(bx, yy + 14, bw * r.kv / 100, 26, C.cyan, {}, 'rx="3" fill-opacity=".75"') +
        text(bx + bw + 12, yy + 33, `${r.kv} %`, 'font-size:18px;font-variant-numeric:tabular-nums'), { s: r.kvS });
    });
    return svg(s);
  };

  function apply(body, k) {
    body.querySelectorAll('[data-s], [data-e]').forEach((el) => {
      const s = el.dataset.s != null ? +el.dataset.s : 0, e = el.dataset.e != null ? +el.dataset.e : 1e9;
      el.classList.toggle('off', k < s || k > e);
    });
  }

  document.querySelectorAll('div.swa[data-swa]:not(.swa-built)').forEach((root) => {
    root.classList.add('swa-built');
    const caps = [...root.querySelectorAll(':scope > p')];
    const body = document.createElement('div'), box = document.createElement('div');
    body.className = 'swa-body'; box.className = 'swa-caps';
    body.innerHTML = FIG[root.dataset.swa](+(root.dataset.window || 2));
    box.append(...caps);
    root.replaceChildren(body, box);
    steps(root, caps.length - 1, (st) => {
      if (st === null) st = caps.length - 1;
      apply(body, st);
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    });
  });
})();
