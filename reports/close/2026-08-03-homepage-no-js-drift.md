# Homepage no-JavaScript catalogue-card drift — 3 August 2026

## Status

**Recorded finding. No homepage code was changed.**

The current homepage source contains three empty catalogue containers — Teacher Tools, Games & Sims and Lesson Hub — which are populated by `/assets/mbm-doors.js`. It contains **0 hardcoded `dx-prod` card components**.

This is a source-level no-JavaScript finding. Managed Chromium policy in the audit container blocks localhost and `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`, so no browser-render claim is made here.

## Attribution

The change originated in site pull request #5, **“Make site.json's doors[] a real renderer, and surface the three lost games”**, merged as `f55e1530f50b2c38245b39de20d4523efa2ecc04`.

That pull request states that all seven existing hardcoded cards were migrated into `doors[]` and validates parity after the renderer executes. It does not name, preserve or deliberately retire the no-JavaScript baseline. The resulting loss is therefore recorded as **silent drift, not a documented product decision**.

## Bounded impact

With JavaScript unavailable, the homepage source still provides:

- the main navigation;
- the hero and search form;
- the Off-Brand and Science · Teesside release components;
- all three catalogue section headings;
- **six static action links** — two beneath each catalogue shelf;
- the video section;
- the recently improved section;
- the site promise;
- the contact form;
- the footer.

What is absent is the catalogue-card population inside the three collection shelves. The empty containers themselves add no usable resource or game links.

## Decision required from Matt

Exactly one of these lines closes or reopens the finding:

- `No-JS drift accepted — record it`
- `Restore the no-JS baseline — go`
- `Six links are enough — prove it`
