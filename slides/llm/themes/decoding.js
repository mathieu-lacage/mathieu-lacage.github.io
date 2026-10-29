// Auto-regressive decoding animation.
//
// Builds the pipeline inside every <div class="viz" data-anim="decoding"> from its data-* attributes:
//   data-tokens     input tokens, "Paris:60704 ␣is:374 …" (␣ = leading space; a token
//                   written &lt;|name|&gt; is a special token, drawn as one symbol)
//   data-generated  tokens produced one decoding pass each, "␣of:315 ␣France:9822"
//   data-score-cols columns drawn for the (n, V) score matrix, each a slice of the vocabulary (12)
//   data-sweep      seconds the automatic fill of the score matrix lasts (3)
//   data-vocab      vocabulary size, to place rows and columns by id
//   data-scale      zoom of the pipeline
// Its <p> children are the captions, one per step, in order.
// Uses viz-core.js (load it first): see there for how steps and ranges work.
(() => {
  const { END, one, from, isSpecial, parseTokens, rand } = window.AD;

  function build(root) {
    const V = +root.dataset.vocab;
    const input = parseTokens(root.dataset.tokens);
    const gen = parseTokens(root.dataset.generated);
    const C = +(root.dataset.scoreCols || 12), SWEEP_S = +(root.dataset.sweep || 3);
    const T = input.length, G = gen.length, all = [...input, ...gen];
    // a last special token (end of text) stops generation: never appended, never fed back
    const stops = G > 0 && isSpecial(gen[G - 1].tok);
    const pct = (id) => `${(100 * id / V).toFixed(2)}%`;

    // timeline: pass 1 in detail, then 5 steps per further generated token
    let s = 0;
    const next = () => ++s;
    const TOK = next(), IDS = next();
    const LK = input.map(next);                       // one embedding lookup per token
    const B1 = next(), B2 = next(), BL = next();
    // scores fill column by column (W_U rows in order), bottom to top (h_L rows from the last):
    // the first column one cell per step, then one step sweeps the rest automatically
    const CELL = input.map(next);                     // CELL[k] fills row T-1-k of column 0
    const SWEEP = next(), ARG = next();
    const append = (p) => (p === G && stops ? END : next());  // no append step after a stop
    const PICK = [, next()], AP = [, append(1)];      // indexed by pass, from 1
    const EMB = [], BLK = [], UNE = [], P2 = [];
    for (let p = 2; p <= G; p++) {
      P2.push(p);
      EMB[p] = next(); BLK[p] = next(); UNE[p] = next(); PICK[p] = next(); AP[p] = append(p);
    }
    const FINAL = s;
    const UN1 = CELL[0];                              // first unembedding step
    const colTime = SWEEP_S / (C - 1), dt = colTime / T;  // sweep: one column, one cell

    const ctx = AD.context();
    const { h, chip, tokrow, vrow, lbrace, tbrace, item, matrix, block, weights } = ctx;

    // in each pass p ≥ 2 only the token appended last (row T+p-2) is highlighted, with its W_E row
    const embSteps = (i) => P2.filter((p) => i === T + p - 2).map((p) => one(EMB[p]));
    const blkSteps = P2.map((p) => one(BLK[p]));
    const firstPass = (i) => i - T + 2;               // pass where generated row i first appears
    const nRows = T + G - 1;                          // rows of x, h and scores in the last pass

    // prompt
    const prompt = h('div', 'viz-prompt', { hl: [one(TOK), ...P2.concat(1).map((p) => one(AP[p]))] },
      ...input.map((t) => chip(t.tok)),
      ...gen.map((t, g) => h('span', 'viz-cw viz-gen', { vis: [from(AP[g + 1])] }, chip(t.tok, 'viz-new'))),
      h('span', 'viz-cursor', { html: '▌' }));

    // input token ids
    const fedBack = stops ? all.slice(0, -1) : all;
    const idRows = fedBack.map((t, i) => tokrow(t, i < T
      ? { hl: [one(LK[i]), ...embSteps(i)] }
      : { vis: [from(AP[i - T + 1])], hl: [one(AP[i - T + 1]), ...embSteps(i)] }));
    const ids = item([from(IDS)], matrix('viz-col', '', idRows, lbrace([['n']], [one(IDS)]),
      tbrace('1', [one(IDS)], 'left:auto; width:66px')), false);

    // W_E, with the row each lookup selects
    const eBands = all.slice(0, nRows).map((t, i) => h('i', 'viz-band',
      { vis: [...(i < T ? [one(LK[i])] : []), ...embSteps(i)], style: `top:${pct(t.id)}` }));
    const wE = item([from(LK[0])], weights('', 'W<sub>E</sub>', [[LK[0], B1], ...P2.map((p) => one(EMB[p]))],
      [one(LK[0])], eBands));

    // x: grows one row per lookup
    const xRows = all.slice(0, nRows).map((_, i) => (i < T
      ? vrow({ vis: [from(LK[i])], hl: [one(LK[i])] })
      : vrow({ vis: [from(EMB[firstPass(i)])], hl: [one(EMB[firstPass(i)])] })));
    const xLabels = [...input.map((_, k) => [String(k + 1), [one(LK[k])]]), ['n', [from(B1)]]];
    const x = item([[LK[0], B2], ...P2.map((p) => [EMB[p], BLK[p] + 1])],
      matrix('', '', xRows, lbrace(xLabels, [[LK[0], B2]]), tbrace('d', [[LK[0], B2]])));

    // transformer blocks and their outputs
    const hidden = (kind, vis, braceVis, rows) => item(vis,
      matrix(kind, '', rows, lbrace([['n']], braceVis), tbrace('d', braceVis)));
    const plainRows = () => input.map(() => vrow({}));
    const h1 = hidden('viz-h1', [[B1, BL]], [[B1, BL]], plainRows());
    const h2 = hidden('viz-h2', [[B2, UN1]], [[B2, UN1]], plainRows());
    const hLRows = all.slice(0, nRows).map((_, i) => (i < T
      ? vrow({ hl: [one(CELL[T - 1 - i])], anim: [one(SWEEP)], cls: 'viz-sweep',
        style: `animation-duration:${colTime}s; animation-delay:${(T - 1 - i) * dt}s; animation-iteration-count:${C - 1}` })
      : vrow({ vis: [from(BLK[firstPass(i)])] })));
    const hL = hidden('viz-hL', [[BL, ARG], ...P2.map((p) => [BLK[p], UNE[p] + 1])], [[BL, ARG]], hLRows);

    // W_U, with the row used by each score cell
    // W_U rows in use: the first slice during the first column, then one slice per column
    const slice = (j) => `${(100 * j / C).toFixed(2)}%`;
    const uBands = [h('i', 'viz-band', { vis: [[CELL[0], SWEEP]], style: 'top:0%' }),
      h('i', 'viz-band viz-sweep', { vis: [one(SWEEP)], anim: [one(SWEEP)],
        style: `top:${slice(1)}; --t0:${slice(1)}; --t1:${slice(C - 1)}; animation-duration:${SWEEP_S}s, .01s;`
          + ` animation-delay:0s, ${SWEEP_S}s; animation-timing-function:steps(${C - 1}, jump-none), linear` })];
    const wU = item([from(UN1)], weights('viz-wu', 'W<sub>U</sub>', [[UN1, ARG], ...P2.map((p) => one(UNE[p]))],
      [[UN1, ARG]], uBands));

    // scores (n, V): cells one dot product at a time, then the whole matrix; argmax marks
    const argCol = (id) => Math.min(C - 1, Math.floor(id * C / V));
    // made-up scores, largest at the argmax
    const heat = (i, j) => (j === argCol(all[i + 1].id) ? 0.95 : 0.1 + 0.6 * rand(i, j)).toFixed(2);
    const scoreCell = (i, j) => {
      if (i >= T) return h('i', 'viz-c', { style: `--a:${heat(i, j)}` });  // later rows appear whole
      if (j === 0) return h('i', 'viz-c', { vis: [from(CELL[T - 1 - i])], hl: [one(CELL[T - 1 - i])], style: `--a:${heat(i, j)}` });
      const order = (j - 1) * T + (T - 1 - i);
      return h('i', 'viz-c', { vis: [from(SWEEP)], style: `--a:${heat(i, j)}; --d:${(order * dt).toFixed(3)}s` });
    };
    const sRows = all.slice(0, nRows).map((_, i) => vrow(i < T ? {} : { vis: [from(UNE[firstPass(i)])] },
      ...Array.from({ length: C }, (_, j) => scoreCell(i, j)),
      h('i', 'viz-arg', { vis: [from(i < T ? ARG : PICK[firstPass(i)])],
        style: `left:${slice(argCol(all[i + 1].id))}; width:${slice(1)}` })));
    const scores = item([[UN1, AP[1]], ...P2.map((p) => [UNE[p], AP[p]])],
      matrix('viz-sc', 'similarity', sRows, lbrace([['n']], [[UN1, PICK[1]]]), tbrace('V', [[UN1, PICK[1]]])));
    const argmax = block('argmax', [from(ARG)], [[ARG, AP[1]], ...P2.map((p) => one(PICK[p]))]);

    // predicted tokens: in each pass the last row is picked, the others dimmed
    const predRows = all.slice(1).map((t, i) => {
      const hl = [], dim = [];
      for (let q = 1; q <= G; q++) {
        if (i >= T + q - 1) continue;
        const r = [PICK[q], q === G ? END : AP[q] + 1];
        (i === T + q - 2 ? hl : dim).push(r);
      }
      return tokrow(t, { vis: i < T ? undefined : [from(PICK[firstPass(i)])], hl, dim }, true);
    });
    const preds = item([from(ARG)], matrix('viz-col', '', predRows, lbrace([['n']], [one(ARG)]),
      tbrace('1', [one(ARG)], 'right:auto; width:66px')));

    const strip = h('div', 'viz-strip', { style: `transform: scale(${root.dataset.scale || 1})` },
      ids, wE, x,
      block('Transformer 1', [from(B1)], [one(B1), ...blkSteps]), h1,
      block('Transformer 2', [[B2, UN1]], [one(B2)]), h2,         // gone from the unembedding on, to save width
      item([from(BL)], '<span class="viz-dots">⋯</span>'),
      block('Transformer L', [from(BL)], [one(BL), ...blkSteps]), hL,
      wU, scores, argmax, preds);
    const kf = document.createElement('style');
    kf.textContent = `@keyframes viz-row-sweep-${T} { 0%, ${(100 / T - 0.01).toFixed(2)}% { outline-color: var(--cutebugs-red); }`
      + ` ${(100 / T).toFixed(2)}%, 100% { outline-color: transparent; } }`
      + ` .viz-hL .viz-sweep.is-anim { animation-name: viz-row-sweep-${T}; }`;
    document.head.append(kf);

    AD.mount(root, ctx, FINAL, [prompt, strip],
      (st) => root.classList.toggle('is-tokenized', st >= TOK));
  }

  AD.run('decoding', build);
})();
