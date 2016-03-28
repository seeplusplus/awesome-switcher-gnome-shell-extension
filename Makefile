UUID=awesome-switcher@yannik.sembritzki.gmail.com
SRCDIR=src
BUILDDIR=build
FILES=metadata.json *.js stylesheet.css

default_target: all
.PHONY: clean all zip

clean:
	rm -rf $(BUILDDIR)

all: clean
	mkdir -p $(BUILDDIR)/$(UUID)
	cp -r src/* $(BUILDDIR)/$(UUID)


zip: all
	zip -jrq $(BUILDDIR)/$(UUID).zip $(FILES:%=$(BUILDDIR)/$(UUID)/%)
