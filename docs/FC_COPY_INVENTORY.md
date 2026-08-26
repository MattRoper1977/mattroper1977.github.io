# FC_COPY_INVENTORY — the diff base for order FC

Per-page copy as the record held it at `main` (4d355e8), the before-picture §FC1.2 requires.
`CHANGED` marks a string this run rewrote; everything else is untouched.

Source of truth is `data/audience-homepages.json`, rendered by
`tools/render_audience_homepages.py`. Nothing in `/for/*/index.html` is hand-edited (R7).

## pupils — `/for/pupils/`

- **hero heading**: Play first. Explore next. Learn your way.
- **hero lead**: Open a real Made by Matt game straight away, then move into lessons, pathways and creative activities when you are ready.
- **noteTitle (guard)**: Public content stays open
- **note (guard clause)**: Public games, lessons and learning areas can be explored without creating an account. Accounts and the mailing list are for adults. Ask a parent, carer, teacher or another trusted adult before using any email or account feature.

**Strings changed by FC: 0**

### section [0] — kicker: 'Games first'
- heading: Made by Matt's Top Picks
- lead: Hand-picked games that earn their place by being played, not by being new.

### section [1] — kicker: 'Every game'
- heading: Browse by kind of game

### section [2] — kicker: 'Not sure what to choose?'
- heading: Surprise me
- lead: Pick one game at random from every game on this page. The choice is made in your browser and needs no third-party service.

### section [3] — kicker: '(none)'
- heading: Recently explored
- lead: These public items are remembered only on this device. You can clear them at any time.

### section [4] — kicker: 'Learn and make'
- heading: Open something to learn from
- lead: Move from play into lessons, pathways and creation without needing an account.
  - *(feature)* **Browse the Lesson Hub** — Find lesson packs, schemes and print sets by subject, year and programme.
  - *(feature)* **BUILD, GROW and LAUNCH** — Explore pathway materials and activities organised within the Lesson Hub.
  - *(feature)* **Make something** — Use the Made by Matt Studio Suite for art, audio, animation, web pages and more.


## teachers — `/for/teachers/`

- **hero heading**: Start with the teaching task.
- **hero lead**: Move from what you need to do—teach, plan, assess, capture evidence, manage information or create—into the right Made by Matt material.
- **noteTitle (guard)**: Capability without unsupported claims
- **note (guard clause)**: Use these as discovery routes for your own planning, not as claims about outcomes, attainment or approval by any awarding body or school. An adult or teacher account is optional and supports account-backed features such as carrying saved Made by Matt shortcuts between devices. Teacher updates use a separate double-opt-in mailing list; creating an account never subscribes you.

**Strings changed by FC: 2**

