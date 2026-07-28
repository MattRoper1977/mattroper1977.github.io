# PASS Q — PLAN (OWL)

## Repo / branch
- Repo audited: **mattroper1977.github.io** (the site/deployment repo — hosts the homepage,
  /hud.js, /theme.js, /styles.css; serves madebymatt.uk). NOT the Lessons estate the template targets.
- Branch: **claude/pass-q-audit-c5tg3s** (harness-assigned; NOT `pass-q-audit`). Off base **a80ae1a**.
- Letter **Q is spent on the SITE repo.** The Lessons sweep must take a fresh letter.

## Scope
- 54 files, 21 HTML. Sibling deployments (Lessons/, Games/, Matt-s-Apps-/) are OUT OF SCOPE for writes;
  read-only cross-repo reads (raw.githubusercontent.com) are permitted and used to close cross-surface
  questions.

## Specimens (no lesson-chassis families here; each HTML is near-bespoke)
- Homepage index.html (churn hotspot — 5 recent commits). Catalogue browser resources/index.html.
- Teacher-tool apps: uas/{index,app}.html, asdan/{index,app}.html. Games: medevac (3 builds), games/index.html.
- Preview area: next/*.html (robots-Disallowed). Shared: theme.js, hud.js, app.js, styles.css, assets/.

## Sweep categories (Phase 1)
Script validity · link integrity (respect do-not-fix ledger: root-absolute + cross-deploy refs) ·
catalogue schema · co-present contradictions (four-surface agreement) · dead/redundant code ·
localStorage keys · reduced-motion mechanics · print integrity · console/network hygiene.

## Tooling
- node --check (syntax) + jsdom@22.1.0 boot with onerror/error-event/uncaught/unhandledRejection capture
  (each proven against planted-positives). tinycss2 available. python xml parse for sitemap.
- Throwaway scripts under _passq/ (git-excluded via .git/info/exclude); only FINDINGS.md + PLAN.md are
  force-added to the commit.

## Commit plan (one defect class per commit; rollback chain)
- Q1  sitemap coverage (/medevac/)              — rollback a80ae1a   [DONE 7c45479]
- Q1b sitemap lastmod correction (inherited date) — rollback 7c45479 [this pass]
- FINDINGS/PLAN report commit (own commit)
- STAGED, NOT executed this pass (await review): Medevac unify-redirect; delete MedevacFrontier_v1.html.

## Token discipline
Scripts over reading; one specimen per pattern; measure classes to zero and replay each zero against a
planted-positive; summarise into FINDINGS.md as I go.
