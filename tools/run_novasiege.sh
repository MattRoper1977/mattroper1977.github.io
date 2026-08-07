#!/usr/bin/env bash
# The Nova Siege gate set, in the spirit of tools/glitchclash/run.sh: run
# against the shipped file, non-zero exit if anything fails, so it works as a
# merge gate.
#
#   tools/run_novasiege.sh [path/to/index.html]
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HERE/../_staging/novasiege/index.html}"
fail=0

echo "== behaviour gate (39 limbs + negative controls) =="
node "$HERE/verify_novasiege.mjs" --self-test "$TARGET" || fail=1

echo
echo "== silhouette distinctness =="
# Floor 0.30, set just under the measured 0.329 rather than at it: a floor
# pinned exactly to today's figure fails on rounding the first time a shape is
# nudged, and a floor set far below it stops meaning anything.
node "$HERE/measure_novasiege_silhouettes.mjs" "$TARGET" --floor 0.30 || fail=1

echo
[ "$fail" -eq 0 ] && { echo "NOVA SIEGE: ALL GATES PASS"; exit 0; }
echo "NOVA SIEGE: GATE FAILURE"; exit 1
