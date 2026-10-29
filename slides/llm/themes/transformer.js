// Inside one transformer block: attention mixes the rows (along n), the FFN transforms
// every row on its own (along d).
// One fixed layout: every step fills it in place.
//
// Builds the animation inside every <div class="viz" data-anim="transformer"> from:
//   data-tokens  the rows, "Paris ␣is …" (␣ = leading space; ":id" suffixes are ignored)
//   data-scale   zoom of the pipeline
// Its <p> children are the captions, one per step, in order.
// Uses viz-core.js (load it first): see there for how steps and ranges work.
(() => {
  const { one, from, parseTokens } = window.AD;

  function build(root) {
    const input = parseTokens(root.dataset.tokens), n = input.length;

    // timeline
    let s = 0;
    const next = () => ++s;
    const ATT = next(), ROW = input.map(next);                     // attention, one output row per step
    const FFN = next(), FROW = input.map(next);                    // FFN, one output row per step
    const FINAL = s;

    const ctx = AD.context();
    const { h, chip, vrow, lbrace, tbrace, item, matrix, block } = ctx;
    const dims = (vis, l, t) => [lbrace([[l]], vis), tbrace(t, vis)];
    // attention reads rows 0..i of x for output row i
    const used = (r) => [[ROW[r], ROW[n - 1] + 1]];
    const toks = item(undefined, matrix('viz-col', '', input.map((t, r) =>
      h('div', 'viz-tr viz-ch viz-pk', { hl: used(r) }, h('span', 'viz-cc', {}, chip(t.tok))))), false);
    const x = item(undefined, matrix('', '', input.map((_, r) => vrow({ hl: used(r) })),
      ...dims(undefined, 'n', 'd')), false);

    // attention: output row i mixes rows 0..i of x
    const a = item(undefined, matrix('tb-a', '', input.map((_, r) => vrow({
      slot: true, vis: [from(ROW[r])], hl: [one(ROW[r]), one(FROW[r])],
    })), ...dims([from(ATT)], 'n', 'd')));

    // FFN: output row i depends on row i of a only
    const y = item(undefined, matrix('tb-y', '', input.map((_, r) => vrow({
      slot: true, vis: [from(FROW[r])], hl: [one(FROW[r])],
    })), ...dims([from(FFN)], 'n', 'd')));

    const strip = h('div', 'viz-strip', { style: `transform: scale(${root.dataset.scale || 1})` },
      toks, x,
      block('Attention', undefined, [[ATT, FFN]]), a,
      block('FFN', undefined, [[FFN, FINAL + 1]]), y);

    AD.mount(root, ctx, FINAL, [strip]);
  }

  AD.run('transformer', build);
})();
