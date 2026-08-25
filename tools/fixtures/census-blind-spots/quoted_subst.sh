#!/usr/bin/env bash
# FIXTURE (not run): a pipe inside a QUOTED command substitution. A splitter
# that tracks quoting reads this whole line as one string and never sees the
# pipe - the first blind spot the census found in itself.
set -euo pipefail
NEWEST="$(ls "$OUT"/clips/*.webm | head -1)"
echo "$NEWEST"
