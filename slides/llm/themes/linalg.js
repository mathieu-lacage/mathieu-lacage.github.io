// Linear algebra refresher: vectors, cosine, dot product, matrix products, transpose.
//
// Each slide is a <div class="la" data-la="name"> whose <p> children are its captions,
// one per step. The drawing is rebuilt from scratch on every step by the slide's
// draw(R, st, anim) below: R is an empty layer over the whole slide (positions are
// slide coordinates, 1280 × 720), st the step, anim true when stepping forward by one
// (play the transition) and false otherwise (draw the end state at once, as in the PDF).
// Colours: blue = left operand being read, magenta = right operand, yellow = written.
// Uses steps.js (load it first) and MathJax (tex2svg, fontCache 'local').
(() => {
  const $ = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.append(e); return e; };
  const fmt = (v) => v == null ? '' : typeof v === 'string' ? v : v < 0 ? '−' + (-v) : String(v);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // timers and animation frames belong to one slide: redrawing it cancels only its own
  let CUR = null;
  const bind = (c, f) => (...a) => { const p = CUR; CUR = c; try { f(...a); } finally { CUR = p; } };
  const later = (ms, f) => { const c = CUR; c.timers.push(setTimeout(bind(c, f), ms)); };
  const frame = (f) => { const c = CUR; c.raf = requestAnimationFrame(bind(c, f)); };
  const stopAll = () => { CUR.timers.forEach(clearTimeout); CUR.timers = []; cancelAnimationFrame(CUR.raf); };

  function tx(p, x, y, html, cls = '') { const e = $('div', 't ' + cls, p, html); e.style.left = x + 'px'; e.style.top = y + 'px'; return e; }
  const mjReady = new Promise((ok) => { const t = () => (window.MathJax && MathJax.tex2svg ? MathJax.startup.promise.then(ok) : setTimeout(t, 50)); t(); });
  function tex(p, src, o = {}) {
    const e = $('div', 'tex ' + (o.x != null ? 'abs ' : '') + (o.cls || ''), p);
    if (o.x != null) { e.style.left = o.x + 'px'; e.style.top = o.y + 'px'; }
    if (o.fs) e.style.fontSize = o.fs + 'px';
    mjReady.then(() => e.append(MathJax.tex2svg(src, { display: false })));
    return e;
  }
  function op(p, x, y, s) { const e = $('div', 'op', p, s); e.style.left = x + 'px'; e.style.top = y + 'px'; return e; }

  // matrix: vals[i][j]; o.cs cell size, o.cw cell width, o.gap extra gap after o.split cells (blocks)
  function mx(p, vals, x, y, o = {}) {
    const cs = o.cs || 58, cw = o.cw || cs, R = vals.length, C = vals[0].length, gap = o.gap || 0, sp = o.split || 1e9;
    const px = (j) => j * cw + (j >= sp ? gap : 0), py = (i) => i * cs + (i >= sp ? gap : 0);
    const W = px(C - 1) + cw, H = py(R - 1) + cs;
    const g = $('div', 'mx ' + (o.cls || ''), p);
    Object.assign(g.style, { left: x + 'px', top: y + 'px', width: W + 'px', height: H + 'px' });
    const cells = vals.map((row, i) => row.map((v, j) => {
      const c = $('div', 'cell', g, fmt(v));
      Object.assign(c.style, { left: px(j) + 'px', top: py(i) + 'px', width: cw + 'px', height: cs + 'px', fontSize: o.fs ? o.fs + 'px' : '' });
      return c;
    }));
    if (o.name) { const l = $('div', 'mlab', p, `<b>${o.name}</b>${o.shape || ''}`); l.style.left = x + W / 2 + 'px'; l.style.top = y + H + 14 + 'px'; }
    return { g, cells, x, y, W, H, R, C, px, py,
      row: (i) => cells[i], col: (j) => cells.map((r) => r[j]), all: () => cells.flat() };
  }
  const cls = (els, c, on = true) => els.forEach((e) => e.classList.toggle(c, on));

  // read two lists of cells pairwise and accumulate their products into `out`
  function readDot(as, bs, av, bv, out, anim, dt = 340, done) {
    cls(as, 'ra'); cls(bs, 'rb'); out.classList.add('w');
    const total = av.reduce((s, a, k) => s + a * bv[k], 0);
    if (!anim || reduced) { out.textContent = fmt(total); done && done(); return 0; }
    out.textContent = '';
    let acc = 0;
    av.forEach((a, k) => later(k * dt, () => {
      cls(as, 'hot', false); cls(bs, 'hot', false);
      as[k].classList.add('hot'); bs[k].classList.add('hot');
      acc += a * bv[k]; out.textContent = fmt(acc); out.classList.add('hot');
    }));
    later(av.length * dt, () => { cls(as, 'hot', false); cls(bs, 'hot', false); out.classList.remove('hot'); out.textContent = fmt(total); out.classList.add('flash'); done && done(); });
    return av.length * dt;
  }
  const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)));

  const SLIDES = {};
  const SLIDE = (name, s) => { SLIDES[name] = s; };

  // 1 ─ vectors
  SLIDE('vector', {
    draw(R, st, anim) {
      if (st < 3) {
        const v = mx(R, [[3], [2]], 200, 250, { cs: 76, name: 'x', shape: '(2, 1)' });
        tx(R, 150, 270, 'x₁', 'sm'); tx(R, 150, 346, 'x₂', 'sm');
        tx(R, 300, 200, '2 rows', 'sm'); tx(R, 300, 232, '1 column', 'sm');
        if (st >= 1) {
          const O = [620, 520], u = 80, P = [O[0] + 3 * u, O[1] - 2 * u];
          const svg = `<svg width="1280" height="720" style="position:absolute;left:0;top:0">
            <defs><marker id="${CUR.id}ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#e3e9f3"/></marker></defs>
            ${[1, 2, 3, 4].map((k) => `<line x1="${O[0] + k * u}" y1="${O[1]}" x2="${O[0] + k * u}" y2="${O[1] - 3.6 * u}" stroke="#1d2a44"/>`).join('')}
            ${[1, 2, 3].map((k) => `<line x1="${O[0]}" y1="${O[1] - k * u}" x2="${O[0] + 4.6 * u}" y2="${O[1] - k * u}" stroke="#1d2a44"/>`).join('')}
            <line x1="${O[0]}" y1="${O[1]}" x2="${O[0] + 4.6 * u}" y2="${O[1]}" stroke="#8e95a2" stroke-width="2"/>
            <line x1="${O[0]}" y1="${O[1]}" x2="${O[0]}" y2="${O[1] - 3.6 * u}" stroke="#8e95a2" stroke-width="2"/>
            ${[1, 2, 3, 4].map((k) => `<text x="${O[0] + k * u}" y="${O[1] + 28}" fill="#8e95a2" font-size="18" text-anchor="middle">${k}</text>`).join('')}
            ${[1, 2, 3].map((k) => `<text x="${O[0] - 16}" y="${O[1] - k * u + 6}" fill="#8e95a2" font-size="18" text-anchor="end">${k}</text>`).join('')}
            <line x1="${O[0]}" y1="${O[1]}" x2="${P[0]}" y2="${O[1]}" stroke="#4aa8ff" stroke-width="5" stroke-dasharray="10 7" class="${anim && st === 1 ? 'pop' : ''}"/>
            ${st >= 2 ? `<line x1="${P[0]}" y1="${O[1]}" x2="${P[0]}" y2="${P[1]}" stroke="#d97fd0" stroke-width="5" stroke-dasharray="10 7" class="${anim ? 'pop' : ''}"/>` : ''}
            <line x1="${O[0]}" y1="${O[1]}" x2="${P[0] - 4}" y2="${P[1] + 3}" stroke="#e3e9f3" stroke-width="4" marker-end="url(#${CUR.id}ah)"/>
            <text x="${P[0] + 14}" y="${P[1] - 10}" fill="#e3e9f3" font-size="26" font-weight="600">x</text>
            <text x="${(O[0] + P[0]) / 2}" y="${O[1] - 14}" fill="#4aa8ff" font-size="20" text-anchor="middle">x₁ = 3</text>
            ${st >= 2 ? `<text x="${P[0] + 14}" y="${(O[1] + P[1]) / 2 + 6}" fill="#d97fd0" font-size="20">x₂ = 2</text>` : ''}
          </svg>`;
          R.insertAdjacentHTML('beforeend', svg);
          v.cells[0][0].classList.add('ra', st === 1 ? 'hot' : 'x');
          if (st >= 2) v.cells[1][0].classList.add('rb', 'hot');
        }
      } else {
        const vals = [['0.12'], ['−0.83'], ['0.40'], ['⋮'], ['1.07'], ['−0.25']];
        mx(R, vals, 170, 170, { cs: 56, cw: 104, fs: 20, name: 'x', shape: '(2048, 1)' });
        tx(R, 112, 175, 'x₁', 'sm'); tx(R, 112, 231, 'x₂', 'sm'); tx(R, 88, 457, 'x₂₀₄₈', 'sm');
        const c = $('canvas', anim ? 'pop' : '', R); c.width = 2048; c.height = 60;
        Object.assign(c.style, { position: 'absolute', left: '400px', top: '280px', width: '800px', height: '60px' });
        const g = c.getContext('2d'); let s = 7;
        const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        for (let k = 0; k < 2048; k++) {
          let v = (rnd() + rnd() + rnd() - 1.5) * 1.4; if (k === 413 || k === 1630) v = 4;
          const t = Math.max(-1, Math.min(1, v / 2));
          g.fillStyle = t >= 0 ? `rgb(${15 + 230 * t},${24 + 172 * t},${41 + 40 * t})` : `rgb(${15 + 59 * -t},${24 + 144 * -t},${41 + 214 * -t})`;
          g.fillRect(k, 0, 1, 60);
        }
        tx(R, 400, 236, 'the same 2048 numbers as colours, one thin bar each', 'sm');
        tx(R, 400, 352, 'x₁', 'sm'); tx(R, 1150, 352, 'x₂₀₄₈', 'sm');
        tx(R, 400, 420, 'blue = negative, dark = 0, yellow = positive', 'sm');
      }
    },
  });

  // shared: two arrows A (fixed) and B (moving), with optional gauges. s = {tb, lb, n}; n = 1: both of length 1
  const rad = Math.PI / 180;
  // letters with a hat, drawn as a caret path: the combining ^ lands off-centre on some letters
  function hatLab(p, word, col, fs = 26) {
    const items = word === 'B-A' ? [['B', 1], ['−', 0], ['A', 1]] : [[word, 1]];
    const step = .8 * fs, x0 = p[0] - (items.length - 1) * step / 2, yb = p[1] + fs * .35;
    return items.map(([c, h], k) => { const x = x0 + k * step;
      return `<text x="${x}" y="${yb}" fill="${col}" font-size="${fs}" font-weight="600" text-anchor="middle">${c}</text>` +
        (h ? `<path d="M${x - fs * .2},${yb - fs * .8} L${x},${yb - fs * .98} L${x + fs * .2},${yb - fs * .8}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round"/>` : ''); }).join('');
  }
  const sgn = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
  function twoVec(s, o) {
    const { O, u, ta, la, gx, gy } = o;
    const LA = la + (1 - la) * s.n, LB = s.lb + (1 - s.lb) * s.n, z = u * (1 + 1.6 * s.n);
    const pt = (t, L, px = 0) => [O[0] + (L * z + px) * Math.cos(t * rad), O[1] - (L * z + px) * Math.sin(t * rad)];
    const [ax, ay] = pt(ta, LA), [bx, by] = pt(s.tb, LB), [lax, lay] = pt(ta, LA, 30), [lbx, lby] = pt(s.tb, LB, 30);
    const th = s.tb - ta, c = Math.cos(th * rad), d = LA * LB * c, hat = s.n > .5;
    const r = 34, [x1, y1] = pt(ta, 0, r), [x2, y2] = pt(s.tb, 0, r), [tx_, ty] = pt((ta + s.tb) / 2, 0, 62);
    const bar = (v, m, y) => { const w = Math.min(1, Math.abs(v) / m) * 200; return `<rect x="${v < 0 ? gx + 200 - w : gx + 200}" y="${y}" width="${w}" height="26" fill="#f5c451"/>`; };
    const gauge = (y, name, v, m, lo, hi) => `<text x="${gx}" y="${y}" font-weight="600">${name}</text><text x="${gx + 400}" y="${y}" text-anchor="end" font-family="IBM Plex Mono" fill="#f5c451">${sgn(v)}</text>
      <rect x="${gx}" y="${y + 16}" width="400" height="26" fill="#18233a"/><line x1="${gx + 200}" y1="${y + 10}" x2="${gx + 200}" y2="${y + 48}" stroke="#8e95a2"/>${bar(v, m, y + 16)}
      <text x="${gx}" y="${y + 68}" fill="#8e95a2" font-size="15">${lo}</text><text x="${gx + 400}" y="${y + 68}" fill="#8e95a2" font-size="15" text-anchor="end">${hi}</text>`;
    let h = `<defs>
        <marker id="${CUR.id}aa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#4aa8ff"/></marker>
        <marker id="${CUR.id}ab" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#d97fd0"/></marker></defs>
      <line x1="${O[0] - 280}" y1="${O[1]}" x2="${O[0] + 300}" y2="${O[1]}" stroke="#2a3550" stroke-width="2"/>
      <line x1="${O[0]}" y1="${O[1] + 140}" x2="${O[0]}" y2="${O[1] - 280}" stroke="#2a3550" stroke-width="2"/>
      <circle cx="${O[0]}" cy="${O[1]}" r="${z}" fill="none" stroke="#f5c451" stroke-width="2" stroke-dasharray="6 6" opacity="${s.n}"/>
      <path d="M${x1},${y1} A${r},${r} 0 0 0 ${x2},${y2}" fill="none" stroke="#f5c451" stroke-width="3"/>
      <text x="${tx_ - 6}" y="${ty + 8}" fill="#f5c451" font-size="22">θ</text>
      <line x1="${O[0]}" y1="${O[1]}" x2="${ax}" y2="${ay}" stroke="#4aa8ff" stroke-width="5" marker-end="url(#${CUR.id}aa)"/>
      <line x1="${O[0]}" y1="${O[1]}" x2="${bx}" y2="${by}" stroke="#d97fd0" stroke-width="5" marker-end="url(#${CUR.id}ab)"/>
      ${hatLab([lax, lay], 'A', '#4aa8ff').replace(/<path[^>]*>/, hat ? '$&' : '')}
      ${hatLab([lbx, lby], 'B', '#d97fd0').replace(/<path[^>]*>/, hat ? '$&' : '')}
      <g font-size="22" fill="#e3e9f3">
      <text x="${gx}" y="${gy}" fill="#8e95a2">‖A‖</text><text x="${gx + 400}" y="${gy}" text-anchor="end" font-family="IBM Plex Mono">${LA.toFixed(2)}</text>
      <text x="${gx}" y="${gy + 36}" fill="#8e95a2">‖B‖</text><text x="${gx + 400}" y="${gy + 36}" text-anchor="end" font-family="IBM Plex Mono">${LB.toFixed(2)}</text>
      <text x="${gx}" y="${gy + 72}" fill="#8e95a2">θ</text><text x="${gx + 400}" y="${gy + 72}" text-anchor="end" font-family="IBM Plex Mono">${Math.round(th)}°</text>
      ${o.curve ? `<text x="${gx}" y="${gy + 136}" font-weight="600">cos θ</text><text x="${gx + 400}" y="${gy + 136}" text-anchor="end" font-family="IBM Plex Mono" fill="#f5c451">${sgn(c)}</text>` : gauge(gy + 136, 'cos θ', c, 1, '−1', '+1')}`;
    if (o.dot) h += gauge(gy + 250, 'A · B', d, 15, '−15', '+15');
    if (o.curve) {
      const cx = gx + 34, cy = gy + 280, cw = 366, ch = 100, X = (t) => cx + t / 180 * cw, Y = (v) => cy - v * ch;
      let pts = ''; for (let t = 0; t <= 180; t += 5) pts += `${X(t)},${Y(Math.cos(t * rad))} `;
      h += `<line x1="${cx}" y1="${cy}" x2="${cx + cw}" y2="${cy}" stroke="#3d4a63"/>
        <polyline points="${pts}" fill="none" stroke="#8e95a2" stroke-width="2"/>
        <circle cx="${X(Math.min(180, th))}" cy="${Y(c)}" r="8" fill="#f5c451"/>
        ${[0, 90, 180].map((t) => `<text x="${X(t)}" y="${cy + ch + 24}" fill="#8e95a2" font-size="15" text-anchor="middle">${t}°</text>`).join('')}
        <line x1="${cx}" y1="${cy - ch}" x2="${cx}" y2="${cy + ch}" stroke="#3d4a63"/>
        ${[[1, '+1'], [0, '0'], [-1, '−1']].map(([v, t]) => `<text x="${cx - 10}" y="${Y(v) + 5}" fill="#8e95a2" font-size="15" text-anchor="end">${t}</text>`).join('')}`;
    }
    return h + '</g>';
  }
  // draws state ST[st] into a fresh svg, tweening from ST[st - 1] when stepping forward
  function playStates(R, ST, st, anim, o) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', 1280); svg.setAttribute('height', 720); svg.style.cssText = 'position:absolute;left:0;top:0';
    R.append(svg);
    const set = (s) => { svg.innerHTML = twoVec(s, o); };
    const to = ST[st], from = anim && st > 0 ? ST[st - 1] : to;
    if (from === to || reduced) { set(to); return; }
    const t0 = performance.now(), D = 900;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / D), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      set({ tb: from.tb + (to.tb - from.tb) * e, lb: from.lb + (to.lb - from.lb) * e, n: from.n + (to.n - from.n) * e });
      if (k < 1) frame(tick);
    };
    frame(tick);
  }

  // 2 ─ cosine similarity
  const ST2 = [{ tb: 55, lb: 2.5, n: 0 }, { tb: 20, lb: 2.5, n: 0 }, { tb: 110, lb: 2.5, n: 0 }, { tb: 200, lb: 2.5, n: 0 }, { tb: 55, lb: 5, n: 0 }];
  SLIDE('cosine', {
    draw(R, st, anim) { playStates(R, ST2, st, anim, { O: [380, 400], u: 52, ta: 20, la: 3, gx: 780, gy: 170, curve: true }); },
  });

  // 3 ─ cos θ from coordinates (the whiteboard construction)
  const nA3 = Math.hypot(3, 1), nB3 = Math.hypot(2, 5), aA3 = Math.atan2(1, 3), aB3 = Math.atan2(5, 2), th3 = aB3 - aA3;
  const L3 = [
    [0, 'A = (a_1, a_2) = (3, 1) \\qquad B = (b_1, b_2) = (2, 5)'],
    [0, '\\theta = b - a'],
    [1, '\\hat A = \\frac{A}{\\|A\\|} = \\left(\\frac{a_1}{\\|A\\|},\\ \\frac{a_2}{\\|A\\|}\\right) = (\\cos a,\\ \\sin a)'],
    [1, '\\hat B = \\frac{B}{\\|B\\|} = \\left(\\frac{b_1}{\\|B\\|},\\ \\frac{b_2}{\\|B\\|}\\right) = (\\cos b,\\ \\sin b)'],
    [3, '\\cos\\theta = \\cos(b - a) = \\cos a \\cos b + \\sin a \\sin b'],
    [4, '\\cos\\theta = \\frac{a_1}{\\|A\\|}\\,\\frac{b_1}{\\|B\\|} + \\frac{a_2}{\\|A\\|}\\,\\frac{b_2}{\\|B\\|}'],
    [5, '\\color{#f5c451}{\\cos\\theta = \\frac{a_1 b_1 + a_2 b_2}{\\|A\\|\\,\\|B\\|}} = \\frac{3 \\cdot 2 + 1 \\cdot 5}{\\sqrt{10}\\,\\sqrt{29}} = 0.65'],
  ];
  function draw3(svg, st, n, S) {
    const O = [250, 545], P = (x, y) => [O[0] + x * S, O[1] - y * S];
    const ua = [Math.cos(aA3), Math.sin(aA3)], ub = [Math.cos(aB3), Math.sin(aB3)];
    const LA = (1 - n) * nA3 + n, LB = (1 - n) * nB3 + n, At = P(LA * ua[0], LA * ua[1]), Bt = P(LB * ub[0], LB * ub[1]);
    const d = [ua[0], -ua[1]], nrm = [-ua[1], -ua[0]];                 // screen: along Â, and across towards B̂
    const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k], mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const arc = (r, t0, t1) => { const p = add(O, [Math.cos(t0), -Math.sin(t0)], r), q = add(O, [Math.cos(t1), -Math.sin(t1)], r); return `M${p} A${r},${r} 0 0 0 ${q}`; };
    const lab = (p, s, col = '#e3e9f3', anchor = 'middle', fs = 21) => `<text x="${p[0]}" y="${p[1] + 7}" fill="${col}" font-size="${fs}" text-anchor="${anchor}">${s}</text>`;
    const Lmin = Math.min(LA, LB) * S, ra = .26 * Lmin, rb = .15 * Lmin, rt = .36 * Lmin, hat = n > .5;
    let h = `<defs>${[['ma', '#4aa8ff'], ['mb', '#d97fd0'], ['my', '#f5c451'], ['ms', '#8e95a2']].map(([id, c]) => `<marker id="${CUR.id}${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('')}</defs>
      <line x1="${O[0] - 170}" y1="${O[1]}" x2="${O[0] + 400}" y2="${O[1]}" stroke="#8e95a2" stroke-width="2"/>`;
    if (n > 0) h += `<path d="${arc(S, -6 * rad, 104 * rad)}" fill="none" stroke="#8e95a2" stroke-width="2" opacity="${n}"/>`;
    const ghost = n > 0 ? Math.max(0, .35 * (1 - (S - 75) / 120)) : 0;
    if (ghost > 0) h += `<g opacity="${ghost}" stroke-width="3"><line x1="${O[0]}" y1="${O[1]}" x2="${P(nA3 * ua[0], nA3 * ua[1])}" stroke="#4aa8ff" /><line x1="${O[0]}" y1="${O[1]}" x2="${P(nB3 * ub[0], nB3 * ub[1])}" stroke="#d97fd0"/></g>`.replace(/x2="([\d.-]+),([\d.-]+)"/g, 'x2="$1" y2="$2"');
    h += `<path d="${arc(ra, 0, aA3)}" fill="none" stroke="#8e95a2" stroke-width="2.5"/>${lab(add(O, [Math.cos(aA3 / 2), -Math.sin(aA3 / 2)], ra + 16), 'a', '#8e95a2')}
      <path d="${arc(rb, 0, aB3)}" fill="none" stroke="#8e95a2" stroke-width="2.5"/>${lab(add(O, [Math.cos(aB3 / 2), -Math.sin(aB3 / 2)], rb + 14), 'b', '#8e95a2')}
      <path d="${arc(rt, aA3, aB3)}" fill="none" stroke="#f5c451" stroke-width="3"/>${lab(add(O, [Math.cos(aB3 - 8 * rad), -Math.sin(aB3 - 8 * rad)], rt + 14), 'θ = b − a', '#f5c451', 'start')}`;
    if (st >= 2) {
      const F = P(Math.cos(th3) * ua[0], Math.cos(th3) * ua[1]), q = 14;
      h += `<line x1="${Bt[0]}" y1="${Bt[1]}" x2="${F[0]}" y2="${F[1]}" stroke="#e3e9f3" stroke-width="3" stroke-dasharray="3 7" stroke-linecap="round"/>
        <path d="M${add(F, d, -q)} L${add(add(F, d, -q), nrm, q)} L${add(F, nrm, q)}" fill="none" stroke="#e3e9f3" stroke-width="2"/>
        <line x1="${O[0]}" y1="${O[1]}" x2="${F[0]}" y2="${F[1]}" stroke="#f5c451" stroke-width="9" stroke-linecap="round" opacity=".55"/>
        ${lab(add(add(O, d, .78 * Math.cos(th3) * S), nrm, -28), 'cos θ', '#f5c451', 'middle', 23)}`;
    }
    h += `<line x1="${O[0]}" y1="${O[1]}" x2="${At[0]}" y2="${At[1]}" stroke="#4aa8ff" stroke-width="5" marker-end="url(#${CUR.id}ma)"/>
      <line x1="${O[0]}" y1="${O[1]}" x2="${Bt[0]}" y2="${Bt[1]}" stroke="#d97fd0" stroke-width="5" marker-end="url(#${CUR.id}mb)"/>
      ${hatLab(add(At, d, 34), 'A', '#4aa8ff', 28).replace(/<path[^>]*>/, hat ? '$&' : '')}${hatLab(add(Bt, [ub[0], -ub[1]], 30), 'B', '#d97fd0', 28).replace(/<path[^>]*>/, hat ? '$&' : '')}`;
    svg.innerHTML = h;
  }
  SLIDE('cosine-xy', {
    draw(R, st, anim) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', 1280); svg.setAttribute('height', 720); svg.style.cssText = 'position:absolute;left:0;top:0';
      R.append(svg);
      if (st === 1 && anim && !reduced) {
        const t0 = performance.now(), D = 2200, ease = (k) => (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
        const tick = (now) => {
          const k = Math.min(1, (now - t0) / D);
          draw3(svg, st, ease(Math.min(1, k * 2)), 75 + 265 * ease(Math.max(0, k * 2 - 1)));
          if (k < 1) frame(tick);
        };
        frame(tick);
      } else draw3(svg, st, st ? 1 : 0, st ? 340 : 75);
      const panel = $('div', 'eqs', R);
      L3.filter(([s]) => s <= st).forEach(([s, src]) => tex(panel, src, { cls: s < st ? 'old' : anim ? 'pop' : '' }));
    },
  });

  // 4 ─ dot product
  const A2 = [2, 1, -1, 3], B2 = [1, 3, 2, 1];
  SLIDE('dot', {
    draw(R, st, anim) {
      const cs = 64, y0 = 230;
      const a = mx(R, A2.map((v) => [v]), 200, y0, { cs, name: 'a', shape: '(4, 1)' });
      const b = mx(R, B2.map((v) => [v]), 340, y0, { cs, name: 'b', shape: '(4, 1)' });
      op(R, 302, y0 + 2 * cs, '·');
      const p = mx(R, A2.map(() => ['']), 540, y0, { cs, cw: 80, cls: 'nob' });
      const plab = tx(R, 548, y0 - 44, 'aᵢ × bᵢ', 'sm fade');
      const terms = [];
      for (let k = 0; k < Math.min(st, 4); k++) {
        p.cells[k][0].textContent = fmt(A2[k] * B2[k]); p.cells[k][0].classList.add('w');
        if (anim && k === st - 1) p.cells[k][0].classList.add('flash');
        terms.push(k ? (A2[k] * B2[k] < 0 ? ' − ' + -A2[k] * B2[k] : ' + ' + A2[k] * B2[k]) : String(A2[k] * B2[k]));
      }
      if (st >= 1 && st <= 4) {
        const k = st - 1;
        a.cells[k][0].classList.add('ra', 'hot'); b.cells[k][0].classList.add('rb', 'hot');
        p.cells[k][0].classList.add('hot');
      }
      const num = terms.join('').replace(/−/g, '-');
      tex(R, '\\begin{aligned} a \\cdot b &= \\sum_{i=1}^{d} a_i\\, b_i \\\\[10pt] &= a_1 b_1 + a_2 b_2 + a_3 b_3 + a_4 b_4 \\\\[6pt] &= '
        + (st >= 5 ? num + ' = \\color{#f5c451}{6}' : num || '\\dots') + '\\end{aligned}', { x: 740, y: 160, fs: 30 });
      if (st >= 5) {
        cls(p.col(0), 'hot', false);
        const s = mx(R, [[6]], 540, 500, { cs: 64, cw: 80, cls: 'nob' });
        s.cells[0][0].classList.add('w'); if (anim && st === 5) s.cells[0][0].classList.add('flash');
        const sig = op(R, 505, 532, '<span style="font-size:30px">Σ</span>'); sig.style.color = 'var(--yellow)'; sig.classList.add('fade');
        if (st >= 6) {
          const eq = op(R, 470, y0 + 2 * cs, '='); eq.classList.add('fade');
          s.g.style.transition = 'top .8s cubic-bezier(.5,0,.3,1)';
          const collapse = () => {
            p.all().forEach((c) => { c.style.top = 1.5 * cs + 'px'; c.style.opacity = 0; });
            s.g.style.top = y0 + 1.5 * cs + 'px'; sig.style.opacity = 0; plab.style.opacity = 0; eq.style.opacity = 1;
          };
          if (anim && !reduced) { eq.style.opacity = 0; requestAnimationFrame(() => requestAnimationFrame(collapse)); } else collapse();
        }
      }
    },
  });


  // 5 ─ dot product and cosine
  const ST5 = [{ tb: 55, lb: 2.5, n: 0 }, { tb: 55, lb: 2.5, n: 0 }, { tb: 20, lb: 2.5, n: 0 }, { tb: 110, lb: 2.5, n: 0 }, { tb: 170, lb: 2.5, n: 0 }, { tb: 55, lb: 5, n: 0 }, { tb: 55, lb: 5, n: 1 }];
  SLIDE('dot-cosine', {
    draw(R, st, anim) {
      tex(R, '\\cos\\theta = \\frac{\\color{#f5c451}{a_1 b_1 + a_2 b_2}}{\\|A\\|\\,\\|B\\|}', { x: 72, y: 128, fs: 28 });
      if (st >= 1) tex(R, '\\Rightarrow\\ \\color{#f5c451}{\\cos\\theta = \\frac{A \\cdot B}{\\|A\\|\\,\\|B\\|}}', { x: 780, y: 128, fs: 28, cls: anim && st === 1 ? 'pop' : '' });
      playStates(R, ST5, st, anim, { O: [360, 440], u: 44, ta: 20, la: 3, gx: 780, gy: 250, dot: true });
    },
  });

  // curly brace along one side of a matrix, with its dimension label at the tip.
  // side: 'up' | 'down' along x1..x2 at y; 'left' | 'right' along y1..y2 at x
  function brace(p, side, at, a1, a2, label, o = {}) {
    const h = 12, L = a2 - a1, r = Math.min(8, L / 4), col = o.col || '#8e95a2';
    const pts = [[0, 0], [0, h / 2], [r, h / 2], [L / 2 - r, h / 2], [L / 2, h / 2], [L / 2, h], [L / 2, h / 2], [L / 2 + r, h / 2], [L - r, h / 2], [L, h / 2], [L, 0]];
    const map = ([u, v]) => side === 'up' ? [a1 + u, at - v] : side === 'down' ? [a1 + u, at + v] : side === 'left' ? [at - v, a1 + u] : [at + v, a1 + u];
    const P = pts.map(map).map((q) => q.join(' '));
    const d = `M${P[0]} Q${P[1]} ${P[2]} L${P[3]} Q${P[4]} ${P[5]} Q${P[6]} ${P[7]} L${P[8]} Q${P[9]} ${P[10]}`;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.assign(s.style, { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' });
    s.setAttribute('width', 1); s.setAttribute('height', 1);
    s.innerHTML = `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/>`;
    p.append(s);
    const [tx0, ty0] = map([L / 2, h + 8]);
    const t = tex(p, o.col ? `\\color{${o.col}}{${label}}` : label, { x: tx0, y: ty0, fs: 24 });
    t.style.transform = { up: 'translate(-50%,-100%)', down: 'translate(-50%,0)', left: 'translate(-100%,-50%)', right: 'translate(0,-50%)' }[side];
    return s;
  }
  // cross layout of C = A B: B above C, A left of C, a brace on each outer side, names outside the braces
  function cross(R, Av, Bv, o) {
    const cs = o.cs, g = 30, bx = o.bx, by = o.by, Ak = Av[0].length;
    const ax = bx - Ak * cs - g, ay = by + Bv.length * cs + g;
    const B = mx(R, Bv, bx, by, { cs }), A = mx(R, Av, ax, ay, { cs });
    const C = mx(R, Av.map(() => Bv[0].map(() => null)), bx, ay, { cs });
    const off = 16, yk = o.hiK ? '#f5c451' : null;
    brace(R, 'up', by - off, bx, bx + B.W, o.dims[2]);
    brace(R, 'right', bx + B.W + off, by, by + B.H, o.dims[1], { col: yk });
    brace(R, 'left', ax - off, ay, ay + A.H, o.dims[0]);
    brace(R, 'down', ay + A.H + off, ax, ax + A.W, o.dims[1], { col: yk });
    brace(R, 'right', bx + C.W + off, ay, ay + C.H, o.dims[0]);
    brace(R, 'down', ay + C.H + off, bx, bx + C.W, o.dims[2]);
    const nm = (x, y, s) => { const e = tex(R, s, { x, y, fs: 34 }); e.style.transform = 'translate(-50%,-50%)'; return e; };
    nm(bx + B.W + 150, by + B.H / 2, o.names[1]);
    nm(ax - 150, ay + A.H / 2, o.names[0]);
    nm(bx + C.W + 150, ay + C.H / 2, o.names[2]);
    return { A, B, C, ax, ay, bx, by };
  }

  // 6 ─ matrix × matrix
  const A5 = [[1, 2, 0], [-1, 1, 3]], B5 = [[2, 0, 1, -1], [1, 1, 0, 2], [0, 3, 1, 1]], C5 = matmul(A5, B5);
  SLIDE('matmul', {
    draw(R, st, anim) {
      if (st === 0) {
        const A = mx(R, A5, 560, 300, { cs: 58 });
        brace(R, 'left', 544, 300, 300 + A.H, 'n = 2'); brace(R, 'up', 284, 560, 560 + A.W, 'k = 3');
        const e = tex(R, 'A', { x: 560 + A.W + 60, y: 300 + A.H / 2, fs: 34 }); e.style.transform = 'translate(-50%,-50%)';
        return;
      }
      tex(R, 'C = A\\,B', { x: 90, y: 180, fs: 34, cls: anim && st === 1 ? 'pop' : '' });
      tex(R, 'c_{ij} = \\displaystyle\\sum_{l=1}^{k} a_{il}\\, b_{lj}', { x: 90, y: 250, fs: 30, cls: anim && st === 1 ? 'pop' : '' });
      const { A, B, C } = cross(R, A5, B5, { cs: 58, bx: 640, by: 180, dims: ['n = 2', 'k = 3', 'm = 4'], names: ['A', 'B', 'C'], hiK: st >= 6 });
      const fill = (i, j) => { C.cells[i][j].textContent = fmt(C5[i][j]); C.cells[i][j].classList.add('w'); };
      const done = { 2: [[0, 0]], 3: [[0, 0], [0, 1]], 4: [[0, 0], [0, 1], [1, 2]] };
      if (st >= 2 && st <= 4) {
        done[st].slice(0, -1).forEach(([i, j]) => fill(i, j));
        const [i, j] = done[st].at(-1);
        readDot(A.row(i), B.col(j), A5[i], B5.map((r) => r[j]), C.cells[i][j], anim);
      }
      if (st >= 5) {
        const rest = [[0, 2], [0, 3], [1, 0], [1, 1], [1, 3]];
        [[0, 0], [0, 1], [1, 2]].forEach(([i, j]) => fill(i, j));
        if (st === 5 && anim && !reduced) rest.forEach(([i, j], k) => later(k * 260, () => { fill(i, j); C.cells[i][j].classList.add('flash'); }));
        else rest.forEach(([i, j]) => fill(i, j));
      }
    },
  });

  // 7 ─ matrix × vector, the case m = 1
  const W4 = [[1, 0, 2, -1], [0, 1, 1, 2], [3, -1, 0, 1]], X4 = [2, 1, -1, 1];
  SLIDE('matvec', {
    draw(R, st, anim) {
      tex(R, 'y = A\\,x', { x: 90, y: 140, fs: 34 });
      tex(R, 'y_{i} = \\displaystyle\\sum_{l=1}^{k} a_{il}\\, x_{l}', { x: 90, y: 190, fs: 30 });
      const { A, B: x, C: y } = cross(R, W4, X4.map((v) => [v]), { cs: 44, bx: 700, by: 165, dims: ['n = 3', 'k = 4', 'm = 1'], names: ['A', 'x', 'y'], hiK: false });
      const Y = matmul(W4, X4.map((v) => [v])).map((r) => r[0]);
      for (let i = 0; i < 3 && i < st; i++) {
        if (i === st - 1) readDot(A.row(i), x.col(0), W4[i], X4, y.cells[i][0], anim);
        else { y.cells[i][0].textContent = fmt(Y[i]); y.cells[i][0].classList.add('w'); }
      }
    },
  });

  // 8 ─ transpose
  const M6 = [[1, 2, 3], [4, 5, 6]];
  SLIDE('transpose', {
    draw(R, st, anim) {
      const cs = 60, bx = 520, by = 140, ax = bx - 4 * cs - 30, ay = by + 4 * cs + 30, cy = 190;
      const nm = (p, x, y, s) => { const e = tex(p, s, { x, y, fs: 34 }); e.style.transform = 'translate(-50%,-50%)'; return e; };
      if (st <= 2) {
        const a = mx(R, A2.map((v) => [v]), ax, cy, { cs, cls: 'nob' });
        if (st === 0) {
          brace(R, 'left', ax - 16, cy, cy + 4 * cs, 'd = 4'); brace(R, 'up', cy - 16, ax, ax + cs, '1');
          nm(R, ax - 150, cy + 2 * cs, 'a');
          return;
        }
        const L = $('div', 'fade', R); Object.assign(L.style, { position: 'absolute', inset: 0 });
        const asRow = () => { a.g.style.left = ax + 'px'; a.g.style.top = ay + 'px'; a.cells.forEach((r, i) => { r[0].style.left = i * cs + 'px'; r[0].style.top = '0px'; }); };
        a.g.style.transition = 'left .8s, top .8s';
        if (st === 1) {
          brace(L, 'left', ax - 16, ay, ay + cs, '1'); brace(L, 'down', ay + cs + 16, ax, ax + 4 * cs, 'd = 4');
          nm(L, ax - 150, ay + cs / 2, 'a^\\top');
          if (anim && !reduced) { L.style.opacity = 0; requestAnimationFrame(() => requestAnimationFrame(asRow)); later(800, () => { L.style.opacity = 1; }); } else asRow();
          return;
        }
        asRow(); a.g.remove();
        const { A, B, C } = cross(R, [A2], B2.map((v) => [v]), { cs, bx, by, dims: ['1', 'd = 4', '1'], names: ['a^\\top', 'b', 'a^\\top b'], hiK: true });
        readDot(A.row(0), B.col(0), A2, B2, C.cells[0][0], anim);
        const box = $('div', 'box' + (anim ? ' pop' : ''), R); Object.assign(box.style, { left: '830px', top: '220px', width: '380px' });
        box.innerHTML = '<h4>dot product as a matrix product</h4>';
        tex(box, 'a^\\top b = \\sum_i a_i\\, b_i = a \\cdot b', { fs: 26 });
        return;
      }
      const mxp = 260, myp = 250, tx0 = 800, ty0 = 210;
      const M = mx(R, M6, mxp, myp, { cs: 64 });
      brace(R, 'left', mxp - 16, myp, myp + M.H, '2'); brace(R, 'up', myp - 16, mxp, mxp + M.W, '3');
      nm(R, mxp - 110, myp + M.H / 2, 'M');
      const T = mx(R, M6[0].map((_, j) => M6.map((r) => r[j])), tx0, ty0, { cs: 64 });
      brace(R, 'left', tx0 - 16, ty0, ty0 + T.H, '3'); brace(R, 'up', ty0 - 16, tx0, tx0 + T.W, '2');
      nm(R, tx0 + T.W + 70, ty0 + T.H / 2, 'M^\\top');
      M.all().forEach((c) => c.classList.add('ra')); T.all().forEach((c) => c.classList.add('w'));
      T.cells[0][1].classList.add('hot'); M.cells[1][0].classList.add('hot');
      tex(R, '(M^\\top)_{ji} = M_{ij}', { x: tx0 - 40, y: ty0 + T.H + 40, fs: 26 });
      tx(R, tx0 - 40, ty0 + T.H + 90, 'row 2 of M is column 2 of Mᵀ', 'sm');
      if (anim && !reduced) { T.all().forEach((c, k) => { c.style.opacity = 0; later(150 + k * 180, () => { c.style.opacity = 1; c.classList.add('flash'); }); }); }
      op(R, 600, myp + M.H / 2, '→');
    },
  });

  // build every <div class="la" data-la="name">: its captions, then one fragment per step
  let uid = 0;
  document.querySelectorAll('div.la[data-la]').forEach((root) => {
    const s = SLIDES[root.dataset.la];
    const caps = [...root.querySelectorAll(':scope > p')];
    const body = $('div', 'la-body'), box = $('div', 'la-caps');
    box.append(...caps);
    root.replaceChildren(body, box);
    const ctx = { id: `la${uid++}-`, timers: [], raf: 0 };
    let prev = null;
    // in the PDF (st null): the last step, drawn without animation
    steps(root, caps.length - 1, (st) => {
      const anim = st !== null && prev !== null && st === prev + 1;
      if (st === null) st = caps.length - 1;
      prev = st;
      CUR = ctx;
      try { stopAll(); body.replaceChildren(); s.draw(body, st, anim); } finally { CUR = null; }
      caps.forEach((c, k) => c.classList.toggle('is-off', k !== st));
    });
  });
})();