| path | before | after |
|---|---|---|
| `.sections[1].lead` | Use canonical Made by Matt destinations rather than hunting through separate collections. | Go straight to the main Made by Matt destinations instead of hunting through separate collections. |
| `.sections[3].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |

### section [0] — kicker: 'Practical routes'
- heading: What do you need to do?
- lead: Each shortcut opens the deeper teacher search with the relevant task already selected.

### section [1] — kicker: 'Pathways and teaching'
- heading: Move from curriculum to classroom
- lead: Use canonical Made by Matt destinations rather than hunting through separate collections.
  - **Lesson Hub** — Search classroom-ready lessons, schemes and teaching packs.
    CTA: `Open the Lesson Hub` -> `/Lessons/`
  - **BUILD** — BUILD is the pathway for building core skills. Find BUILD pathway hubs, sequences and resources.
    CTA: `View BUILD material` -> `/teach/?pathway=BUILD`
  - **GROW** — GROW is the pathway for growing confidence through guided iteration. Find GROW pathway hubs, sequences and resources.
    CTA: `View GROW material` -> `/teach/?pathway=GROW`
  - **LAUNCH** — LAUNCH is the pathway for independent mastery. Find LAUNCH pathway hubs, sequences and resources.
    CTA: `View LAUNCH material` -> `/teach/?pathway=LAUNCH`

### section [2] — kicker: 'Workflow tools'
- heading: Evidence, assessment and learner information
- lead: Direct routes to genuine Made by Matt browser tools.
  - **Evidence Binder** — Capture and tag work for portfolios.
    CTA: `Open Evidence Binder` -> `/Matt-s-Apps-/Evidence_Binder.html`
  - **Data Manager Studio** — Work with cohorts, learner IDs, evidence coverage and review queues locally.
    CTA: `Open Data Manager Studio` -> `/Matt-s-Apps-/Data_Manager_Studio.html`
  - **UAS Register** — Date-stamp outcomes, file evidence and export a summary.
    CTA: `Open UAS Register` -> `/uas/`
  - **ASDAN Register** — Track PEQ and Short Course evidence and sign-off.
    CTA: `Open ASDAN Register` -> `/asdan/`
  - **Rubric & Feedback Studio** — Mark against a rubric and build feedback.
    CTA: `Open Rubric & Feedback Studio` -> `/Matt-s-Apps-/Rubric_Studio.html`
  - **Exit Ticket & Quick Marks** — Run an immediate class understanding check.
    CTA: `Open Exit Ticket` -> `/Matt-s-Apps-/Exit_Ticket.html`

### section [3] — kicker: 'See the platform'
- heading: Teaching and creation in context
- lead: Genuine Made by Matt imagery from the live Lesson Hub and Studio Suite.
  - *(feature)* **Every lesson collection** — Browse lesson packs, schemes and print sets by subject, year or programme.
  - *(feature)* **BUILD, GROW and LAUNCH** — Search evidence-aware pathway material across the canonical catalogue.
  - *(feature)* **Made by Matt Studio Suite** — Choose tools for art, audio, animation, documents, whiteboards and more.
  - *(feature)* **The Made by Matt Arcade** — Browse the browser games used in lessons, tutor time and enrichment.

### section [4] — kicker: 'Owner-controlled demonstration'
- heading: Watch only when you choose
- lead: The local poster loads first. YouTube receives no request until the play control is deliberately activated.

### section [5] — kicker: '(none)'
- heading: Recently explored
- lead: A local-only shortcut back to public Made by Matt items.


## parents — `/for/parents-carers/`

- **hero heading**: See what is here, then choose together.
- **hero lead**: A calm overview of Made by Matt games, lessons and public learning resources, with clear routes and plain-English explanations.
- **noteTitle (guard)**: Clear boundaries
- **note (guard clause)**: Made by Matt provides public educational content and browser tools. It does not provide statutory safeguarding, medical or clinical advice. Where official external resources are included, the publisher is clearly identified.

**Strings changed by FC: 3**

| path | before | after |
|---|---|---|
| `.sections[1].items[1].title` | Use the audience homepage | Send them to the pupil homepage |
| `.sections[1].items[1].description` | The pupil face keeps adult account and mailing actions out of the main learner journey. | It keeps account and mailing links off the pages your child uses. |
| `.sections[2].lead` | These links open filtered views in the Professional Education Hub before any external navigation. | These links open a filtered list in the Professional Education Hub before anything takes you off Made by Matt. |

### section [0] — kicker: 'Explore together'
- heading: Try the real thing together
- lead: Open the same games, lessons and resources that are used in real classrooms — not cut-down samples. Try one together and see what fits today; nothing here assumes a good week.
  - *(feature)* **Apex Kick** — A quick physics game built around planning a free kick.
  - *(feature)* **Lesson Hub** — Browse classroom material by subject, year and programme.
  - *(feature)* **Make and create** — Explore browser-based tools for art, audio, animation and documents.

### section [1] — kicker: 'Helpful starting points'
- heading: A few practical ways to use the platform
- lead: General suggestions for exploring public content; they are not statutory, safeguarding or clinical advice.
  - **Choose together** — Open the game or resource first and decide whether it suits the learner, device and moment.
    CTA: `—` -> `—`
  - **Use the audience homepage** — The pupil face keeps adult account and mailing actions out of the main learner journey.
    CTA: `—` -> `—`
  - **Keep the route simple** — Use direct Play and Open actions rather than sending a learner through several hubs.
    CTA: `—` -> `—`
  - **Check the source label** — The Education Hub clearly separates Made by Matt material from official external guidance.
    CTA: `—` -> `—`

### section [2] — kicker: 'Clearly labelled external help'
- heading: Trusted education and online-safety sources
- lead: These links open filtered views in the Professional Education Hub before any external navigation.
  - **NSPCC resources** — Find NSPCC safeguarding and online-safety resources in the curated external collection.
    CTA: `View NSPCC sources` -> `/education-hub/?origin=external&source=NSPCC`
  - **Childnet resources** — Find Childnet online-safety resources for families and education settings.
    CTA: `View Childnet sources` -> `/education-hub/?origin=external&source=Childnet`
  - **CEOP Safety Centre** — Reach the clearly labelled CEOP Safety Centre entries in the external collection.
    CTA: `View CEOP sources` -> `/education-hub/?origin=external&source=CEOP+Safety+Centre`

### section [3] — kicker: 'Questions families often ask'
- heading: Parent and carer FAQ
  - **** —
    CTA: `—` -> `—`
  - **** —
    CTA: `—` -> `—`
  - **** —
    CTA: `—` -> `—`
  - **** —
    CTA: `—` -> `—`


## schools — `/for/schools-semh/`

- **hero heading**: A clearer map for schools and SEMH settings.
- **hero lead**: Start with the teaching or workflow need, then move into lessons, pathways, tools and clearly labelled authoritative guidance.
- **noteTitle (guard)**: Capability without unsupported claims
- **note (guard clause)**: Made by Matt is not described as approved for SEMH or endorsed by a school. The page describes genuine platform capabilities and routes only.

**Strings changed by FC: 7**

| path | before | after |
|---|---|---|
| `.sections[0].items[1].description` | Reach registers, evidence tools and portfolio-oriented resources without invented approval claims. | Reach registers, evidence tools and portfolio resources — with no claim of approval attached. |
| `.sections[1].items[3].description` | Search all canonical internal destinations. | Search every Made by Matt lesson, resource, tool and app in one place. |
| `.sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `.sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `.sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `.sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `.utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

