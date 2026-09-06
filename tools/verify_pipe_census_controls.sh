#!/usr/bin/env bash
# V4 — the census, tested against the blind spots that produced it.
#
# tools/census_pipe_shortcircuit.py found two gaps in itself, and it found them
# by having its recall measured against a cruder instrument (a raw grep): 22
# sites against 24 candidate lines. Neither gap was in the grep. Then one
# CLASSIFICATION was backwards - a bare `! pipeline` had been filed false-red
# when it is the single most dangerous shape.
#
# A fix that has never been tested against the case that produced it is a
# hypothesis. These three are planted deliberately, every run:
#
#   1  a pipe inside "$( … | … )"        - invisible to a quote-tracking splitter
#   2  workflow YAML outside .github/    - never walked at all
#   3  a bare `! producer | grep -q`     - must file FALSE-GREEN, not false-red
#
# Planted into a scratch tree rather than onto a scratch branch: the proof is
# the same and it runs on every push instead of once.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
CENSUS="$HERE/census_pipe_shortcircuit.py"
# The planted instances live as FILES under tools/fixtures/, not in heredocs
# here: a fixture written inside a heredoc reads as live code to any
# scanner, which this census proved by flagging its own control file.
FX="$HERE/fixtures/census-blind-spots"
SC="$(mktemp -d)"
trap 'rm -rf "$SC"' EXIT

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  [ ok ] %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  [FAIL] %s\n' "$1"; }

mkdir -p "$SC/.github/workflows" "$SC/tools/fixtures/parked/workflows"

# --- 1. a pipe inside a QUOTED command substitution ------------------------
cp "$FX/quoted_subst.sh" "$SC/tools/quoted_subst.sh"

# --- 2. workflow YAML OUTSIDE .github/workflows ---------------------------
cp "$FX/parked.yml" "$SC/tools/fixtures/parked/workflows/parked.yml"

# --- 3. a BARE negative assertion, the shape that must file false-green ----
cp "$FX/negative.yml" "$SC/.github/workflows/negative.yml"

OUT="$(python3 "$CENSUS" "$SC" 2>&1)"

echo "=== 4.1 · the two blind spots that produced the fix ==="
grep -q 'quoted_subst.sh' <<<"$OUT" \
  && ok "1 a pipe inside \"\$( … | … )\" is seen  — $(grep -o 'quoted_subst.sh:[0-9]*' <<<"$OUT" | sed -n 1p)" \
  || bad "1 a pipe inside a quoted command substitution is STILL invisible"

grep -q 'parked.yml' <<<"$OUT" \
  && ok "2 workflow YAML outside .github/workflows is walked  — $(grep -o 'parked.yml[^:]*:[0-9]*' <<<"$OUT" | sed -n 1p)" \
  || bad "2 workflow YAML outside .github/workflows is STILL never walked"

grep -q 'NOT LIVE' <<<"$OUT" \
  && ok "2b …and it is named as NOT LIVE rather than gated or dropped" \
  || bad "2b the parked workflow was not distinguished from a live one"

echo
echo "=== 4.2 · failure mode 48: the classification was backwards ==="
NEG="$(awk '/negative.yml/{found=1} found && /->/{print; exit}' <<<"$OUT")"
BUCKET="$(awk '/=== FALSE-GREEN/{g=1} /=== FALSE-RED/{g=0} g && /negative.yml/{print "false-green"; exit}' <<<"$OUT")"
[ "$BUCKET" = "false-green" ] \
  && ok "3 a bare \`! producer | grep -q\` files FALSE-GREEN  — ${NEG:-(no reason line)}" \
  || bad "3 the bare negative assertion filed as '${BUCKET:-not false-green}' — it is the dangerous shape"

echo
echo "=== a clean tree finds nothing, so the three above are not noise ==="
mkdir -p "$SC/clean/.github/workflows"
cp "$FX/clean.yml" "$SC/clean/.github/workflows/clean.yml"
CLEAN="$(python3 "$CENSUS" --gate "$SC/clean" 2>&1)"; crc=$?
[ "$crc" -eq 0 ] && ok "the repaired form is not flagged  — gate exit $crc" \
                 || bad "the repaired form was flagged  — gate exit $crc"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
