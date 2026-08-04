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
  ['copy','whole-shelf-copy-restored',s=>s.replace('The whole shelf','The rest of the shelf')]
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
ok('four-game-sports-copy-preserved',html.includes('Four Apex games, side by side')&&html.includes('Apex Golf')&&html.includes('Apex Tennis'));
ok('correction-sentinel',html.includes('apexpool-arcade-catalogue-correction-2026-08-04'));
console.log('='.repeat(68));console.log(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} ARCADE SPORTS SOURCE CHECKS PASSED`);process.exit(fail?1:0);
