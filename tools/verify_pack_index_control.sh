#!/usr/bin/env bash
# The positive control for tools/verify_pack_index.mjs.
#
# A gate that cannot fail proves nothing (trap #19). This reinstates the exact
# defect v5.2 fixed - the folder index deriving its own page number as
# `evidenceStartPage + Math.floor(i/2)`, i.e. assuming two items per page,
# instead of reading the shared page map the appendix is actually printed from -
# and demands the gate go RED.
#
# It also reverse-applies: undoing the replacement must return the input
# byte-for-byte, so the control cannot silently leave a modified file behind.
#
# Usage:  tools/verify_pack_index_control.sh [path/to/index.html]
set -uo pipefail

SRC="${1:-asdan/moderation-lab/index.html}"
GOOD='<td>${pageMap.get(x.key)||"—"}</td>'
BAD='<td>${evidenceStartPage?evidenceStartPage+Math.floor(i/2):"—"}</td>'

SCRATCH="$(mktemp -d)"
BROKEN="$SCRATCH/broken.html"
RESTORED="$SCRATCH/restored.html"
trap 'rm -rf "$SCRATCH"' EXIT

BEFORE_SHA="$(sha256sum "$SRC" | cut -d' ' -f1)"

if ! grep -qF "$GOOD" "$SRC"; then
  echo "INCONCLUSIVE: the shipped build does not contain the fixed page-map render."
  echo "  looked for: $GOOD"
  echo "  Without it the control is not reinstating the real defect, so it proves nothing."
  exit 2
fi

# --- build the broken variant -------------------------------------------------
python3 - "$SRC" "$BROKEN" "$GOOD" "$BAD" <<'PY'
import sys
src, dst, good, bad = sys.argv[1:5]
s = open(src, encoding='utf-8').read()
n = s.count(good)
if n != 1:
    print(f"INCONCLUSIVE: expected exactly one page-map render, found {n}")
    sys.exit(2)
open(dst, 'w', encoding='utf-8').write(s.replace(good, bad))
PY
[ $? -eq 0 ] || exit 2

echo "=== CONTROL: Math.floor(i/2) reinstated — the gate must go RED ==="
set +e
OUT="$(node tools/verify_pack_index.mjs "$BROKEN" 2>&1)"
RC=$?
set -e
echo "$OUT"
echo

if [ $RC -eq 0 ]; then
  echo "❌ CONTROL FAILED — the gate PASSED on a build carrying the defect."
  echo "   The gate is vacuous and any green from it is worthless."
  exit 1
fi

# The failure must be the RIGHT failure, not merely any failure.
if ! echo "$OUT" | grep -q "INDEX POINTS AT THE RIGHT PLATE"; then
  echo "❌ CONTROL INCONCLUSIVE — the gate went red, but not on the plate assertion."
  exit 1
fi
WRONG_LINE="$(echo "$OUT" | grep "INDEX POINTS AT THE RIGHT PLATE")"
echo "✅ CONTROL PASSED — the gate goes red on the defect it exists to catch."
echo "   $WRONG_LINE"

# --- reverse-apply ------------------------------------------------------------
python3 - "$BROKEN" "$RESTORED" "$GOOD" "$BAD" <<'PY'
import sys
src, dst, good, bad = sys.argv[1:5]
s = open(src, encoding='utf-8').read()
open(dst, 'w', encoding='utf-8').write(s.replace(bad, good))
PY

AFTER_SHA="$(sha256sum "$RESTORED" | cut -d' ' -f1)"
echo
if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
  echo "✅ reverse-apply: undoing the control returns the input byte-for-byte"
  echo "   $BEFORE_SHA"
else
  echo "❌ reverse-apply FAILED"
  echo "   before $BEFORE_SHA"
  echo "   after  $AFTER_SHA"
  exit 1
fi
