# Makefile for anomalous-action — a GitHub Action that runs the standalone
# system-probe binary to capture host-wide activity dumps.
#
# Mirrors the npm scripts in package.json but with real dependency ordering so
# `make all` runs the full quality gate in the right sequence. Run `make help`
# to see available targets.

.DEFAULT_GOAL := help

# --- tooling (prefer local node_modules bins so CI without global installs works) ---
NPM      := npm
NPX      := npx
NODE     := node
TSC      := $(NPX) tsc
NCC      := $(NPX) ncc
ESLINT   := $(NPX) eslint
PRETTIER := $(NPX) prettier
JEST     := $(NPX) jest

# --- paths ---
SRC      := src
TESTS    := __tests__
DIST     := dist
TS_FILES := $(shell find $(SRC) $(TESTS) -name '*.ts' 2>/dev/null)

# Color output unless redirected.
ifneq (,$(findstring xterm,$$TERM))
	CLR := \033[36m
	END := \033[0m
else
	CLR :=
	END :=
endif

.PHONY: help install build check lint format format-check test clean all

## Show this help.
help: ## display this help
	@printf "Usage: make <target>\n\nTargets:\n"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(CLR)%-16s$(END) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

## Install dependencies (npm ci in CI, npm install locally).
install: ## install dependencies
	@if [ -f package-lock.json ] && [ "$$CI" = "true" ]; then \
		$(NPM) ci; \
	else \
		$(NPM) install; \
	fi

## Type-check without emitting (tsc --noEmit).
check: ## type-check (tsc --noEmit)
	$(TSC) --noEmit

## Run eslint over src and __tests__.
lint: ## lint with eslint
	$(ESLINT) $(SRC) $(TESTS)

## Format all TS files in place.
format: ## format with prettier (write)
	$(PRETTIER) --write "$(SRC)/**/*.ts" "$(TESTS)/**/*.ts"

## Verify formatting without changing files (CI gate).
format-check: ## check formatting (no writes)
	$(PRETTIER) --check "$(SRC)/**/*.ts" "$(TESTS)/**/*.ts"

## Run the jest test suite.
test: ## run unit tests (jest)
	$(JEST)

## Build the action bundles with ncc (dist/main + dist/post).
build: ## build dist/main and dist/post with ncc
	$(NCC) build $(SRC)/main.ts -o $(DIST)/main --minify
	$(NCC) build $(SRC)/post.ts -o $(DIST)/post --minify

## Remove build output and node_modules caches.
clean: ## remove dist/ and jest cache
	rm -rf $(DIST)
	rm -rf .jest-cache coverage

## Full quality gate: format-check, lint, type-check, test, build.
all: format-check lint check test build ## run the full quality gate
	@printf "$(CLR)all checks passed$(END)\n"
