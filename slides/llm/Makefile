# The deck is index.html (reveal.js and MathJax vendored in vendor/): open it
# in a browser, S for the speaker view. The PDF is its print view (?print-pdf),
# every animation in its final state, printed by tools/pdf.mjs with puppeteer-core
# driving the system Chromium (plain `chromium --print-to-pdf` sometimes prints
# before reveal.js has laid out its print pages).
CHROME=$(shell command -v chromium-browser chromium google-chrome | head -1)

all:

# Live-reload dev server for editing the decks and mockups: keep
# http://localhost:3000/<deck>.html (or mockups/) open in a browser; the tab
# refreshes itself on every file change. S toggles the speaker view.
serve: node_modules
	npx browser-sync start --server --directory --port 3000 --no-open --files "*.html, mockups/**, themes/**, vendor/**"

pdf: next-word-prediction.pdf llm-inference.pdf

node_modules: package.json
	npm install --no-fund --no-audit
	touch $@

next-word-prediction.pdf: next-word-prediction.html tools/pdf.mjs node_modules $(wildcard themes/*.css themes/*.js themes/*.svg)
	CHROME=$(CHROME) node tools/pdf.mjs next-word-prediction.html $@

# Logit-lens plot (« Layer by layer… ») and attention slide (« What does of
# look at? »), from the same model and prompt. Both scripts only write their
# figure, themes/lens.svg and themes/attn.svg (the slides are edited by hand);
# attn_slide.py also reads the lens data, for the stack of lens groups.
# `make lens` reruns the model when the data is missing or lens2d.py changed;
# the deck does not depend on it, so a plain `make` never runs the model.
# The prompt does not start with « Paris »: in Qwen the first token becomes an
# attention sink and its content gets wiped. After changing the model or the
# prompt, force the rerun with `make -B slides`.
LENS_MODEL=Qwen/Qwen3-1.7B
LENS_PROMPT=The city of Paris is the capital of
LENS_DATA=data/Qwen3-1.7B.json
ATTN_DATA=data/attn-Qwen3-1.7B.json
QKV_DATA=data/qkv-Qwen3-1.7B.json

$(LENS_DATA): tools/lens2d.py
	uv run tools/lens2d.py --model $(LENS_MODEL) --prompt "$(LENS_PROMPT)"

$(ATTN_DATA): tools/attn_map.py
	uv run tools/attn_map.py --model $(LENS_MODEL) --prompt "$(LENS_PROMPT)"

lens: $(LENS_DATA) tools/lens_slide.py tools/deckslide.py
	python3 -B tools/lens_slide.py $(LENS_DATA)

attn: $(ATTN_DATA) $(LENS_DATA) tools/attn_slide.py tools/deckslide.py
	python3 -B tools/attn_slide.py $(ATTN_DATA) $(LENS_DATA)

# « Self-Attention Intuitively »: one head (layer 21, head 13) read by « of »;
# qkv_slide.py only writes its figure, themes/qkv.svg (the slide is edited by hand)
$(QKV_DATA): tools/qkv_map.py
	uv run tools/qkv_map.py --model $(LENS_MODEL) --prompt "$(LENS_PROMPT)"

qkv: $(QKV_DATA) tools/qkv_slide.py tools/deckslide.py
	python3 -B tools/qkv_slide.py $(QKV_DATA)

# « Decoding repeats itself »: greedy passes without cache, real numbers of every row;
# writes themes/kvpasses.js directly, and is phony so that a plain `make` never runs the model
kv:
	uv run tools/kv_passes.py --model $(LENS_MODEL)

slides: lens attn qkv kv

.PHONY: all pdf www serve push zip clean lens attn qkv kv slides

# Everything the decks need to run in a browser, online (push) or offline (zip)
DECK_FILES=index.html next-word-prediction.html inference.html follower.html exercises/next-word-probability-similarity.ipynb $(wildcard themes/*.css themes/*.js themes/*.svg) vendor/reveal/reveal.css vendor/reveal/reveal.js vendor/reveal/notes.js vendor/mathjax/tex-svg-full.js vendor/qrcode.min.js

push: $(DECK_FILES)
	rsync -avzR $^ mlacage@srv-sophia.inria.fr:/net/servers/www-sop/members/Mathieu.Lacage/slides/llm

# The same files in llm/, to unzip and open llm/index.html without a server
zip: llm.zip

# Copy the deck into the Hugo static dir, served at /slides/llm/ (CI: slides Makefile)
www: $(DECK_FILES)
	rm -rf ../../static/slides/llm && mkdir -p ../../static/slides/llm
	cp --parents $^ ../../static/slides/llm/

llm.zip: $(DECK_FILES)
	rm -rf $@ zip.tmp && mkdir -p zip.tmp/llm
	cp --parents $^ zip.tmp/llm
	cd zip.tmp && zip -qr ../$@ llm
	rm -rf zip.tmp

clean:
	rm -f deck.pdf llm.zip 2>/dev/null
