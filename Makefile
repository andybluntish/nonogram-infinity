.PHONY: start

ROOT_DIR := $(realpath .)

start:
	python -m http.server --directory "${ROOT_DIR}/"
