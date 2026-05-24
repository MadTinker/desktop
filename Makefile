.PHONY: all dev prod install

all: dev

dev:
	yarn build:dev

prod:
	yarn build:prod

install:
	yarn build:install
