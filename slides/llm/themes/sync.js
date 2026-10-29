// Publish the deck's position (slide + fragment) to an ntfy.sh topic, so the follower
// page (follower.html) can follow along on the audience's laptops.
//
//   <script src="themes/deck.js"></script>
//   <script src="themes/sync.js" data-topic-base="inria-llm" data-deck="llm-inference"
//           data-follower="follower.html"></script>
//
// The channel is picked in the deck with the « followers » button (sync-qr.js, key L):
// topic = data-topic-base + '-' + a random string per talk. It is kept in
// localStorage, so a follower page served from the same origin as the deck finds it
// without a URL; elsewhere pass it as ?ch=<topic>. The topic is the password
// (docs.ntfy.sh): whoever has it can publish — the random suffix is the whole
// access control, which is fine for a lecture.
//
// Sends the full state {ver, deck, h, s, f, t} — never deltas — so clients are
// idempotent and a lost message is corrected by the next step. Trailing-throttled
// to one message per 700 ms: ntfy.sh rate-limits anonymous publishing, and the
// newest state is the only one that matters. ?print-pdf does not publish, and
// neither does an embedded deck (the follower view mirrors the deck in an iframe).
(() => {
  const me = document.currentScript;
  if (!me || window.parent !== window || /print-pdf/i.test(location.search)) return;
  const base = me.dataset.topicBase || 'slides';
  const follower = me.dataset.follower || new URL('follower.html', location).href;
  let suffix = me.dataset.topic || '';                  // data-topic: a fixed topic, no dialog
  let last = null, timer = null;

  window.syncTopic = () => (suffix ? `${base}-${suffix}` : null);
  window.syncSetSuffix = (s) => {
    suffix = String(s || '').trim();
    if (suffix) localStorage.setItem('syncTopic', `${base}-${suffix}`);
    publish();
  };
  window.syncFollowerUrl = (s = suffix) => `${follower}?ch=${base}-${s}`;

  function send() {
    timer = null;
    const t = window.syncTopic();
    if (!last || !t) return;
    last.t = Date.now();
    fetch(`https://ntfy.sh/${t}`, { method: 'POST', body: JSON.stringify(last) }).catch(() => {});
  }

  function publish() {
    const i = Reveal.getIndices();
    last = { ver: 1, deck: me.dataset.deck || location.pathname.replace(/.*\//, '').replace(/\.html$/, ''), h: i.h, s: i.v || 0, f: i.f === undefined ? -1 : i.f };
    if (timer === null) timer = setTimeout(send, 700);   // trailing throttle: last state wins
  }

  const arm = () => {
    if (!window.Reveal) return setTimeout(arm, 100);     // deck.js initializes last
    Reveal.on('slidechanged', publish);
    Reveal.on('fragmentshown', publish);
    Reveal.on('fragmenthidden', publish);
    if (Reveal.isReady()) publish(); else Reveal.on('ready', publish);
  };
  arm();
})();
