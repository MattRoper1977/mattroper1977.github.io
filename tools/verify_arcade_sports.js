#!/usr/bin/env node
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process');
const args=process.argv.slice(2),self=args.includes('--self-test'),file=args.find(x=>x!=='--self-test')||path.join(__dirname,'..','games','index.html');
const html=fs.readFileSync(file,'utf8');
let pass=0,fail=0;function ok(n,c,d=''){console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'   '+d:''));c?pass++:fail++;}
if(self){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'arcade-catalogue-'));
 const cases=[
  ['top','apex-kick-remains-in-top',s=>s.replace('var TOP=["Apex Kick",','var TOP=[')],
  ['shelf','whole-shelf-uses-complete-manifest',s=>s.replace('var gs=state.games.slice();','var gs=state.games.filter(function(g){return g.collection!=="Sports"});')],
  ['grouping','sports-is-collection-not-tag',s=>s.replace('g.collection==="Sports"','g.tag==="Sport"')],
  ['count','total-count-derived-from-manifest',s=>s.replace('var n=state.games.length;','var n=33;')],
  ['copy','whole-shelf-copy-restored',s=>s.replace('The whole shelf','The rest of the shelf')],
  /* the derived sports-copy check must still reject copy whose number word
     disagrees with the games it names — the failure the pinned literal used to
     catch, minus the false alarm on a correct addition */
  ['sports-copy','sports-copy-count-matches-the-games-it-names',s=>s.replace('Five Apex games, side by side','Four Apex games, side by side')],
  ['sports-copy-drop','sports-copy-count-matches-the-games-it-names',s=>s.replace(', then read the court and win the duel in Apex Rally','')]
 ];let missed=0;
 for(let i=0;i<cases.length;i++){const [family,expected,mut]=cases[i],changed=mut(html),p=path.join(root,i+'.html');fs.writeFileSync(p,changed);const r=spawnSync(process.execPath,[__filename,p],{encoding:'utf8'}),out=(r.stdout||'')+(r.stderr||'');if(changed!==html&&r.status!==0&&out.includes('FAIL  '+expected))console.log('  PASS  '+family+' tamper rejected');else{console.log('  FAIL  '+family+' tamper escaped');missed++;}}
 fs.rmSync(root,{recursive:true,force:true});console.log(missed?`${cases.length-missed} detected, ${missed} missed`:`ALL ${cases.length} PLANTED FAILURES WERE DETECTED`);process.exit(missed?1:0);
}
console.log('== Arcade Sports catalogue contract ==');
ok('sports-section-once',(html.split('id="sports" hidden').length-1)===1&&(html.split('id="sportsRail"').length-1)===1);
ok('sports-uses-existing-rail-card-system',/<div class="rail" id="sportsRail"/.test(html)&&/sportsRail\.appendChild\(gCard\(g,false\)\)/.test(html));
ok('sports-is-collection-not-tag',/g\.collection==="Sports"/.test(html)&&!/g\.tag==="Sport"/.test(html)&&!/>SPORT</.test(html));
ok('apex-kick-remains-in-top',/var TOP=\["Apex Kick","Voxel Frontier"/.test(html));
ok('top-copy-still-eight',html.includes("The eight I'd put in front of anyone first"));
ok('whole-shelf-uses-complete-manifest',/function drawGrid\(\)\{\n var gs=state\.games\.slice\(\);/.test(html)&&!/collection!=="Sports"/.test(html));
ok('whole-shelf-copy-restored',html.includes('The whole shelf')&&html.includes('Every game, A to Z'));
ok('total-count-derived-from-manifest',/var n=state\.games\.length;/.test(html)&&!/var n=\d+;/.test(html));
/* Was `four-game-sports-copy-preserved`, which pinned the literal "Four Apex
   games, side by side". Same A-6 defect as the pinned manifest count above: it
   froze the copy at a moment in the estate's history, so the fifth sports game
   made a correct change look like a regression. The number word is now DERIVED
   from the game names the copy actually lists, which keeps it honest at five,
   six or more — and still catches the real failure, which is copy that claims a
   different number from the one it goes on to name. */
ok('sports-copy-count-matches-the-games-it-names',(()=>{
 const m=html.match(/<section class="sec sports"[\s\S]*?<p class="sub">([\s\S]*?)<\/p>/);
 if(!m)return false;
 const copy=m[1];
 const WORDS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
 const lead=(copy.trim().split(/\s+/)[0]||'').toLowerCase();
 const claimed=WORDS[lead];
 const named=new Set((copy.match(/Apex [A-Z][a-z]+/g)||[])).size;
 return Boolean(claimed)&&named>0&&claimed===named;
})(),(()=>{
 const m=html.match(/<section class="sec sports"[\s\S]*?<p class="sub">([\s\S]*?)<\/p>/);
 if(!m)return'(no sports copy found)';
 const copy=m[1],lead=copy.trim().split(/\s+/)[0];
 const named=[...new Set((copy.match(/Apex [A-Z][a-z]+/g)||[]))];
 return`copy says "${lead}", names ${named.length}: ${named.join(', ')}`;
})());
ok('correction-sentinel',html.includes('apexpool-arcade-catalogue-correction-2026-08-04'));
console.log('='.repeat(68));console.log(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} ARCADE SPORTS SOURCE CHECKS PASSED`);process.exit(fail?1:0);
