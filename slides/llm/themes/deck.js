// Footer and page number on every slide, then start reveal.js.
// Runs last: the slide scripts must have added their fragments (themes/steps.js),
// since reveal.js counts them when it starts.
(() => {
  const footer = document.getElementById('footer');
  const sections = document.querySelectorAll('.reveal .slides > section');
  sections.forEach((s, k) => {
    s.dataset.page = `${k + 1}/${sections.length}`;
    s.dataset.n = k + 1;                                // the overview's big number
    const f = footer.cloneNode(true);
    f.removeAttribute('id');
    f.hidden = false;
    s.append(f);
  });
  // a click on an <object> figure moves the keyboard focus into its SVG, where the
  // deck's keys (arrows, S for the speaker view) are lost: give it back (the figures
  // only use hover)
  window.addEventListener('blur', () => setTimeout(() => {
    if (document.activeElement instanceof HTMLObjectElement) document.activeElement.blur();
  }));
  // on screen, a margin of page around the slide shows its edges; none in the PDF,
  // nor in full screen: F (Fullscreen API) or the browser's own (F11)
  const print = /print-pdf/i.test(location.search);
  const fullscreen = () => !!document.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches;
  const margin = () => (print || fullscreen() ? 0 : 0.04);
  Reveal.initialize({
    width: 1280, height: 720, margin: margin(), minScale: 0.1, maxScale: 4,
    center: false, display: 'flex',
    // the embedded follower iframe is phone-sized: keep the slide view at any
    // width (reveal's scroll view crashes on narrow iframes)
    scrollActivationWidth: null,
    controls: false, progress: false, hash: true, transition: 'none', backgroundTransition: 'none',
    // PDF (?print-pdf): one page per slide, every fragment shown
    pdfSeparateFragments: false, pdfMaxPagesPerSlide: 1,
    plugins: [RevealNotes],
  });
  // Reveal.configure() resyncs the whole deck: only when the margin changes
  const fit = () => { if (margin() !== Reveal.getConfig().margin) Reveal.configure({ margin: margin() }); };
  document.addEventListener('fullscreenchange', fit);
  window.addEventListener('resize', fit);

  // keyboard shortcuts as buttons, in a strip under the slide; not in full screen nor in the PDF
  const KEYS = [
    ['←', 'previous', () => Reveal.prev()],
    ['→', 'next', () => Reveal.next()],
    ['Esc', 'overview', () => Reveal.toggleOverview()],
    ['F', 'full screen', () => document.documentElement.requestFullscreen()],
    ['S', 'speaker view', () => Reveal.getPlugin('notes').open()],
    ['?', 'help', () => Reveal.toggleHelp()],
  ];
  const bar = document.createElement('nav');
  bar.id = 'keys';
  for (const [key, label, action] of KEYS) {
    const b = document.createElement('button');
    b.innerHTML = `<kbd${key.length === 1 && key > '~' ? ' class="arrow"' : ''}>${key}</kbd> ${label}`;
    b.title = `${label} (${key})`;
    b.tabIndex = -1;                                    // keeps the focus on the deck: Space must not click it
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', action);
    bar.append(b);
  }
  document.body.append(bar);
  const showKeys = () => {
    const on = !print && !fullscreen();
    if (on === document.documentElement.classList.contains('keys')) return;
    document.documentElement.classList.toggle('keys', on);
    Reveal.layout();                                    // the strip changes the room left for the slide
  };
  showKeys();
  document.addEventListener('fullscreenchange', showKeys);
  window.addEventListener('resize', showKeys);

  // overview (Esc): a grid of every slide, instead of reveal.js's single row; laid
  // out again after reveal.js does (activation, navigation, resize). With <body
  // data-overview="sections"> the grid is grouped by section: each .title slide
  // (or data-section marker) starts a section, headed by its own title slide, and
  // flows over as many rows as it needs. ↑ ↓ move within the column, across
  // section rows. Tiles never shrink below MIN_TILE pixels on screen: a grid
  // taller than the window at that size scrolls vertically (wheel) instead.
  const GAP = 70;                                       // as reveal.js: 70 px between slides
  const SGAP = 120;                                     // extra vertical space between sections
  const MIN_TILE = 220;                                 // smallest readable tile height, px on screen
  let rows = [], rowOf = [], colOf = [];
  let vscroll = 0, view = { K: 1, max: 0 };              // the grid's vertical scroll, slide-space px
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const grid = (follow = true) => {
    if (!Reveal.isOverview()) return;
    const slides = Reveal.getHorizontalSlides(), n = slides.length;
    const { width, height } = Reveal.getComputedSlideSize(), W = width + GAP, H = height + GAP;
    const sc = Reveal.getScale();
    // sections: consecutive slides up to the next .title slide or data-section
    // marker (all of them if not grouped); a data-section slide starts a row of
    // its own without the .title divider styling (e.g. the conclusion)
    const isSectionStart = (sl) => sl.classList.contains('title') || 'section' in sl.dataset;
    const groups = [];
    for (const sl of slides) {
      if (!groups.length || (document.body.dataset.overview === 'sections' && isSectionStart(sl) && groups[groups.length - 1].length)) groups.push([]);
      groups[groups.length - 1].push(sl);
    }
    // The on-screen tile scale is K = sc*k. Pick the column count giving the
    // largest tiles: each candidate wraps the sections over rows (closed-form
    // grid height) and the whole grid must fit the window minus a thin edge
    // margin; below the MIN_TILE floor the grid overflows and scrolls instead —
    // it is then scaled up to span the full width, so no column of the window
    // goes to waste and the tiles still grow past MIN_TILE. A wider window
    // allows more columns at the floor scale, hence the cap on the search.
    const M = 10;                                        // px kept clear of the window edges
    const strip = document.getElementById('keys');
    const availH = innerHeight - (strip && strip.offsetHeight ? strip.offsetHeight : 0);
    const Kfloor = Math.min(MIN_TILE / height, (innerWidth - 2 * M) / width);
    const colsCap = Math.max(1, Math.floor(((innerWidth - 2 * M) / Kfloor + GAP) / W));
    let best = { K: 0, cols: 1 };
    for (let c = 1; c <= Math.min(n, colsCap); c++) {
      const lines = groups.reduce((t, g) => t + Math.ceil(g.length / c), 0);
      const ht = (lines - 1) * H + SGAP * (groups.length - 1) + H;
      const wt = groups.reduce((m, g) => Math.max(m, Math.min(g.length, c)), 0) * W - GAP;
      const K = Math.min((innerWidth - 2 * M) / wt, (availH - 2 * M) / ht);
      if (K > best.K) best = { K, cols: c };
    }
    const cols = best.cols;
    const lines = groups.reduce((t, g) => t + Math.ceil(g.length / cols), 0);
    const Htot = (lines - 1) * H + SGAP * (groups.length - 1) + H;
    const Wtot = groups.reduce((m, g) => Math.max(m, Math.min(g.length, cols)), 0) * W - GAP;
    const K = best.K >= Kfloor ? Math.min(best.K, 1) : Math.min((innerWidth - 2 * M) / Wtot, 1);
    const k = K / sc;
    // place every slide: a section starts on a new row; the rows of a section sit
    // SGAP lower than a plain stack would put them
    rows = []; rowOf = new Array(n); colOf = new Array(n);
    const rowY = [];
    let row = 0, extra = 0;
    groups.forEach((g, gi) => {
      if (gi > 0) extra += SGAP;
      g.forEach((sl, j) => {
        const r = row + Math.floor(j / cols), c = j % cols, i = slides.indexOf(sl);
        rowOf[i] = r; colOf[i] = c;
        (rows[r] ||= []).push(i);
        rowY[r] = r * H + extra;
      });
      row += Math.ceil(g.length / cols);
    });
    // reveal.js's own transform of the slides box is its layout part (when it
    // scales with a transform rather than zoom: "translate(…) scale(…)") then its
    // overview part: replace the latter. slide 0 sits where the box is, so centre
    // the grid about it — or put its visible window at the top when scrolled. The
    // box also carries reveal's own offset, which no formula of ours can know:
    // measure where the grid actually landed and cancel the residual. Both the
    // box and the measured slide must not transition while we do (reveal's
    // overview animates sections into place), hence the freeze before layout.
    const box = Reveal.getSlidesElement(), layout = (box.style.transform.match(/^\s*translate\([^)]*\)\s*scale\([^)]*\)/) || [''])[0];
    const freeze = (el) => { const t = el.style.transition; el.style.transition = 'none'; return () => el.style.transition = t; };
    const restore = [freeze(box), freeze(slides[0])];
    slides.forEach((sl, i) => {
      const t = `translate3d(${colOf[i] * W}px, ${rowY[rowOf[i]]}px, 0)`;
      sl.style.transform = t;
      const bg = Reveal.getSlideBackground(i);
      if (bg) bg.style.transform = t;
    });
    // vertical scroll: navigation keeps the current slide's row in view; the
    // wheel scrolls freely (its handler below calls grid(false))
    const viewH = availH / K;
    view = { K, max: Math.max(0, Htot - viewH) };
    if (follow) {
      const y = rowY[rowOf[Reveal.getIndices().h]] ?? 0;
      if (y < vscroll) vscroll = y - GAP / 2;
      else if (y + height > vscroll + viewH) vscroll = y + height - viewH + GAP / 2;
    }
    vscroll = clamp(vscroll, 0, view.max);
    // reveal.js's own transform of the slides box is its layout part (when it
    // scales with a transform rather than zoom: "translate(…) scale(…)") then its
    // overview part: replace the latter. slide 0 sits where the box is, so centre
    // the grid about it — or put its visible window at the top when scrolled. The
    // box also carries reveal's own offset, which no formula of ours can know:
    // measure where the grid actually landed and cancel the residual.
    const tx = -(Math.max(...colOf) * W) / 2;
    const ty = Htot <= viewH ? -Htot / 2 : -(vscroll + viewH / 2);
    // the analytic position leaves whatever offset reveal keeps around the box:
    // measure where the grid origin actually landed and cancel the residual —
    // re-measuring until it is within a pixel
    let t = { x: tx, y: ty };
    for (let i = 0; i < 3; i++) {
      box.style.transform = `${layout} scale(${k}) translate(${t.x}px, ${t.y}px)`;
      const r0 = slides[0].getBoundingClientRect();
      const ex = (innerWidth - K * Wtot) / 2 - r0.left;
      const ey = (Htot <= viewH ? (availH - K * Htot) / 2 : -K * vscroll) - r0.top;
      t.x += ex / K; t.y += ey / K;
      if (Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) break;
    }
    box.style.transform = `${layout} scale(${k}) translate(${t.x}px, ${t.y}px)`;
    restore.forEach((f) => f());
  };
  const regrid = () => setTimeout(grid);
  Reveal.on('overviewshown', regrid);
  Reveal.on('overviewshown', () => { vscroll = 0; });    // each open starts at the top
  Reveal.on('slidechanged', regrid);
  window.addEventListener('resize', regrid);
  window.addEventListener('wheel', (e) => {              // the overview's vertical scroll
    if (!Reveal.isOverview() || !view.max) return;
    e.preventDefault();
    vscroll = clamp(vscroll + (e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY) / view.K, 0, view.max);
    grid(false);
  }, { capture: true, passive: false });

  // in the overview every tile shows its slide's last step: force all fragments
  // visible (the slide scripts re-render through the steps.js observers) and put
  // the previous states back on exit — needed, since reveal's exit path would
  // otherwise leave the slide we return to at its final step, past its last →
  let fragmentStates = null;
  Reveal.on('overviewshown', () => {
    const fragments = document.querySelectorAll('.reveal .slides .fragment');
    fragmentStates = new Map([...fragments].map((f) => [f, {
      visible: f.classList.contains('visible'),
      current: f.classList.contains('current-fragment'),
    }]));
    for (const f of fragmentStates.keys()) f.classList.add('visible');
  });
  Reveal.on('overviewhidden', () => {
    if (!fragmentStates) return;
    for (const [f, st] of fragmentStates) {
      f.classList.toggle('visible', st.visible);
      f.classList.toggle('current-fragment', st.current);
    }
    fragmentStates = null;
  });
  window.addEventListener('keydown', (e) => {
    if (!Reveal.isOverview() || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const i = Reveal.getIndices().h, r = rowOf[i], t = rows[r + (e.key === 'ArrowDown' ? 1 : -1)];
    if (r === undefined || !t) return;
    let best = t[0];                                     // the column of the target row closest to ours
    for (const j of t) if (Math.abs(colOf[j] - colOf[i]) < Math.abs(colOf[best] - colOf[i])) best = j;
    Reveal.slide(best);
  }, true);
})();
