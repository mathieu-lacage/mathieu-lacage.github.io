// Next-word animation of « Conditional probabilities »: a prompt grows one word at a time.
//
//   <div class="nw" data-prompt="Paris is the capital" data-vocab="100000">
//   <p>of:38 France:31 in:9 our:4 this:2</p>
//   <p>France:81 region:6 Belgium:3 Texas:2 Britanny:1</p>
//   </div>
//
// One <p> per generated word: the most likely next words with their probability (%),
// the first one picked; the rest of the vocabulary gets what is left. Each <p> takes
// three keys (themes/steps.js): its distribution grows, its first word is picked, the
// word is appended to the prompt. In the PDF: the final state.
// nextword.js toggles .is-grown, .is-on and .is-picked on each distribution and .is-on
// on each appended word.
// Styles: nextword.css.
(() => {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const thousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  document.querySelectorAll('div.nw:not(.nw-built)').forEach((root) => {
    root.classList.add('nw-built');
    const dists = [...root.querySelectorAll(':scope > p')].map((p) =>
      p.textContent.trim().split(/\s+/).map((t) => {
        const [word, pct] = t.split(':');
        return { word, pct: +pct };
      }));

    const prompt = el('div', 'nw-prompt', root.dataset.prompt);
    let sofar = root.dataset.prompt;
    const words = [], boxes = dists.map((dist) => {
      const box = el('div', 'nw-dist');
      box.append(el('div', 'nw-cap', `After « ${sofar} », the next word is…`));
      const rest = 100 - dist.reduce((s, d) => s + d.pct, 0);
      const others = `… ${thousands(+root.dataset.vocab - dist.length)} others`;
      [...dist, { word: others, pct: rest, rest: true }].forEach((d, i) => {
        const row = el('div', i ? 'nw-row' : 'nw-row nw-pick');
        row.style.setProperty('--i', i);
        const bar = el('span', d.rest ? 'nw-bar nw-rest' : 'nw-bar');
        bar.style.setProperty('--p', d.pct);
        row.append(el('span', 'nw-w', d.word), bar, el('span', 'nw-pct', `${d.pct} %`));
        box.append(row);
      });
      const w = el('span', 'nw-new', ' ' + dist[0].word);
      words.push(w);
      prompt.append(w);
      sofar += ' ' + dist[0].word;
      return box;
    });
    prompt.append(el('span', 'nw-cursor', '▌'));
    const stack = el('div', 'nw-dists');
    stack.append(...boxes);
    root.replaceChildren(prompt, stack);

    // word k: shown on step 3k + 1, picked on 3k + 2, appended on 3k + 3;
    // its distribution stays shown until the word is appended, the last one to the end
    const FINAL = 3 * dists.length;
    steps(root, FINAL, (st) => {
      if (st === null) st = FINAL;
      boxes.forEach((box, k) => {
        const last = k === boxes.length - 1;
        box.classList.toggle('is-grown', st >= 3 * k + 1);
        box.classList.toggle('is-on', st >= 3 * k + 1 && (last || st < 3 * k + 3));
        box.classList.toggle('is-picked', st >= 3 * k + 2);
        words[k].classList.toggle('is-on', st >= 3 * k + 3);
      });
    });
  });
})();
