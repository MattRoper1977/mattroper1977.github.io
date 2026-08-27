#!/usr/bin/env bash
# Runs the Micro-Tinkerer suite against the shipped file.
#
#   tools/microtinkerer/run.sh                     # the game in this repo
#   tools/microtinkerer/run.sh path/to/copy.html   # any other copy
#
# Needs Playwright. If Chromium lives somewhere non-standard, point at it:
#   CHROMIUM_PATH=/opt/pw-browsers/chromium/chrome-linux/chrome tools/microtinkerer/run.sh
#
# Exits non-zero if any gate fails, so it works as a gate. This is the file
# data/hud-coverage.json cites as Micro-Tinkerer's verifier: the register will
# not accept a declination without one on disk.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
TARGET="${1:-}"

# Playwright is commonly installed globally, and node does not look there on
# its own. Resolve the global root rather than making every developer
# npm-install into this repo.
if ! node -e "require.resolve('playwright')" 2>/dev/null; then
  GROOT="$(npm root -g 2>/dev/null || true)"
  if [ -n "$GROOT" ] && [ -f "$GROOT/playwright/index.mjs" ]; then
    export MT_PLAYWRIGHT="$GROOT/playwright/index.mjs"
  else
    echo "playwright not found. Install it with:  npm i -g playwright" >&2
    exit 2
  fi
fi

if [ -n "$TARGET" ]; then
  # A copy somewhere else still has to be served from a directory that looks
  # like the deployed one, because the service worker's scope is the directory.
  [ -f "$TARGET" ] || { echo "no such file: $TARGET" >&2; exit 2; }
  TMP="$(mktemp -d)"
  mkdir -p "$TMP/micro-tinkerer"
  cp "$TARGET" "$TMP/micro-tinkerer/index.html"
  for f in sw.js manifest.webmanifest; do
    src="$(dirname "$TARGET")/$f"
    [ -f "$src" ] && cp "$src" "$TMP/micro-tinkerer/$f"
  done
  export MT_ROOT="$TMP" MT_GAME="$TMP/micro-tinkerer/index.html"
  trap 'rm -rf "$TMP"' EXIT
fi

node "$HERE/mt.test.mjs"
