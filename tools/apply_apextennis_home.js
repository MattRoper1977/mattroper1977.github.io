#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),INDEX=path.join(ROOT,'index.html'),SITE=path.join(ROOT,'site.json');
const NAMES=['Apex Kick','Apex Pool','Apex Golf','Apex Tennis'];
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
 {zone:'games',title:'Apex Golf',desc:'Read the hole, call your stroke count and play nine seeded holes with honest wind and slope.',href:'apexgolf/',countKey:'apex-golf',image:'assets/cards/apex-golf-door.svg',imageAlt:'Apex Golf — a called score of three on a curved top-down hole',imageW:120,imageH:96,badgeIcon:'🎮',badgeLabel:'plays'},
 {zone:'games',title:'Apex Tennis',desc:'Call the point before the serve, then build it on court with real rules and an honest Plan Rating.',href:'apextennis/',countKey:'apex-tennis',image:'assets/cards/apex-tennis-door.svg',imageAlt:'Apex Tennis — a blue court with a planned ball path and three clauses',imageW:120,imageH:96,badgeIcon:'🎮',badgeLabel:'plays'}
];
const CATALOG=[{key:'apex-golf',title:'Apex Golf'},{key:'apex-tennis',title:'Apex Tennis'}];
function count(s,x){return s.split(x).length-1}
function transformIndex(source){
 const counts=Object.fromEntries(NAMES.map(n=>[n,count(source,`data-sport-game="${n}"`)]));
 if(NAMES.every(n=>counts[n]===1)&&source.includes(NEW_LEDE))return source;
 if(counts['Apex Kick']!==1||counts['Apex Pool']!==1||counts['Apex Golf']!==0||counts['Apex Tennis']!==0)throw Error('homepage Sports membership drift');
 if(count(source,OLD_LEDE)!==1)throw Error('homepage Sports lede drift');
 const poolStart=source.indexOf('<a class="dx-sport" data-sport-game="Apex Pool"');
 const poolEnd=source.indexOf('</a>',poolStart);
 if(poolStart<0||poolEnd<0)throw Error('Apex Pool card anchor drift');
 source=source.replace(OLD_LEDE,NEW_LEDE);
 const adjustedStart=source.indexOf('<a class="dx-sport" data-sport-game="Apex Pool"');
 const adjustedEnd=source.indexOf('</a>',adjustedStart)+4;
 source=source.slice(0,adjustedEnd)+NEW_CARDS+source.slice(adjustedEnd);
 if(count(source,'id="homeSports"')!==1||count(source,'data-release="Apex Pool"')!==1||count(source,'id="newrelease"')!==1)throw Error('protected homepage component drift');
 return source;
}
function transformSite(source){
 const doc=JSON.parse(source),doors=doc.doors||[],catalog=doc.features?.downloads?.catalog||[];
 const present=NAMES.map(n=>doors.filter(d=>d.title===n).length);
 if(doors.length===14&&present.every(x=>x===1)&&DOORS.every(d=>doors.some(x=>JSON.stringify(x)===JSON.stringify(d))))return source;
 if(doors.length!==12||present[0]!==1||present[1]!==0||present[2]!==0||present[3]!==0)throw Error('door baseline drift');
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
console.log(afterIndex===beforeIndex&&afterSite===beforeSite?'NO-OP: four-game homepage Sports is canonical.':'Applied Apex Golf and Apex Tennis to the existing homepage Sports section and relative doors.');
