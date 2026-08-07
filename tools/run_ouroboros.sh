#!/usr/bin/env bash
# The Ouroboros gate, in the spirit of tools/glitchclash/run.sh: run against
# the shipped file, non-zero exit if anything fails, so it works as a gate.
#
#   tools/run_ouroboros.sh [path/to/index.html] [path/to/pre-fix.html]
#
# The second argument is the NEGATIVE CONTROL. Without it the U-1 limbs are
# still measured but have never been seen to go red, and a gate that has never
# failed is not evidence.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HERE/../_staging/ouroboros/index.html}"
CONTROL="${2:-}"
if [ -n "$CONTROL" ]; then
  exec node "$HERE/verify_ouroboros.mjs" "$TARGET" --control "$CONTROL"
fi
echo "note: no pre-fix control supplied — U-1 limbs run unproven-red" >&2
exec node "$HERE/verify_ouroboros.mjs" "$TARGET"
