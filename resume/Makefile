all: cv.pdf cv-french.pdf

%.pdf: %.tex
	pdflatex $^

view: cv.pdf
	evince cv.pdf

clean: 
	rm -f *.pdf *.log *.aux 2>/dev/null

install: cv.pdf
	cp cv.pdf ../static/pdf/resume.pdf

