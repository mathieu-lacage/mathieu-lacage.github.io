// The followers view of the deck itself. When the deck is embedded in the follower
// page (an iframe of follower.html), slides that carry a hidden .followers block
// display that instead of the projector's slide: the code aimed at the audience,
// with the caption and trace of the current step. The standalone deck is untouched.
//
// Steps are Reveal's own fragment index, so the follower page drives them with the
// deck URL's #/h/v/f fragment — the deck needs nothing but its own state. The step
// position is posted to the parent for its footer. Needs cutebugs.css (palette).
(() => {
  if (window.parent === window) return;                  // standalone deck: normal view
  if (/print-pdf/i.test(location.search)) return;

  document.head.insertAdjacentHTML('beforeend', `<style>
    #followers-view { position: fixed; inset: 0; z-index: 50; display: grid; grid-template-columns: 1fr 400px;
                      min-height: 0; background: #05080e; color: var(--cutebugs-ink, #e3e9f3);
                      font: 15px/1.5 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; }
    #followers-view[hidden] { display: none !important; }
    #fv-code { overflow: auto; padding: 18px 0 18px 24px; }
    .fv-head { font: 600 11px 'IBM Plex Mono', monospace; letter-spacing: .12em; text-transform: uppercase;
               color: var(--cutebugs-slate, #8e95a2); margin: 18px 0 8px; }
    .fv-code { margin: 0 24px 0 0; padding: 10px 0; background: #0b1424; border: 1px solid #2a3550; border-radius: 8px;
               font: 13.5px/1.7 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace; white-space: pre; }
    .fv-ln { display: block; padding: 0 18px 0 0; opacity: .62; transition: opacity .25s, background .25s; }
    .fv-ln .no { display: inline-block; width: 3.2em; text-align: right; margin-right: 1.4em; color: #4a5876; user-select: none; }
    .fv-ln.hl { opacity: 1; background: var(--cutebugs-panel, #18233a); box-shadow: inset 3px 0 0 var(--cutebugs-blue, #4aa8ff); }
    .fv-kw { color: var(--cutebugs-blue, #4aa8ff); } .fv-str { color: var(--cutebugs-green, #7bc86c); }
    .fv-com { color: var(--cutebugs-slate, #8e95a2); font-style: italic; } .fv-num { color: var(--cutebugs-orange, #f5a97f); }
    .fv-fn { color: var(--cutebugs-cyan, #8fc5fa); }
    #fv-side { border-left: 1px solid #2a3550; padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; min-height: 0; overflow: auto; }
    #fv-status { font: 500 12px 'IBM Plex Mono', monospace; color: var(--cutebugs-slate, #8e95a2); }
    #fv-status b { color: var(--cutebugs-cyan, #8fc5fa); font-weight: 500; }
    #fv-cap { font-size: 17px; line-height: 1.45; background: var(--cutebugs-panel, #18233a);
              border-left: 6px solid var(--cutebugs-blue, #4aa8ff); padding: 12px 16px; }
    #fv-trace { font: 13px/1.7 'IBM Plex Mono', monospace; color: var(--cutebugs-cyan, #8fc5fa); background: #0b1424;
                border: 1px solid #2a3550; border-radius: 8px; padding: 10px 14px; }
    #fv-trace small { display: block; color: var(--cutebugs-slate, #8e95a2); font-size: 10px;
                      letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
    /* phones (portrait or landscape): the code takes the whole width and every
       pixel of left-over height, the caption and trace move below it (an auto
       row: they get exactly what they need — a percentage max-height on the
       item itself is mis-resolved against the auto row by Chrome). The follower
       page sizes the iframe to the window, so these queries see the real
       device size. */
    @media (max-width: 820px), (max-height: 560px) {
      #followers-view { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; }
      #fv-code { padding: 12px 0 12px 14px; }
      .fv-code { margin: 0 14px 0 0; font-size: 12px; }
      #fv-side { border-left: none; border-top: 1px solid #2a3550; padding: 10px 14px; gap: 8px; }
      #fv-cap { font-size: 14px; padding: 10px 12px; }
      #fv-trace { font-size: 12px; padding: 8px 12px; }
    }
  </style>`);

  const view = document.createElement('div');
  view.id = 'followers-view';
  view.hidden = true;
  view.innerHTML = `<div id="fv-code"></div>
    <aside id="fv-side">
      <div id="fv-status">waiting for the presenter…</div>
      <div id="fv-cap"></div>
      <div id="fv-trace"><small>at this step</small><div id="fv-tracein">—</div></div>
    </aside>`;
  document.body.append(view);

  const $ = (s) => view.querySelector(s);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function highlight(src) {                              // tiny stand-in for pygments
    const re = /("""(?:[^"]|"(?!""))*"""|"(?:[^"\\]|\\.)*")|(#[^\n]*)|\b(def|return|for|in|if|import|while|and|or|not|None|True|False)\b|\b(np|softmax|attention|attention_manual)\b|\b(\d[\d_]*)\b/g;
    let out = '', at = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(at, m.index));
      const cls = m[1] ? 'fv-str' : m[2] ? 'fv-com' : m[3] ? 'fv-kw' : m[4] ? 'fv-fn' : 'fv-num';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      at = m.index + m[0].length;
    }
    return out + esc(src.slice(at));
  }

  // Build the display of a .followers block once; the DOM is kept per block so
  // switching slides back and forth does not rebuild it.
  const built = new WeakMap();
  function build(fol) {
    const box = document.createElement('div');
    fol.querySelectorAll('pre.code').forEach((pre) => {
      const label = document.createElement('div');
      label.className = 'fv-head';
      label.textContent = pre.dataset.label || '';
      const out = document.createElement('pre');
      out.className = 'fv-code';
      out.innerHTML = [...pre.querySelectorAll('.ln')].map((ln) =>
        `<span class="fv-ln" data-s="${ln.dataset.s || ''}"><span class="no">${ln.dataset.n}</span>${highlight(ln.textContent) || ' '}</span>`
      ).join('');
      box.append(label, out);
    });
    return {
      box,
      lines: [...box.querySelectorAll('.fv-ln')],
      caps: [...fol.querySelectorAll('.caps > p')].map((p) => p.innerHTML),
      trace: [...fol.querySelectorAll('.trace > p')].map((p) => p.innerHTML),
    };
  }

  function setStep(b, step) {
    b.lines.forEach((ln) =>
      ln.classList.toggle('hl', step > 0 && (ln.dataset.s || '').split(' ').includes(String(step))));
    $('#fv-cap').innerHTML = step === 0 ? 'press → in the deck…' : b.caps[step - 1] || '';
    $('#fv-tracein').innerHTML = step === 0 ? '—' : b.trace[step - 1] || '';
    const first = b.box.querySelector('.fv-ln.hl');
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function render() {
    const sec = window.Reveal && Reveal.getCurrentSlide();
    const fol = sec && [...sec.children].find((e) => e.classList.contains('followers'));
    if (!fol) {                                          // no followers content: mirror the slide
      view.hidden = true;
      window.parent.postMessage({ type: 'followers', active: false }, '*');
      return;
    }
    let b = built.get(fol);
    if (!b) { b = build(fol); built.set(fol, b); }
    $('#fv-code').replaceChildren(b.box);
    const i = Reveal.getIndices();
    const step = Math.min(Math.max((i.f === undefined ? -1 : i.f) + 1, 0), b.caps.length);
    setStep(b, step);
    const title = sec.querySelector('h1')?.textContent || '';
    $('#fv-status').innerHTML = `slide <b>${i.h + 1}</b> « ${esc(title)} »`;
    view.hidden = false;
    window.parent.postMessage({ type: 'followers', active: true, step, nSteps: b.caps.length }, '*');
  }

  const arm = () => {
    if (!window.Reveal) return setTimeout(arm, 100);     // deck.js initializes last
    Reveal.on('slidechanged', render);
    Reveal.on('fragmentshown', render);
    Reveal.on('fragmenthidden', render);
    if (Reveal.isReady()) render(); else Reveal.on('ready', render);
  };
  arm();
})();
