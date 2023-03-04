all: build install

translation:
	xgettext --from-code=UTF-8 *.js --output=po/messages.pot

build:
	glib-compile-schemas ./schemas
	gnome-extensions pack -f --extra-source=constants.js --extra-source=custom_signals.js --extra-source=duolingo.js --extra-source=duolingoLanguageMenu.js --extra-source=duolingoUI.js --extra-source=flagsKeys.js --extra-source=icons/ --extra-source=README.md --extra-source=reminder.js --extra-source=utils.js . --out-dir=./

install:
	gnome-extensions install -f duolingo-status2@stslxg.gmail.com.shell-extension.zip

clean:
	rm -f schemas/gschemas.compiled
	rm -f duolingo-status2@stslxg.gmail.com.shell-extension.zip

