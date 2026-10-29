MARP=npx @marp-team/marp-cli@latest

all: html

html: deck.html

pdf: deck.pdf

deck.html: deck.md
	$(MARP) --html $^ -o $@

deck.pdf: deck.md
	$(MARP) --allow-local-files --html $^ -o $@

index.html: deck.html
	cp $^ $@

push: index.html .htaccess qrcode.svg facebook-mau.svg deck.pdf opportunity.jpg
	rsync -avz $^ mlacage@srv-sophia.inria.fr:/net/servers/www-sop/members/Mathieu.Lacage/slides/test-engineering/

clean:
	rm -f deck.pdf deck.html 2>/dev/null