### section [0] — kicker: 'In your setting'
- heading: Start with what your setting is carrying
- lead: Go straight to the lessons, tools and resources and judge them against the pupils, routines and pressures you already know. This was built inside an SEMH alternative provision, which tells you where it came from and nothing about whether it will fit your setting.
  - **Find adaptable teaching material** — Search lessons, schemes and support resources by subject, pathway and format.
    CTA: `—` -> `—`
  - **Build evidence-aware workflows** — Reach registers, evidence tools and portfolio-oriented resources without invented approval claims.
    CTA: `—` -> `—`
  - **Support classroom routines** — Find practical browser tools for planning, quick checks and organisation.
    CTA: `—` -> `—`
  - **Review professional guidance** — Use publisher-labelled official and sector sources in the Education Hub.
    CTA: `—` -> `—`

### section [1] — kicker: 'Platform map'
- heading: Move to the right Made by Matt surface
- lead: The same public platform, organised around common education workflows.
  - **Teach Hub** — Task-first discovery for teachers and education staff.
    CTA: `Open the Teach Hub` -> `/teach/`
  - **Lesson Hub** — Lessons, schemes and pathway material.
    CTA: `Open the Lesson Hub` -> `/Lessons/`
  - **Tools Hub** — Evidence, data, assessment and classroom tools.
    CTA: `Open the Tools Hub` -> `/tools/`
  - **Resource Catalogue** — Search all canonical internal destinations.
    CTA: `Search all internal material` -> `/resources/`

