#!/usr/bin/env node
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const args=process.argv.slice(2),self=args.includes('--self-test'),file=args.find(x=>x!=='--self-test')||path.join(__dirname,'..','games','index.html');
const html=fs.readFileSync(file,'utf8');
let pass=0,fail=0;function ok(n,c,d=''){console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'   '+d:''));c?pass++:fail++;}
if(self){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'arcade-catalogue-'));
 const cases=[
  ['top','the-rail-is-the-featured-flag',t=>t.replace('function topOf(gs){return gs.filter(function(g){return g.featured===true})}','function topOf(gs){return gs.slice(0,8)}')],
  ['shelf','every-genre-draws-from-the-complete-manifest',t=>t.replace('var all=state.games, n=all.length;','var all=state.games.filter(function(g){return g.collection!=="Sports"}), n=all.length;')],
  ['grouping','sports-membership-comes-from-the-genre-record',t=>t.replace('function genreOf(g){return GENRE[keyOf(g)]||""}','function genreOf(g){return g.collection==="Sports"?"Sports":(GENRE[keyOf(g)]||"")}')],
  ['count','total-count-derived-from-manifest',t=>t.replace('var all=state.games, n=all.length;','var all=state.games, n=52;')],
  ['copy','browse-copy-present',t=>t.replace('Browse by genre','Browse the shelf')],
  ['rail-returns','sports-declared-once-as-a-genre',t=>t.replace('<div id="genreSections"></div>','<div id="genreSections"></div><div class="rail" id="sportsRail"></div>')],
  ['baked-count','no-genre-count-is-written-into-the-markup',t=>t.replace('sm.querySelector(".gnum").textContent=members.length+" game"','sm.querySelector(".gnum").textContent="8 game"')],
  ['bespoke-card','sports-uses-the-same-card-system-as-every-genre',t=>t.replace('members.forEach(function(g){c.appendChild(gCard(g,false))});','members.forEach(function(g){c.appendChild(document.createElement("a"))});')],
  /* H3.3. The number limb had no mutation case, so nothing proved it could fail.
     Drop a rail slot and leave the sentence saying "eight": seven slots, eight
     claimed. */
  ['rail-count','top-copy-number-matches-the-rail',t=>t.replace(/(<section class="sec" id="picks">[\s\S]*?<p class="sub">)[^<]*/,'$1The handful I would put in front of anyone first.')]
 ];let missed=0;
 for(let i=0;i<cases.length;i++){const [family,expected,mut]=cases[i],changed=mut(html),p=path.join(root,i+'.html');fs.writeFileSync(p,changed);const r=spawnSync(process.execPath,[__filename,p],{encoding:'utf8'}),out=(r.stdout||'')+(r.stderr||'');if(changed!==html&&r.status!==0&&out.includes('FAIL  '+expected))console.log('  PASS  '+family+' tamper rejected');else{console.log('  FAIL  '+family+' tamper escaped');missed++;}}
 fs.rmSync(root,{recursive:true,force:true});console.log(missed?`${cases.length-missed} detected, ${missed} missed`:`ALL ${cases.length} PLANTED FAILURES WERE DETECTED`);process.exit(missed?1:0);
}
console.log('== Arcade Sports catalogue contract ==');
/* Sports used to be a RAIL of its own, drawn on top of the whole shelf. It is
   now a GENRE SECTION, because the rail was one of five that each drew their
   own copy of a game — 82 cards for 52 games, and a game appearing four times.
   Every check below still protects what it always protected; only the shape it
   looks for moved. What it must never become is weaker: "Sports exists" is not
   a contract, so each one names the mechanism. */
ok('sports-declared-once-as-a-genre',
 (html.split('"Sports"').length-1)>=1
 && /var GENRE_ORDER=\[[\s\S]*?"Sports"[\s\S]*?\];/.test(html)
 && (html.match(/^\s*"Sports",?$/gm)||[]).length===1
 && !/id="sportsRail"/.test(html),
 'declared once in GENRE_ORDER, and the standalone rail is gone');
ok('sports-uses-the-same-card-system-as-every-genre',
 /members\.forEach\(function\(g\)\{c\.appendChild\(gCard\(g,false\)\)\}\);/.test(html)
 && !/sportsRail\.appendChild/.test(html),
 'genre sections render through gCard, with no bespoke sports card');
