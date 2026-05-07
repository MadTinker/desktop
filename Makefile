.PHONY: all

all:
	DESKTOP_SKIP_PACKAGE=1 yarn build:dev && yarn start
