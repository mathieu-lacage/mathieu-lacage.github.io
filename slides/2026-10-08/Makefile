MARP=npx @marp-team/marp-cli@latest

THEMES=$(wildcard themes/*.css)

# Everything the deck needs to run in a browser, online (push) or offline (zip)
DECK_FILES=index.html $(THEMES)

all: html

html: deck.html

pdf: deck.pdf

deck.html: deck.md $(THEMES)
	$(MARP) --html --theme themes/inria.css $< -o $@

deck.pdf: deck.md $(THEMES)
	$(MARP) --allow-local-files --html --theme themes/inria.css $< -o $@

index.html: deck.html
	cp $^ $@

# Build the deck into the Hugo static dir, served at /slides/deck/
www: html
	mkdir -p ../static/slides/deck
	cp deck.html ../static/slides/deck/index.html

push: index.html .htaccess
	rsync -avz $^ mlacage@srv-sophia.inria.fr:/net/servers/www-sop/members/Mathieu.Lacage/slides/compute

# The same files in compute/, to unzip and open compute/index.html without a server
zip: compute.zip

compute.zip: $(DECK_FILES)
	rm -rf $@ zip.tmp && mkdir -p zip.tmp/compute
	cp --parents $^ zip.tmp/compute
	cd zip.tmp && zip -qr ../$@ compute
	rm -rf zip.tmp

.PHONY: all html pdf push www zip clean

clean:
	rm -f deck.pdf deck.html compute.zip 2>/dev/null
