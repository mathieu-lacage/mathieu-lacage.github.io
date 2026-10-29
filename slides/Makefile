# One directory per deck. A deck is either a Marp deck (deck.md, themes/, images)
# or a bare PDF (presentation.pdf). This top-level Makefile builds Marp decks and
# copies their runtime assets into the Hugo static dir, served at
# /slides/<deck-name>/. CI runs `make -C slides www` before hugo. Deck dirs may
# have their own Makefile for pdf/zip/push.
DECKS=$(patsubst %/,%,$(dir $(wildcard */deck.md)))

all: www

www:
	@rm -rf ../static/slides && mkdir -p ../static/slides
	@for d in */; do \
		d=$${d%/}; \
		if [ -f $$d/deck.md ]; then \
			echo "== building deck $$d"; \
			$(MAKE) -C $$d html || exit 1; \
			mkdir -p ../static/slides/$$d; \
			cp $$d/deck.html ../static/slides/$$d/index.html || exit 1; \
		fi; \
		for f in $$d/*.pdf $$d/*.png $$d/*.jpg $$d/*.jpeg $$d/*.svg $$d/*.gif $$d/*.webp; do \
			[ -e "$$f" ] || continue; \
			echo "== copying $$f"; \
			mkdir -p ../static/slides/$$d; \
			cp $$f ../static/slides/$$d/ || exit 1; \
		done; \
	done

clean:
	@for d in $(DECKS); do $(MAKE) -C $$d clean; done

.PHONY: all www clean
