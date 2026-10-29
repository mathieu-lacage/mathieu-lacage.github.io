// Keyboard steps and decoration of an equation grid: a table inside
// <div class="eqgrid">, one column per token position, one row per quantity.
//
//   <div class="eqgrid" data-fixed="1" data-colors="slate blue magenta …">
//
//   | **token**<br>one column per position | The | ␣city | … |
//   |---|---|---|---|
//   | **input**<br>what the model knows | $x_1$ | $x_2$ | … |
//
//   </div>
//
// - the first column holds the row labels: **name**, then a short description;
// - data-colors: one theme colour per body row (slate, blue, magenta, red, green…),
//   drawn as the label's left border; the header row is dim;
// - data-query (optional, default: the last column): the token column to tint;
// - a cell that is only « · » is drawn dim;
// - a cell that ends with « NN % » gets a bar filled to NN %;
// - a row whose only filled cell is its first data cell spans the whole row, right-aligned;
// - steps: the header and the first data-fixed body rows (default 1) are always shown,
//   then each arrow key shows one more row (themes/steps.js). In the PDF every row shows.
//   With data-step-cols="N", a step only shows the row's cells from column N on: the
//   first N columns of every row are always shown (class eqpair: one token | all tokens).
//
// Styles: the « Equation grid » section of cutebugs.css (in the theme, so that they
// win over its table rules).
(() => {
  document.querySelectorAll('div.eqgrid:not(.eqgrid-built)').forEach((root) => {
    root.classList.add('eqgrid-built');
    const table = root.querySelector('table');
    if (!table) return;
    const head = table.tHead.rows[0];
    const body = [...table.tBodies[0].rows];
    const nCols = head.cells.length;
    const q = +(root.dataset.query || nCols - 1);
    const colors = (root.dataset.colors || '').split(/\s+/).filter(Boolean);

    head.cells[0].style.setProperty('--c', 'var(--cutebugs-dim)');
    body.forEach((tr, r) => {
      if (colors[r]) tr.cells[0].style.setProperty('--c', `var(--cutebugs-${colors[r]})`);
      const data = [...tr.cells].slice(1);
      // a row with only its first data cell filled: one merged cell
      if (data.length > 1 && data.slice(1).every((td) => !td.textContent.trim() && !td.children.length)) {
        data.slice(1).forEach((td) => td.remove());
        data[0].colSpan = nCols - 1;
        data[0].classList.add('eqgrid-merged');
        return;
      }
      data.forEach((td) => {
        const t = td.textContent.trim();
        if (t === '·') td.classList.add('eqgrid-dot');
        const m = t.match(/(\d+(?:[.,]\d+)?)\s*%$/);
        if (m) {
          td.classList.add('eqgrid-bar');
          td.style.setProperty('--p', parseFloat(m[1].replace(',', '.')));
          td.innerHTML = `<span class="eqgrid-txt">${td.innerHTML}</span>`;
        }
      });
    });
    [head, ...body].forEach((tr) => {
      const c = tr.cells[q];
      if (c && c.colSpan === 1) c.classList.add('eqgrid-q');
    });

    // steps: one fragment per row after the fixed ones
    const fixed = +(root.dataset.fixed || 1);
    const stepped = body.slice(fixed);
    const cols = +root.dataset.stepCols;
    steps(root, stepped.length, (st) => stepped.forEach((tr, k) => {
      const off = st !== null && k >= st;
      if (cols) [...tr.cells].slice(cols).forEach((td) => td.classList.toggle('is-off', off));
      else tr.classList.toggle('is-off', off);
    }));
  });
})();
