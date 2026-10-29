// The « followers » button (next to the deck's other buttons, key L): pick the talk's
// random channel string and show the QR code of the follower URL. Needs deck.js (the
// #keys strip) and sync.js (window.syncSetSuffix / syncFollowerUrl / syncTopic).
// The QR library is vendored (vendor/qrcode.min.js, MIT, Kazuhiko Arase).
(() => {
  if (!window.syncSetSuffix) return;                     // sync.js not included (e.g. print view)
  const LIB = new URL('../vendor/qrcode.min.js', document.currentScript.src).href;
  const rand = () => Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 6);
  let modal = null, input = null, qrel = null, urlel = null;

  document.head.insertAdjacentHTML('beforeend', `<style>
    [hidden] { display: none !important; }
    #syncqr { position: fixed; inset: 0; z-index: 99; background: #05080ecc; display: flex; align-items: center; justify-content: center; }
    #syncqr .box { background: #0f1829; border: 1px solid #2a3550; border-radius: 12px; padding: 28px 34px; max-width: 420px;
                   font: 15px/1.5 'IBM Plex Sans', sans-serif; color: var(--cutebugs-ink, #e3e9f3); }
    #syncqr h2 { margin: 0 0 10px; font: 600 22px 'IBM Plex Sans Condensed', sans-serif; color: var(--cutebugs-blue, #4aa8ff); }
    #syncqr p { margin: 8px 0; }
    #syncqr .u { font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--cutebugs-cyan, #8fc5fa); word-break: break-all; }
    #syncqr .qr { background: #fff; border-radius: 8px; padding: 10px; width: min(220px, 60vw); margin: 10px auto; }
    #syncqr .qr svg { display: block; width: 100%; height: auto; }
    #syncqr .row { display: flex; align-items: center; gap: 8px; }
    #syncqr input { flex: 1; font: 500 15px 'IBM Plex Mono', monospace; color: #05080e; background: var(--cutebugs-ink, #e3e9f3);
                    border: 1px solid #2a3550; border-radius: 6px; padding: 6px 10px; }
    #syncqr .dice { font-size: 15px; padding: 6px 10px; border-radius: 6px; border: 1px solid #2a3550; background: none; color: inherit; cursor: pointer; }
    #syncqr .small { font-size: 12px; color: var(--cutebugs-slate, #8e95a2); }
  </style>`);

  function showQR(suffix) {
    urlel.textContent = window.syncFollowerUrl(suffix);
    qrel.innerHTML = '<small>loading…</small>';
    loadLib().then(() => {
      const qr = qrcode(0, 'M');                         // typeNumber 0: size from the payload
      qr.addData(window.syncFollowerUrl(suffix));
      qr.make();
      qrel.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }).catch(() => { qrel.innerHTML = '<small>QR unavailable — the URL above still works</small>'; });
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
          <h2>Followers follow along</h2>
          <p>Followers open <span class="u"></span> — or scan:</p>
          <div class="qr"></div>
          <p class="row">channel <input spellcheck="false"> <button class="dice" title="new random string">↻</button></p>
          <p class="small">Share one URL per talk. Esc closes; the deck publishes to this channel until you change it.</p>
        </div>`;
      document.body.append(modal);
      input = modal.querySelector('input');
      qrel = modal.querySelector('.qr');
      urlel = modal.querySelector('.u');
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
      modal.querySelector('.dice').addEventListener('click', () => { input.value = rand(); update(); });
      input.addEventListener('input', update);
      update();
    }
    modal.hidden = false;
    if (!input.value.trim()) input.value = (window.syncTopic() || '').split('-').pop() || rand();
    input.focus();
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
    b.title = 'followers follow along (L)';
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
      open();
    }
  }, true);
})();
