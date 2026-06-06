.PHONY: all dev prod install install-app cli

all: dev

dev:
	yarn build:dev

prod:
	yarn build:prod

install:
	yarn build:install

# Stable target the CLI symlink points at.
APP_DEST := /Applications/Madness Desktop.app
CLI_LINK := /usr/local/bin/madhub

# Sync the freshest built .app from dist/ into /Applications, then refresh the
# madhub CLI symlink so `madhub .` keeps working across rebuilds.
install-app:
	@SRC="$$(ls -dt "dist/"*"/Madness Desktop.app" 2>/dev/null | head -1)"; \
	if [ -z "$$SRC" ]; then echo "No built .app in dist/ — run 'make prod' first." >&2; exit 1; fi; \
	echo "Installing $$SRC -> $(APP_DEST)"; \
	rsync -a --delete "$$SRC/" "$(APP_DEST)/"; \
	$(MAKE) cli

# (Re)create the madhub symlink against the stable /Applications path.
cli:
	@SH="$(APP_DEST)/Contents/Resources/app/static/madhub.sh"; \
	if [ ! -f "$$SH" ]; then echo "madhub.sh missing at $$SH — run 'make install-app'." >&2; exit 1; fi; \
	if [ "$$(readlink "$(CLI_LINK)" 2>/dev/null)" = "$$SH" ]; then echo "madhub already linked."; \
	else echo "Linking $(CLI_LINK) (sudo may prompt)"; sudo ln -sf "$$SH" "$(CLI_LINK)"; fi; \
	echo "Done. Try: madhub ."
