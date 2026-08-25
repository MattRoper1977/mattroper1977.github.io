#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),MAIN=path.join(ROOT,'main','index.html'),INDEX=fs.existsSync(MAIN)?MAIN:path.join(ROOT,'index.html'),SITE=path.join(ROOT,'site.json');
// The four ESTABLISHED sports, and deliberately not the shelf's current
// membership: Sports is additive, and games.json now also carries Apex Curl,
// Apex Rally and Apex Velodrome. Deriving this from the shelf would be wrong
// rather than better - it would rewrite a homepage lede about four games every
// time a fifth arrived. A fixed historical set, named as one. (S5 §V2)
const CARD_NAMES=['Apex Kick','Apex Pool','Apex Golf','Apex Tennis'];
const OLD_LEDE='Two games about reading a line, controlling the finish and making the next decision count.';
const NEW_LEDE='Four games about reading the line, calling the plan and making the next decision count.';
const NEW_CARDS=`
<a class="dx-sport" data-sport-game="Apex Golf" href="/apexgolf/" style="--sport:#7C5CFC">
<span class="dx-sport-icon" aria-hidden="true">⛳</span><span class="dx-sport-copy"><b>Apex Golf</b><span>Call your stroke count, read honest wind and slope, then make the hole prove you right.</span></span><span class="dx-sport-go">Play &rarr;</span>
</a>
<a class="dx-sport" data-sport-game="Apex Tennis" href="/apextennis/" style="--sport:#3B6FD4">
<span class="dx-sport-icon" aria-hidden="true">🎾</span><span class="dx-sport-copy"><b>Apex Tennis</b><span>Call the point before the serve, then build it on court with real rules and an honest Plan Rating.</span></span><span class="dx-sport-go">Play &rarr;</span>
</a>`;
const DOORS=[
 /* Apex Golf's door was REMOVED by Matt's C1 ruling (AGX-1): the four-game
    homepage Sports block is ratified, but one surface per game stands, so
    Golf keeps its Sports card and does NOT take a door. Pool's
    spotlight+Sports pairing remains the ruled exception, not the precedent.
    Do not re-add this entry — re-running this transform must not undo the
    ruling. */
 {zone:'games',title:'Apex Tennis',desc:'Call the point before the serve, then build it on court with real rules and an honest Plan Rating.',href:'apextennis/',countKey:'apex-tennis',image:'assets/cards/apex-tennis-door.svg',imageAlt:'Apex Tennis — a blue court with a planned ball path and three clauses',imageW:120,imageH:96,badgeIcon:'🎮',badgeLabel:'plays'}
];
const CATALOG=[{key:'apex-golf',title:'Apex Golf'},{key:'apex-tennis',title:'Apex Tennis'}];
function count(s,x){return s.split(x).length-1}
function transformIndex(source){
 const counts=Object.fromEntries(CARD_NAMES.map(n=>[n,count(source,`data-sport-game="${n}"`)]));
 // ELEVENTH INSTANCE OF THE A-6 SHAPE, in the already-applied detector. This
 // required `source.includes(NEW_LEDE)` — the exact four-game lede string — so
 // the moment the lede was rewritten for a fifth sports game the transform
 // stopped recognising its own completed work, fell through to the
 // not-yet-applied guard below, and threw "membership drift" on a homepage that
 // was in fact correct. The transform is applied when the cards it adds are
 // present and the lede it replaces is gone; what the lede was replaced WITH is
 // not this script's business, and pinning it made a correct homepage look
 // broken.
 if(CARD_NAMES.every(n=>counts[n]===1)&&!source.includes(OLD_LEDE))return source;
 if(counts['Apex Kick']!==1||counts['Apex Pool']!==1||counts['Apex Golf']!==0||counts['Apex Tennis']!==0)throw Error('homepage Sports membership drift');
 if(count(source,OLD_LEDE)!==1)throw Error('homepage Sports lede drift');
 const poolStart=source.indexOf('<a class="dx-sport" data-sport-game="Apex Pool"'),poolEnd=source.indexOf('</a>',poolStart);
 if(poolStart<0||poolEnd<0)throw Error('Apex Pool card anchor drift');
 source=source.replace(OLD_LEDE,NEW_LEDE);
 const adjustedStart=source.indexOf('<a class="dx-sport" data-sport-game="Apex Pool"'),adjustedEnd=source.indexOf('</a>',adjustedStart)+4;
 source=source.slice(0,adjustedEnd)+NEW_CARDS+source.slice(adjustedEnd);
 if(count(source,'id="homeSports"')!==1||count(source,'data-release="Apex Pool"')!==1||count(source,'id="newrelease"')!==1)throw Error('protected homepage component drift');
 return source;
}
function transformSite(source){
 const doc=JSON.parse(source),doors=doc.doors||[],catalog=doc.features?.downloads?.catalog||[];
 const hits=title=>doors.filter(d=>d.title===title).length;
 // The already-applied detector used to require doors.length===14 with an
 // Apex Golf door present, and the not-yet-applied guard required exactly
 // 12. Matt's C1 ruling removes Golf's door and takes the count to 13, so
 // BOTH pins were wrong the moment that landed: the transform matched
 // neither state and threw 'door baseline drift'. That is the same shape as
 // the 12-door workflow pin and the arcade manifest pin. So the test is now
 // COUNT-FREE and asks the only question that actually matters: is every
 // door this transform adds already present?
 if(DOORS.every(d=>doors.some(x=>JSON.stringify(x)===JSON.stringify(d))))return source;
 if(hits('Apex Kick')!==1)throw Error('Apex Kick door missing or duplicated');
 if(hits('Apex Pool')!==0)throw Error('an Apex Pool door exists; the measured convention is none');
 const kick=doors.findIndex(d=>d.title==='Apex Kick');if(kick<0)throw Error('Apex Kick door missing');
 doors.splice(kick+1,0,...DOORS.map(x=>({...x})));
 const ci=catalog.findIndex(x=>x.key==='apex-kick');if(ci<0||CATALOG.some(x=>catalog.some(y=>y.key===x.key)))throw Error('count catalogue drift');
 catalog.splice(ci+1,0,...CATALOG.map(x=>({...x})));
 return JSON.stringify(doc,null,2)+'\n';
}
const beforeIndex=fs.readFileSync(INDEX,'utf8'),beforeSite=fs.readFileSync(SITE,'utf8');
const afterIndex=transformIndex(beforeIndex),afterSite=transformSite(beforeSite);
if(transformIndex(afterIndex)!==afterIndex||transformSite(afterSite)!==afterSite)throw Error('idempotency failure');
if(afterIndex!==beforeIndex)fs.writeFileSync(INDEX,afterIndex);if(afterSite!==beforeSite)fs.writeFileSync(SITE,afterSite);
console.log(afterIndex===beforeIndex&&afterSite===beforeSite?`NO-OP: homepage Sports is canonical (${(afterIndex.match(/data-sport-game="/g)||[]).length} cards).`:'Applied Apex Golf and Apex Tennis to the existing homepage Sports section and relative doors.');
