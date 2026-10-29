# One directory per deck, each self-contained: deck.md + themes/ (+ optional Makefile
# for pdf/zip/push). This top-level Makefile builds every deck into the Hugo static
# dir, served at /slides/<deck-name>/. CI runs `make -C slides www` before hugo.
DECKS=$(patsubst %/,%,$(dir $(wildcard */deck.md)))

all: www

www:
	@for d in $(DECKS); do \
		echo "== building deck $$d"; \
		$(MAKE) -C $$d html || exit 1; \
		mkdir -p ../static/slides/$$d; \
		cp $$d/deck.html ../static/slides/$$d/index.html || exit 1; \
	done

clean:
	@for d in $(DECKS); do $(MAKE) -C $$d clean; done

.PHONY: all www clean
