#!/usr/bin/env bash

set -e
set -x

# mypy app
# ruff check app
# ruff format app --check
uv run mypy app
uv run ruff check app
uv run ruff format app --check
