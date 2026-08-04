#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),indexFile=path.join(root,'index.html'),siteFile=path.join(root,'site.json');
const START='<!-- apexpool-home-2026-08-04 START -->',END='<!-- apexpool-home-2026-08-04 END -->';
const css=`/* ---------- Sports catalogue: hardcoded no-JS baseline ---------- */
.dx-sports{background:var(--dx-lite);padding:.2rem 0 2.6rem}
.dx-sports .dx-sports-lede{max-width:42rem;margin:.75rem auto 1rem;text-align:center;color:var(--dx-mut);font-size:.9rem;line-height:1.5}
.dx-sports-grid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;max-width:760px;margin:0 auto}
a.dx-sport{--sport:var(--dx-amber);display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:.8rem;min-height:92px;padding:.9rem 1rem;background:var(--dx-card);border:1.5px solid var(--dx-line);border-left:5px solid var(--sport);border-radius:14px;text-decoration:none;color:var(--dx-ink);box-shadow:0 3px 10px #161D3D0d;transition:transform .18s ease,border-color .18s ease}
a.dx-sport:hover{transform:translateY(-2px);border-color:var(--sport)}
a.dx-sport:focus-visible{outline:3px solid var(--dx-amber);outline-offset:2px}
.dx-sport-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:var(--dx-lite);border:1px solid var(--sport);font-size:1.55rem}
.dx-sport-copy b{display:block;color:var(--dx-title);font-size:1rem;line-height:1.2}
.dx-sport-copy span{display:block;color:var(--dx-mut);font-size:.76rem;line-height:1.4;margin-top:.2rem}
.dx-sport-go{font-size:.72rem;font-weight:800;white-space:nowrap;color:var(--dx-eyeb)}
@media(max-width:620px){.dx-sports-grid{grid-template-columns:1fr}.dx-sport-go{justify-self:end}}
@media(prefers-reduced-motion:reduce){a.dx-sport{transition:none}a.dx-sport:hover{transform:none}}

`;
const release=`<div class="dx-updbox" data-release="Apex Pool" style="border-left:4px solid #F2A24A">
<p class="dx-when">August 2026 &middot; Games Arcade</p>
<h3>Apex Pool &mdash; call the leave, then prove it</h3>
<ul class="dx-updlist">
<li><span class="dx-dot"></span><span><b>Call the cue ball's leave, then prove you can read the table.</b> Position play is part of the shot, not an afterthought.</span></li>
<li><span class="dx-dot"></span><span><b>Play complete offline 8-ball with genuine spin.</b> AI opponents and trick shots give you more than one way to solve the table.</span></li>
<li><span class="dx-dot"></span><span><b>Get an honest Leave Rating.</b> The cue-ball finish stays visible alongside the result.</span></li>
</ul>
<div class="dx-updacts">
<a class="dx-chip dx-main" href="/apexpool/">Play Apex Pool &rarr;</a>
<a class="dx-chip" href="games/">Browse the Arcade</a>
</div>
</div>
`;
const sports=`${START}
<section class="dx-sports" id="homeSports"><div class="dx-wrap">
<h2 class="dx-eyebrow">Sports</h2>
<p class="dx-sports-lede">Two games about reading a line, controlling the finish and making the next decision count.</p>
<div class="dx-sports-grid" aria-label="Sports games">
<a class="dx-sport" data-sport-game="Apex Kick" href="/apexkick/" style="--sport:#2F8F6B">
<span class="dx-sport-icon" aria-hidden="true">⚽</span><span class="dx-sport-copy"><b>Apex Kick</b><span>Bend the free kick around the wall; card stats set the physics, never the dice.</span></span><span class="dx-sport-go">Play &rarr;</span>
</a>
<a class="dx-sport" data-sport-game="Apex Pool" href="/apexpool/" style="--sport:#F2A24A">
<span class="dx-sport-icon" aria-hidden="true">🎱</span><span class="dx-sport-copy"><b>Apex Pool</b><span>Call the cue ball's leave, apply genuine spin and make the table prove you right.</span></span><span class="dx-sport-go">Play &rarr;</span>
</a>
</div>
</div></section>
${END}

`;
function n(s,x){return s.split(x).length-1}
function transformIndex(source){
 if(n(source,'data-release="Apex Pool"')===1&&n(source,'id="homeSports"')===1&&source.includes('.dx-duo.dx-trio>.dx-prod:nth-child(3):last-child'))return source;
 if(source.includes(START)||source.includes(END)||source.includes('data-release="Apex Pool"'))throw Error('partial homepage state');
 const cssAnchor='/* ---------- latest drops rail ---------- */';if(n(source,cssAnchor)!==1)throw Error('CSS anchor drift');source=source.replace(cssAnchor,css+cssAnchor);
 const outgoing='<div class="dx-updbox" style="border-left:4px solid #A78BFA">',science='<div class="dx-updbox" style="border-left:4px solid #2F6B4D">';
 if(n(source,outgoing)!==1||n(source,science)!==1)throw Error('New Release baseline drift');const a=source.indexOf(outgoing),b=source.indexOf(science,a);if(a<0||b<=a)throw Error('release isolation failed');source=source.slice(0,a)+release+source.slice(b);
 const latest='<section class="dx-drops" id="latest" hidden>';if(n(source,latest)!==1)throw Error('Latest anchor drift');source=source.replace(latest,sports+latest);
 const oldGrid='.dx-duo.dx-trio>.dx-prod:nth-child(3){grid-column:1/-1}',newGrid='.dx-duo.dx-trio>.dx-prod:nth-child(3):last-child{grid-column:1/-1}';if(n(source,oldGrid)!==1)throw Error('door grid anchor drift');return source.replace(oldGrid,newGrid);
}
function transformSite(source){
 const d=JSON.parse(source),doors=d.doors||[],catalog=d.features?.downloads?.catalog||[];
 if(doors.some(x=>x.title==='Off-Brand')){if(doors.length!==12||doors.filter(x=>x.title==='Apex Kick').length!==1)return (()=>{throw Error('partial door state')})();return source;}
 if(doors.length!==11||doors.filter(x=>x.title==='Apex Kick').length!==1)throw Error('door baseline drift');
 const survivors=JSON.stringify(doors);doors.push({zone:'games',title:'Off-Brand',desc:'Six workshop shapes, one Glitch in disguise — read the trails, scene log and Roll Call to find who does not fit.',href:'Lessons/Games/Off_Brand.html',countKey:'off-brand',image:'assets/cards/off-brand-door.svg',imageAlt:'Off-Brand — six workshop shapes with a violet diamond Glitch',imageW:120,imageH:96,badgeIcon:'🎮',badgeLabel:'plays'});
 if(JSON.stringify(doors.slice(0,-1))!==survivors)throw Error('existing doors changed');const i=catalog.findIndex(x=>x.key==='apex-kick');if(i<0||catalog.some(x=>x.key==='off-brand'))throw Error('catalog baseline drift');catalog.splice(i+1,0,{key:'off-brand',title:'Off-Brand'});return JSON.stringify(d,null,2)+'\n';
}
const ib=fs.readFileSync(indexFile,'utf8'),sb=fs.readFileSync(siteFile,'utf8'),ia=transformIndex(ib),sa=transformSite(sb);
if(transformIndex(ia)!==ia||transformSite(sa)!==sa)throw Error('idempotency failure');
if(ia!==ib)fs.writeFileSync(indexFile,ia);if(sa!==sb)fs.writeFileSync(siteFile,sa);
console.log(ia===ib&&sa===sb?'NO-OP: homepage publication already canonical.':'Applied Apex Pool New Release, hardcoded Sports, Off-Brand door #12 and six-door grid reflow.');
