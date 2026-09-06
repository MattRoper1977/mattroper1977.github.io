#!/usr/bin/env bash
# Failure mode 47, proved in BOTH directions — one control per direction, not
# one per site.
#
# `producer | short-circuiting-consumer` under `pipefail`: the consumer exits on
# the first match and closes the pipe, the still-writing producer dies of a
# broken pipe, and `pipefail` promotes that death to the pipeline's status.
#
#   POSITIVE assertion ("X must be present")  -> non-zero means FAIL
#                                                = FALSE RED, and it is noisy
#   NEGATIVE assertion ("X must be absent")   -> non-zero means "absent"
#                                                = FALSE GREEN, and it is silent
#
# The false green is the one that matters: the check certifies the absence of
# something it never looked for. This file proves the repaired form catches what
# the old form missed, and that it still reds on the thing it is there to catch.
set -uo pipefail

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  [ ok ] %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  [FAIL] %s\n' "$1"; }

# A producer whose match lands EARLY and which has a great deal left to write.
# The size is what makes the race deterministic rather than occasional; the bug
# itself does not need this much output, only a loaded machine.
emit() { # emit <with-bad|no-bad> <lines>
  python3 -c "
import sys
mode, n = sys.argv[1], int(sys.argv[2])
if mode == 'with-bad': print('BAD-THING')
for i in range(n): print('filler line %d' % i)
" "$1" "$2"
}
emit_died() { # prints a little, then dies WITHOUT ever reaching the bad thing
  python3 -c "
import sys
for i in range(50): print('filler line %d' % i)
sys.exit(9)
"
}

echo "=== DIRECTION 1 · NEGATIVE ASSERTION — the false-green direction ==="
echo "    the rule: BAD-THING must be absent"

# --- the OLD form, shown failing, so the repair is measured against something
# stderr is captured, not shown raw: the producer's BrokenPipeError traceback
# is the evidence here, and printed unlabelled it reads as this file failing.
old_negative() { ! emit "$1" 200000 2>/tmp/sc-old-neg.err | grep -q 'BAD-THING'; }
if old_negative with-bad; then
  ok "OLD form CERTIFIED THE ABSENCE of a BAD-THING that was on line 1 — the bug, reproduced"
  died="$(grep -o 'BrokenPipeError.*' /tmp/sc-old-neg.err || true)"
  printf '         producer died: %s\n' "$(head -1 <<<"$died")"
else
  bad "OLD form caught it; this control cannot prove anything about the repair"
fi

# --- the repaired form. Capture, check the producer's own status, then match on
#     a herestring. All three parts are load-bearing: the herestring stops the
#     broken pipe, and the status check stops a producer that never finished
#     from reading as an absence.
new_negative() { # <mode> ; 0 = clean, 1 = bad found, 2 = could not measure
  local out rc=0
  out="$(emit "$1" 200000)" || rc=$?
  [ "$rc" -eq 0 ] || return 2
  grep -q 'BAD-THING' <<<"$out" && return 1
  return 0
}
new_negative with-bad; r=$?
[ "$r" -eq 1 ] && ok "1a repaired form still REDS when the bad thing is present  [rc=$r]" \
               || bad "1a repaired form did not red on a present bad thing  [rc=$r]"

new_negative no-bad; r=$?
[ "$r" -eq 0 ] && ok "1b repaired form passes on a genuinely clean producer  [rc=$r]" \
               || bad "1b repaired form failed on clean output  [rc=$r]"

# The producer dies before it could have reported the bad thing. A pass here
# would be the same defect wearing different clothes.
new_negative_died() {
  local out rc=0
  out="$(emit_died)" || rc=$?
  [ "$rc" -eq 0 ] || return 2
  grep -q 'BAD-THING' <<<"$out" && return 1
  return 0
}
new_negative_died; r=$?
[ "$r" -eq 2 ] && ok "1c repaired form refuses to certify an absence when the producer DIED  [rc=$r, MEASUREMENT INVALID]" \
               || bad "1c a dead producer read as an absence  [rc=$r]"

echo
echo "=== DIRECTION 2 · POSITIVE ASSERTION — the false-red direction ==="
echo "    the rule: GOOD-THING must be present"

old_positive() { emit with-bad 200000 2>/tmp/sc-old-pos.err | grep -q 'BAD-THING'; }
if old_positive; then
  bad "OLD form passed; the race did not fire here, so direction 2 is unproven"
else
  ok "OLD form REPORTED NO MATCH on output whose line 1 was the match — the bug, reproduced"
  died="$(grep -o 'BrokenPipeError.*' /tmp/sc-old-pos.err || true)"
  printf '         producer died: %s\n' "$(head -1 <<<"$died")"
fi

new_positive() {
  local out rc=0
  out="$(emit with-bad 200000)" || rc=$?
  [ "$rc" -eq 0 ] || return 2
  grep -q 'BAD-THING' <<<"$out"
}
new_positive && ok "2a repaired form matches what is genuinely there" \
             || bad "2a repaired form missed a present match"

new_positive_absent() {
  local out rc=0
  out="$(emit no-bad 200000)" || rc=$?
  [ "$rc" -eq 0 ] || return 2
  grep -q 'BAD-THING' <<<"$out"
}
new_positive_absent && bad "2b repaired form matched something that is not there" \
                    || ok "2b repaired form still reports a genuine absence"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