### section [2] — kicker: 'Genuine platform views'
- heading: Lessons, pathways and creation
- lead: Real Made by Matt artwork and product captures—not concept products.
  - *(feature)* **Lesson Hub** — Browse lesson packs, schemes and pathway materials.
  - *(feature)* **BUILD, GROW and LAUNCH** — Search evidence-aware pathway material across the canonical catalogue.
  - *(feature)* **Made by Matt Studio Suite** — Explore classroom, evidence, data and creation tools.

### section [3] — kicker: 'Authoritative external material'
- heading: Open the Professional Education Hub
- lead: Made by Matt material and external publisher resources remain visibly separate.
  - **Relevant official and sector material** — Use the local curated dataset and filters before deliberately leaving Made by Matt.
    CTA: `Search authoritative resources` -> `/education-hub/?origin=external&audience=schools-semh`
  - **Made by Matt internal catalogue** — Search only the canonical Made by Matt index for lessons, resources, tools and apps.
    CTA: `Search internal material` -> `/resources/`


## trusts — `/for/trusts/`

- **hero heading**: A platform map for trusts.
- **hero lead**: Review genuine Made by Matt teaching, resource and workflow surfaces alongside date-aware official guidance.
- **noteTitle (guard)**: Capability without unsupported claims
- **note (guard clause)**: No trust deployment statistics, procurement claims, licensing packages or official endorsement are implied. Contact uses the established Made by Matt email only.

**Strings changed by FC: 6**

| path | before | after |
|---|---|---|
| `.sections[0].items[0].description` | Explore subject, pathway and format coverage across the canonical internal index. | Explore subject, pathway and format coverage across everything on Made by Matt. |
| `.sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `.sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `.sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `.sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `.utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

### section [0] — kicker: 'Across your schools'
- heading: Start with what you need to compare across schools
- lead: Open the live materials behind each route and judge the curriculum, tools and accessibility from the work itself, across more than one school context. Nothing here has been approved, adopted or measured for you — that judgement is yours.
  - **Map teaching content** — Explore subject, pathway and format coverage across the canonical internal index.
    CTA: `—` -> `—`
  - **Review workflow tools** — See genuine evidence, register, data and feedback tools without assuming a procurement model.
    CTA: `—` -> `—`
  - **Find date-aware guidance** — Distinguish current, upcoming and evergreen official publications by effective date.
    CTA: `—` -> `—`
  - **Understand boundaries** — No fabricated trust adoption, licensing package or accreditation claim is presented.
    CTA: `—` -> `—`

### section [1] — kicker: 'Platform map'
- heading: Move to the right Made by Matt surface
- lead: The same public platform, organised around common education workflows.
  - **Teach Hub** — Task-first routes across lessons, pathways and tools.
    CTA: `Open the Teach Hub` -> `/teach/`
  - **Education Hub** — Made by Matt and authoritative external resources, clearly separated.
    CTA: `Open the Education Hub` -> `/education-hub/`
  - **Resource Catalogue** — Search one deterministic internal index.
    CTA: `Search the catalogue` -> `/resources/`
  - **Tools Hub** — Browse genuine teacher and workflow tools.
    CTA: `Open the Tools Hub` -> `/tools/`

### section [2] — kicker: 'Genuine platform views'
- heading: Lessons, pathways and creation
- lead: Real Made by Matt artwork and product captures—not concept products.
  - *(feature)* **Lesson Hub** — Browse lesson packs, schemes and pathway materials.
  - *(feature)* **BUILD, GROW and LAUNCH** — Search evidence-aware pathway material across the canonical catalogue.
  - *(feature)* **Made by Matt Studio Suite** — Explore classroom, evidence, data and creation tools.

### section [3] — kicker: 'Authoritative external material'
- heading: Open the Professional Education Hub
- lead: Made by Matt material and external publisher resources remain visibly separate.
  - **Relevant official and sector material** — Use the local curated dataset and filters before deliberately leaving Made by Matt.
    CTA: `Search authoritative resources` -> `/education-hub/?origin=external&audience=trusts`
  - **Made by Matt internal catalogue** — Search only the canonical Made by Matt index for lessons, resources, tools and apps.
    CTA: `Search internal material` -> `/resources/`


## councils — `/for/councils-organisations/`

- **hero heading**: Discovery for councils and education organisations.
- **hero lead**: Move from organisational priorities into genuine Made by Matt content, tools and clearly sourced external education material.
- **noteTitle (guard)**: Capability without unsupported claims
- **note (guard clause)**: Made by Matt is not presented as endorsed by a council or education organisation. No proposal process, customer list or commercial arrangement is invented.

**Strings changed by FC: 6**

| path | before | after |
|---|---|---|
| `.sections[1].items[2].description` | Search all canonical internal destinations. | Search every Made by Matt lesson, resource, tool and app in one place. |
| `.sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `.sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `.sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `.sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `.utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

