# Age assurance — decision note

**Nothing has been implemented, stubbed, scaffolded or defaulted.** This note
exists so the decision can be taken deliberately and separately, which is the
ruling already made. It is a recommendation, not a change.

Date: 2026-08-08 · Context: PR #99, `agent/accounts-members-mailing-2026-08-08`

---

## 1. What #99 currently does about age — measured, not assumed

**Nothing.** A search of the account, members, mailing, privacy and Supabase
surfaces of the branch for age, date-of-birth, under-13/16/18, guardian,
parental or COPPA terms returns exactly one hit, and it is a *negative*
statement:

> `privacy/index.html:24` — *"The site does not ask the account system for date
> of birth, school, pupil details, postal address or sensitive characteristics."*

Confirmed by construction as well as by search:

- `register(displayName, email, password)` in `assets/mbm-account.js` takes
  three fields. There is no age input, no self-declaration checkbox, no
  gate before it.
- `public.profiles` holds `id, name, display_name, tier, created_at,
  updated_at`. No age column, and no column that could carry one.
- The mailing form collects an email, a consent checkbox and a honeypot
  (`mailing-list/index.html:20–22`). No age field.
- Nothing anywhere branches on age.

So the current position is: **anyone of any age can create an account with an
email address and a password.** That is the status quo the decision acts on.

## 2. What the account model changed

This is the part that matters, and it is easy to state.

The prior design was **deliberately account-free**: seven-word codes, no
identity, data keyed to a code that nobody could attach to a person. Whatever
one thinks about age assurance in the abstract, that design made the question
close to moot — there was no identifiable person, so there was very little to
be wrong about.

#99 attaches a **durable identifier — an email address — to a pupil-facing
estate**. Three things change at once:

1. **Data becomes personal data in the ordinary sense.** An email address plus
   saved activity is an identifiable record, where before there was a code.
2. **The UK GDPR age-of-consent question becomes live.** In the UK the
   information-society-services threshold is **13**. Below it, consent for
   processing on a consent basis needs the holder of parental responsibility.
   Before #99 there was no consent-based processing of identifiable data to
   speak of.
3. **The ICO Age Appropriate Design Code becomes relevant** in a way it was not
   before. It applies to services *likely to be accessed by children* — and a
   site whose front door is lesson packs, ASDAN programmes and classroom games
   is squarely that, regardless of who the accounts are nominally aimed at.

There is one significant mitigation already in place, and it is worth full
credit: `member_data` carries **favourites only**, and the house rule excluding
pupil names, marks and register data is enforced on the way out *and* on the
way in (verified in the P1 report). The registers stay on-device. So the
exposure created is "an email address and a list of saved links", not a pupil
record. That is a genuinely small footprint — but "small" is not "none", and
the email address is the thing that changed.

**Who actually holds accounts** is the question that decides most of what
follows, and this note cannot answer it — see §5.

## 3. Options

### A. Do nothing. Accounts stay open to any age.
- **Costs:** the UK-GDPR-13 question is unanswered for any under-13 who signs
  up; no defence-in-depth if a pupil registers with a school email; the AADC
  position is weakest here.
- **Buys:** zero friction, zero code, nothing to maintain, no new personal data.
- **Honest note:** this is the current state, so choosing it deliberately is
  materially different from arriving at it by default — and considerably better.

### B. Self-declared age gate at registration (a checkbox or a year-of-birth field)
- **Costs:** one field, one branch, a line of privacy copy. If a year of birth
  is *stored*, it is new personal data about children — a real cost, and one
  that cuts against data minimisation. A checkbox ("I am 13 or over") avoids
  that by storing nothing.
- **Buys:** a documented position and a deliberate decision point for the user.
  Trivially bypassable, and everyone including the regulator knows it.
- **Honest note:** the ICO's stated view is that self-declaration is
  proportionate for **low-risk** services. This is low-risk by data footprint
  (email + saved links, no messaging, no user-to-user contact, no profiling, no
  ads). That argument is available here and it is a good one.

### C. Accounts for adults only — teachers and parents — stated and enforced by copy
- **Costs:** a positioning decision. Needs the account copy, the Members page
  and the privacy page to say it consistently, and it constrains what accounts
  can ever become. Still self-declared in practice.
- **Buys:** the cleanest story by some distance. Sidesteps the age-of-consent
  question rather than answering it, because the intended account holder is an
  adult. Fits the estate as it stands: accounts currently buy *favourites*,
  which is a professional convenience, not a pupil feature. Pupils keep using
  the games and lessons signed-out, exactly as they do today.
- **Honest note:** it only holds if pupils genuinely have no reason to register.
  That is true of favourites; it would stop being true the moment an account
  gates progress, saves or anything a pupil wants.

### D. Verified age assurance (a third-party provider)
- **Costs:** disproportionate. A vendor, a fee, a new processor in the privacy
  notice, and — the decisive objection — it means collecting **more** identity
  data about children in order to protect them, on a static site whose entire
  architecture is "no build step, nothing uploaded".
- **Buys:** near-nothing that this estate's risk profile needs.
- **Honest note:** listed for completeness. It would be the wrong answer here.

## 4. Recommendation

**C, with B as its mechanism: position accounts as adult (teacher/parent), and
back it with a single self-declaration at registration.**

Reasoning:

1. **It matches what accounts actually do.** They buy cross-device favourites.
   That is a professional convenience. No pupil-facing feature depends on
   registering, and the whole estate works signed-out — so nothing is taken
   away from a pupil by this position.
2. **It is proportionate to a genuinely small footprint.** Email address plus
   saved links, with pupil records structurally excluded from sync and that
   exclusion under test. Verified assurance would be heavier than the risk.
3. **It stores no new data about children.** A declaration checkbox, not a date
   of birth. Better under data minimisation than B alone, and it is the reason
   to prefer a checkbox over a year field.
4. **It is one consistent sentence**, not an architecture: the same claim on
   `/account/`, `/members/` and `/privacy/`.

The load-bearing condition: **this holds only while accounts stay a
teacher/parent convenience.** If an account ever gates pupil progress or saves,
the answer changes and this note should be reopened. Worth writing that trigger
down next to the decision.

## 5. What this note cannot settle — for Matt

- **Who is actually expected to hold accounts?** If the honest answer is "some
  pupils will", C weakens sharply and the decision is between A and B. This is
  the single question that determines the rest, and only Matt can answer it.
- Whether Made by Matt is presented to schools in a way that makes the AADC's
  "likely to be accessed by children" test unambiguous. My reading is that it
  probably is, but that is a judgement about positioning, not code.
- Whether any of this needs a view from someone qualified. This note reports
  and recommends; it does not advise on the law.

---

**Reminder on scope:** no age gate, checkbox or date-of-birth field has been
added, stubbed or prepared anywhere in the branch. The only change here is this
file.
