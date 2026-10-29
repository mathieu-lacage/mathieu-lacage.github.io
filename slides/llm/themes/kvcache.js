// KV cache slides: « Decoding repeats itself » (naive decoding, pass after pass, with the
// real numbers of themes/kvpasses.js) and « Why rows 1–4 do not change » (one block,
// with its dependencies).
//
// Each slide is a <div class="kv" data-kv="decode|why"> whose <p> children are its
// captions, one per step. FIG[name](st, play) returns the figure of step st as an SVG
// (1136 × 440, under the title); it is drawn again at every step. play is true when
// stepping forward by one: only then do the flights and the scroll animate.
// In the PDF (steps() gives null) the last step shows.
// Uses steps.js and kvpasses.js (load them first). Styles: themes/kvcache.css.
(() => {
  const C = { slide: '#0f1829', panel: '#18233a', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2',
              blue: '#4aa8ff', green: '#7cc47a', gold: '#f5c451' };
  const P = window.KV_PASSES;

  // fixed shades: the same (seed, row, col) always gives the same colour
  const val = (a, b, c) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return 0.3 + 0.7 * (s - Math.floor(s)); };
  const mix = (h1, h2, t) => { const p = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
    return '#' + [0, 1, 2].map((i) => Math.round(p(h1, i) * t + p(h2, i) * (1 - t)).toString(16).padStart(2, '0')).join(''); };
  const shade = (col, v) => mix(col, C.slide, v);
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const R = (x, y, w, h, a) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const L = (x1, y1, x2, y2, a) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a}/>`;
  // marker and pattern ids are per figure: an id in a hidden slide would not render elsewhere
  let uid = 0;
  function svg(inner) {
    const id = `kv${uid++}`;
    return `<svg viewBox="0 0 1136 440"><defs>