### section [0] — kicker: 'For the question in front of you'
- heading: Start with the question you are being asked
- lead: Open the live materials behind each route and see what is already available to schools and settings, without waiting for a brochure or a summary. Treat it as work to look at, not as commissioned provision, approval or a compliance position.
  - **Explore public learning provision** — Map games, lessons, pathway resources and creative apps across the public platform.
    CTA: `—` -> `—`
  - **Find professional resources** — Use audience, source and jurisdiction filters in the Education Hub.
    CTA: `—` -> `—`
  - **Review practical tools** — See genuine classroom, evidence and data tools without an invented service offer.
    CTA: `—` -> `—`
  - **Use direct contact** — Contact Made by Matt only through the established email route when a conversation is needed.
    CTA: `—` -> `—`

### section [1] — kicker: 'Platform map'
- heading: Move to the right Made by Matt surface
- lead: The same public platform, organised around common education workflows.
  - **Complete platform** — See the broad Made by Matt platform composition.
    CTA: `Explore the live platform` -> `/main/`
  - **Professional Education Hub** — Search internal and authoritative external resources.
    CTA: `Open the Education Hub` -> `/education-hub/`
  - **Resource Catalogue** — Search all canonical internal destinations.
    CTA: `Search the catalogue` -> `/resources/`
  - **Games and creative apps** — Explore genuine public Made by Matt products.
    CTA: `Browse games` -> `/games/`

### section [2] — kicker: 'Genuine platform views'
- heading: Lessons, pathways and creation
- lead: Real Made by Matt artwork and product captures—not concept products.
  - *(feature)* **Lesson Hub** — Browse lesson packs, schemes and pathway materials.
  - *(feature)* **BUILD, GROW and LAUNCH** — Search evidence-aware pathway material across the canonical catalogue.
  - *(feature)* **Made by Matt Studio Suite** — Explore classroom, evidence, data and creation tools.

### section [3] — kicker: 'Authoritative external material'
- heading: Open the Professional Education Hub
- lead: Made by Matt material and external publisher resources remain visibly separate.
  - **Relevant official and sector material** — Use the local curated dataset and filters before deliberately leaving Made by Matt.
    CTA: `Search authoritative resources` -> `/education-hub/?origin=external&audience=councils-organisations`
  - **Made by Matt internal catalogue** — Search only the canonical Made by Matt index for lessons, resources, tools and apps.
    CTA: `Search internal material` -> `/resources/`


## partners — `/for/partners/`

- **hero heading**: Explore the genuine Made by Matt portfolio.
- **hero lead**: Use the canonical catalogue to inspect real games, lessons, apps, tools and education hubs—without fictional clients, programmes or proposal routes.
- **noteTitle (guard)**: Capability without unsupported claims
- **note (guard clause)**: No partnership scheme, customer logo, partner count, licensing programme, proposal button or commercial arrangement is invented. The page presents only genuine public work and the established contact email.

