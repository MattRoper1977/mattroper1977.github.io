#!/usr/bin/env node
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const args=process.argv.slice(2),self=args.includes('--self-test'),file=args.find(x=>x!=='--self-test')||path.join(__dirname,'..','games','index.html');
const html=fs.readFileSync(file,'utf8');
let pass=0,fail=0;function ok(n,c,d=''){console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'   '+d:''));c?pass++:fail++;}
if(self){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'arcade-catalogue-'));
 const cases=[
  ['top','apex-kick-remains-in-top',t=>t.replace('{href:"/apexkick/",','{href:"/apexkick-MOVED/",')],
  ['shelf','every-genre-draws-from-the-complete-manifest',t=>t.replace('var all=state.games, n=all.length;','var all=state.games.filter(function(g){return g.collection!=="Sports"}), n=all.length;')],
  ['grouping','sports-membership-comes-from-the-genre-record',t=>t.replace('function genreOf(g){return GENRE[keyOf(g)]||""}','function genreOf(g){return g.collection==="Sports"?"Sports":(GENRE[keyOf(g)]||"")}')],
  ['count','total-count-derived-from-manifest',t=>t.replace('var all=state.games, n=all.length;','var all=state.games, n=52;')],
  ['copy','browse-copy-present',t=>t.replace('Browse by genre','Browse the shelf')],
  ['rail-returns','sports-declared-once-as-a-genre',t=>t.replace('<div id="genreSections"></div>','<div id="genreSections"></div><div class="rail" id="sportsRail"></div>')],
  ['baked-count','no-genre-count-is-written-into-the-markup',t=>t.replace('sm.querySelector(".gnum").textContent=members.length+" game"','sm.querySelector(".gnum").textContent="8 game"')],
  ['bespoke-card','sports-uses-the-same-card-system-as-every-genre',t=>t.replace('members.forEach(function(g){c.appendChild(gCard(g,false))});','members.forEach(function(g){c.appendChild(document.createElement("a"))});')]
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
ok('apex-kick-remains-in-top',/\{href:"\/apexkick\/",\s*rail:\d+/.test(html),
 'still a rail slot, now href-keyed');
ok('top-copy-still-eight',html.includes("The eight I'd put in front of anyone first"));
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