<pattern id="${id}-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="${mix(C.gold, C.slide, .14)}"/><line x1="0" y1="0" x2="0" y2="7" stroke="${C.gold}" stroke-width="2.2" opacity=".75"/></pattern>
<marker id="${id}-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${C.slate}"/></marker>
<marker id="${id}-ag" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${C.gold}"/></marker>
</defs>${inner.replaceAll('url(#ID-', `url(#${id}-`)}</svg>`;
  }
  const arrow = (x1, y1, x2, y2, gold) => L(x1, y1, x2, y2, `stroke="${gold ? C.gold : C.slate}" stroke-width="${gold ? 2 : 1.6}" marker-end="url(#ID-${gold ? 'ag' : 'ar'})"`);
  const tblock = (x, y, h, label, col = C.blue) => R(x, y, 26, h, `fill="${C.panel}" stroke="${col}" stroke-width="1.6"`) +
    T(x + 18, y + h / 2, label, `font-size="13" text-anchor="middle" transform="rotate(-90 ${x + 13} ${y + h / 2})"`);
  const fmt = (v) => (v < 0 && v.toFixed(2) != -0 ? '−' : ' ') + Math.abs(v).toFixed(2);
  const tokTxt = (t) => t.replace(/^ /, '␣');

  const FIG = {};

  // « Decoding repeats itself »: the strip of « Next-token probability from Transformer
  // stacks », one per pass, with the first 3 numbers of x, h₁ and h_L of every row.
  // Steps: 0 pass 1 · 1 only the last row is used · 2–8 pass 2, one stage per step (the
  // new token flies back from the « next » column, then ids, x, h₁, h_L, score, next) ·
  // 9 rows 1–4 are the same · 10 pass 2 scrolls up in place of pass 1 · 11–17 pass 3,
  // the same way · 18 rows 1–5 are the same
  const RH = 24, W = 52, CX = { x: 214, h1: 456, hL: 706 };
  FIG.decode = (s, play) => {
    let o = '';
    const p3 = s >= 10, top = P[p3 ? 1 : 0], bot = P[p3 ? 2 : 1];
    const tn = top.tok.length, yt = 48, yb = yt + tn * RH + 52;
    const upto = s < 2 ? -1 : p3 ? Math.min(s - 11, 6) : Math.min(s - 2, 6);
    const same = s === 9 || s === 18, scroll = s === 10 && play, gap = 4 * RH + 52;
    [[0, 'token'], [140, 'id', 'end'], [CX.x, 'x · 3 of 2 048'], [CX.h1, 'h₁'], [CX.hL, 'h_L'], [1000, 'score', 'end'], [1012, 'next']]
      .forEach(([x, t, a]) => o += T(x, 18, t, `font-size="14" class="sl" ${a ? `text-anchor="${a}"` : ''}`));
    const nums = (x, y, vals, st) => vals.map((v, j) =>
      T(x + j * W + W - 6, y, fmt(v), `class="mono" font-size="14" text-anchor="end" fill="${st === 'dim' ? C.dim : C.ink}"`)).join('')
      + T(x + 3 * W + 4, y, '…', `font-size="14" fill="${st === 'dim' ? C.dim : C.slate}"`);
    // one pass, its first `up` stages shown (0 text … 6 next token); st(i): 'new' | 'same' | 'dim'
    function pass(y0, d, p, up, st) {
      const n = d.tok.length, H = n * RH, mid = y0 + H / 2;
      let r = T(0, y0 - 12, `pass ${p} · n = ${n}`, `font-size="18" font-weight="600" fill="${C.gold}"`);
      for (let i = 0; i < n; i++) {
        const y = y0 + i * RH + 16, sti = st(i), last = i === n - 1, dimc = sti === 'dim' ? C.dim : null;
        if (sti === 'same') r += R(-6, y - 17, 1096, RH - 2, 'fill="url(#ID-hatch)" opacity=".55"');
        // the appended token flies in from the « next » column of the pass above
        const fly = last && p > 1 && up === 0 && play;
        const dx = 1012 - (80 - 9 * tokTxt(d.tok[i]).length), dy = (yt + (i - 1) * RH + 16) - y;
        r += `<g ${fly ? `class="kv-fly" style="--dx:${dx}px; --dy:${dy}px"` : ''}>` +
          T(80, y, tokTxt(d.tok[i]), `class="mono" font-size="15" text-anchor="end" fill="${dimc || (last && p > 1 ? C.gold : C.ink)}" ${last && p > 1 ? 'font-weight="600"' : ''}`) + '</g>';
        if (up >= 1) r += T(140, y, d.ids[i], `class="mono" font-size="14" text-anchor="end" fill="${dimc || C.slate}"`);
        if (up >= 2) r += nums(CX.x, y, d.x[i], sti);
        if (up >= 3) r += nums(CX.h1, y, d.h1[i], sti);
        if (up >= 4) r += nums(CX.hL, y, d.hL[i], sti);
        if (up >= 5) r += T(1000, y, d.top[i].toFixed(2), `class="mono" font-size="14" text-anchor="end" fill="${dimc || C.ink}"`);
        if (up >= 6) r += T(1012, y, tokTxt(d.pred[i]), `class="mono" font-size="15" fill="${dimc || (last ? C.gold : C.slate)}" ${last ? 'font-weight="600"' : ''}`);
      }
      if (up >= 2) r += arrow(146, mid, 162, mid) + tblock(166, y0, H, 'W_E') + arrow(196, mid, 210, mid);
      if (up >= 3) r += arrow(390, mid, 406, mid) + tblock(410, y0, H, 'block 1') + arrow(440, mid, 452, mid);
      if (up >= 4) r += T(646, mid + 5, '…', 'font-size="18" text-anchor="middle" class="sl"') + tblock(660, y0, H, 'block L') + arrow(690, mid, 702, mid);
      if (up >= 5) r += arrow(884, mid, 898, mid) + tblock(902, y0, H, 'W_U', C.green) + arrow(932, mid, 946, mid);
      return r;
    }
    // the stage just revealed: a dashed frame around its column
    const COLS = [[-6, 88], [96, 146], [162, 386], [406, 632], [656, 882], [898, 1006], [1006, 1096]];
    const frame = (y0, n, up) => (up < 0 || same ? '' :
      R(COLS[up][0], y0 - 2, COLS[up][1] - COLS[up][0], n * RH, `fill="none" stroke="${C.gold}" stroke-width="2" stroke-dasharray="6 4" rx="4"`));
    if (scroll) o += `<g class="kv-out" style="--dy:${-gap}px">` + pass(yt, P[0], 1, 6, (i) => (i < 3 ? 'dim' : 'new')) + '</g>';
    o += `<g ${scroll ? `class="kv-fly" style="--dx:0px; --dy:${gap}px"` : ''}>` +
      pass(yt, top, p3 ? 2 : 1, 6, (i) => (s >= 1 && i < tn - 1 ? 'dim' : 'new')) + '</g>';
    if (s >= 2 && s !== 10) {
      const bn = bot.tok.length;
      o += pass(yb, bot, p3 ? 3 : 2, upto, (i) => (same && i < bn - 1 ? 'same' : 'new')) + frame(yb, bn, upto);
    }
    return svg(o);
  };

  // « Why rows 1–4 do not change »: the block of « The Transformer black box » at n = 5,
  // with its dependencies. Steps: 0 the block · 1 attention fans in (row i reads rows 1…i) ·
  // 2 rows 1–4 after attention are the same · 3 FFN, row to row, rows 1–4 the same ·
  // 4 the same argument, block after block
  const TOK5 = ['Paris', '␣is', '␣the', '␣capital', '␣of'];
  function mat(x, y, rows, cols, cw, rh, col, seed, st) {
    let o = '';
    for (let i = 0; i < rows; i++) {
      const sti = st(i);
      for (let j = 0; j < cols; j++) o += R(x + j * cw, y + i * rh, cw - 1, rh - 6, `fill="${shade(col, val(seed, i, j))}"`);
      if (sti === 'same') o += R(x, y + i * rh, cols * cw - 1, rh - 6, 'fill="url(#ID-hatch)" opacity=".8"');
      if (sti === 'gold') o += R(x - 2, y + i * rh - 2, cols * cw + 3, rh - 2, `fill="none" stroke="${C.gold}" stroke-width="2.5"`);
    }
    return o;
  }
  FIG.why = (s) => {
    let o = '';
    const y0 = 70, rh = 42, n = 5, H = n * rh - 6, cy = (i) => y0 + i * rh + (rh - 6) / 2;
    const X = { tok: 150, x: 190, att: 360, a: 470, ffn: 640, y: 750 }, MW = 7 * 18;
    TOK5.forEach((t, i) => o += T(X.tok, cy(i) + 6, t, `class="mono" font-size="19" text-anchor="end" fill="${i === 4 ? C.gold : C.ink}" ${i === 4 ? 'font-weight="600"' : ''}`));
    const st = (from) => (i) => (i === 4 ? 'gold' : s >= from ? 'same' : 'new');
    o += mat(X.x, y0, n, 7, 18, rh, C.blue, 31, st(0));
    o += mat(X.a, y0, n, 7, 18, rh, '#6d86ff', 32, st(2));
    o += mat(X.y, y0, n, 7, 18, rh, '#a46cf5', 33, st(3));
    [['x', X.x], ['after attention', X.a], ['after FFN', X.y]].forEach(([t, x]) => o += T(x + MW / 2, y0 - 16, t, 'font-size="17" text-anchor="middle" class="sl"'));
    o += R(X.att, y0 - 6, 70, H + 12, `fill="${C.panel}" stroke="${C.blue}" stroke-width="2" opacity="${s >= 1 ? .5 : 1}"`) + T(X.att + 35, y0 + H + 34, 'Attention', 'font-size="18" text-anchor="middle"');
    o += R(X.ffn, y0 - 6, 70, H + 12, `fill="${C.panel}" stroke="${C.blue}" stroke-width="2" opacity="${s >= 3 ? .5 : 1}"`) + T(X.ffn + 35, y0 + H + 34, 'FFN', 'font-size="18" text-anchor="middle"');
    // attention: row i reads rows 1..i; the new row's lines in gold
    if (s >= 1) for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      const g = i === 4;
      o += `<path d="M${X.x + MW + 4} ${cy(j)}C${X.att + 20} ${cy(j)} ${X.att + 50} ${cy(i)} ${X.a - 6} ${cy(i)}" fill="none" stroke="${g ? C.gold : C.slate}" stroke-width="${g ? 2 : 1.2}" opacity="${g ? 1 : .7}"/>`;
    }
    if (s >= 3) for (let i = 0; i < n; i++) o += arrow(X.a + MW + 4, cy(i), X.y - 6, cy(i), i === 4);
    if (s >= 1) o += T(X.att + 35, y0 - 34, 'row i reads rows 1 … i', `font-size="15" text-anchor="middle" fill="${C.gold}"`);
    if (s >= 3) o += T(X.ffn + 35, y0 - 34, 'row i reads row i', `font-size="15" text-anchor="middle" fill="${C.gold}"`);
    if (s >= 4) {
      o += R(920, y0 - 6, 216, H + 64, `fill="${C.panel}"`);
      ['block 1', 'block 2', '…', 'block L'].forEach((t, k) => {
        const yy = y0 + 8 + k * 50;
        o += t === '…' ? T(1028, yy + 22, '⋮', 'font-size="22" text-anchor="middle" class="sl"')
          : R(950, yy, 156, 34, `fill="none" stroke="${C.blue}" stroke-width="1.6"`) + T(1028, yy + 23, t, 'font-size="16" text-anchor="middle"');
      });
      o += T(1028, y0 + H + 22, 'rows 1–4 equal in,', `font-size="15" text-anchor="middle" fill="${C.gold}"`) + T(1028, y0 + H + 44, 'rows 1–4 equal out', `font-size="15" text-anchor="middle" fill="${C.gold}"`);
    }
    return svg(o);
  };

  document.querySelectorAll('div.kv[data-kv]:not(.kv-built)').forEach((root) => {
    root.classList.add('kv-built');
    const caps = [...root.querySelectorAll(':scope > p')], fig = FIG[root.dataset.kv];
    const body = document.createElement('div'), box = document.createElement('div');
    body.className = 'kv-body'; box.className = 'kv-caps';
    box.append(...caps);
    root.replaceChildren(body, box);
    let prev = null;
    steps(root, caps.length - 1, (st) => {
      const play = st !== null && prev !== null && st === prev + 1;
      if (st === null) st = caps.length - 1;
      prev = st;
      body.innerHTML = fig(st, play);
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    });
  });
})();
