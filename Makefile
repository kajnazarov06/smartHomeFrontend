# Everything runs in node:22-alpine, same as the commands in CLAUDE.md.
NODE := docker run --rm -v "$(CURDIR)":/app -w /app node:22-alpine
NODE_IT := docker run --rm -it -v "$(CURDIR)":/app -w /app node:22-alpine

.DEFAULT_GOAL := help
.PHONY: help install test test-watch test-file build check

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-12s %s\n", $$1, $$2}'

install: ## Install dependencies (npm ci)
	$(NODE) npm ci --no-audit --no-fund

test: ## Run the whole test suite once
	$(NODE) npx vitest run

test-watch: ## Re-run tests on file changes
	$(NODE_IT) npx vitest

test-file: ## Run one file or folder: make test-file F=src/pages
	@test -n "$(F)" || (echo "Usage: make test-file F=<path>"; exit 1)
	$(NODE) npx vitest run $(F)

build: ## Compile check (vite build)
	$(NODE) npx vite build

check: test build ## Tests + build: run before finishing a change
