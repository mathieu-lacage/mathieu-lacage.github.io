// Shared machinery for the keyboard-driven matrix animations (decoding.js, transformer.js).
//
// An animation is a list of steps. Every element is shown, highlighted, dimmed or
// animated on step ranges [a, b): h() registers them, mount() adds one fragment per
// step (themes/steps.js, so the arrow keys step through the animation) and toggles
// .is-off / .is-hl / .is-dim / .is-anim on every step. In the PDF the final state is
// shown. The <p> children of the root are the captions, one per step.
//
// Animation scripts must run after this one and after their slide's div.
// Styles of every animation: decoding.css.
(() => {
  if (window.AD) return;

  const END = Infinity;
  const ARROW = '<svg class="viz-ar" viewBox="0 0 14 12"><path d="M0,6 H13 M8,2 L13,6 L8,10"/></svg>';
  const brace = (side) => `<span class="viz-bw"><svg class="viz-brace" data-side="${side}"><path/></svg></span>`;
  const one = (st) => [st, st + 1];
  const from = (st) => [st, END];
  const inRanges = (ranges, st) => ranges.some(([a, b]) => a <= st && st < b);
  // a token written &lt;|name|&gt; is a special token, drawn as one symbol
  const isSpecial = (tok) => /^<\|.*\|>$/.test(tok);

  // "Paris:60704 ␣is:374 …" (␣ = leading space)
  const parseTokens = (s) => (s || '').trim().split(/\s+/).filter(Boolean).map((t) => {
    const [tok, id] = t.split(':');
    return { tok: tok.replace(/␣/g, ' '), id: +id };
  });

  // pseudo-random but fixed (same on every load and in the PDF), in [0, 1)
  const rand = (i, j) => {
    let x = Math.imul(i * 1009 + j * 7919 + 1, 0x9e3779b1);
    x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13;
    return (x >>> 0) / 2 ** 32;
  };

  // DOM helpers for one animation; elements given ranges are registered in items
  function context() {
    const items = [];
    function h(tag, cls, opt = {}, ...kids) {
      const e = document.createElement(tag);
      e.className = cls;
      if (opt.style) e.style.cssText = opt.style;
      if (opt.html) e.innerHTML = opt.html;
      for (const k of kids) {
        if (typeof k === 'string') e.insertAdjacentHTML('beforeend', k);
        else if (k) e.append(k);
      }
      if (opt.vis || opt.hl || opt.dim || opt.anim) {
        e.classList.add('viz-v');
        items.push({ e, vis: opt.vis, hl: opt.hl || [], dim: opt.dim || [], anim: opt.anim || [] });
      }
      return e;
    }
    const chip = (tok, cls = '') => {
      if (isSpecial(tok)) return h('span', `viz-chip viz-special ${cls}`, {}, h('i', '', { html: '' }, document.createTextNode(tok)));
      const c = h('span', `viz-chip ${cls}`);
      for (const ch of tok) {
        const i = document.createElement('i');
        if (ch === ' ') { i.className = 'viz-sp'; i.textContent = '␣'; } else i.textContent = ch;
        c.append(i);
      }
      return c;
    };
    // a token row: chip then id (input), or id then chip (decoder output: the id comes first)
    const tokrow = (t, opt, idFirst = false) => {
      const cc = h('span', 'viz-cc', {}, chip(t.tok)), id = h('span', 'viz-id', { html: String(t.id) });
      return h('div', `viz-tr viz-ch viz-pk${idFirst ? ' viz-idfirst' : ''}`, opt, ...(idFirst ? [id, cc] : [cc, id]));
    };
    // a row of d numbers; it collapses when hidden, unless it is a slot (keeps its place)
    const vrow = (opt, ...kids) => h('div',
      `viz-r${(opt.vis || opt.hl) && !opt.slot ? ' viz-ch' : ''} ${opt.cls || ''}`, opt, ...kids);
    const lbrace = (labels, vis) => h('div', 'viz-lb viz-cw', { vis },
      h('span', 'viz-bl', {}, ...labels.map(([t, v]) => h('span', 'viz-lab', { vis: v, html: t }))), brace('left'));
    const tbrace = (label, vis, style) => h('div', 'viz-tb', { vis, style },
      h('span', 'viz-lab', { html: label }), brace('top'));
    const item = (vis, body, arrow = true) => h('div', 'viz-it viz-cw', { vis }, arrow ? ARROW : null, body);
    const matrix = (kind, name, rows, lb, tb) => h('div', 'viz-mx', {}, lb,
      h('div', `viz-mb ${kind}`, {}, tb, ...rows, name ? h('span', 'viz-nm', { html: name }) : null));
    const block = (label, vis, hl) => item(vis, h('div', 'viz-blk', { hl, html: label }));
    // a weight matrix, (V, d) unless other dimension labels are given
    const weights = (cls, name, hl, braceVis, bands, dims = ['V', 'd']) => h('div', 'viz-mx', {}, lbrace([[dims[0]]], braceVis),
      h('div', `viz-w ${cls}`, { hl }, tbrace(dims[1], braceVis), ...bands, h('span', 'viz-nm', { html: name })));
    return { items, h, chip, tokrow, vrow, lbrace, tbrace, item, matrix, block, weights };
  }

  // replace root's content with body + its captions, plus one fragment per step; onStep(st) runs on every step
  function mount(root, ctx, FINAL, body, onStep = () => {}) {
    const captions = [...root.querySelectorAll(':scope > p')];
    if (captions.length !== FINAL + 1) {
      console.warn(`${root.dataset.anim || 'animation'}: ${captions.length} captions for ${FINAL + 1} steps`);
    }
    const caps = ctx.h('div', 'viz-caps', {}, ...captions.map((c, k) => {
      c.classList.add('viz-v');
      ctx.items.push({ e: c, vis: [k === FINAL ? from(k) : one(k)], hl: [], dim: [], anim: [] });
      return c;
    }));
    root.replaceChildren(...body, caps);

    // in the PDF (st null): past the final step
    steps(root, FINAL, (st) => {
      if (st === null) st = FINAL + 1;
      onStep(st);
      for (const { e, vis, hl, dim, anim } of ctx.items) {
        e.classList.toggle('is-off', vis ? !inRanges(vis, st) : false);
        e.classList.toggle('is-hl', inRanges(hl, st));
        e.classList.toggle('is-dim', inRanges(dim, st));
        e.classList.toggle('is-anim', inRanges(anim, st));
      }
    });
  }

  // build every not-yet-built <div class="viz" data-anim="name"> with build(root)
  const run = (name, build) => document.querySelectorAll(`div.viz[data-anim="${name}"]:not(.viz-built)`)
    .forEach((root) => { root.classList.add('viz-built'); build(root); });

  window.AD = { END, ARROW, one, from, inRanges, isSpecial, parseTokens, rand, context, mount, run };
})();
