all: cv.pdf cv-french.pdf

%.pdf: %.tex
	pdflatex $^

view: cv.pdf
	evince cv.pdf

clean: cv.pdf
	rm $^
