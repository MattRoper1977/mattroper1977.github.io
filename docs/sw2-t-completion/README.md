# Part T completion candidate — 12 September 2026

Status: REVIEW ONLY. No new admission retirement is approved or activated. The live release remains Site 93916d80d7a82655cd8676c29162e4e60c1670cb, Lessons fd95ef4cc636b31d96b6b83fc33faff0c64f383d and Apps 2055df24d97d1f6a362be509832767f31c19f5db. This candidate does not issue SW2_T_OK.

The live 31-page chrome census found 17 pages without the required origin-root token link, seven missing footer taglines, and the Apps publisher's extra header tagline. This candidate normalises the token link, appends a missing signoff without replacing authored footer prose or links, and rejects duplicate or misplaced taglines. The approved mark is retained. Existing correctly completed footers stay byte-identical. Navigation and content data remain record-derived.

The token file also corrects dark mode combined with increased contrast: the old media rule made the primary ink dark on a dark surface. The file is 6,021 bytes, SHA-256 2e78ad7348ee7beaafda1f33ff5b112e7fd121654d7a9d39fc1ec681dee00019. The opted-in standalone Rally file is regenerated from that exact source. Its source anchor is 34a283df7bc58d337d29a1facdcae580dcc42a97; its original published preservation baseline and all prior revisions remain. The scheduling repair in #356 is retained.

The collision checker now verifies the complete AS1 generated region and omits only its byte-exact canonical token copy from the duplicate-owner census. Handwritten game, brand and shell declarations remain covered. A changed generated copy is rejected and an additional definition outside it remains a collision. This is not a whole-game exclusion.

Local proof on the actual built publication:

- 31/31 pages have one origin-root token link, one footer-only tagline, and the same 32 nonempty computed tokens.
- 68 ink/surface comparisons across cream, dark, and both increased-contrast combinations pass; minimum 5.122:1. Removed tokens, duplicate/header tagline and the original dark/increased-contrast defect are rejected, then restored green.
- The full shared-navigation suite passes with JavaScript and without it, including real keyboard operation, focus, narrow widths, pupil targets, search and theme journeys.
- Cross-estate source contracts and their mutation controls pass for both consumer candidates. Authored source wording, resources and app identities are unchanged.
- These are local candidate proofs, not live deployment claims. The normal release checks remain required.

## Exact admission decision

[admission-plan.json](admission-plan.json) specifies 29 changed rows across the three independent publishers. Ten old digests would need retirement to stay within the existing two-digest limit. No active registry has been changed. The previously approved T5R1 retirement was a different, single digest; this proposal does not treat it as blanket authority.

Five Site rows and the Lessons hub/subject and Apps hub retain their currently served digest alongside the candidate. The Site builder additionally has two distinct configured Apps source inputs (production 3ad0a7df, CI 924ab986): its two candidate Apps outputs occupy both slots together. Both old Site-builder Apps outputs remain recoverable with the immutable old builder and its original registry. The two owner-specific consumer builders preserve all other publication outputs, curriculum contracts, source-selection pins and existing admission rules. The Lessons resource-sizes-v1 derivation remains intact.

The old CSS digest remains beside the new one. Its ARRIVING marker can be removed because all three owning current main checkouts already contain the file. No third digest, wildcard, changed validator or wider exception is proposed.

## Release blockers and continuation

1. The ten enumerated admission retirements need a new bounded decision. Site and consumer release candidates must remain drafts until it is resolved.
2. Games remains on its owner-managed pins. #79's two PR runs require GitHub workflow approval; no approval or owner pin-dispatch capability is exposed here. #78/#79 and play-publication.json remain untouched. The canonical Play token was last observed returning 404.
3. Post-merge Rally provenance fails because the source-diff witness list treats assets/arcade/rally-hooks.js as an Education output. The publisher explicitly excludes that build input. Run 34725487870 / job 103638759187 matched all nine mandatory Education witnesses and the Rally handoff stub, then failed on the excluded input. Maker provenance repeats the same error; the professional live run was cancelled while waiting on it. A repair must bind this classification to the publisher's explicit exclusion policy and reject any actual leak, unexpected missing asset, stale publication or wrong source SHA. No provenance checker or workflow is changed by this candidate.

The master order's three-blocker ceiling ends this implementation pass. Preserve the reviewed candidates, finish the running checks, and request the bounded admission/provenance decision before further release work. Keep #456 itself, LP1 and other held lanes untouched; Part L remains behind Part T. There is no whole-main or whole-estate green claim.

## Saved consumer builders

- Lessons: 8f1f6b22fe8081f8d6672a8e7284571ea404aa86; tree f9d0a6807f8d5bd475e82bb879eeb7a2f936d9d9.
- Apps: 8f70dcb99d75c66c249a556c84bdc371018762f5; tree ae4026ec1cc77fc968d12ffb7d51096f59f5f061.

Both remote trees equal the locally reviewed trees. Their active registries are unchanged. The separate proposed registries pass the unmodified validators on all three publisher builds, including both configured Site Apps sources. This validates the proposal mechanically; it does not approve its ten retirements. The existing publication tests pass 28/28 and structural tests 11/11.
