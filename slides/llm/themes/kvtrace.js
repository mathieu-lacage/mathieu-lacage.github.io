// « What « of » reads from the past »: a dependency trace through an equation grid.
//
//   <div class="kvtrace"> <div class="eqgrid">…</div> <p>…</p> <p data-cur="z x5" data-w="O">…</p> … </div>
//
// In the grid's TeX, every variable is wrapped in \class{v-<name> v-<name><index>}{…}, every
// weight in \class{w-<name><column>}{W_…}, and the right-hand side of a cached k or v
// equation in \class{rhs<column>}{…}. Its <p> children are the captions, one per step;
// each one may say what its step reaches, from that step on:
//   data-cur="z x5"   variables reached (v-z, v-x5): gold and bold now, muted gold after
//   data-w="O Q5"     weights reached (w-O, w-Q5): blue
//   data-past="k1 …"  variables from the previous pass: orange
//   data-cache        the cached values: td.kv-cache framed, td.kv-old and .rhs1…rhs4 dimmed
// The colours are one <style> rewritten at every step. In the PDF the last step shows.
// Uses steps.js. Styles: themes/kvcache.css.
(() => {
  const C = { gold: '#f5c451', muted: '#c2ac72', blue: '#4aa8ff', orange: '#ff9f43' };
  let uid = 0;
  document.querySelectorAll('div.kvtrace:not(.kvtrace-built)').forEach((root) => {
    root.classList.add('kvtrace-built');
    const id = root.dataset.kvt = String(uid++);
    const caps = [...root.querySelectorAll(':scope > p')];
    const box = document.createElement('div'), style = document.createElement('style');
    box.className = 'kv-caps';
    box.append(...caps);
    root.append(box, style);
    const words = (p, k) => (p.dataset[k] || '').split(/\s+/).filter(Boolean);
    const sel = (pre, names, tail = '') => names.map((v) => `section [data-kvt="${id}"] .${pre}${v}${tail}`).join(', ');
    steps(root, caps.length - 1, (st) => {
      if (st === null) st = caps.length - 1;
      let css = '', cache = false;
      caps.slice(0, st + 1).forEach((p, k) => {
        const cur = words(p, 'cur'), w = words(p, 'w'), past = words(p, 'past');
        if (cur.length) {
          css += `${sel('v-', cur)} { color: ${k === st ? C.gold : C.muted}; }\n`;
          if (k === st) css += `${sel('v-', cur, ' :is(path, use)[data-c]')} { stroke-width: 28; }\n`;
        }
        if (w.length) css += `${sel('w-', w)} { color: ${C.blue}; }\n`;
        if (past.length) css += `${sel('v-', past)} { color: ${C.orange}; }\n`;
        if ('cache' in p.dataset) cache = true;
      });
      if (cache) css += `${sel('rhs', [1, 2, 3, 4])} { opacity: .2; }\n`;
      style.textContent = css;
      root.classList.toggle('is-cache', cache);
      caps.forEach((c, i) => c.classList.toggle('is-off', i !== st));
    });
  });
})();
