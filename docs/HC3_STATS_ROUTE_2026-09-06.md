# HC3 device statistics route identity — 2026-09-06

Rollback: Site ce56bdea9e0b950f6cbf335047c385a494726a0d.

Measurement: the generated /stats/on-this-device/ page retains `<base href="/stats/">` to resolve its original assets, but its `#main` skip link therefore points at shared /stats/#main. Its canonical and og:url also identify shared /stats/. Current open-PR touch sets were checked; this generator/route is unowned.

Correct only the generated page's skip destination and canonical/og identity. Keep the relative-asset base and all counters, source content, data and provider configuration intact. Extend the existing navigation browser check with real Tab/Enter on this route and a planted wrong-destination control, plus built-page identity assertions. All applicable checks must pass before merge. After merge, require exact publication/provenance and live phone/desktop checks at that SHA; no missing result counts green.
