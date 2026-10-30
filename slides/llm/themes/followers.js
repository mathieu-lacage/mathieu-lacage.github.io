// The followers view of the deck itself. When the deck is embedded in the follower
// page (an iframe of follower.html) the view augments the projector's layout:
// slides that carry a hidden .followers block keep the slide on top as the
// reference — stepping in sync with it — and display that block's code, caption
// and trace below; every other slide is simply mirrored (the view is transparent
// there). The right column is always the slide overview — everything up to the
// furthest slide reached, as titles or miniatures. The standalone deck is
// untouched.
//
// Steps are Reveal's own fragment index, so the follower page drives them with the
// deck URL's #/h/v/f fragment — the deck needs nothing but its own state. The step
// position is posted to the parent for its footer. Needs cutebugs.css (palette).
(() => {
  if (window.parent === window) return;                  // standalone deck: normal view
  if (/print-pdf/i.test(location.search)) return;

  document.head.insertAdjacentHTML('beforeend', `<style>
    #followers-view { position: fixed; inset: 0; z-index: 50; display: grid; grid-template-columns: 1fr 400px;
                      min-height: 0; color: var(--cutebugs-ink, #e3e9f3);
                      font: 15px/1.5 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif; }
    #followers-view[hidden] { display: none !important; }
    /* The view is unconditional: slides with a .followers block show that code on
       the left; every other slide is mirrored as-is — .mirror makes the left
       column paint nothing so the projector's slide shows through the overlay,
       and the deck's own layout shrinks to keep clear of the overview column. */
    #fv-main { display: grid; grid-template-rows: minmax(0, 1fr) minmax(0, 45%); min-height: 0; }
    #followers-view.mirror #fv-main { grid-template-rows: minmax(0, 1fr) 0; }
    #followers-view.mirror #fv-content { display: none; }
    /* On follower-content slides the slide itself stays on top as the reference
       (its fragments step in sync with the code below): the top row is
       transparent, and the deck's own layout shrinks by the rendered heights
       of the bands (--fv-h content, --fv-t overview) so both fit exactly. */
    body.fv-content .reveal { width: calc(100% - 400px); height: calc(100% - var(--fv-h, 0px)); }
    body.fv-mirror .reveal { width: calc(100% - 400px); }
    #fv-content { display: flex; flex-direction: column; min-height: 0; background: #05080e; }
    #fv-code { overflow: auto; flex: 1; min-height: 0; padding: 18px 0 18px 24px; }
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
    #fv-toc-wrap { border-left: 1px solid #2a3550; padding: 18px 22px; display: flex; flex-direction: column; min-height: 0; background: #05080e; }
    /* where we are: every slide up to the current one, the current highlighted.
       The list scrolls on its own and is on screen on every slide. */
    #fv-toc { flex: 1; min-height: 0; overflow: auto; font: 12.5px/1.9 'IBM Plex Sans', sans-serif; }
    #fv-toc .toc-e { display: flex; gap: 10px; align-items: baseline; padding: 0 10px 0 8px; border-left: 3px solid transparent;
                     color: var(--cutebugs-slate, #8e95a2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                     cursor: pointer; }
    #fv-toc .toc-e:hover { color: var(--cutebugs-ink, #e3e9f3); }
    #fv-toc .toc-e .no { font: 500 10px 'IBM Plex Mono', monospace; color: #4a5876; min-width: 2em; text-align: right; flex: none; }
    #fv-toc .toc-e[hidden] { display: none !important; }
    #fv-toc .toc-e.toc-title { font-family: 'IBM Plex Sans Condensed', sans-serif; font-weight: 600; }
    #fv-toc .toc-e.cur { color: var(--cutebugs-ink, #e3e9f3); border-left-color: var(--cutebugs-blue, #4aa8ff);
                         background: var(--cutebugs-panel, #18233a); }
    /* titles or miniatures: the switch sits on top of the column */
    #fv-mode { flex: none; display: flex; gap: 6px; margin-bottom: 12px; }
    #fv-mode button { font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; cursor: pointer;
                      color: var(--cutebugs-slate, #8e95a2); background: none; border: 1px solid #2a3550; border-radius: 10px; padding: 2px 10px; }
    #fv-mode button.on { color: #05080e; background: var(--cutebugs-blue, #4aa8ff); border-color: var(--cutebugs-blue, #4aa8ff); }
    #fv-toc .toc-e .mini { display: none; }
    #fv-toc.minis .toc-e { display: block; border-left-color: transparent; background: none; padding: 0 0 10px 0; }
    #fv-toc.minis .toc-e .tt { display: none; }
    #fv-toc.minis .toc-e .no { display: block; margin-bottom: 3px; text-align: left; }
    #fv-toc.minis .toc-e .mini { display: block; position: relative; aspect-ratio: 16 / 9; overflow: hidden;
                                 border: 1px solid #2a3550; border-radius: 4px; background: #0f1829; }
    #fv-toc.minis .toc-e.cur .mini { border-color: var(--cutebugs-blue, #4aa8ff); }
    #fv-toc.minis .toc-e.cur .no { color: var(--cutebugs-blue, #4aa8ff); }
    /* a miniature is a one-shot clone of the slide's live DOM — the deck's own
       markup and CSS at its 1280 × 720 design size, scaled down to the entry */
    #fv-toc .fv-stage { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; transform-origin: 0 0; }
    #fv-toc .fv-stage .reveal, #fv-toc .fv-stage .slides { position: absolute; inset: 0; width: 1280px; height: 720px; pointer-events: none; }
    #fv-toc .fv-stage section { position: absolute !important; left: 0; top: 0; margin: 0; width: 1280px; height: 720px;
                                visibility: visible; box-shadow: none; display: flex !important; }
    #fv-cap { flex: none; margin: 0 24px 12px; font-size: 17px; line-height: 1.45; background: var(--cutebugs-panel, #18233a);
              border-left: 6px solid var(--cutebugs-blue, #4aa8ff); padding: 12px 16px; }
    #fv-trace { flex: none; margin: 0 24px 18px; font: 13px/1.7 'IBM Plex Mono', monospace; color: var(--cutebugs-cyan, #8fc5fa); background: #0b1424;
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
      #fv-toc-wrap { border-left: none; border-top: 1px solid #2a3550; padding: 10px 14px; max-height: 30vh; }
      body.fv-mirror .reveal { width: 100%; height: calc(100% - var(--fv-t, 0px)); }
      body.fv-content .reveal { width: 100%; height: calc(100% - var(--fv-h, 0px) - var(--fv-t, 0px)); }
      #fv-cap { margin: 0 14px 10px; font-size: 14px; padding: 10px 12px; }
      #fv-trace { margin: 0 14px 12px; font-size: 12px; padding: 8px 12px; }
    }
  </style>`);

  const view = document.createElement('div');
  view.id = 'followers-view';
  view.hidden = true;
  view.innerHTML = `<div id="fv-main">
      <div id="fv-ref"></div>
      <div id="fv-content">
        <div id="fv-code"></div>
        <div id="fv-cap"></div>
        <div id="fv-trace"><small>at this step</small><div id="fv-tracein">—</div></div>
      </div>
    </div>
    <aside id="fv-toc-wrap">
      <div id="fv-mode"><button data-m="list">titles</button><button data-m="minis">slides</button></div>
      <nav id="fv-toc" hidden></nav>
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
    // the slide's step count: the captions if authored, else the highest step
    // any line belongs to (a code-only block has no .caps)
    const hi = [...box.querySelectorAll('.fv-ln')].flatMap((ln) =>
      (ln.dataset.s || '').split(/\s+/).filter(Boolean).map(Number));
    return {
      box,
      lines: [...box.querySelectorAll('.fv-ln')],
      caps: [...fol.querySelectorAll('.caps > p')].map((p) => p.innerHTML),
      trace: [...fol.querySelectorAll('.trace > p')].map((p) => p.innerHTML),
      nSteps: Math.max([...fol.querySelectorAll('.caps > p')].length, hi.length ? Math.max(...hi) : 0),
    };
  }

  function setStep(b, step) {
    b.lines.forEach((ln) =>
      ln.classList.toggle('hl', step > 0 && (ln.dataset.s || '').split(' ').includes(String(step))));
    const cap = $('#fv-cap');
    cap.innerHTML = step === 0 ? 'press → in the deck…' : b.caps[step - 1] || '';
    cap.hidden = !cap.textContent.trim();                // code-only block: no captions
    $('#fv-tracein').innerHTML = step === 0 ? '—' : b.trace[step - 1] || '';
    const first = b.box.querySelector('.fv-ln.hl');
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // The « where are we » list: every slide up to the current one, numbered and
  // titled (title slides in the condensed face). Clicking an entry asks the
  // follower page to display that slide; built once, updated per render.
  let tocBuilt = false;
  const slideTitle = (sl) => sl.querySelector('h1, h2')?.textContent.trim() || '—';
  function buildToc() {
    const toc = $('#fv-toc');
    Reveal.getHorizontalSlides().forEach((sl, k) => {
      const e = document.createElement('div');
      e.className = 'toc-e' + (sl.classList.contains('title') ? ' toc-title' : '');
      e.innerHTML = `<span class="no">${sl.dataset.n || k + 1}</span><span class="tt">${esc(slideTitle(sl))}</span>`;
      e.addEventListener('click', () => window.parent.postMessage({ type: 'followers', select: k }, '*'));
      toc.append(e);
    });
    toc.hidden = false;
    tocBuilt = true;
  }

  // The overview lists the slides up to the presenter's frontier (maxH), which
  // the follower page tracks from the sync history and posts in — the deck
  // itself never decides what has been « reached » (its own state also moves
  // when the follower browses detached).
  let maxH = 0;
  let tocMode = 'list';
  try { tocMode = localStorage.getItem('fv-toc-mode') || 'list'; } catch {}

  function setMode(m) {
    tocMode = m;
    try { localStorage.setItem('fv-toc-mode', m); } catch {}
    $('#fv-toc').classList.toggle('minis', m === 'minis');
    [...$('#fv-mode').children].forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    if (m === 'minis') {
      for (let k = 0; k <= maxH; k++) ensureMini(k);
      layoutMinis();
    }
  }
  $('#fv-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.m !== tocMode) setMode(b.dataset.m);
  });

  // A miniature: a clone of the slide's live DOM, fragments reset to their
  // pristine state, scaled from the deck's 1280x720 design size. Built lazily,
  // kept across renders.
  function ensureMini(k) {
    const e = $('#fv-toc').children[k];
    if (!e || e.querySelector('.mini')) return;
    const sl = Reveal.getHorizontalSlides()[k];
    if (!sl) return;
    const clone = sl.cloneNode(true);
    clone.removeAttribute('style');
    clone.removeAttribute('hidden');                     // reveal shows slides by clearing it
    clone.removeAttribute('aria-hidden');
    clone.classList.remove('present', 'past', 'future');
    clone.querySelectorAll('.fragment').forEach((f) => f.classList.remove('visible', 'current-fragment', 'current-visible'));
    const stage = document.createElement('div');
    stage.className = 'fv-stage';
    stage.innerHTML = '<div class="reveal"><div class="slides"></div></div>';
    stage.querySelector('.slides').append(clone);
    const mini = document.createElement('div');
    mini.className = 'mini';
    mini.append(stage);
    e.append(mini);
    e.title = e.querySelector('.tt').textContent;
  }
  function layoutMinis() {
    $('#fv-toc').querySelectorAll('.mini').forEach((mini) => {
      mini.querySelector('.fv-stage').style.transform = `scale(${mini.clientWidth / 1280})`;
    });
  }

  // The deck's own layout must clear the overlay's bands: re-measure them and
  // re-scale reveal whenever they change — also after font loads (text heights
  // settle late) and on resize (the band caps are fractions of the viewport).
  let lastMirror = null;
  function syncBands() {
    const mirroring = document.body.classList.contains('fv-mirror');
    let dirty = mirroring !== lastMirror;
    lastMirror = mirroring;
    const setVar = (name, v) => {
      if (document.body.style.getPropertyValue(name) !== v + 'px') {
        document.body.style.setProperty(name, v + 'px');
        dirty = true;
      }
    };
    setVar('--fv-h', mirroring ? 0 : $('#fv-content').offsetHeight);
    setVar('--fv-t', $('#fv-toc-wrap').offsetHeight);
    if (dirty && window.Reveal && Reveal.isReady()) {
      Reveal.layout();
      if (tocMode === 'minis') layoutMinis();
    }
  }
  document.fonts?.ready.then(syncBands);
  window.addEventListener('resize', () => { syncBands(); if (tocMode === 'minis') layoutMinis(); });

  function render() {
    const sec = window.Reveal && Reveal.getCurrentSlide();
    const fol = sec && [...sec.children].find((e) => e.classList.contains('followers'));
    const i = Reveal.getIndices();
    view.hidden = false;                                 // the view is unconditional now
    let step = 0, nSteps = 0;
    if (fol) {
      let b = built.get(fol);
      if (!b) { b = build(fol); built.set(fol, b); }
      $('#fv-code').replaceChildren(b.box);
      $('#fv-trace').hidden = b.trace.length === 0;      // code-only block: no trace panel
      step = Math.min(Math.max((i.f === undefined ? -1 : i.f) + 1, 0), b.nSteps);
      nSteps = b.nSteps;
      setStep(b, step);
    }
    // The overview is on screen on every slide, up to the furthest slide seen.
    // In mirror mode the deck's own layout shrinks by the column's width so
    // the slide stays clear of it.
    if (!tocBuilt) { buildToc(); setMode(tocMode); }
    [...$('#fv-toc').children].forEach((e, k) => {
      e.hidden = k > maxH;                               // only the slides reached so far
      e.classList.toggle('cur', k === i.h);
      if (tocMode === 'minis' && k <= maxH) ensureMini(k);   // a newly reached slide
    });
    $('#fv-toc').querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
    // Keep the deck's own layout in sync with the overlay's bands: the slide
    // must stay clear of the overview column and, on follower-content slides,
    // of the content band below it — the slide remains visible there as the
    // reference, its fragments stepping in sync with the code.
    const mirroring = !fol;
    document.body.classList.toggle('fv-mirror', mirroring);
    document.body.classList.toggle('fv-content', !mirroring);
    syncBands();
    view.classList.toggle('mirror', mirroring);
    window.parent.postMessage({ type: 'followers', active: !mirroring, step, nSteps, title: document.title }, '*');
  }

  // The follower page owns the presenter frontier (from the sync history) and
  // posts it here; the overview never shows past it.
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.type !== 'followers-frontier' || m.h === maxH) return;
    maxH = m.h;
    if (window.Reveal && Reveal.isReady()) render();
  });

  // Navigation keys belong to the follower page: there they cross slides and
  // steps, and the follower page owns the detached state. Keep them away from
  // the mirrored deck's own reveal bindings, which would desync the chrome.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.parent.postMessage({ type: 'followers', key: e.key === 'ArrowRight' ? 'next' : 'prev' }, '*');
  }, true);

  const arm = () => {
    if (!window.Reveal) return setTimeout(arm, 100);     // deck.js initializes last
    Reveal.on('slidechanged', render);
    Reveal.on('fragmentshown', render);
    Reveal.on('fragmenthidden', render);
    if (Reveal.isReady()) render(); else Reveal.on('ready', render);
  };
  arm();
})();
