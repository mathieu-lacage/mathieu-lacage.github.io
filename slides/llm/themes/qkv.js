// Keyboard steps of the « Self-Attention Intuitively » slide (figure by tools/qkv_slide.py).
//
// Adds data-steps fragments to every <div class="qk" data-steps="N"> (themes/steps.js), so
// the arrow keys step through it, shows the caption of the current step (the <p> children
// of its .qk-caps, one per step) and posts the step to the script inside its <object> SVG.
// A step reached from the one before plays its animation; any other move just shows it.
// In the PDF nothing is posted: the SVG and the captions show the final step.
(() => {
  document.querySelectorAll('div.qk[data-steps]:not(.qk-built)').forEach((root) => {
    root.classList.add('qk-built');
    const FINAL = +root.dataset.steps, obj = root.querySelector('object');
    const caps = [...root.querySelectorAll('.qk-caps > p')];
    if (caps.length !== FINAL + 1) console.warn(`qkv: ${caps.length} captions for ${FINAL + 1} steps`);
    // a new URL on every page load: browsers (Firefox) keep an <object> in their cache even on a forced reload
    obj.data = obj.getAttribute('data').replace(/\?.*$/, '') + '?t=' + Date.now();

    // the SVG's window: Firefox gives a file:// page no obj.contentWindow, so it is
    // also taken from the source of the SVG's ready message
    let st = null, prev = null, svgWin = null;
    function post(animate) {
      caps.forEach((c, k) => c.classList.toggle('is-off', k !== Math.min(st ?? FINAL, caps.length - 1)));
      const win = obj.contentWindow || svgWin;
      if (st === null || !win) return;
      win.postMessage({ qkv: st, animate: animate && prev === st - 1 }, '*');
      prev = st;
    }
    steps(root, FINAL, (s) => { st = s; post(true); });
    // the SVG loads after this runs: send it the current step once it is ready
    window.addEventListener('message', (ev) => {
      if (!ev.data || !ev.data.qkvReady || (obj.contentWindow && ev.source !== obj.contentWindow)) return;
      svgWin = ev.source;
      post(false);
    });
    obj.addEventListener('load', () => post(false));
  });
})();
