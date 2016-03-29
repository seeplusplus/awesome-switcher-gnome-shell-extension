# Inspired by:
# https://github.com/luispabon/maximus-gnome-shell/blob/53759a1c1ea31dd75339323a51fbb591959ba6fd/Makefile
# https://github.com/aleho/gnome-shell-volume-mixer/blob/6d678eced6707f17fbf0737798438e74ce258a14/Makefile
# https://github.com/jenslody/gnome-shell-extension-openweather/blob/a92e5d2268b486bea12ba60b38f8cea877d5d9cb/Makefile.am
UUID=$(shell cat src/metadata.json | python -c "import json,sys;obj=json.load(sys.stdin);print obj['uuid'];")
SRCDIR=src
BUILDDIR=build
MKFILE_PATH := $(lastword $(MAKEFILE_LIST))
MKFILE_DIR := $(dir $(MKFILE_PATH))
ABS_MKFILE_PATH := $(abspath $(MKFILE_PATH))
ABS_MKFILE_DIR := $(abspath $(MKFILE_DIR))
ABS_BUILDDIR=$(ABS_MKFILE_DIR)/$(BUILDDIR)
FILES=metadata.json *.js stylesheet.css

default_target: all
.PHONY: clean all zip

clean:
	rm -rf $(BUILDDIR)

all: clean
	mkdir -p $(BUILDDIR)/$(UUID)
	cp -r src/* $(BUILDDIR)/$(UUID)


zip: all
	(cd $(BUILDDIR)/$(UUID); \
         zip -rq $(ABS_BUILDDIR)/$(UUID).zip $(FILES:%=%); \
        );
