# Pass U — site-repo reconciliation (lighter pass)

**Repo** `mattroper1977.github.io` (the site half) · **branch** `claude/pass-u-audit-hapesp`.
Companion to the Lessons-body audit on the `Lessons` repo branch `pass-u-audit` (commit `7c4b2b4`),
where the full sweep and the estate record live. This note is the *reconciliation half* the user asked for
("Both, Lessons first"). Kept deliberately light — the site repo is 54 files and mostly a launcher.

## Framing note
The brief describes a site-side "Pass Q" record at `claude/pass-q-audit-c5tg3s @ 6845f44` and a site
`pass-u-audit` branch with "68 sitemap additions". **Neither the Lessons repo's own record nor this
session verified those branches/SHAs** — they are treated as UNVERIFIED cached claims (Lessons REGISTER
R-G01). This session's designated site branch is `claude/pass-u-audit-hapesp` (harness-created off `main`,
even with `main` at start). No `pass-q-audit`/`pass-u-audit` branch was found or relied upon here.

## Checks run (all CLEAN)
| check | result |
|---|---|
| `site.json`, `data/resources.json` parse | valid |
| inline `<script>` syntax (`node --check`) | 17 blocks, **0 errors** |
| `sitemap.xml` well-formed | yes · **395** `<loc>` URLs, single host `madebymatt.uk` |

## Cross-repo sitemap reconciliation — the check `sitemap_audit.py` can't run behind the proxy
With **both** repo trees on disk, every sitemap URL was decoded (`unquote`, both sides) and resolved
against the real file tree — the offline form of Lessons R-G01 row 3 / R-D04:

- **`/Lessons/*` URLs: 387 / 387 resolve** to files in the Lessons working tree. **0 dead.**
  (Directory-index convention honoured: a `…/` URL resolves via `index.html`.)
- **Site-scoped: 6 resolve; 2 do not — `Games/` and `Matt-s-Apps-/`.** These are the **sibling GitHub
  Pages project repos** named in brief §3, deployed under the same origin (Lessons R-D01: "one public
  origin… extended over project pages"). They resolve **live**; they are absent only from *this* repo's
  tree. Same "outside this repo, fine live" class as the Lessons root-absolute false-positives.

## Disposition
**Zero site-side defects. Nothing changed, nothing to fix.** 387/387 Lessons URLs and 6/6 in-repo site
URLs resolve; the 2 non-resolving entries are known sibling deployments. The `395` vs the register's
recorded `386` (at `35efefd`) is expected estate movement, not drift (Lessons R-G04: historical stamp).

## Hand-back
- Provably better, merged: nothing (nothing broken).
- Waiting on Matt: nothing site-side. (The one open decision is Lessons-side — the `ko_staleness` shallow
  guard, U-T2-01 in the Lessons FINDINGS.)
- Left alone and why: the `Games/` + `Matt-s-Apps-/` sitemap entries are correct sibling-project URLs — do
  not "fix" by removing them (they are the R-D04 reachability the sitemap exists to provide).

*Tip SHA not written here (R-G04): derive with `git log -1`.*
