# PRX1 closing-boundary census — unfixed findings

Measured 2026-09-12T09:24:43.989408+00:00 at Site `30e86ad64bd1aaaf3a6887f9eb4cd4d9dbcde436`.
This reconstruction supersedes no previous measurement. RF1's 133, RF2's 137,
and RF3's reported 129 used different scan rules; they are historical observations,
not denominators for this scan. The missing RF3 commit could not be recovered.

## Method and population

`git ls-files`: 1155 tracked files. Scan all 577 tracked
Python, JS/MJS/CJS/TS, shell, YAML and HTML/HTM files, including inline source and
templates. Find closing-tag literals on lines with locating/patching calls; refine
against the first argument, supplement Python multiline/triple-quoted calls with
AST, and record read-through classifications below. Count one row per source line.
All broad hits, including false positives and bundled third-party hits, remain
visible. This is a static literal census; computed tag names require tracing their
callers and are not inferred to be safe by an absent literal.

Classification totals: {"BALANCED": 1, "MEASURING": 163, "NOT LOCATOR": 74, "VENDOR/COMPILED": 9, "WRITING": 33}.
WRITING includes exact-fragment replacements and boundary extractors feeding an
output writer. MEASURING includes controls that mutate scratch test inputs. Neither
is a severity count. BALANCED is explicitly outside the first-close defect class.

## Findings for separate orders

- `domain-split/education_discovery.py:161`: first `</div>` after the toolbar anchor;
  div nesting can truncate it. Leave unfixed.
- `domain-split/build_publications.py:156`: first closing main bounds preview-body
  extraction. Leave unfixed.
- `domain-split/build_publications.py:212`, `tools/render_audience_homepages.py:858`,
  and `tools/stamp_chrome.py:98`: first-close style/article/button extraction.
  Leave unfixed; parser sensitivity and execution ownership need their own review.
- The two authorised header/main call sites are recorded at their **main** line
  numbers below; #350 alone replaces those two mechanisms.

P5.5: a carried figure acquires authority by repetition. Any future order quoting
these totals must cite this source, measurement time and method, or call them
unverified. This entry does not repair any additional writer.

## Full candidate ledger

