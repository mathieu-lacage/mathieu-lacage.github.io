// The exercise slide's QR code, generated in the browser with the vendored
// library (vendor/qrcode.min.js, MIT, Kazuhiko Arase). The payload is the
// slide's data-notebook URL: relative hrefs resolve against the deck's host,
// but a scanned QR must carry the published https:// URL (the PDF is printed
// from file://).
(() => {
  const script = document.currentScript;
  const host = script.closest('section')?.querySelector('.ex');
  const qrEl = host?.querySelector('.qr');
  const url = host?.dataset.notebook;
  if (!qrEl || !url) return;

  const LIB = new URL('../vendor/qrcode.min.js', script.src).href;
  let lib = null;
  const loadLib = () => (lib ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = LIB; s.onload = ok; s.onerror = () => ko(new Error('no QR lib'));
    document.head.append(s);
  }));

  loadLib().then(() => {
    const qr = qrcode(0, 'M');                           // typeNumber 0: size from the payload
    qr.addData(url);
    qr.make();
    qrEl.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }).catch(() => { qrEl.innerHTML = '<small>QR unavailable</small>'; });
})();
