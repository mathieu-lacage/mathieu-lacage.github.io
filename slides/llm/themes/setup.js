// « Megakernels », section « The setup » (from mockups/mk-pipeline.html). Two static figures:
//  - <div class="mk" data-mkp="model">: one Qwen3-1.7B layer as MPK runs it, with the weights it streams
//  - <div class="mk" data-mkp="hw">: the 148 SMs of a B200 as MPK splits them (128 workers, 20 scheduler SMs)
(() => {
  const C = { slide: '#0f1829', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', blue: '#4aa8ff',
    gold: '#f5c451', cyan: '#8fc5fa', green: '#7cc47a', magenta: '#d97fd0' };
  const KIND = { embed: C.gold, norm: C.slate, linear: C.blue, attn: C.magenta, splitk: C.cyan,
    silu: C.green, argmax: C.gold };
  const NS = 'http://www.w3.org/2000/svg';
  const el = (p, tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    p.appendChild(e);
    return e;
  };
  const txt = (p, x, y, s, a = {}) => el(p, 'text', { x, y, 'font-size': 16, fill: C.slate, ...a }, s);

  /* ---------- model: one layer as MPK runs it, with the weights it streams ---------- */
  const model = (svg) => {
    const X = 830, W = 300;
    const ops = [
      { name: 'RMSNorm', k: 'norm' },
      { name: 'QKV', k: 'linear', w: 'W 4096 × 2048', mb: 16.8 },
      { name: 'attention (QK-norm, RoPE, KV)', k: 'attn', w: 'KV cache', mb: null },
      { name: 'o_proj  + x', k: 'splitk', w: 'W 2048 × 2048', mb: 8.4 },
      { name: 'RMSNorm', k: 'norm' },
      { name: 'gate + up', k: 'linear', w: 'W 12288 × 2048', mb: 50.3 },
      { name: 'SiLU · mul', k: 'silu' },
      { name: 'down  + x', k: 'splitk', w: 'W 2048 × 6144', mb: 25.2 },
    ];
    txt(svg, X + W / 2, 160, 'one layer, × 28', { 'text-anchor': 'middle', fill: C.ink, 'font-size': 18 });
    let y = 180;
    ops.forEach((o, i) => {
      const h = 40;
      el(svg, 'rect', { x: X, y, width: 8, height: h, fill: KIND[o.k] });
      txt(svg, X + 18, y + 18, o.name, { fill: C.ink, 'font-size': 16 });
      if (o.w) txt(svg, X + 18, y + 36, o.w + (o.mb ? ` · ${o.mb} MB` : ''), { 'font-size': 13, class: 'mono' });
      if (o.mb) el(svg, 'rect', { x: X + W - 4 - o.mb * 1.6, y: y + 8, width: o.mb * 1.6, height: h - 16, fill: KIND[o.k], opacity: 0.55 });
      if (i < ops.length - 1) el(svg, 'line', { x1: X + 4, x2: X + 4, y1: y + h, y2: y + h + 8, stroke: C.dim, 'stroke-width': 2 });
      y += h + 8;
    });
    txt(svg, X + W - 4, y + 14, 'bar length ∝ bytes streamed', { 'text-anchor': 'end', 'font-size': 13 });
    return { n: 0, onStep: () => {} };
  };

  /* ---------- hw: the 148 SMs as MPK splits them ---------- */
  const hw = (svg) => {
    const X0 = 90, Y0 = 150, S = 26, G = 3, PER = 37;
    for (let i = 0; i < 148; i++) {
      const r = Math.floor(i / PER), c = i % PER, worker = i < 128;
      const x = X0 + c * (S + G), y = Y0 + r * (S + G);
      el(svg, 'rect', { x, y, width: S, height: S, rx: 3, fill: worker ? C.blue : C.gold, opacity: worker ? 0.85 : 1 });
      if (!worker) for (let w = 0; w < 4; w++)
        el(svg, 'rect', { x: x + 3 + w * 5.5, y: y + 6, width: 3.5, height: S - 12, fill: C.slide });
    }
    const yl = Y0 + 4 * (S + G) + 30;
    el(svg, 'rect', { x: X0, y: yl - 13, width: 14, height: 14, rx: 2, fill: C.blue });
    txt(svg, X0 + 22, yl, '128 workers: 1 CTA each, 256 threads, 201 KB SMEM for its tasks  (worker_kernel)', { fill: C.ink, 'font-size': 17 });
    el(svg, 'rect', { x: X0, y: yl + 15, width: 14, height: 14, rx: 2, fill: C.gold });
    txt(svg, X0 + 22, yl + 28, '20 scheduler SMs × 4 scheduler warps = 80 schedulers  (scheduler_kernel)', { fill: C.ink, 'font-size': 17 });
    return { n: 0, onStep: () => {} };
  };

  const FIG = { model, hw };
  document.querySelectorAll('div.mk[data-mkp]').forEach((root) => {
    if (!FIG[root.dataset.mkp]) return;
    const svg = el(root, 'svg', { viewBox: '0 0 1280 720' });
    FIG[root.dataset.mkp](svg).onStep(null);
  });
})();
