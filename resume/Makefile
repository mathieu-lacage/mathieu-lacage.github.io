all: cv.pdf cv-french.pdf

%.pdf: %.tex
	pdflatex $^

view: cv.pdf
	evince cv.pdf

clean: cv.pdf cv-french.pdf
	rm $^

install: cv.pdf
	cp cv.pdf ../static/pdf/resume.pdf

