all: cv.pdf cv-software.pdf cv-ai.pdf

%.pdf: %.tex
	pdflatex $^

view: cv.pdf cv-software.pdf cv-ai.pdf
	evince cv.pdf

clean: 
	rm -f *.pdf *.log *.aux 2>/dev/null

install: cv.pdf cv-software.pdf cv-ai.pdf
	cp cv.pdf ../static/pdf/resume.pdf
	cp cv-software.pdf ../static/pdf/resume-software.pdf
	cp cv-ai.pdf ../static/pdf/resume-latest.pdf

