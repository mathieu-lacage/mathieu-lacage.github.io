// Publish the deck's position (slide + fragment) to an ntfy.sh topic, so the follower
// page (follower.html) can follow along on the audience's laptops.
//
//   <script src="themes/deck.js"></script>
//   <script src="themes/sync.js" data-topic-base="inria-llm"
//           data-follower="follower.html"></script>
//
// The channel is picked in the deck with the « follow along » button (sync-qr.js, key L):
// topic = data-topic-base + '-' + a random string per talk. It is kept in
// localStorage, so a follower page served from the same origin as the deck finds it
// without a URL; elsewhere pass it as ?ch=<topic>. The topic is the password
// (docs.ntfy.sh): whoever has it can publish — the random suffix is the whole
// access control, which is fine for a lecture.
//
// Sends the full state {ver, url, h, s, f, t} — never deltas — so clients are
// idempotent and a lost message is corrected by the next step. url is the deck's
// own address: the follower needs nothing else to mirror it. Trailing-throttled
// to one message per 700 ms: ntfy.sh rate-limits anonymous publishing, and the
// newest state is the only one that matters. ?print-pdf does not publish, and
// neither does an embedded deck (the follower view mirrors the deck in an iframe).
(() => {
  const me = document.currentScript;
  if (!me || window.parent !== window || /print-pdf/i.test(location.search)) return;
  const base = me.dataset.topicBase || 'slides';
  const follower = new URL(me.dataset.follower || 'follower.html', location).href;
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
    // a failed POST (ntfy.sh rate-limits anonymous publishing) must not lose the
    // state: retry the newest one shortly — the next step re-arms anyway
    fetch(`https://ntfy.sh/${t}`, { method: 'POST', body: JSON.stringify(last) })
      .then((r) => { if (!r.ok) throw new Error(r.status); })
      .catch(() => { if (timer === null) timer = setTimeout(send, 2000); });
  }

  function publish() {
    const i = Reveal.getIndices();
    last = { ver: 2, url: location.href.split('#')[0], h: i.h, s: i.v || 0, f: i.f === undefined ? -1 : i.f };
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
