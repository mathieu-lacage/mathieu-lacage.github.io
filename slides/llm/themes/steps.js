// Keyboard steps of the slide animations, on top of reveal.js fragments.
//
//   steps(root, n, onStep)
//
// prepends n empty fragments to root, so the arrow keys step through the animation,
// and calls onStep(st) whenever st, the number of fragments shown, changes (from 0
// to n). In the PDF (?print-pdf) it calls onStep(null) once: show the final state.
//
// Must run before Reveal.initialize (themes/deck.js), which counts the fragments.
window.steps = (root, n, onStep) => {
  const marks = [];
  for (let k = 0; k < n; k++) {
    const m = document.createElement('i');
    m.className = 'fragment';
    m.style.cssText = 'position: absolute; width: 0; height: 0;';
    marks.push(m);
  }
  root.prepend(...marks);
  if (/print-pdf/i.test(location.search)) { onStep(null); return; }
  let st = null;
  const update = () => {
    const now = marks.filter((m) => m.classList.contains('visible')).length;
    if (now !== st) onStep(st = now);
  };
  const mo = new MutationObserver(update);
  marks.forEach((m) => mo.observe(m, { attributes: true, attributeFilter: ['class'] }));
  update();
};