ok('sports-membership-comes-from-the-genre-record',
 /genre:"Sports"/.test(html)
 && /function genreOf\(g\)\{return GENRE\[keyOf\(g\)\]\|\|""\}/.test(html)
 && !/g\.collection==="Sports"/.test(html)
 && !/g\.tag==="Sport"/.test(html),
 'membership is the declared genre, not manifest collection and not tag');
/* Ruling ug-4 (22 Oct 2026): the Top Picks rail is the shelf manifest's `featured` flag,
   in manifest order. No hand-written rail slot may survive in CURATION. */
ok('the-rail-is-the-featured-flag',
 /function topOf\(gs\)\{return gs\.filter\(function\(g\)\{return g\.featured===true\}\)\}/.test(html)
 && /topOf\(gs\)\.forEach\(function\(g,i\)\{rail\.appendChild\(pickCard\(g,i===0\)\)\}\);/.test(html)
 && !/\brail:\s*\d+/.test(html),
 'topOf() filters the shelf on featured, the rail paints topOf(), and no rail:N slot remains');
/* H3. The line above fuses two values with different owners: Matt's prose, which
   data/takes-pin.json owns and which this limb still detects (proved by mutating
   the page and watching it fire), and the NUMBER WORD, whose real owner is the
   set of rail:N slots in CURATION. Nothing derived that number, so the rail could
   go to seven or nine while the sentence still said "eight" and every check here
   passed — the exact failure the limb is named for and could not catch. Counted
   from the slots now, never read from the word. A zero count fails rather than
   satisfying anything, so an empty rail cannot read as a pass. */
/* Since ruling ug-4 the number's owner is the manifest's `featured` flag (the rail paints
   exactly those games), so it is counted from the manifest. The sentence itself is the
   owner's prose (data/takes-pin.json): if the count moves, the sentence must be re-issued
   by the owner, and until then this limb is red rather than quietly wrong. */
const MANIFEST=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','source-manifests','games.json'),'utf8'));
const RAIL_SLOTS=(MANIFEST.games||MANIFEST).filter(g=>g.featured===true).length;
const NUMWORD=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const PICKS=(html.match(/<section class="sec" id="picks">[\s\S]*?<\/section>/)||[''])[0];
const RAIL_WORD=NUMWORD[RAIL_SLOTS];
ok('top-copy-number-matches-the-rail',
 RAIL_SLOTS>0 && !!RAIL_WORD && PICKS.includes(RAIL_WORD),
 RAIL_SLOTS===0?'no featured games in the manifest — refusing to pass on nothing'
  :`${RAIL_SLOTS} featured games on the rail; the sub-line ${RAIL_WORD&&PICKS.includes(RAIL_WORD)?'says':'does NOT say'} "${RAIL_WORD||'?'}"`);
ok('every-genre-draws-from-the-complete-manifest',
 /var members=sortGames\(all\.filter\(function\(g\)\{return genreOf\(g\)===gname\}\)\);/.test(html)
 && /var all=state\.games/.test(html)
 && !/collection!=="Sports"/.test(html),
 'sections filter the whole shelf by genre, excluding nothing up front');
ok('browse-copy-present',html.includes('Browse by genre'));
ok('total-count-derived-from-manifest',
 /var all=state\.games, n=all\.length;/.test(html) && !/var n=\d+;/.test(html),
 'the shelf total is counted, never written down');
/* Was `sports-copy-count-matches-the-games-it-names`, which derived a number
   word from the Apex games the sports blurb listed. The blurb went with the
   rail. The defect it guarded — a number in the markup drifting from the games
   it describes — now applies to every genre heading, and the answer is
   stronger than a derived word: no count is in the markup at all. Each heading
   is written by the renderer from the record. */
ok('no-genre-count-is-written-into-the-markup',
 /sm\.querySelector\("\.gnum"\)\.textContent=members\.length\+" game"/.test(html)
 && !/(<span class="gnum">\s*\d)/.test(html),
 'genre counts are computed at render time, not baked into the HTML');
ok('correction-sentinel',html.includes('apexpool-arcade-catalogue-correction-2026-08-04'));
console.log('='.repeat(68));console.log(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} ARCADE SPORTS SOURCE CHECKS PASSED`);process.exit(fail?1:0);
