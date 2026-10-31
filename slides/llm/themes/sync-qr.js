// The « followers » button (next to the deck's other buttons, key L): pick the talk's
// random channel string and show the QR code of the follower URL. Needs deck.js (the
// #keys strip) and sync.js (window.syncSetSuffix / syncFollowerUrl / syncTopic).
// The QR library is vendored (vendor/qrcode.min.js, MIT, Kazuhiko Arase).
(() => {
  if (!window.syncSetSuffix) return;                     // sync.js not included (e.g. print view)
  const LIB = new URL('../vendor/qrcode.min.js', document.currentScript.src).href;
  const rand = () => Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 6);
  let modal = null, input = null, qrel = null;

  document.head.insertAdjacentHTML('beforeend', `<style>
    [hidden] { display: none !important; }
    #syncqr { position: fixed; inset: 0; z-index: 99; background: #05080ecc; display: flex; align-items: center; justify-content: center; }
    #syncqr .box { background: #0f1829; border: 1px solid #2a3550; border-radius: 12px; padding: 30px 40px 24px; max-width: 600px;
                   font: 16px/1.5 'IBM Plex Sans', sans-serif; color: var(--cutebugs-ink, #e3e9f3); }
    #syncqr h2 { margin: 0 0 14px; font: 600 30px 'IBM Plex Sans Condensed', sans-serif; color: var(--cutebugs-blue, #4aa8ff); text-align: center; }
    #syncqr .qr { display: block; background: #fff; border-radius: 10px; padding: 14px; margin: 0 auto; cursor: pointer; text-decoration: none;
                  /* min(…, 62vh): the square QR must fit a 720p projector with the title and the row below */
                  width: min(420px, 62vh, 76vw); }
    #syncqr .qr svg { display: block; width: 100%; height: auto; }
    #syncqr .qr small { color: #05080e; }
    #syncqr .row { display: flex; margin: 14px 0 0; }
    #syncqr input { flex: 1; font: 500 17px 'IBM Plex Mono', monospace; color: #05080e; background: var(--cutebugs-ink, #e3e9f3);
                    border: 1px solid #2a3550; border-radius: 6px; padding: 9px 12px; }
  </style>`);

  function showQR(suffix) {
    const url = window.syncFollowerUrl(suffix);
    qrel.href = url;                                     // the QR is a link to the follower view
    qrel.title = url;
    qrel.innerHTML = '<small>loading…</small>';
    loadLib().then(() => {
      const qr = qrcode(0, 'M');                         // typeNumber 0: size from the payload
      qr.addData(url);
      qr.make();
      qrel.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }).catch(() => { qrel.innerHTML = '<small>QR unavailable — the channel input below still works</small>'; });
  }

  let lib = null;
  const loadLib = () => (lib ||= new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = LIB; s.onload = ok; s.onerror = () => ko(new Error('no QR lib'));
    document.head.append(s);
  }));

  function open() {
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'syncqr';
      modal.innerHTML = `
        <div class="box">
          <h2>Follow along</h2>
          <a class="qr" target="_blank" title="open the follower view"></a>
          <p class="row"><input spellcheck="false" placeholder="channel"></p>
        </div>`;
      document.body.append(modal);
      input = modal.querySelector('input');
      qrel = modal.querySelector('.qr');
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
      input.addEventListener('input', update);
      update();
    }
    modal.hidden = false;
    if (!input.value.trim()) input.value = (window.syncTopic() || '').split('-').pop() || rand();
    input.focus();
    input.select();                                      // overwrite the channel right away
  }
  function update() {
    const s = input.value.trim() || rand();
    window.syncSetSuffix(s);                             // publishes immediately (throttled)
    showQR(s);
  }
  function close() { if (modal) modal.hidden = true; }

  // the button, in the strip deck.js builds under the slide
  const bar = document.getElementById('keys');
  if (bar) {
    const b = document.createElement('button');
    b.innerHTML = '<kbd>L</kbd> followers';
    b.title = 'Follow along (L)';
    b.tabIndex = -1;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', open);
    bar.append(b);
  }
  document.addEventListener('keydown', (e) => {
    if (modal && !modal.hidden && e.key === 'Escape') {  // keep reveal's Esc from firing behind the modal
      e.stopImmediatePropagation();
      close();
    } else if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea/i.test(e.target.tagName)) {
      e.stopImmediatePropagation();
      e.preventDefault();                    // open() focuses the input: keep the « l » out of it
      open();
    }
  }, true);
})();
