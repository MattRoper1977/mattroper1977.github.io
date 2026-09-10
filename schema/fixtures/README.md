# Validator fixtures — not published content

These are **fixtures**, not tasks anyone will see. They exist so
`tools/verify_diagnostic_task_schema.mjs` exercises the schema against something
real-shaped.

Order S §S2.4 asked for "both provided sample tasks (electrolysis, calorimetry)"
to be validated. **Neither was ever supplied as a file**, and this estate carries
no diagnostic-task content at all — 0 files contain `classroomRole`. So these two
were written to the named topics to exercise every required field, both register
tiers, the optional `grow` fallback, `unitAwardRef`, and a `supportGiven` entry.

They carried an explanatory `_fixture` key when first written, and the schema
**rejected them** — `additionalProperties: false` is what stops a `learnerName`
field appearing here later (§S6.3), and it worked on its first contact with a
stray key. The note lives here instead.
