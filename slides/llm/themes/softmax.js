// « Megakernels », « Softmax: textbook vs online »: one query head, 8 keys (made-up scores, the running max
// changes at keys 0, 2, 4). Top: the textbook softmax over the whole row (max(S), P = exp(S − max(S)), ΣP,
// A = P / ΣP). Bottom: the online version the attention task runs, one key per step, keeping only the
// running max(S) and ΣP; a key that raises the max takes three steps (the new max, the rescale of the
// earlier P and of ΣP by exp(old − new), then its own P), and the final P / ΣP equals the textbook A.
// Builds the figure inside every <div class="mk" data-sm="two">; its caption goes to the
// <div class="gq-cap" data-sm-cap="two"> next to it. Uses steps.js (load it first).
(() => {
  const C = { slide: '#0f1829', dim: '#3d4a63', ink: '#e3e9f3', slate: '#8e95a2', gold: '#f5c451', cyan: '#8fc5fa', hatch: '#1d2c44', green: '#7cc47a' };
  const COL = { Q: '#ff9f43', K: '#7cc47a', V: '#d97fd0', O: '#6d86ff', A: 'rgb(143,197,250)' };
  const R = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${a}/>`;
  const T = (x, y, s, a = '') => `<text x="${x}" y="${y}" ${a}>${s}</text>`;
  const sm = (x, y, s, a = '') => T(x, y, s, `font-size="13" fill="${C.slate}" ${a}`);
  const num = (x, y, v, a = '') => T(x, y, v, `class="num" font-size="15" fill="${C.ink}" text-anchor="middle" ${a}`);
  const f2 = (v) => v.toFixed(2);

  // one head, 8 keys: the scores S = q·kᵀ/√d_h (made up: new running max at keys 0, 2, 4)
  const S = [1.2, 0.4, 2.1, 0.8, 3.0, 1.5, 0.2, 2.6], N = S.length;
  // the online state after the first n keys: running max m, P = exp(S − m) for the keys seen, d = Σ P
  const online = (n) => {
    const m = Math.max(...S.slice(0, n)), P = S.slice(0, n).map((s) => Math.exp(s - m));
    return { m, P, d: P.reduce((a, v) => a + v, 0) };
  };
  const FINAL = online(N), A = FINAL.P.map((p) => p / FINAL.d);
  const heat = (v, lo, hi) => (0.12 + 0.88 * Math.max(0, Math.min(1, (v - lo) / (hi - lo)))).toFixed(2);

  // (cur.m, cur.d below: the running max(S) and ΣP)
  const two = (st) => {
    const X0 = 330, CW = 70, cx = (k) => X0 + k * CW + CW / 2;
    const cell = (k, y, v, fill, lo, hi, txt = f2(v)) => R(X0 + k * CW + 2, y - 15, CW - 4, 28, `fill="${fill}" fill-opacity="${heat(v, lo, hi)}"`) + num(cx(k), y + 4, txt, 'font-size="13"');
    const hl = (k0, k1, y, col = C.gold) => R(X0 + k0 * CW + 1, y - 17, (k1 - k0) * CW - 2, 32, `fill="none" stroke="${col}" stroke-width="1.5" stroke-dasharray="4 3"`);
    let o = T(120, 170, 'TEXTBOOK: the whole row at once', `font-size="13" font-weight="600" fill="${C.slate}" letter-spacing=".06em"`)
      + T(120, 350, 'ONLINE: one key at a time, as the task streams them', `font-size="13" font-weight="600" fill="${C.slate}" letter-spacing=".06em"`);
    for (let k = 0; k < N; k++) o += sm(cx(k), 190, `key ${k}`, 'text-anchor="middle" font-size="12"');
    // the definitions, as the textbook rows' labels
    const def = (y, name, rhs) => T(X0 - 12, y, `<tspan font-weight="600" font-size="18" fill="${C.ink}">${name}</tspan><tspan font-size="15" fill="${C.cyan}"> = ${rhs}</tspan>`, 'text-anchor="end"');
    o += def(220, 'S', 'q·kᵀ / √d<tspan font-size="75%" dy="3">h</tspan>') + def(258, 'P', 'exp(S − max(S))') + def(296, 'A', 'P / ΣP');
    if (st >= 1) {
      for (let k = 0; k < N; k++) o += cell(k, 216, S[k], COL.A, 0, 3) + cell(k, 254, FINAL.P[k], C.gold, 0, 1) + cell(k, 292, A[k], COL.A, 0, 0.5);
      const dfn = (y, txt) => T(X0 + N * CW + 16, y, txt, `font-size="15" fill="${C.cyan}"`);
      o += dfn(220, `max(S) = ${f2(FINAL.m)}`) + dfn(258, `ΣP = ${f2(FINAL.d)}`);
    }
    // online: the steps of SEQ (from st 2), then A; the running max(S) and ΣP on the right
    const YS = 400, YP = 438, YA = 512, YN = 474, RX = X0 + N * CW + 16;
    o += def(YS + 4, 'S', 'q·kᵀ / √d<tspan font-size="75%" dy="3">h</tspan>') + def(YP + 4, 'P', 'exp(S − max(S))') + def(YA + 4, 'A', 'P / ΣP');
    for (let k = 0; k < N; k++) o += sm(cx(k), 372, `key ${k}`, 'text-anchor="middle" font-size="12"')
      + R(X0 + k * CW + 2, YS - 15, CW - 4, 28, `fill="${C.hatch}"`) + R(X0 + k * CW + 2, YP - 15, CW - 4, 28, `fill="${C.hatch}"`)
      + R(X0 + k * CW + 2, YA - 15, CW - 4, 28, `fill="${C.hatch}"`);
    const box = (y, name, val, on, hot) => T(RX, y + 4, name, `font-size="16" fill="${C.ink}" font-weight="600"`)
      + R(RX + 64, y - 15, 70, 28, `fill="${C.gold}" fill-opacity="${on ? 0.3 : 0}" stroke="${hot ? C.gold : C.dim}" stroke-width="${hot ? 2 : 1}"`) + (on ? num(RX + 99, y + 4, val) : '')
      + T(RX + 142, y + 4, 'so far', `font-size="15" fill="${C.cyan}"`);
    const note = (txt) => T(X0 + (N * CW) / 2, YN + 4, txt, `font-size="14" fill="${C.gold}" text-anchor="middle"`);
    const e = st >= 2 && st - 2 < SEQ.length ? SEQ[st - 2] : null;
    if (st >= 2 + SEQ.length) {                                  // done: all keys, then A
      const f = online(N);
      for (let k = 0; k < N; k++) o += cell(k, YS, S[k], COL.A, 0, 3) + cell(k, YP, f.P[k], C.gold, 0, 1) + cell(k, YA, A[k], COL.A, 0, 0.5);
      o += box(YS, 'max(S)', f2(f.m), true) + box(YP, 'ΣP', f2(f.d), true) + sm(RX, YA + 4, '= the textbook A ✓', `fill="${C.green}" font-size="14"`);
      return o;
    }
    if (!e) return o + box(YS, 'max(S)', '', false) + box(YP, 'ΣP', '', false);
    const { k, ph } = e, before = k ? online(k) : null, after = online(k + 1);
    const fct = before ? Math.exp(before.m - after.m) : 1;
    // what is shown: S up to key k; P of the earlier keys (old or rescaled), P of key k once added
    for (let j = 0; j <= k; j++) o += cell(j, YS, S[j], COL.A, 0, 3);
    const oldP = ph === 'max', withK = ph === 'add' || ph === 'one';
    for (let j = 0; j < k; j++) o += cell(j, YP, oldP ? before.P[j] : after.P[j], C.gold, 0, 1);
    if (withK) o += cell(k, YP, after.P[k], C.gold, 0, 1);
    const sum = ph === 'max' ? before.d : ph === 'rescale' ? before.d * fct : after.d;
    o += box(YS, 'max(S)', f2(after.m), true, ph === 'max') + box(YP, 'ΣP', f2(sum), true, ph === 'rescale' || withK);
    o += hl(k, k + 1, YS);
    if (ph === 'max') o += note(`S = ${f2(S[k])} > ${f2(before.m)}: the new max(S) is ${f2(after.m)}`);
    if (ph === 'rescale') o += hl(0, k, YP, C.cyan) + note(`rescale = exp(${f2(before.m)} − ${f2(after.m)}) = ${f2(fct)},  P = P × rescale,  ΣP = ΣP × rescale`);
    if (ph === 'add') o += hl(k, k + 1, YP) + note(`P = exp(${f2(S[k])} − ${f2(after.m)}) = 1, ΣP = ${f2(before.d * fct)} + 1 = ${f2(after.d)}`);
    if (ph === 'one') o += hl(k, k + 1, YP) + note(before ? `P = exp(${f2(S[k])} − ${f2(after.m)}) = ${f2(after.P[k])}, ΣP = ${f2(before.d)} + ${f2(after.P[k])} = ${f2(after.d)}`
      : `key 0: max(S) = ${f2(S[0])}, P = exp(0) = 1, ΣP = 1`);
    return o;
  };
  // the online steps: one per key; a key that raises the max takes three (new max, rescale, add)
  const SEQ = S.flatMap((v, k) => (k > 0 && v > online(k).m ? ['max', 'rescale', 'add'] : ['one']).map((ph) => ({ k, ph })));
  const CAP_TWO = ['The same 8 scores, softmaxed two ways',
    'Textbook: max(S) of the row, exp, ΣP, divide. It needs <b>the whole row</b> before it can start',
    ...SEQ.map(({ k, ph }) => ({
      one: k === 0 ? 'Online, key 0: the first max(S); its P is exp(0) = 1' : `Key ${k}: below max(S), its P is added to ΣP. Only max(S) and ΣP are carried to the next key`,
      max: `Key ${k}: a <b>new max(S)</b>`,
      rescale: 'Every P so far, and ΣP, used the old max: <b>rescale</b> them by exp(old − new)',
      add: `Then key ${k}'s own P = 1 is added to ΣP`,
    }[ph])),
    'A = P / ΣP: <b>exactly the textbook result</b>, in one pass over the keys'];


  document.querySelectorAll('div.mk[data-sm="two"]').forEach((root) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 1280 720');
    root.appendChild(svg);
    const cap = root.parentElement.querySelector('[data-sm-cap="two"]');
    steps(root, CAP_TWO.length - 1, (st) => {
      if (st === null) st = CAP_TWO.length - 1;
      svg.innerHTML = two(st);
      cap.innerHTML = CAP_TWO[st];
    });
  });
})();