**Strings changed by FC: 7**

| path | before | after |
|---|---|---|
| `.lead` | Use the canonical catalogue to inspect real games, lessons, apps, tools and education hubs—without fictional clients, programmes or proposal routes. | Use the full catalogue to inspect real games, lessons, apps, tools and education hubs — with no fictional clients, programmes or proposal routes. |
| `.sections[1].items[3].description` | Search the complete canonical internal portfolio. | Search the complete Made by Matt portfolio. |
| `.sections[2].lead` | Real Made by Matt artwork and product captures—not concept products. | Real Made by Matt artwork and screenshots — not mock-ups. |
| `.sections[2].features[1].description` | Search evidence-aware pathway material across the canonical catalogue. | Search evidence-aware pathway material across the whole catalogue. |
| `.sections[3].items[0].description` | Use the local curated dataset and filters before deliberately leaving Made by Matt. | Use the curated list and filters here before you follow a link off Made by Matt. |
| `.sections[3].items[1].description` | Search only the canonical Made by Matt index for lessons, resources, tools and apps. | Search only Made by Matt for lessons, resources, tools and apps. |
| `.utilities[1].description` | One canonical internal search index. | One search across everything on Made by Matt. |

### section [0] — kicker: 'Closest to your work'
- heading: Start with the part of the work you know best
- lead: Open the live games, apps, tools and resources and judge the work in the area closest to yours. Looking commits nobody to anything, and no relationship follows from reading it.
  - **Explore the portfolio** — Search genuine public products by content type, source, subject and audience.
    CTA: `—` -> `—`
  - **See design breadth** — Move between games, lesson systems, creative apps and professional browser tools.
    CTA: `—` -> `—`
  - **Review provenance** — Product imagery and source manifests are tied to real routes and pinned repository commits.
    CTA: `—` -> `—`
  - **Use the established contact** — Contact uses contactmadebymatt@gmail.com; no invented proposal or licensing action appears.
    CTA: `—` -> `—`

### section [1] — kicker: 'Platform map'
- heading: Move to the right Made by Matt surface
- lead: The same public platform, organised around common education workflows.
  - **Games** — Browse genuine Made by Matt browser games and artwork.
    CTA: `Browse the games` -> `/games/`
  - **Lesson Hub** — Explore the live lesson and resource estate.
    CTA: `Open the Lesson Hub` -> `/Lessons/`
  - **Apps and tools** — Browse creative, classroom and workflow applications.
    CTA: `Browse the apps` -> `/Matt-s-Apps-/`
  - **Resource Catalogue** — Search the complete canonical internal portfolio.
    CTA: `Search the portfolio` -> `/resources/`

### section [2] — kicker: 'Genuine platform views'
- heading: Lessons, pathways and creation
- lead: Real Made by Matt artwork and product captures—not concept products.
  - *(feature)* **Lesson Hub** — Browse lesson packs, schemes and pathway materials.
  - *(feature)* **BUILD, GROW and LAUNCH** — Search evidence-aware pathway material across the canonical catalogue.
  - *(feature)* **Made by Matt Studio Suite** — Explore classroom, evidence, data and creation tools.
  - *(feature)* **The Made by Matt Arcade** — Browse the browser games used in lessons, tutor time and enrichment.

### section [3] — kicker: 'Authoritative external material'
- heading: Open the Professional Education Hub
- lead: Made by Matt material and external publisher resources remain visibly separate.
  - **Relevant official and sector material** — Use the local curated dataset and filters before deliberately leaving Made by Matt.
    CTA: `Search authoritative resources` -> `/education-hub/?origin=external&audience=partners`
  - **Made by Matt internal catalogue** — Search only the canonical Made by Matt index for lessons, resources, tools and apps.
    CTA: `Search internal material` -> `/resources/`

