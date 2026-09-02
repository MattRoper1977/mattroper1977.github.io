#!/usr/bin/env bash
# P6 regression: every line PASS/FAIL. Usage: tools/p6.sh [html]
set -u; cd "$(dirname "$0")/.."; F="${1:-titanforge.html}"; OUT=shots/p6; mkdir -p "$OUT"; cp "$F" builds/p6.html; : > "$OUT/perf.txt"
line(){ printf '%s %s\n' "$1" "$2"; }
echo "== P6 REGRESSION on $F ($(stat -c %s "$F") bytes, sha256 $(sha256sum "$F" | cut -c1-16)…) =="
R=$(node tools/rep_harness.mjs "$F" 6 --json "$OUT/reps.json" 2>&1); echo "$R" | grep -q "RESULT PASS" && line PASS "6 tri-phase reps: combo 1..6, GAINS x1.9 at 6/6, doubled strength after a flawless set ($(echo "$R" | grep -o 'ratio [0-9.]*'))" || { line FAIL "6 tri-phase reps"; echo "$R" | tail -4; }
node tools/p6_regression.mjs "$F" 2>&1 | grep -E "^(PASS|FAIL)" | sed 's/^PASS /PASS /'
S=$(python3 - "$F" <<'PY'
import sys,re
b=open(sys.argv[1],encoding='utf-8').read();a=open('input_v4.html',encoding='utf-8').read()
def seg(t,s,e):i=t.index(s);j=t.index(e,i)+len(e);return t[i:j]
sp=seg(a,'<!-- MBM-SPLASH:BEGIN','<!-- MBM-SPLASH:END -->')==seg(b,'<!-- MBM-SPLASH:BEGIN','<!-- MBM-SPLASH:END -->')
ex=seg(a,'<!-- MBM-INLINE-EXIT:BEGIN','<!-- MBM-INLINE-EXIT:END -->')==seg(b,'<!-- MBM-INLINE-EXIT:BEGIN','<!-- MBM-INLINE-EXIT:END -->')
print(('PASS' if sp and ex else 'FAIL')+f' splash stamp byte-identical to the input: {sp}; inline-exit stamp byte-identical: {ex}')
PY
); echo "$S"
C=$(node tools/check_scripts.mjs "$F" 2>&1 | tail -1); echo "$C" | grep -q " 0 failures" && line PASS "every script block passes node --check ($C)" || line FAIL "node --check: $C"
RM=$(node tools/p3_reduced.mjs "$F" 2>&1); echo "$RM" | grep -q "RESULT PASS" && line PASS "reduced-motion run: zero animation frames from P3/P5 effects ($(echo "$RM" | grep -o 'motion counters non-zero: [a-z]*'), $(echo "$RM" | grep -o 'particles spawned [0-9]*'))" || { line FAIL "reduced-motion run"; echo "$RM" | tail -3; }
P=$(node tools/phone_proof.mjs "$F" "$OUT" p6 2>&1); Y=$(echo "$P" | grep -c "scroll 0: YES"); N=$(echo "$P" | grep -E "^(360|390|412)" | grep -c "popup overlapping lift: NO"); [ "$Y" -ge 3 ] && [ "$N" -eq 3 ] && line PASS "P1 phone proof YES on all three phone sizes; no popup overlaps the fixed LIFT (failed requests $(echo "$P" | grep -o 'failed requests [0-9]*' | sort -u | tr '\n' ' '))" || { line FAIL "phone proof"; echo "$P" | cut -c1-160; }
for i in 1 2 3; do node tools/perf_budget.mjs builds/p6.html --label "perf run$i" 2>&1 | head -1 | tee -a "$OUT/perf.txt"; done
MEDS=$(grep -o 'median fps [0-9]*' "$OUT/perf.txt" | grep -o '[0-9]*$' | sort -n | tr '\n' ' '); MED=$(echo $MEDS | awk '{print $2}'); IDLE=$(grep -o 'draws delta [0-9]*' "$OUT/perf.txt" | grep -o '[0-9]*$' | sort -n | tail -1)
if [ "${MED:-0}" -ge 50 ] && [ "${IDLE:-1}" -eq 0 ]; then line PASS "performance budget: three runs, medians [$MEDS] → median-of-three $MED (>= 50); idle FX draws max $IDLE (= 0)"; else line FAIL "performance budget: three runs, medians [$MEDS] → median-of-three ${MED:-?}; idle FX draws max ${IDLE:-?}"; fi
