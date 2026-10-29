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

  // overview (Esc): a grid of every slide, scaled to fit the window, instead of reveal.js's
  // single row; laid out again after reveal.js does (activation, navigation, resize).
  // With <body data-overview="sections"> the grid is grouped by section: each .title
  // slide (or data-section marker) starts a section, on a new row, headed by its own
  // title slide. ↑ ↓ move within the column, across section rows.
  const GAP = 70;                                       // as reveal.js: 70 px between slides
  const SGAP = 120;                                     // extra vertical space between sections
  let rows = [], rowOf = [], colOf = [];
  const grid = () => {
    if (!Reveal.isOverview()) return;
    const slides = Reveal.getHorizontalSlides(), n = slides.length;
    const { width, height } = Reveal.getComputedSlideSize(), W = width + GAP, H = height + GAP;
    // sections: consecutive slides up to the next .title slide or data-section
    // marker (all of them if not grouped); a data-section slide starts a row of
    // its own without the .title divider styling (e.g. the conclusion)
    const isSectionStart = (s) => s.classList.contains('title') || 'section' in s.dataset;
    const groups = [];
    for (const s of slides) {
      if (!groups.length || (document.body.dataset.overview === 'sections' && isSectionStart(s) && groups[groups.length - 1].length)) groups.push([]);
      groups[groups.length - 1].push(s);
    }
    // the column count that makes the grid's shape closest to the window's
    const aspect = innerWidth / innerHeight;
    let cols = 1, dist = Infinity;
    for (let c = 1; c <= n; c++) {
      const r = groups.reduce((t, g) => t + Math.ceil(g.length / c), 0);
      const d = Math.abs(Math.log((c * W) / (r * H) / aspect));
      if (d < dist) { dist = d; cols = c; }
    }
    // place every slide: a section starts on a new row; the rows of a section sit
    // SGAP lower than a plain stack would put them
    rows = []; rowOf = new Array(n); colOf = new Array(n);
    const rowY = [];
    let row = 0, extra = 0;
    groups.forEach((g, gi) => {
      if (gi > 0) extra += SGAP;
      g.forEach((s, j) => {
        const r = row + Math.floor(j / cols), c = j % cols, i = slides.indexOf(s);
        rowOf[i] = r; colOf[i] = c;
        (rows[r] ||= []).push(i);
        rowY[r] = r * H + extra;
      });
      row += Math.ceil(g.length / cols);
    });
    slides.forEach((s, i) => {
      const t = `translate3d(${colOf[i] * W}px, ${rowY[rowOf[i]]}px, 0)`;
      s.style.transform = t;
      const bg = Reveal.getSlideBackground(i);
      if (bg) bg.style.transform = t;
    });
    // slide 0 sits where the slides box is; scale about the box centre, then centre the grid
    const s = Reveal.getScale(), k = 0.94 * Math.min(innerWidth / s / ((Math.max(...colOf) + 1) * W), innerHeight / s / (rowY[rows.length - 1] + H));
    // reveal.js's own transform of the slides box is its layout part (when it scales with a
    // transform rather than zoom: "translate(…) scale(…)") then its overview part: replace the latter
    const box = Reveal.getSlidesElement(), layout = (box.style.transform.match(/^\s*translate\([^)]*\)\s*scale\([^)]*\)/) || [''])[0];
    box.style.transform = `${layout} scale(${k}) translate(${(-Math.max(...colOf) * W) / 2}px, ${(-rowY[rows.length - 1]) / 2}px)`;
  };
  const regrid = () => setTimeout(grid);
  Reveal.on('overviewshown', regrid);
  Reveal.on('slidechanged', regrid);
  window.addEventListener('resize', regrid);

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