| File and line at measured source | Classification | Reason | Source excerpt |
|---|---|---|---|
| `.github/workflows/mbm-audience-discovery-closeout.yml:488` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `io.open(p,'w',encoding='utf-8').write(s.replace('<main id="main">','<main id="main"><p>100% GDPR compliant.</p>',1))` |
| `.github/workflows/mbm-audience-discovery-closeout.yml:807` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace('</head>', '<style>.mbm-sw{display:none!important}</style></head>', 1)` |
| `.github/workflows/mbm-audience-discovery-closeout.yml:845` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace('</head>', '<style>.mbm-sw{width:40px!important;height:40px!important}</style></head>', 1)` |
| `.github/workflows/mbm-audience-discovery-closeout.yml:876` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = re.sub(r'  <url>\n    <loc>https://madebymatt.uk/apexcurl/</loc>.*?</url>\n', '', s, flags=re.S)` |
| `.github/workflows/mbm-audience-discovery-closeout.yml:979` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = re.sub(r'<div class="mf-hero-search">.*?</form></div>', '', s, count=1, flags=re.S)` |
| `.github/workflows/neonbreach-verify.yml:64` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const tampered = html.replace('</body>', '<!-- x --></body>');` |
| `_tfr2/input_v4.html:160` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `&#96;+l.stack}}var Ki=Object.prototype.hasOwnProperty,Hf=Ae.unstable_scheduleCallback,pi=Ae.unstable_cancelCallback,nb=Ae.unstable_shouldYield,sb=Ae.unstable_requestPaint,La=Ae.unstable_now,ib=Ae.unstable_getCurren` |
| `_tfr2/input_v4.html:1009` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderAura(){if(!refs.auraGrid)return;refs.auraMeta.textContent=marks()+" MARKS · "+crests()+" CRESTS";var m=marks(),c=crests();refs.auraGrid.innerHTML="";AURAS.forEach(function(a){var owned=state.owne` |
| `_tfr2/titanforge.html:160` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `&#96;+l.stack}}var Ki=Object.prototype.hasOwnProperty,Hf=Ae.unstable_scheduleCallback,pi=Ae.unstable_cancelCallback,nb=Ae.unstable_shouldYield,sb=Ae.unstable_requestPaint,La=Ae.unstable_now,ib=Ae.unstable_getCurren` |
| `_tfr2/titanforge.html:1015` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderAura(){if(!refs.auraGrid)return;refs.auraMeta.textContent=marks()+" MARKS · "+crests()+" CRESTS";var m=marks(),c=crests();refs.auraGrid.innerHTML="";AURAS.forEach(function(a){var owned=state.owne` |
| `apexgolf/index.html:532` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderTitleMarkup(mode){var title=AG.gameTitle(),parts=title.split(/\s+/),lead=parts.shift()\|\|title,tail=parts.join(' ');return '<section class="screen screen--title" data-mode="'+esc(mode)+'" data-r` |
| `apexgolf/index.html:656` | NOT LOCATOR | read-through: escaping/report or testing a fixed literal, no boundary located | `var out={ok:rows.every(function(r){return r.pass;}),width:innerWidth,height:innerHeight,reducedMotion:reduced,loadMs:load,fps:fps,rows:rows};document.body.innerHTML='<pre id="ag-contract-results">'+JSON.stringi` |
| `apexkick/index.html:4184` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `if(inMatch){AK.Input.enable(false);$('hud').classList.add('hidden');$('lanScore').classList.remove('on');setBroadcast(false);screen('LAN match ended','<div class="sect" style="text-align:center"><div class="v3t` |
| `apexkick/index.html:4225` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function updateLanPairStatus(msg,ok){var e=$('pairStatus');if(e){e.className='pair-status'+(ok?' ok':'');e.innerHTML='<i></i><span>'+String(msg).replace(/[<>]/g,'')+'</span>'}var b=$('bLanStart');if(b)b.disable` |
| `apexkick/index.html:4759` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `var badges=(pp.season.badges\|\|[]).map(function(b){return '<div class="rowline"><span>◆ '+String(b).replace(/[<>]/g,'')+'</span><b>EARNED</b></div>'}).join('')\|\|'<p class="note">Play Championship modes to ea` |
| `apexkick/index.html:4837` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `Object.keys(P.mastery\|\|{}).map(function(k){return '<div class="rowline"><span>'+k.replace(/_/g,' ')+'</span><b>'+masteryLevel(P.mastery[k]\|\|0)+' · '+(P.mastery[k]\|\|0)+'</b></div>'}).join('')+'</div>'+` |
| `apexpool/index.html:338` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `var body='<div class="title-wrap"><div class="rackmark" aria-hidden="true"><div class="tri"></div><div class="ballhero b1">1</div><div class="ballhero b8">8</div><div class="ballhero b9">9</div></div><h1 class=` |
| `apexpool/index.html:346` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function showShop(){var groups=['felt','cue','balls'].map(function(type){return'<div class="sect"><h3>'+type+'</h3><div class="shop-grid">'+SHOP.filter(function(i){return i.type===type}).map(function(i){var own` |
| `apexpool/index.html:350` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `var next=findTournamentMatch(t),foot='<button class="btn sec" id="backTour">Back</button>'+(next&&next.indexOf(0)>=0?'<button class="btn" id="playTour">Play your match</button>':'<button class="btn" id="advance` |
| `apextennis/index.html:239` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function finishMatch(){G.running=false;$('hud').classList.add('hidden');$('hud').setAttribute('aria-hidden','true');var won=G.score.winner===0;if(won){progress.matchWins++;if(!G.practice){progress.completed.ind` |
| `apexvelodrome/index.html:1731` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `var cos=$('v4CosmeticShop');cos.textContent='';catalog.cosmetics.forEach(function(item){var row=document.createElement('div'),copy=document.createElement('div');row.className='v4Item';copy.innerHTML='<b></b><sm` |
| `asdan/app.html:910` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `for(const ev of evs)h+=&#96;<div class="evcell"><img class="evthumb" src="${evURL(ev)}" alt="${esc(ev.ref)}" data-evview="${ev.id}"><div class="evref">${esc(ev.ref.split("/").slice(1).join("/"))}</div></div>&#96;;` |
| `asdan/moderation-lab/index.html:1501` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `host.innerHTML=targets.map(t=>&#96;<button type="button" class="chip target-chip ${selected.has(t.id)?"on":""}" data-ev-target="${t.id}"><span><strong>${esc(t.short)}</strong><small>${esc(t.label.replace(&#96;${t.short` |
| `asdan/moderation-lab/index.html:1597` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const ws=S.witnessStatements.find(x=>x.id===id);if(!ws)return;activeEvidenceLinkId=&#96;ws:${id}&#96;;const pu=getPupil(ws.pupilId),p=getProgramme(ws.programId),target=findTarget(p,ws.targetId);$("#evidence-view-title"` |
| `biopunkhive/index.html:343` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function openQte(forced){if(runtime.qte)return false;despawnSpore();var diff=BHCore.qteDifficulty(state.mutagens),types=['nodes','sequence','frequency'],type=forced&&types.indexOf(forced)>=0?forced:types[Math.f` |
| `biopunkhive/index.html:346` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderAchievements(){var box=$('achievementGrid');box.innerHTML='';BHCore.ACHIEVEMENTS.forEach(function(a){var on=unlocked.indexOf(a.id)>=0,e=document.createElement('article');e.className='achievement'` |
| `crownbadge/index.html:705` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const land=islandPath(state.seed),sectors=state.sectors.map((s,i)=>{const incident=state.incidents.find(n=>n.sectorId===s.id),fill=colourFor(s),status=s.secured?'SECURED':s.control==='lost'?'LOST':s.control==='` |
| `crownbadge/index.html:726` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function stationSVG(state){const ready=state.officers.filter(o=>o.status==='ready').length;return&#96;<svg viewBox="0 0 840 330" class="station-svg" role="img" aria-label="Procedural cutaway of Crown Watch Headquar` |
| `crownbadge/index.html:1085` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `$('incidentSheetBody').innerHTML = &#96;<div class="incident-hero"><span class="eyebrow">${esc(incident.type.toUpperCase().replace('_', ' '))}</span><h2 id="incidentTitle">${esc(incident.name)}</h2><p>${esc(Core.IN` |
| `docs/hc3-recovery/concurrent-save-reproduction.cjs:5` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('const SAVE_VERSION = 3;'));` |
| `domain-split/added-this-half-term.js:73` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `return '<a class="acard" href="' + esc(safeHref(/^https?:\/\//i.test(path) ? path : '/Lessons/' + path)) + '" data-resource-path="' + esc(path) + '"><span class="when">' + esc(fmtDay(r.added)) + '</span><h3>' +` |
| `domain-split/audience_discovery.py:232` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `document, replaced = re.subn(r'<main\b[^>]*>.*?</main>', lambda _: main, document, count=1, flags=re.S)` |
| `domain-split/audience_discovery.py:235` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `document = re.sub(r'<title>.*?</title>', '<title>'+esc(audience['label'])+' · Made by Matt</title>', document, count=1, flags=re.S)` |
| `domain-split/audience_discovery.py:238` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `document = document.replace('</head>', '<link rel="stylesheet" href="/assets/audience-discovery.css"></head>', 1)` |
| `domain-split/audience_discovery.py:240` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `document = document.replace('</body>', '<script defer src="/assets/audience-discovery.js"></script></body>', 1)` |
| `domain-split/build_education.py:271` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `text=text.replace('</head>','<link rel="stylesheet" href="/assets/education-navigation.css"></head>',1)` |
| `domain-split/build_publications.py:156` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `possible = [n for n in [preview.find('<section class="view', start + 20), preview.find('</main>', start)] if n >= 0]` |
| `domain-split/build_publications.py:173` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('<div class="cards-4" data-subject-pathways></div>', '<div class="cards-4 subject-pathways">' + cards + '</div>', 1)` |
| `domain-split/build_publications.py:177` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('<div class="wrap" data-teacher-note></div>', '<div class="wrap"><h2 id="teacher-note-title">' + html.escape(note['noteTitle']) + '</h2><p>' + html.escape(note['note']) + '</p></div>', 1)` |
| `domain-split/build_publications.py:180` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('<p class="quiet-note" data-kind-note></p>', '<p class="quiet-note">' + html.escape(KIND_NOTE) + '</p>')` |
| `domain-split/build_publications.py:186` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('</footer>', '<div class="wrap"><a href="/privacy/">Privacy and saved progress</a></div></footer>')` |
| `domain-split/build_publications.py:187` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `body = body.replace('<footer class="footer">', '<div class="section"><div class="wrap"><h2>Classroom activities</h2><div class="results" id="classroom-activities"></div><h2>For staff</h2><p class="game-note">Pr` |
| `domain-split/build_publications.py:189` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('</footer>', '<div class="wrap"><a href="/privacy/">Privacy</a></div></footer>')` |
| `domain-split/build_publications.py:200` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('</div><div class="hero-art">', search + '</div><div class="hero-art">', 1)` |
| `domain-split/build_publications.py:205` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('</a></div></div></div>\n<div class="section" id="places">', '</a>' + extras + '</div></div></div>\n<div class="section" id="places">', 1)` |
| `domain-split/build_publications.py:210` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `body = body.replace('<div class="audience-rows" data-audience-rows></div>', '<div class="audience-rows" data-audience-rows>' + rows + '</div>', 1)` |
| `domain-split/build_publications.py:212` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `css = re.search(r'<style>(.*?)</style>', preview, re.S)[1]` |
| `domain-split/build_publications.py:316` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `preview_data = json.loads(re.search(r'<script type="application/json" id="preview-data">(.*?)</script>', preview, re.S)[1])` |
| `domain-split/check_audience_discovery.cjs:32` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const main = html.match(/<main\b[\s\S]*?<\/main>/);` |
| `domain-split/check_education_support.py:99` | MEASURING | verification/extraction or planted test mutation; no production repair here | `dst.write_text(src.read_text().replace('</body>', '<aside data-mbm-support-footer><a href="' + KOFI + '">Ko-fi</a></aside></body>', 1))` |
| `domain-split/check_primary_discovery.py:78` | MEASURING | verification/extraction or planted test mutation; no production repair here | `text = text.replace('<script defer src="'+src+'"></script>', '', 1)` |
| `domain-split/check_ux2_education.cjs:101` | MEASURING | verification/extraction or planted test mutation; no production repair here | `'inject-kofi': { target: 'money', route: '/', apply: html => html.replace('</footer>', '<p><a href="https://ko-fi.com/madebymattuk">Support Made by Matt</a></p></footer>') },` |
| `domain-split/check_ux2_education.cjs:102` | MEASURING | verification/extraction or planted test mutation; no production repair here | `'inject-third-party': { target: 'third-party', route: '/', apply: html => html.replace('</head>', '<script src="https://cdn.example.net/planted.js"></script></head>') },` |
| `domain-split/check_ux2_education.cjs:104` | MEASURING | verification/extraction or planted test mutation; no production repair here | `'strip-stats-everywhere': { target: 'reachability', routes: ['/privacy/', '/for/teachers/'], apply: html => html.replace(/<a href="\/stats\/">[^<]*<\/a>/g, 'Shared activity') },` |
| `domain-split/check_ux2_education.cjs:261` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `assert.match(raw, /<p data-usage-choice-status role="status"><\/p>/, 'The status line is empty in the static page; only the client paints it');` |
| `domain-split/check_ux2_education.cjs:426` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const locs = files.flatMap(f => [...fs.readFileSync(path.join(siteRoot, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname));` |
| `domain-split/education_discovery.py:161` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `end = text.index('</div>', start)+len('</div>')` |
| `domain-split/education_expansion.py:92` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `slots[0].getparent().replace(slots[0], fragment('<p id="audience-play-showcase" class="wrap mbm-external-play">Looking for recreational games? <a href="'+PLAY+'/">Made by Matt Play — separate games website</a>.` |
| `domain-split/play/check.cjs:47` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const countStatements=html.match(/<p id="result-count"[^>]*>([^<]*)<\/p>/g)\|\|[];assert.equal(countStatements.length,1,'exactly one count statement');assert.equal(countStatements[0].replace(/<[^>]+>/g,''),cata` |
| `domain-split/play/check.cjs:52` | MEASURING | verification/extraction or planted test mutation; no production repair here | `assert(!/<(a\|button)[\s>][^>]*>(?:(?!<\/(a\|button)>).)*<(a\|button)[\s>]/s.test(html.replace(/<script[\s\S]*?<\/script>/g,'')),'nested interactive elements');` |
| `domain-split/play/play.js:56` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `return lane('genre-' + x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), esc(x.name), '<a class="see-all" data-genre="' + esc(x.name) + '" href="?genre=' + encodeURIComponent(x.name) + '#all-games">See all ' + ` |
| `domain-split/shared_navigation.py:181` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `text,count=re.subn(r'<header\b[^>]*>.*?</header>',lambda _:replacement,text,count=1,flags=re.S)` |
| `domain-split/shared_navigation.py:188` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `text = text.replace('</head>', '<link rel="stylesheet" href="/assets/shared-navigation.css">'` |
| `domain-split/stub_handoff.py:17` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `html = html.replace(inline, '<script defer src="/stub-handoff.js"></script>')` |
| `domain-split/stub_handoff.py:19` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `html = html.replace('</style>', '#save-handoff button{font:inherit;min-height:44px;min-width:44px;padding:.5rem 1rem;touch-action:manipulation}#save-handoff button:focus-visible{outline:3px solid #e39129;outlin` |
| `domain-split/stub_handoff.py:20` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `html = html.replace('</main>', '<div id="save-handoff"></div></main>')` |
| `domain-split/usage_discovery.py:365` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `legacy=legacy.replace('<a href="/games/">Games</a>','<a href="/">Made by Matt Play</a>').replace('href="/main/#about"','href="'+EDUCATION+'/main/"')` |
| `domain-split/usage_discovery.py:402` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `legacy=legacy.replace('<a href="/games/">Games</a>', '<a href="'+PLAY+'/">Made by Matt Play</a>').replace('Interactive lessons, simulations and games', 'Lessons, learning resources and teaching tools').replace(` |
| `games/index.html:174` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `<script>window.MBM_DATA_STAMP={"/site.json":"6c357219c0a3","/data/resources.json":"6db846b84893"};window.MBM_STAMP=function(u){var D=window.MBM_DATA_STAMP\|\|{},k=String(u==null?"":u),p=k.charAt(0)==="/"?k:"/"+` |
| `games/index.html:552` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `var badge=CURATED.indexOf(keyOf(g))>=0?'<span class="mini">TOP PICK</span>':"";` |
| `houseolympiad/index.html:1156` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function buildRoster(){var lines=$('#rosterInput').value.split(/\s+/).map(function(x){return x.trim()}).filter(Boolean);if(!lines.length){$('#rosterPreview').hidden=false;$('#rosterPreview').textContent='Paste ` |
| `hyperdraft/index.html:1134` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const p=game.player;if(!p)return;const rank=Math.max(1,game.ranking.indexOf(p)+1\|\|1),field=game.cars.length;dom.position.innerHTML=&#96;P${rank}<small>/${field}</small>&#96;;dom.raceClock.textContent=fmtTime(game.rac` |
| `luminahaven/index.html:762` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderIngredients(){const grid=q('ingredientGrid');grid.innerHTML='';for(const [key,m] of Object.entries(ingredients)){const b=document.createElement('button');b.className='ingredient'+(fusionPick.incl` |
| `main/index.html:253` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `<script>window.MBM_DATA_STAMP={"/site.json":"6c357219c0a3","/data/resources.json":"6db846b84893"};window.MBM_STAMP=function(u){var D=window.MBM_DATA_STAMP\|\|{},k=String(u==null?"":u),p=k.charAt(0)==="/"?k:"/"+` |
| `neonsync/index.html:135` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function save(){Store.set('settings',S);Store.set('progress',P);Store.set('statistics',T)}function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'` |
| `neonsync/index.html:143` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function showShop(){var body='<p class="note">Beat Coins are earned by play and endorsements. The existing dyes and trails are visual only.</p><div class="shop-grid">'+DYES.map(function(d){var own=P.unlocked.in` |
| `neonturf/index.html:2155` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const local=this.networkGuest?this.cars[1]:this.cars[0];ui.boostFill.style.width=&#96;${local.boost}%&#96;;ui.boostText.textContent=Math.round(local.boost);const pulse=1-clamp(local.pulseCd/7.5,0,1);ui.pulseFill.style.` |
| `olympics/index.html:2834` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const records=t.schedule.map(id=>&#96;<div class="recordCard"><span class="eyebrow">${EVENT_META[id].icon} ${EVENT_META[id].short}</span><b>${this.save.records[id]===undefined?'No PB':formatScore(id,this.save.recor` |
| `olympics/index.html:3135` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const a=this.app,s=a.save.settings,grid=a.screen.querySelector('.grid2');if(!grid)return;const card=document.createElement('div');card.className='card';card.innerHTML=&#96;<h3>World Stage accessibility suite</h3><l` |
| `ouroboros/index.html:1379` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const order=["flow","guard","void"],i=order.indexOf(u.stance);u.stance=order[(i+1)%3];Game.save.characters.yasuke.stance=u.stance;u.guard=u.stance==="guard";b.log=&#96;Yasuke shifts into <strong>${u.stance.toUpperC` |
| `ouroboros/index.html:1864` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const lore=Game.save.codex.lore.filter((v,i,a)=>a.indexOf(v)===i).map(id=>&#96;<div class="choice-btn" style="cursor:default"><b>${esc(LORE_ENTRIES[id]?.title\|\|id)}</b><small>${esc(LORE_ENTRIES[id]?.text\|\|"Encr` |
| `resources/index.html:69` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `<script>window.MBM_DATA_STAMP={"/site.json":"6c357219c0a3","/data/resources.json":"6db846b84893"};window.MBM_STAMP=function(u){var D=window.MBM_DATA_STAMP\|\|{},k=String(u==null?"":u),p=k.charAt(0)==="/"?k:"/"+` |
| `resources/index.html:178` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function fillFilters(){const cards=[...new Set([...S.keys.map(k=>k.card),...S.docs.map(r=>r._card)])].sort((a,b)=>{const i=CARD_ORDER.indexOf(a),j=CARD_ORDER.indexOf(b);return (i<0?9:i)-(j<0?9:j)\|\|nameOf(a).l` |
| `start/index.html:3` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Choose your homepage · Made by Matt</title><meta name="description" co` |
| `stats/index.html:55` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `<script>window.MBM_DATA_STAMP={"/site.json":"6c357219c0a3","/data/resources.json":"6db846b84893"};window.MBM_STAMP=function(u){var D=window.MBM_DATA_STAMP\|\|{},k=String(u==null?"":u),p=k.charAt(0)==="/"?k:"/"+` |
| `titanforge/index.html:160` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `&#96;+l.stack}}var Ki=Object.prototype.hasOwnProperty,Hf=Ae.unstable_scheduleCallback,pi=Ae.unstable_cancelCallback,nb=Ae.unstable_shouldYield,sb=Ae.unstable_requestPaint,La=Ae.unstable_now,ib=Ae.unstable_getCurren` |
| `titanforge/index.html:1014` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderAura(){if(!refs.auraGrid)return;refs.auraMeta.textContent=marks()+" MARKS · "+crests()+" CRESTS";var m=marks(),c=crests();refs.auraGrid.innerHTML="";AURAS.forEach(function(a){var owned=state.owne` |
| `tools/2c-pristine/Lumina_pristine.html:387` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderIngredients(){const grid=q('ingredientGrid');grid.innerHTML='';for(const [key,m] of Object.entries(ingredients)){const b=document.createElement('button');b.className='ingredient'+(fusionPick.incl` |
| `tools/apply_apextennis_home.js:45` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `const poolStart=source.indexOf('<a class="dx-sport" data-sport-game="Apex Pool"'),poolEnd=source.indexOf('</a>',poolStart);` |
| `tools/apply_apextennis_home.js:48` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `const adjustedStart=source.indexOf('<a class="dx-sport" data-sport-game="Apex Pool"'),adjustedEnd=source.indexOf('</a>',adjustedStart)+4;` |
| `tools/apply_arcade_sports_catalogue_correction.py:63` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `after = after.replace('</body></html>', marker+'</body></html>', 1)` |
| `tools/as1/storage-source-controls.py:22` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `page.write_text('<script>'+census.MAKER_SCRIPT.replace('DAY=86400000','DAY=86400001',1)+'</script>')` |
| `tools/as1/verify-pilot.cjs:94` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const markup=await page.locator('#as1-shell').evaluate(e=>e.outerHTML);fs.writeFileSync(path.join(OUT,label.replace(/[^a-z0-9]+/gi,'-')+'-composed.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><t` |
| `tools/as1_reference_codec_audit.mjs:9` | MEASURING | read-through: source extraction for audit/simulation/gate | `const block=source.match(/<script>\s*\/\*\*[\s\S]*?class ArcadeHost[\s\S]*?<\/script>/);` |
| `tools/as1_reference_codec_audit.mjs:11` | MEASURING | read-through: source extraction for audit/simulation/gate | `const script=block[0].replace(/^<script>/,'').replace(/<\/script>$/,'');` |
| `tools/crownbadge/sim.mjs:18` | MEASURING | read-through: source extraction for audit/simulation/gate | `const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);` |
| `tools/cyberpulse/verify.mjs:164` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const blocks = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);` |
| `tools/cyberpulse/verify.mjs:650` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: (s) => [s.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/three/build/three.min.js"></script></head>'), manifestRaw] },` |
| `tools/cyberpulse/verify.mjs:672` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `mutate: (s) => [s.replace('<h1 class="logo">', '<h1 class="shadow">CYBERPULSE</h1><h1 class="logo">'), manifestRaw] },` |
| `tools/cyberpulse/verify.mjs:681` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: (s) => [s.replace('</body>', '<script src="/hud.js"></script></body>'), manifestRaw] },` |
| `tools/cyberpulse/verify.mjs:713` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: (s) => [s.replace('</head>', '<script src="https://example.invalid/runtime.js"></script></head>'), manifestRaw] },` |
| `tools/microtinkerer/mt.test.mjs:70` | NOT LOCATOR | read-through: escaping/report or testing a fixed literal, no boundary located | `const planted = html.replace('<head>', '<head>\n<script src="/hud.js"></script>');` |
| `tools/microtinkerer/mt.test.mjs:110` | NOT LOCATOR | read-through: escaping/report or testing a fixed literal, no boundary located | `!/requestPointerLock/.test('<html></html>'),` |
| `tools/mtr_live_gate.mjs:51` | MEASURING | read-through: source extraction for audit/simulation/gate | `const m = SOURCE.match(new RegExp('<p class="disclosure" id="' + id + '">([\\s\\S]*?)</p>'));` |
| `tools/mtr_live_gate.mjs:57` | MEASURING | read-through: source extraction for audit/simulation/gate | `const RECORD = (() => { const m = SOURCE.match(/<script id="standalone-build-record" type="application\/json">([\s\S]*?)<\/script>/); return m ? JSON.parse(m[1]) : null; })();` |
| `tools/render_arcade_pilot.py:39` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `else:html=html.replace('</body>',region+'</body>')` |
| `tools/render_audience_homepages.py:95` | NOT LOCATOR | read-through: escape all JSON closing prefixes, not element surgery | `return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")` |
| `tools/render_audience_homepages.py:709` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Choose your homepage · Made by Matt</title><meta name="description" co` |
| `tools/render_audience_homepages.py:858` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `run = re.search(r'(?:<article class="mbm-audience-card"[\s\S]*?</article>)+', html)` |
| `tools/render_inline_exit.py:194` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `idx = html.rfind("</body>")` |
| `tools/render_maker_splash.py:186` | BALANCED | read-through: tokens consumed by depth walk at lines 190-195 | `token_re = re.compile(rf"</?{tag}\b[^>]*>", re.IGNORECASE)` |
| `tools/render_maker_splash.py:235` | WRITING | Python AST catches multiline/triple-quoted closing-tag locator | `re.subn(         r"(<body\b[^>]*>\s*)(?:<noscript\b[\s\S]{0,1600}?</noscript>\s*)?<script\b[^>]*>[\s\S]{0,1800}?getElementById\(['\"]mbmSplash['\"]\)[\s\S]{0,1800}?</script>\s*",         r"\1",         html,   ` |
| `tools/render_maker_splash.py:258` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `idx = html.lower().rfind("</body>")` |
| `tools/stamp-data.py:142` | WRITING | authoring/publication/runtime transformation; trace separately before repair | `k = html.find("</head>")` |
| `tools/stamp_chrome.py:98` | WRITING | Python AST first argument contains closing-tag locator | `re.compile(r"""<button\b[^>]*class=["'][^"']*\bmenu\b[^"']*["'][^>]*>.*?</button>""", re.S),` |
| `tools/sw2/check_authored_body.py:67` | MEASURING | verification/extraction or planted test mutation; no production repair here | `re.compile(r"<!-- mbm-chrome:footer -->\s*<footer[^>]*data-mbm-chrome=\"minimal\">.*?</footer>\s*<!-- /mbm-chrome:footer -->\n?", re.S),` |
| `tools/sw2/check_authored_body.py:69` | MEASURING | verification/extraction or planted test mutation; no production repair here | `re.compile(r"<small>Learn\s*•\s*Build\s*•\s*Explore</small>"),` |
| `tools/sw2/check_authored_body.py:117` | MEASURING | verification/extraction or planted test mutation; no production repair here | `after = after.replace("</header>", "</header><!--x-->", 1)` |
| `tools/test_published_site.py:243` | MEASURING | verification/extraction or planted test mutation; no production repair here | `cls.shared_stats = re.sub(r'<header\b[^>]*>.*?</header>',` |
| `tools/test_published_site.py:246` | MEASURING | verification/extraction or planted test mutation; no production repair here | `cls.shared_stats = cls.shared_stats.replace('</head>',` |
| `tools/test_published_site.py:250` | MEASURING | verification/extraction or planted test mutation; no production repair here | `cls.published_legacy_stats = re.sub(r'<header\b[^>]*>.*?</header>',` |
| `tools/test_published_site.py:252` | MEASURING | verification/extraction or planted test mutation; no production repair here | `cls.legacy_stats, count=1, flags=re.S).replace('</head>',` |
| `tools/test_published_site.py:334` | MEASURING | verification/extraction or planted test mutation; no production repair here | `result = self.evaluate_stats(self.shared_stats.replace('</main>', markup + '</main>', 1))` |
| `tools/test_published_site.py:343` | MEASURING | verification/extraction or planted test mutation; no production repair here | `result = self.evaluate_stats(self.shared_stats.replace('</main>', markup + '</main>', 1))` |
| `tools/townlife/verify.mjs:48` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `assert.match(html, /<h1>Town Life<\/h1>/, 'h1 must use the authored title');` |
| `tools/townlife/verify.mjs:352` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const headingControlHtml = html.replace('<h1>Town Life</h1>', '<h2 data-heading-negative-control>Town Life</h2>');` |
| `tools/verify_accounts_members_mailing.js:102` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const close=open<0?-1:accountPage.indexOf('</section>',btn<0?open:btn);` |
| `tools/verify_adult_surfaces_browser.py:331` | MEASURING | Python AST catches multiline/triple-quoted closing-tag locator | `src.replace(                 "</footer>",                 '<a href="/account/">Sign in</a><a href="https://ko-fi.com/madebymattuk">Coffee</a></footer>',                 1,             )` |
| `tools/verify_apexgolf.js:557` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const style = (html.match(/<style>([\s\S]*?)<\/style>/) \|\| [,''])[1];` |
| `tools/verify_apexgolf.js:658` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['off-origin CDN', html.replace('</head>', '<script src="https://cdn.example.invalid/a.js"></script></head>')],` |
| `tools/verify_apexgolf.js:659` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['a second same-origin script', html.replace('</head>', '<script src="/analytics.js"></script></head>')],` |
| `tools/verify_apexkick.js:84` | MEASURING | verification/extraction or planted test mutation; no production repair here | `return src.replace(/<script[\s\S]*?<\/script>/gi, ' ')` |
| `tools/verify_apexkick.js:85` | MEASURING | verification/extraction or planted test mutation; no production repair here | `.replace(/<style[\s\S]*?<\/style>/gi, ' ')` |
| `tools/verify_apexkick.js:91` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const scripts = src.match(/<script>[\s\S]*?<\/script>/gi) \|\| [];` |
| `tools/verify_apexkick.js:176` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const embeddedThree = html.match(/<script id="three-embedded">[\s\S]*?<\/script>/);` |
| `tools/verify_apexkick.js:182` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const plantedAuthoredNetwork = authoredHtml.replace('<title>', '<script>fetch("https://control.invalid/")</script><title>');` |
| `tools/verify_apexkick_controls.cjs:60` | MEASURING | verification/extraction or planted test mutation; no production repair here | `for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {` |
| `tools/verify_apexkick_runtime.mjs:773` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);` |
| `tools/verify_apexpool_landing.js:41` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['dependency', 'remote-runtime-reference-census', (s) => s.replace('</body>', '<script src="https://example.invalid/tamper.js"></script></body>')],` |
| `tools/verify_apexpool_landing.js:89` | MEASURING | verification/extraction or planted test mutation; no production repair here | `ok('single-document', (html.match(/<!doctype html>/gi) \|\| []).length === 1 && (html.match(/<\/html>/gi) \|\| []).length === 1);` |
| `tools/verify_apexpool_landing.js:118` | MEASURING | verification/extraction or planted test mutation; no production repair here | `ok('noscript-source-contract', /<noscript><style>#mbmSplash\{display:none!important\}<\/style><div[^>]*><h1>Apex Pool needs JavaScript<\/h1>/.test(html));` |
| `tools/verify_apexpool_landing.js:119` | MEASURING | verification/extraction or planted test mutation; no production repair here | `ok('noCanvas-source-contract', /<div id="noCanvas"><div class="guard"><h1>Canvas is unavailable<\/h1>/.test(html) && /if\(!ctx\)\{\$\('noCanvas'\)\.style\.display='flex';return\}/.test(html));` |
| `tools/verify_apexrally.js:188` | MEASURING | verification/extraction or planted test mutation; no production repair here | `title: /<title>Apex Rally — Read the Court<\/title>/.test(s),` |
| `tools/verify_apexrally.js:344` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const scripts = [...stripExitRegion(html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);` |
| `tools/verify_apexrally.js:362` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['title', html.replace('<title>Apex Rally — Read the Court</title>', '<title>Apex Rally</title>')],` |
| `tools/verify_apexrally.js:365` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['network', html.replace('</head>', '<script src="https://example.invalid/x.js"></script></head>')],` |
| `tools/verify_apextennis.js:29` | MEASURING | verification/extraction or planted test mutation; no production repair here | `gate('G1','identity, sentinel and metadata',()=>{const lines=html.trimEnd().split('\n'),n=(html.match(new RegExp(SENTINEL,'g'))\|\|[]).length;assert(lines[0].includes(SENTINEL),'sentinel not first line');assert` |
| `tools/verify_apextennis.js:71` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['external',html.replace('</head>','<script src="https://example.invalid/x.js"></script></head>'),'external'],` |
| `tools/verify_apextennis.js:72` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['forbidden',html.replace('</body>','<script>var apex_coins=1,crate_reel=true;</script></body>'),'forbidden']` |
| `tools/verify_apextennis_home.py:86` | MEASURING | verification/extraction or planted test mutation; no production repair here | `release=lambda text:re.search(r'<section[^>]*id="newrelease".*?</section>',text,re.S).group(0)` |
| `tools/verify_apextennis_home_browser.js:48` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const sectionEnd=HOME.indexOf('</div></section>',start);` |
| `tools/verify_arcade_sports.js:15` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['rail-returns','sports-declared-once-as-a-genre',t=>t.replace('<div id="genreSections"></div>','<div id="genreSections"></div><div class="rail" id="sportsRail"></div>')],` |
| `tools/verify_arcade_sports.js:62` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const PICKS=(html.match(/<section class="sec" id="picks">[\s\S]*?<\/section>/)\|\|[''])[0];` |
| `tools/verify_artsaward.mjs:138` | MEASURING | verification/extraction or planted test mutation; no production repair here | `if (/^\s*<\/script>\s*$/.test(l)) closes.push(i + 1);` |
| `tools/verify_audience_copy.mjs:46` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')` |
| `tools/verify_biopunkhive.js:24` | MEASURING | verification/extraction or planted test mutation; no production repair here | `push('sentinel-near-file-end',/<!-- sentinel: biopunkhive-build-2026-08-04 -->\s*<\/body>\s*<\/html>\s*$/.test(html));` |
| `tools/verify_biopunkhive.js:26` | MEASURING | verification/extraction or planted test mutation; no production repair here | `push('title-contract',/<title>Biopunk Hive — Made by Matt<\/title>/.test(html));` |
| `tools/verify_biopunkhive.js:118` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `push('motionless-status-copy-present',/>● CONTAINED</.test(html)&&/● LOCKDOWN/.test(html)&&/⚠ OVERLOADED/.test(html)&&/SIPHON NOW/.test(html));` |
| `tools/verify_biopunkhive.js:159` | MEASURING | verification/extraction or planted test mutation; no production repair here | `.replace('</body>','<script>alert("tampered")<\/script></body>');` |
| `tools/verify_catalogue_counts.mjs:108` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const block = after.slice(0, after.indexOf('</details>'));` |
| `tools/verify_claims_guard.mjs:51` | MEASURING | verification/extraction or planted test mutation; no production repair here | `.replace(/<script[\s\S]*?<\/script>/gi, ' ')` |
| `tools/verify_claims_guard.mjs:52` | MEASURING | verification/extraction or planted test mutation; no production repair here | `.replace(/<style[\s\S]*?<\/style>/gi, ' ')` |
| `tools/verify_claims_guard.mjs:53` | MEASURING | verification/extraction or planted test mutation; no production repair here | `.replace(/<head[\s\S]*?<\/head>/gi, ' ')` |
| `tools/verify_curation_vocabulary.mjs:62` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const railHeading = (hub.match(/<section class="sec" id="picks">[\s\S]*?<h2>([^<]+)<\/h2>/) \|\| [])[1];` |
| `tools/verify_curation_vocabulary.mjs:63` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const railBlurb = (hub.match(/<section class="sec" id="picks">[\s\S]*?<p class="sub">([^<]+)<\/p>/) \|\| [])[1];` |
| `tools/verify_curation_vocabulary.mjs:64` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const badge = (hub.match(/<span class="badge">([^<]+)<\/span>/) \|\| [])[1];` |
| `tools/verify_design_inheritance.py:91` | MEASURING | verification/extraction or planted test mutation; no production repair here | `end = markup.find("</main>")` |
| `tools/verify_design_inheritance.py:99` | MEASURING | verification/extraction or planted test mutation; no production repair here | `header = markup[markup.find("<header"):markup.find("</header>") + 9]` |
| `tools/verify_echovault.js:42` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const o=(game.match(/<script/g)\|\|[]).length, c=(game.match(/<\/script>/g)\|\|[]).length;` |
| `tools/verify_echovault.js:60` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const t=(html.match(/<title>([^<]+)<\/title>/)\|\|[])[1];` |
| `tools/verify_echovault.js:106` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `check('remote script injected',s=>s.replace('<title>','<script src="https://cdn.example.com/x.js"></script><title>'),` |
| `tools/verify_echovault.js:108` | MEASURING | verification/extraction or planted test mutation; no production repair here | `check('V6 shell duplicated',s=>s.replace('</body>','<script id="mbm-v6-release">window.__MBM_V6_RELEASE__={};</script></body>'),` |
| `tools/verify_education_stubs.py:120` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `canvas = GOOD.replace(b'<p>', b'<canvas></canvas><p>')` |
| `tools/verify_education_stubs.py:130` | MEASURING | verification/extraction or planted test mutation; no production repair here | `four = GOOD.replace(b'<p><a id="play-game"', b'<ol><li><a href="/game-saves/">Download</a></li><li><a href="https://www.madebymatt-play.uk/game-saves/">Import</a></li></ol><p><a id="play-game"').replace(b'</p><` |
| `tools/verify_emberwild.js:112` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const styleBlock = (html.match(/<style>([\s\S]*?)<\/style>/) \|\| [, ''])[1];` |
| `tools/verify_emberwild.js:173` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const blocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]);` |
| `tools/verify_emberwild.js:665` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: s => s.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script></head>') },` |
| `tools/verify_emberwild.js:671` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `mutate: s => s.replace('<main id="app"', '<div id="renderer-failure"></div><main id="app"') },` |
| `tools/verify_emberwild.js:680` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: s => s.replace(/<noscript>[\s\S]*?<\/noscript>/, '') },` |
| `tools/verify_emberwild.js:734` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const scriptBlock = html.match(/<script>'use strict';([\s\S]*?)<\/script>/)[1];` |
| `tools/verify_evidence_binder_modpro.mjs:130` | MEASURING | verification/extraction or planted test mutation; no production repair here | `if (/^\s*<\/script>\s*$/.test(l)) closes.push(i + 1);` |
| `tools/verify_games_audience_faces.py:134` | MEASURING | verification/extraction or planted test mutation; no production repair here | `match = re.search(r'<section\b[^>]*\bclass=["\'][^"\']*\bmf-hero\b[^"\']*["\'][^>]*>([\s\S]*?)</section>', source, re.I)` |
| `tools/verify_games_audience_faces.py:206` | MEASURING | Python AST catches multiline/triple-quoted closing-tag locator | `re.search(             rf'<article class="mbm-audience-card" data-index="{index:02d}"[\s\S]*?</article>', region         )` |
| `tools/verify_games_audience_faces.py:276` | MEASURING | verification/extraction or planted test mutation; no production repair here | `if not re.search(r'<h([12])\b[^>]*>Choose your own homepage type</h\1>', chooser):` |
| `tools/verify_games_audience_faces.py:304` | MEASURING | Python AST catches multiline/triple-quoted closing-tag locator | `re.search(             rf'<a class="mf-choice" data-mbm-face-choice="{re.escape(main_option["id"])}"[\s\S]*?</a>',             chooser         )` |
| `tools/verify_games_audience_faces.py:431` | MEASURING | verification/extraction or planted test mutation; no production repair here | `hero_without_svg = re.sub(r'<svg\b[\s\S]*?</svg>', '', hero, flags=re.I)` |
| `tools/verify_games_audience_faces.py:457` | MEASURING | verification/extraction or planted test mutation; no production repair here | `pupil_nav = re.search(r'<nav\b[\s\S]*?</nav>', pupil, re.I)` |
| `tools/verify_games_audience_faces.py:583` | MEASURING | verification/extraction or planted test mutation; no production repair here | `band = re.search(r'<section class="mf-section mf-studio-band"[\s\S]*?</section>', chooser)` |
| `tools/verify_games_audience_faces.py:729` | MEASURING | Python AST catches multiline/triple-quoted closing-tag locator | `re.compile(         r'<a\b[^>]*\bhref=["\']' + re.escape(href) + r'["\'][^>]*>' + re.escape(label) + r"</a>"     )` |
| `tools/verify_games_audience_faces.py:775` | MEASURING | Python AST catches multiline/triple-quoted closing-tag locator | `re.search(         rf'<a class="mf-choice" data-mbm-face-choice="{re.escape(str(main_option["id"]))}"[\s\S]*?</a>', chooser     )` |
| `tools/verify_games_audience_faces.py:858` | MEASURING | Python AST catches multiline/triple-quoted closing-tag locator | `chooser.replace(         "</body>", "<!--" + "w" * (ROOT_WEIGHT_CAP - len(chooser.encode("utf-8")) + 1) + "--></body>", 1     )` |
| `tools/verify_games_audience_faces.py:903` | MEASURING | verification/extraction or planted test mutation; no production repair here | `block = re.search(r'<div class="' + re.escape(pill["containerClass"]) + r'"[\s\S]*?</div>', teach)` |
| `tools/verify_genre_participants.mjs:249` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `names.map(n => &#96;<details><summary>${n.replace(/&/g, '&amp;')}</summary><p>x</p></details>&#96;).join('') +` |
| `tools/verify_guard_clause_present.mjs:43` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')` |
| `tools/verify_highlumen.py:52` | MEASURING | verification/extraction or planted test mutation; no production repair here | `STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.S)` |
| `tools/verify_hud_script_line.py:59` | MEASURING | verification/extraction or planted test mutation; no production repair here | `ANY_HUD_TAG = re.compile(r'<script\b[^>]*\bsrc="/hud\.js"[^>]*>(?:</script>)?')` |
| `tools/verify_hud_script_line.py:200` | MEASURING | verification/extraction or planted test mutation; no production repair here | `"drop-defer": lambda t: ANY_HUD_TAG.sub('<script src="/hud.js"></script>', t, count=1),` |
| `tools/verify_hud_script_line.py:209` | MEASURING | verification/extraction or planted test mutation; no production repair here | `"wire-a-hud":   lambda t: t.replace("</head>", '<script defer src="/hud.js"></script></head>', 1),` |
| `tools/verify_hud_script_line.py:212` | MEASURING | verification/extraction or planted test mutation; no production repair here | `"wire-a-hud":   lambda t: t.replace("</head>", '<script defer src="/hud.js"></script></head>', 1),` |
| `tools/verify_main_nojs.mjs:105` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const teachEnd = src.indexOf('</div>', teachStart);` |
| `tools/verify_main_nojs.mjs:166` | MEASURING | verification/extraction or planted test mutation; no production repair here | `broken.indexOf('</div>', broken.indexOf('<div class="dx-teach">'))));` |
| `tools/verify_moderation_lab.mjs:97` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const brand = (src.match(/ASDAN Moderation Lab<small>([^<]+)<\/small>/) \|\| [])[1] \|\| '';` |
| `tools/verify_moderation_lab.mjs:173` | MEASURING | verification/extraction or planted test mutation; no production repair here | `if (/^\s*<\/script>\s*$/.test(l)) closes.push(i + 1);` |
| `tools/verify_neonbreach.js:71` | MEASURING | verification/extraction or planted test mutation; no production repair here | `['body-byte-drift',      t => t.replace('</body>', '<!-- x --></body>')],` |
| `tools/verify_neonbreach.js:72` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `['remote-script',        t => t.replace('<head>', '<head>\n<script src="https://cdn.example.com/a.js"></script>')],` |
| `tools/verify_neonbreach.js:142` | MEASURING | verification/extraction or planted test mutation; no production repair here | `(html.match(/<title>([^<]*)<\/title>/) \|\| [])[1] ===` |
| `tools/verify_neonbreach.js:176` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];` |
| `tools/verify_neonsync.js:68` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: t => t.replace('</body>', '<!-- identity tamper --></body>'),` |
| `tools/verify_neonsync.js:198` | MEASURING | verification/extraction or planted test mutation; no production repair here | `ok('title-exact', /<title>Neon Sync — Made by Matt<\/title>/.test(html));` |
| `tools/verify_neonsync.js:208` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `ok('visible-v11-mark', />v1\.1 · VOLT \+ ESCORT RUSH</.test(html));` |
| `tools/verify_no_boilerplate_regressions.mjs:43` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const body=tag.replace(/^<\/?\s*[^\s>]+/,'').replace(/\/?\s*>$/,'');` |
| `tools/verify_no_boilerplate_regressions.mjs:60` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const name=tag.match(/^<\/?\s*([^\s/>]+)/)[1].toLowerCase();` |
| `tools/verify_no_boilerplate_regressions.mjs:61` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const closing=/^<\//.test(tag);` |
| `tools/verify_novasiege.mjs:105` | MEASURING | verification/extraction or planted test mutation; no production repair here | `check('title carries the suffix', /<title>[^<]*—\s*Made by Matt<\/title>/.test(SOURCE),` |
| `tools/verify_novasiege.mjs:106` | MEASURING | verification/extraction or planted test mutation; no production repair here | `(SOURCE.match(/<title>([^<]*)<\/title>/) \|\| [])[1] \|\| 'no title');` |
| `tools/verify_novasiege.mjs:134` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const j = SOURCE.indexOf('<script>', i), k = SOURCE.indexOf('</script>', j);` |
| `tools/verify_novasiege.mjs:411` | MEASURING | verification/extraction or planted test mutation; no production repair here | `.replace(/<title>([^<]*)—\s*Made by Matt<\/title>/, '<title>$1</title>');` |
| `tools/verify_novasiege.mjs:413` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const titled = /<title>[^<]*—\s*Made by Matt<\/title>/.test(weakened);` |
| `tools/verify_olympics_live_selftest.sh:180` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s=s.replace('</head>','<style>#allGrid a.gcard,#genreSections a.gcard{display:none!important}</style></head>',1)` |
| `tools/verify_olympics_live_selftest.sh:197` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s=s.replace('</head>','<script>setTimeout(function(){throw new Error("negative control")},50)</script></head>',1)` |
| `tools/verify_ouroboros.mjs:192` | MEASURING | verification/extraction or planted test mutation; no production repair here | `check('title suffix', /<title>[^<]*—\s*Made by Matt<\/title>/.test(SOURCE),` |
| `tools/verify_ouroboros.mjs:193` | MEASURING | verification/extraction or planted test mutation; no production repair here | `(SOURCE.match(/<title>([^<]*)<\/title>/) \|\| [])[1]);` |
| `tools/verify_pack_index.mjs:37` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const appMatch = raw.match(/<script>\n"use strict";([\s\S]*?)<\/script>/);` |
| `tools/verify_pack_index.mjs:43` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const appScript = appMatch[0].replace(/^<script>\|<\/script>$/g, "");` |
| `tools/verify_pack_index.mjs:115` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const tbody = body.slice(body.indexOf("<tbody>"), body.indexOf("</tbody>"));` |
| `tools/verify_pack_index.mjs:117` | MEASURING | verification/extraction or planted test mutation; no production repair here | `(tbody.match(/<tr>[\s\S]*?<\/tr>/g) \|\| []).forEach(row => {` |
| `tools/verify_pack_index.mjs:118` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const ref = (row.match(/<b>(GATE-[PW]\d)<\/b>/) \|\| [])[1];` |
| `tools/verify_pack_index.mjs:119` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const cells = row.match(/<td>([^<]*)<\/td>/g) \|\| [];` |
| `tools/verify_pack_index.mjs:121` | MEASURING | verification/extraction or planted test mutation; no production repair here | `if (ref) claimed.set(ref, (pageCell \|\| "").replace(/<\/?td>/g, "").trim());` |
| `tools/verify_professional_site.js:191` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(matches[0][0], '').replace(/<\/main>/i, matches[0][0] + '</main>');` |
| `tools/verify_professional_site.js:246` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(/<head\b[\s\S]*?<\/head>/gi, ' ');` |
| `tools/verify_professional_site.js:247` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');` |
| `tools/verify_professional_site.js:248` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(/<style\b[\s\S]*?<\/style>/gi, ' ');` |
| `tools/verify_professional_site.js:249` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');` |
| `tools/verify_professional_site.js:250` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(/<header\b[\s\S]*?<\/header>/gi, ' ');` |
| `tools/verify_professional_site.js:251` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(/<section\b[^>]*\bid\s*=\s*["']audiences["'][^>]*>[\s\S]*?<\/section>/gi, ' ');` |
| `tools/verify_professional_site.js:252` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s = s.replace(/<div\b[^>]*\bid\s*=\s*["']mbmAuth["'][^>]*>[\s\S]*?(?=<\/body>)/gi, ' ');` |
| `tools/verify_pupil_genres.mjs:282` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const surpriseCopy = (pupilHtml.match(/<span>([^<]*random[^<]*)<\/span>/) \|\| [])[1] \|\| '';` |
| `tools/verify_relicforge.js:89` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const close = (game.match(/<\/script>/g) \|\| []).length;` |
| `tools/verify_relicforge.js:111` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const title = (html.match(/<title>([^<]+)<\/title>/) \|\| [])[1];` |
| `tools/verify_relicforge.js:190` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `s => s.replace('<title>', '<script src="https://cdn.example.com/x.js"></script><title>'),` |
| `tools/verify_relicforge.js:194` | MEASURING | verification/extraction or planted test mutation; no production repair here | `s => s.replace('</body>', '<script id="mbm-v6-release-script">window.__MBM_V6_RELEASE__={};</script></body>'),` |
| `tools/verify_sitemap_covers_games.mjs:30` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());` |
| `tools/verify_skybreak.mjs:100` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);` |
| `tools/verify_skybreak.mjs:109` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const pub = [...html.matchAll(/<title>([^<]*)<\/title>\|<meta name="description" content="([^"]*)"\|<p class="eyebrow">([^<]*)<\/p>/g)].map(m => m[1] \|\| m[2] \|\| m[3]).filter(Boolean);` |
| `tools/verify_skybreak.mjs:113` | MEASURING | verification/extraction or planted test mutation; no production repair here | `gate('SG0h', 'Local Link is inside a closed <details> fold and egress-clean', /<details class="local-link-fold">(?![^<]*open)[\s\S]*?id="open-local-link"[\s\S]*?<\/details>/.test(html) && /iceServers:\[\]/.test` |
| `tools/verify_skybreak.mjs:301` | MEASURING | verification/extraction or planted test mutation; no production repair here | `{ gate: 'SG0a', why: 're-add an external script', mutate: s => s.replace('</head>', '<script src="https://cdn.example.com/x.js"></script></head>') },` |
| `tools/verify_skybreak.mjs:304` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `{ gate: 'SG0d', why: 'put the hand-written splash back', mutate: s => s.replace('<main id="menu"', '<div id="splash" class="overlay"></div><main id="menu"') },` |
| `tools/verify_skybreak.mjs:306` | MEASURING | verification/extraction or planted test mutation; no production repair here | `{ gate: 'SG0f', why: 're-add the download link', mutate: s => s.replace('</main>', '<a href="x.html" download>Download</a></main>') },` |
| `tools/verify_skybreak.mjs:309` | MEASURING | verification/extraction or planted test mutation; no production repair here | `{ gate: 'SG0i', why: 'pad the file past the raw ceiling', mutate: s => s.replace('</body>', '<!--' + 'x'.repeat(RAW_BUDGET) + '--></body>') },` |
| `tools/verify_surface_floor_control.mjs:48` | MEASURING | verification/extraction or planted test mutation; no production repair here | `body = Buffer.from(body.toString('utf8').replace('</head>', inject + '</head>'), 'utf8');` |
| `tools/verify_surfaces.js:89` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `occupants = RULED_OCCUPANTS.filter(r => home.includes('<h3>' + r) \|\| home.includes(r + '</h3>') \|\| new RegExp('<h3>[^<]*' + r.replace(/[.*+?^${}()\|[\]\\]/g, '\\$&')).test(home));` |
| `tools/verify_surfaces.js:238` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const strippedHtml = gamesHtml.replace(/<article class="game-card[^"]*" data-card="game-neon-breach">[\s\S]*?<\/article>/, '')` |
| `tools/verify_surfaces.js:239` | MEASURING | verification/extraction or planted test mutation; no production repair here | `.replace(/<article class="game-card[^"]*"[^>]*>(?:(?!<\/article>)[\s\S])*?href="\/neonbreach\/"[\s\S]*?<\/article>/, '');` |
| `tools/verify_teach_task_filter.mjs:109` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const select = teach.match(/<select id="filter-task"[^>]*>([\s\S]*?)<\/select>/);` |
| `tools/verify_theme_parity.py:166` | MEASURING | verification/extraction or planted test mutation; no production repair here | `return html.split(THEME_STYLE, 1)[1].split("</style>", 1)[0]` |
| `tools/verify_touchline.mjs:187` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);` |
| `tools/verify_touchline.mjs:208` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]*>/g, '').trim());` |
| `tools/verify_touchline.mjs:816` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: s => s.replace('</head>', '<script src="https://cdn.jsdelivr.net/npm/three/build/three.min.js"></script></head>') },` |
| `tools/verify_touchline.mjs:822` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `mutate: s => s.replace('<body>', '<body><section class="mbm-splash" id="mbmSplash"><h1>Touchline<span>Dynasty V2</span></h1></section>') },` |
| `tools/verify_touchline.mjs:824` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: s => s.replace('</body>', '<!--' + 'x'.repeat(100000) + '--></body>') },` |
| `tools/verify_touchline.mjs:826` | MEASURING | verification/extraction or planted test mutation; no production repair here | `mutate: s => { let h = ''; let x = 88172645463325252n; while (h.length < 80000) { x ^= x << 13n; x ^= x >> 7n; x ^= x << 17n; x &= (1n << 64n) - 1n; h += x.toString(16).padStart(16, '0'); } return s.replace('</` |
| `tools/verify_v4_games_deployment.mjs:131` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];` |
| `tools/verify_v4_games_deployment.mjs:155` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const cssSurface = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');` |
| `tools/verify_v4_games_deployment.mjs:165` | MEASURING | verification/extraction or planted test mutation; no production repair here | `assert(/<!doctype html>/i.test(html) && /<\/html>\s*$/i.test(html), &#96;${game.id}: truncated HTML&#96;);` |
| `tools/verify_v4_games_deployment.mjs:168` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const title = (html.match(/<title>([\s\S]*?)<\/title>/i) \|\| [])[1] \|\| '';` |
| `tools/verify_v4_games_deployment.mjs:169` | MEASURING | verification/extraction or planted test mutation; no production repair here | `const visible = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ');` |
| `tools/verify_v4_games_deployment.mjs:248` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `for (const game of GAMES) assert.equal(count(sitemap, new RegExp(&#96;<loc>${game.canonical.replace(/[.*+?^${}()\|[\]\\]/g, '\\$&')}</loc>&#96;, 'g')), 1, &#96;${game.id}: sitemap record count&#96;);` |
| `touchline/index.html:754` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderSquadEnhanced(){let base=renderSquad().replace('<div class="career-grid">',&#96;<div class="career-grid">${renderAdvancedTacticalControls()}&#96;);for(const p of careerState.squad){const needle=&#96;<b>${esc` |
| `touchline/index.html:757` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderCompetitions(){const {table}=careerPosition(),rounds=careerState.schedule.map((r,i)=>({i,fx:r.find(m=>m.home===USER_CLUB\|\|m.away===USER_CLUB)})),scorers=Object.entries(careerState.records.score` |
| `touchline/index.html:764` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function worldClubCard(club,world){const meta=CLUBS.find(c=>c.id===club.id)\|\|{name:&#96;Club ${club.id}&#96;,code:'CPU',color:'#7f9aa1'},manager=world.managers?.find(m=>m.id===club.managerId),squad=Array.isArray(club` |
| `touchline/index.html:776` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `function renderInbox(){const messages=careerState.messages,selected=messages.find(m=>m.id===careerSelectedMessage)\|\|messages[0];return&#96;<div class="career-message-layout"><section class="career-card"><div clas` |
| `trailrunner/index.html:4749` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `}&#96;})}};ur.BlurDirectionX=new re(1,0);ur.BlurDirectionY=new re(0,1);window.__trailBundleStarted=!0;var st={ctx:null,init:function(){let n=window.AudioContext\|\|window.webkitAudioContext;if(!n)return null;if(thi` |
| `trailrunner/index.html:4761` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `gl_FragColor=vec4(r,g,b,1.0); }&#96;},Rh=class{constructor(e){this.onTierChange=e,this.samples=new Float32Array(60),this.cursor=0,this.count=0,this.lastAdjustment=-1/0,this.tier=0,this.tiers=Object.freeze([Object.f` |
| `uas/app.html:1106` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `return list.map(ev=>&#96;<div class="evcell"><img class="evthumb" src="${evURL(ev)}" alt="Work example ${esc(ev.ref)}" data-evview="${ev.id}"><div class="evref">${esc(ev.ref.split("/").slice(1).join("/"))}</div></d` |
| `uas/app.html:1515` | NOT LOCATOR | closing markup occurs outside the locator argument; construction/other operation | `const cnboxes=cno.split("").map(ch=>&#96;<span class="ccbox">${esc(ch.trim())}</span>&#96;).join("");` |
| `uas/vendor/jspdf/jspdf.umd.min.js:86` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `*/var P={print:4,modify:8,copy:16,"annot-forms":32};function k(t,e,r,n){this.v=1,this.r=2;var i=192;t.forEach((function(t){if(void 0!==P.perm)throw new Error("Invalid permission: "+t);i+=P[t]})),this.padding="(` |
| `uas/vendor/jspdf/jspdf.umd.min.js:383` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `function(t){var e=function(){var t='<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:jspdf="'+this.internal.__metadata__.namespaceuri+'"><jspdf:metadata>',e=u` |
| `uas/vendor/pdfjs/pdf.min.js:22` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `!function webpackUniversalModuleDefinition(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=t.pdfjsLib=e():"function"==typeof define&&define.amd?define("pdfjs-dist/build/pdf",[],(()=>t.pdfj` |
| `uas/vendor/pdfjs/pdf.worker.min.js:22` | VENDOR/COMPILED | third-party or compiled bundle; retained as a raw hit | `!function webpackUniversalModuleDefinition(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=e.pdfjsWorker=t():"function"==typeof define&&define.amd?define("pdfjs-dist/build/pdf.worker",[],(` |

## Reproduction script

Change only ROOT/OUT for a local checkout of the recorded source.

```python
from pathlib import Path
from html.parser import HTMLParser
from collections import Counter
import subprocess, re, json, datetime, ast

ROOT = Path('/workspace/scratch/1703bef47fa2/site-main')
OUT = Path('/workspace/scratch/1703bef47fa2/recovery')
paths = subprocess.check_output(['git','-C',str(ROOT),'ls-files','-z'],text=True).split('\0')[:-1]
closing = re.compile(r'</|<\\/|<\[/\]|<\[\\/\]')
operation = re.compile(r'\b(?:subn?|replace(?:All)?|find|rfind|index|indexOf|lastIndexOf|split|match(?:All)?|search|compile|test|exec)\s*\(')

def first_arguments(line):
    for m in operation.finditer(line):
        start=m.end(); i=start; quote=None; depth=0; escaped=False
        while i<len(line):
            c=line[i]
            if quote:
                if escaped: escaped=False
                elif c=='\\': escaped=True
                elif c==quote: quote=None
            elif c in '\"\'`': quote=c
            elif c=='/' and not line[start:i].strip(): quote='/'
            elif c in '([{': depth+=1
            elif c in ')]}':
                if depth==0: break
                depth-=1
            elif c==',' and depth==0: break
            i+=1
        yield line[start:i]

rows=[]; scanned=[]
for name in paths:
    p=ROOT/name
    if p.suffix not in {'.py','.js','.mjs','.cjs','.ts','.sh','.yml','.yaml','.html','.htm'}: continue
    scanned.append(name)
    for n,line in enumerate(p.read_text(errors='replace').splitlines(),1):
        if not closing.search(line) or not operation.search(line): continue
        relevant=any(closing.search(a) for a in first_arguments(line))
        # JS /pattern/.test(subject) and /pattern/.exec(subject) put the locator before the call.
        relevant = relevant or bool(re.search(r'<\\/[^\n]{0,160}/[gimsuy]*\.(?:test|exec)\(',line))
        if '/vendor/' in name or len(line)>10000:
            kind='VENDOR/COMPILED'; reason='third-party or compiled bundle; retained as a raw hit'
        elif not relevant:
            kind='NOT LOCATOR'; reason='closing markup occurs outside the locator argument; construction/other operation'
        elif (name.startswith('.github/') or '/check' in name or '/test' in name or '/verify' in name
              or name.startswith('docs/') or 'controls' in name or '/probe' in name):
            kind='MEASURING'; reason='verification/extraction or planted test mutation; no production repair here'
        else:
            kind='WRITING'; reason='authoring/publication/runtime transformation; trace separately before repair'
        rows.append({'path':name,'line':n,'kind':kind,'reason':reason,'source':line.strip()})
    if p.suffix == '.py':
        source=p.read_text()
        tree=ast.parse(source)
        for node in ast.walk(tree):
            if not isinstance(node,ast.Call) or not node.args:continue
            op=node.func.attr if isinstance(node.func,ast.Attribute) else ''
            if not operation.match(op+'('):continue
            arg=ast.get_source_segment(source,node.args[0]) or ''
            if not closing.search(arg):continue
            matches=[r for r in rows if r['path']==name and r['line']==node.lineno]
            kind='MEASURING' if re.search(r'/(?:test|check|verify)',name) else 'WRITING'
            if matches:
                if matches[0]['kind']=='NOT LOCATOR':
                    matches[0]['kind']=kind;matches[0]['reason']='Python AST first argument contains closing-tag locator'
            else:
                rows.append({'path':name,'line':node.lineno,'kind':kind,
                             'reason':'Python AST catches multiline/triple-quoted closing-tag locator',
                             'source':ast.get_source_segment(source,node) or ''})

# Read-through classifications for names that the conservative path rule cannot identify.
for row in rows:
    name,n=row['path'],row['line']
    if name in {'tools/as1_reference_codec_audit.mjs','tools/crownbadge/sim.mjs','tools/mtr_live_gate.mjs'}:
        row['kind']='MEASURING';row['reason']='read-through: source extraction for audit/simulation/gate'
    if name=='tools/microtinkerer/mt.test.mjs' or (name=='apexgolf/index.html' and n==656):
        row['kind']='NOT LOCATOR';row['reason']='read-through: escaping/report or testing a fixed literal, no boundary located'
    if name=='tools/render_audience_homepages.py' and n==95:
        row['kind']='NOT LOCATOR';row['reason']='read-through: escape all JSON closing prefixes, not element surgery'
    if name=='tools/render_maker_splash.py' and n==186:
        row['kind']='BALANCED';row['reason']='read-through: tokens consumed by depth walk at lines 190-195'
rows.sort(key=lambda r:(r['path'],r['line']))

class Tags(HTMLParser):
    def __init__(self):
        super().__init__(); self.depth=Counter(); self.closes=Counter(); self.nested=set()
    def handle_starttag(self,tag,attrs):
        if tag in {'header','main'}:
            self.depth[tag]+=1
            if self.depth[tag]>1:self.nested.add(tag)
    def handle_endtag(self,tag):
        if tag in {'header','main'}:
            self.closes[tag]+=1;self.depth[tag]-=1
    def handle_startendtag(self,tag,attrs):pass

htmlrows=[]
for name in paths:
    if Path(name).suffix not in {'.html','.htm'}:continue
    text=(ROOT/name).read_text(); p=Tags();p.feed(text);p.close()
    htmlrows.append({'path':name,'raw_header':text.count('</header>'),'raw_main':text.count('</main>'),
                     'parsed_header':p.closes['header'],'parsed_main':p.closes['main'],'nested':sorted(p.nested)})
result={'measured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source':subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'],text=True).strip(),
        'tracked_files':len(paths),'scanned_files':len(scanned),'counts':dict(Counter(x['kind'] for x in rows)),
        'rows':rows,'html':htmlrows}
(OUT/'census.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in {'rows','html'}},indent=2))
for r in rows:
    if r['kind']=='WRITING':print(f"{r['path']}:{r['line']} {r['source'][:180]}")
```
