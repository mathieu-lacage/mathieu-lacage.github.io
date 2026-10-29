# AGENTS.md

A set of course decks on LLMs: static HTML files using reveal.js and MathJax
(vendored in `vendor/`, do not edit) with a coherent custom CSS theme
(`themes/`, shared across decks).

## Editing slides

Decks are hand-edited HTML: `index.html` (landing page), `next-word-prediction.html`,
`llm-inference.html`, and the standalone `deck.html`. A `<section>` is one slide.
Each deck copies the same `<head>` and footer pattern; keep new slides consistent
with it (same class conventions, `themes/*.css` per topic area).

The overview (`Esc`) groups slides by section when the deck's `<body>` carries
`data-overview="sections"` (do not add it to `index.html`): each `.title` slide
starts a new row, and a slide marked `data-section` starts one without divider
styling (e.g. a trailing Conclusion slide).

## Dev loop: `make serve`

`make serve` starts browser-sync on http://localhost:3000 with live reload:
keep the deck URL open in a browser (`S` toggles the speaker view); the tab
refreshes itself on every file change. Use it while editing anything under
`themes/` or the deck HTML files.

## Mockup workflow

For design explorations or new-slide proposals, generate a standalone file
`mockups/<name>.html` — a minimal reveal.js page that reuses `../themes/` and
`../vendor/` so it looks exactly like the deck (copy the `<head>` of the deck
you are mimicking, keep one or two `<section>`s). View it at
http://localhost:3000/mockups/<name>.html. Do not touch the real decks until
the mockup is approved; after integrating it into a deck, delete the mockup.

## PDF export

`make pdf` builds `next-word-prediction.pdf` via `tools/pdf.mjs`
(puppeteer-core driving the system Chromium, printing the `?print-pdf` view
with all animations in their final state). Plain
`chromium --print-to-pdf` is unreliable here: it can print before reveal.js
has laid out its print pages.

## Figures and model data

`make slides` (and the `lens`, `attn`, `qkv`, `kv` targets) runs the Qwen3-1.7B
model through `uv` and regenerates `themes/*.svg` and `data/*.json`. A plain
`make` never runs the model — the decks do not depend on those targets. To
force a rerun after changing the prompt or model: `make -B slides`.
