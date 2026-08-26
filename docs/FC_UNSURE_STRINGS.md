# FC_UNSURE_STRINGS — left unchanged on purpose

§FC2.4: *unsure is not a reason to edit; it is a reason to ledger.* Every string here
was reached by the sweep, looked at, and **left exactly as it was**. Each row says why.

## Vocabulary that is arguably jargon, but is the reader's own

| string | where | why it was left |
|---|---|---|
| `evidence-aware pathway material` | teachers / schools / trusts / councils / partners, features | "evidence-aware" describes the *material*, not the site's architecture. §FC2's sweep targets prose that explains internal architecture to a visitor. Only "canonical" was changed in this sentence. |
| `procedurally generated block world` | Voxel Frontier | This is Minecraft vocabulary. A child who plays block games knows it better than any rewording I could offer. `DESCRIPTIONS=verified-only` says rewrite dev jargon — this is player jargon, which is different. |
| `procedural neon arena` | Neon Breach | Same family. Borderline; "procedural" reads to a player as "different every run", which is what it means. |
| `a deterministic curling sheet` | Apex Curl | The most borderline of the set. "Deterministic" IS developer vocabulary — but the sentence uses it to promise that the ice behaves the same way twice, which is the game's whole selling point. Rewording risks losing a real claim. **Your call.** |
| `Local-only shortcut` | pupils / teachers, Recently-explored kicker | Carries a privacy meaning (the list never leaves the device). Rewording it risks weakening a statement that is doing real work, and red line 8 forbids new privacy sentences. |

## Not a defect, though a naive sweep would flag it

| string | where | why it was left |
|---|---|---|
| `Professional Education Hub` | 6 reader-facing places | It is the destination's real name: `<title>Professional Education Hub — Made by Matt</title>`. Renaming it in copy would make the page *less* true. KEEP, recorded in the FC2 commit. |
| `Capability without unsupported claims` | noteTitle on 5 pages | §FC2.3 puts it explicitly out of scope. It is the estate's settled phrase. |
| `<link rel="canonical">` | all 7 pages | SEO markup. Never read by a visitor. The word "canonical" surviving here is correct. |
| repeated CTA labels | teachers, schools, trusts, partners | e.g. `Open the Lesson Hub` twice on one page. Both point at `/Lessons/`. The pack's complaint was *different destinations sharing one generic label* — that does not reproduce. Same label for the same destination is consistency, and giving one of them a different name would make the page worse. See the close record, §FC4.1. |
| `three nations` | World Cup description | A count in prose, and red line 7 forbids those. But that rule exists because *catalogue* counts go stale. A game that ships three nations will ship three nations tomorrow. Pre-existing; not introduced here. |

## Deliberately not attempted

| item | why |
|---|---|
| Wholesale dash normalisation across the record | §FC5.2 asks for consistency; the record is genuinely mixed (4 spaced em dashes, 7 unspaced, 8 spaced hyphens). Normalising all of it would touch strings this order never measured, including ones bound by gates and red-proofs. Dashes were normalised **only on strings this run was already rewriting**. The rest is a ledgered item, not a silent skip. |
| Any take | `TAKES=report-only`. See `FC_TAKES_CONTACT_SHEET.md`. |

## Wanted by the order, but not written — and why

| item | why |
|---|---|
| `Section 19` on `/for/councils-organisations/` | §FC4.3 names it as a sector-recognition term and I tried to use it. `verify_catalogue_counts.mjs` then went red: the numeral `19` sits in a node that also contains the word "route", and the gate flags any 2–6 digit numeral next to a catalogue noun. The gate is mechanically right and red line 7 forbids counts in prose. **I did not weaken the gate to admit my own sentence** — that is precisely the move this estate's register calls out. The duty is named in words instead: *"a duty to arrange suitable education"*, which is what Section 19 says. `PEP` and `Virtual School` are both present as written. If you want the statutory citation itself on the page, it needs a declared exemption for statutory references in the gate — a small, separate change, and yours to authorise rather than mine to slip in. |

