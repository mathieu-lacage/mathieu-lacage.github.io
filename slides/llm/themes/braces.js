// Curly braces for slides: every <svg class="viz-brace" data-side="left|top|right|bottom"><path/></svg>
// gets a brace path fitted to its layout size, redrawn whenever that size changes
// (e.g. while the matrix next to it grows during an animation).
(() => {
  if (window.adBraces) return;  // loaded once per deck: it draws every brace
  window.adBraces = true;

  // Brace from (x1,y1) to (x2,y2), bulging by w to the left of that direction.
  const curly = (x1, y1, x2, y2, w, q = 0.6) => {
    const len = Math.hypot(x1 - x2, y1 - y2);
    const dx = (x1 - x2) / len, dy = (y1 - y2) / len;
    const at = (f, k) => `${x1 - f * len * dx + k * w * dy},${y1 - f * len * dy - k * w * dx}`;
    const tip = at(0.5, 1);
    return `M${x1},${y1} Q${at(0, q)} ${at(0.25, 1 - q)} T${tip}` +
      ` M${x2},${y2} Q${x2 + q * w * dy},${y2 - q * w * dx} ${at(0.75, 1 - q)} T${tip}`;
  };

  const draw = (svg) => {
    const W = svg.clientWidth, H = svg.clientHeight;
    if (!W || !H) return;
    // the tip points away from the matrix: left, up (top), right or down (bottom)
    const ends = { left: [W - 1, 1, W - 1, H - 1, W - 2], top: [W - 1, H - 1, 1, H - 1, H - 2],
      right: [1, H - 1, 1, 1, W - 2], bottom: [1, 1, W - 1, 1, H - 2] }[svg.dataset.side] || [W - 1, H - 1, 1, H - 1, H - 2];
    svg.firstElementChild.setAttribute('d', curly(...ends));
  };

  const init = () => {
    const ro = new ResizeObserver((entries) => entries.forEach((e) => draw(e.target)));
    document.querySelectorAll('svg.viz-brace').forEach((svg) => { ro.observe(svg); draw(svg); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
