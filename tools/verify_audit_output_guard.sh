#!/usr/bin/env bash
# The control for the control.
#
# `mbm-audience-discovery-closeout.yml` runs the browser proof a second time
# against a deliberately broken estate, and redirects that run's output with
# --artifacts so the deliberate failure never lands in audit-output/. It landed
# there once and had to be reverted by hand, so the workflow asserts the
# redirect is holding.
#
# That assertion was `git diff --quiet audit-output/`. It worked only because
# the seven files under audit-output/ were tracked. Untracking them — which is
# the right call for run output — would have left the assertion passing for
# ever on a hazard it had stopped watching, because git diff reports nothing at
# all about an untracked path. This script proves the replacement can still go
# red, and proves the one it replaced could not.
#
#   tools/verify_audit_output_guard.sh
#
# Exit 0 green · 1 a guard that cannot fire.
set -uo pipefail

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fails=0
say() { printf '%-6s %s\n' "$1" "$2"; [ "$1" = FAIL ] && fails=$((fails + 1)); return 0; }

# The predicate under test, lifted verbatim from the workflow step.
manifest() { find audit-output -type f -exec sha256sum {} + 2>/dev/null | sort || true; }

scratch="$tmp/repo"
mkdir -p "$scratch"; cd "$scratch"
git init -q .; git config user.email a@b.c; git config user.name t

# ---------------------------------------------------------------- G1 · G2
# A tree shaped like the site repo AFTER the untracking: audit-output/ present
# on disk, ignored, nothing under it tracked.
mkdir -p audit-output/audience-discovery
printf 'baseline\n' > audit-output/audience-discovery/results.json
printf 'audit-output/\n' > .gitignore
git add .gitignore; git commit -qm base

[ "$(git ls-files audit-output/ | wc -l)" -eq 0 ] \
  && say PASS "G0  the fixture reproduces the untracked shape (0 tracked under audit-output/)" \
  || say FAIL "G0  fixture is tracking audit-output/ — the rest proves nothing"

# G1 — the OLD predicate, on the untracked tree. It must be shown UNABLE to fire.
printf 'the control run clobbered this\n' > audit-output/audience-discovery/results.json
if git diff --quiet audit-output/; then
  say PASS "G1  the retired predicate (git diff --quiet) passes over a clobbered file — it could not fire"
else
  say FAIL "G1  git diff saw an untracked change; the premise of this fix is wrong"
fi
printf 'baseline\n' > audit-output/audience-discovery/results.json

# G2 — the NEW predicate, same clobber. It must fire.
before=$(manifest)
printf 'the control run clobbered this\n' > audit-output/audience-discovery/results.json
after=$(manifest)
[ "$before" != "$after" ] \
  && say PASS "G2  the replacement fires on a MODIFIED file" \
  || say FAIL "G2  the replacement did not fire on a modified file"
printf 'baseline\n' > audit-output/audience-discovery/results.json

# G3 — the failure mode git diff never covered at all: a file the control CREATES.
before=$(manifest)
printf 'stray\n' > audit-output/audience-discovery/root-phone.png
after=$(manifest)
[ "$before" != "$after" ] \
  && say PASS "G3  the replacement fires on a CREATED file (git diff never did)" \
  || say FAIL "G3  a created file went unnoticed"
rm -f audit-output/audience-discovery/root-phone.png

# G4 — and on a deletion, for completeness.
before=$(manifest)
rm -f audit-output/audience-discovery/results.json
after=$(manifest)
[ "$before" != "$after" ] \
  && say PASS "G4  the replacement fires on a DELETED file" \
  || say FAIL "G4  a deletion went unnoticed"
printf 'baseline\n' > audit-output/audience-discovery/results.json

# G5 — the negative half. A control run that writes ELSEWHERE must stay green,
# or the guard is red for everyone and gets deleted within the week.
before=$(manifest)
mkdir -p "$tmp/boot-control"; printf 'deliberate failure\n' > "$tmp/boot-control/results.json"
after=$(manifest)
[ "$before" = "$after" ] \
  && say PASS "G5  a run redirected by --artifacts leaves audit-output/ untouched" \
  || say FAIL "G5  the guard reds on a correctly redirected run"

# G6 — vacuity. An absent directory must not read as 'unchanged and fine' when
# the step is meant to be watching one; report the count so a zero is visible.
rm -rf audit-output
[ -z "$(manifest)" ] \
  && say PASS "G6  an absent audit-output/ hashes to nothing, and the step prints that count" \
  || say FAIL "G6  manifest() invented content for an absent directory"

echo
[ "$fails" -eq 0 ] && echo "GREEN — the audit-output guard can fire, and the one it replaced could not." \
                   || echo "RED — $fails check(s) failed."
exit $([ "$fails" -eq 0 ] && echo 0 || echo 1)
