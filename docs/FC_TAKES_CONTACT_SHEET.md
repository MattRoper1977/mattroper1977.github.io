# FC_TAKES_CONTACT_SHEET — Matt's voice, reported not touched

`TAKES=report-only` (D2). **Nothing here has been applied.** No agent may edit a take,
and no gate may ratify an edit by adopting it (red line 5). The pinned region in
`games/index.html` was never opened for writing in this run; `tools/verify_takes_pin.mjs`
was proved to fire on a deliberate mutation before any other work began, and is green at
the merge head.

Each row is **a question for you**, not a replacement string. Answer any of them in one
line and a later pass can apply it — changing the words and re-deriving
`data/takes-pin.json` in the same commit, where a reviewer sees both halves.

Takes read: **18**. Takes carrying one of the three mechanical issues: **4**.

None of this is a judgement on the writing. The voice is yours and it is the reason the
region is pinned at all — these are punctuation and spelling questions only.

| # | game | the take, as it stands | what caught my eye | question for you |
|--:|---|---|---|---|
| 1 | `/emberwild/` | Madebymatt meets creature collecting - shh, you know the one. | `Madebymatt` casing; spaced hyphen | Several small things — want me to list a suggested form for your yes/no? |
| 2 | `/olympics/` | The weather's too hot and you're not a pro - enjoy athletics at home. | spaced hyphen | An em dash to match the others, or keep the hyphen? |
| 3 | `/apexpool/` | Good at pool - be great with Apex Pool | no terminal punctuation; spaced hyphen | Several small things — want me to list a suggested form for your yes/no? |
| 4 | `/auroralinks/` | Can't afford your own clubs - the realism means you don't need any. | spaced hyphen | An em dash to match the others, or keep the hyphen? |

## What was NOT done

- No take was edited, reworded or re-punctuated.
- `data/takes-pin.json` was not touched.
- `tools/verify_takes_pin.mjs` was not touched.
- The pin fired on a deliberate mutation at FC0.7 (named the region, printed hashes, never
  the string) and is green at the head.