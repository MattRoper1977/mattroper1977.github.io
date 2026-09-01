#!/usr/bin/env python3
"""TFR2 build: input_v4.html -> titanforge.html.

Every edit to an existing layer is a single asserted string replacement that must
match exactly once. New behaviour lives in the V5 layer assembled from _tfr2/src/.
Phases are cumulative; pass --through P3 to build only up to a phase.
"""
import sys, re, pathlib, json, hashlib
HERE=pathlib.Path(__file__).resolve().parent.parent
SRC=HERE/'src'
THROUGH=(sys.argv[sys.argv.index('--through')+1] if '--through' in sys.argv else 'P7')
ORDER=['P2','P3','P4','P5','P6','P7']
def active(phase):return ORDER.index(phase)<=ORDER.index(THROUGH)

text=(HERE/'input_v4.html').read_text(encoding='utf-8')
# Pinned input: sha256 of Titan_Forge_AAA_Release_V4.html as delivered with order TFR2 on 2026-09-01
# (2,121,261 B). The build refuses any other input, so every patch below is asserted against one text.
assert hashlib.sha256(text.encode('utf-8')).hexdigest()=='fc9699b5c1a1e02f694b31b20cb918796d02cc8269385b3f2ba3f6bf93418f8f','input hash mismatch'
log=[]
def rep(phase,label,old,new):
    global text
    if not active(phase):return
    n=text.count(old)
    assert n==1,f'{phase} {label}: expected exactly 1 match, found {n}'
    text=text.replace(old,new)
    log.append(f'{phase} {label}: 1 match replaced')

# ---------------- P2 ----------------
rep('P2','L7 graphics off on fresh saves',
 'graphics:{enabled:!!(window.matchMedia&&!window.matchMedia("(pointer:coarse)").matches&&Math.min(innerWidth,innerHeight)>=650&&(navigator.hardwareConcurrency||4)>=6)}',
 'graphics:{enabled:false}')
rep('P2','L5 speed table',
 '  function PhaseController(){this.phase="concentric";',
 '  var SPEED={base:2200,warm:2800,warmReps:15,rampReps:30,capSpeed:1.05,fatSlope:.0022,eccentric:1150,perfectHalfWidth:.07,amplitude:.48,centre:.72},sessionTriReps=0;\n'
 '  function drivePeriod(rep){rep=Math.max(0,rep|0);if(rep<SPEED.warmReps)return SPEED.warm;if(rep>=SPEED.rampReps)return SPEED.base;return SPEED.warm-(SPEED.warm-SPEED.base)*((rep-SPEED.warmReps)/(SPEED.rampReps-SPEED.warmReps));}\n'
 '  function driveSpeed(fat){return Math.min(SPEED.capSpeed,1+clamp(fat,0,100)*SPEED.fatSlope);}\n'
 '  function perfectDwellMs(period,fat){var lo=(SPEED.centre-SPEED.perfectHalfWidth-.5)/SPEED.amplitude,hi=(SPEED.centre+SPEED.perfectHalfWidth-.5)/SPEED.amplitude;return (Math.asin(hi)-Math.asin(lo))/(Math.PI*2)*(period/driveSpeed(fat));}\n'
 '  function PhaseController(){this.phase="concentric";')
rep('P2','L5 concentric period + fatigue cap',
 'var speed=1+fat*.0035,jitter=fat>80?Math.sin(t*.09)*(fat-80)*.0012:0;this.position=clamp(.5+.48*Math.sin(elapsed/1180*Math.PI*2*speed)+jitter,.02,.98);',
 'var speed=driveSpeed(fat),jitter=fat>80?Math.sin(t*.09)*(fat-80)*.0012:0;this.position=clamp(.5+.48*Math.sin(elapsed/drivePeriod(sessionTriReps)*Math.PI*2*speed)+jitter,.02,.98);')
rep('P2','L5 eccentric divisor',
 'this.position=clamp(elapsed/(950/(1+fat*.002)),0,1);',
 'this.position=clamp(elapsed/(SPEED.eccentric/(1+fat*.002)),0,1);')
rep('P2','L5 session rep counter',
 '    if(this.committing)return;this.committing=true;var total=this.phaseGrades.reduce(',
 '    if(this.committing)return;this.committing=true;sessionTriReps++;var total=this.phaseGrades.reduce(')
rep('P2','L5 test seam',
 'workerSource:workerSource};',
 'workerSource:workerSource,speed:SPEED,drivePeriod:drivePeriod,driveSpeed:driveSpeed,perfectDwellMs:perfectDwellMs,sessionTriReps:function(){return sessionTriReps;}};')
rep('P2','L6 V3 toast seam',
 'API.saveKey=V3_KEY;API.getState=function(){return JSON.parse(JSON.stringify(state));};API.auras=',
 'API.saveKey=V3_KEY;API.toast=toast;API.getState=function(){return JSON.parse(JSON.stringify(state));};API.auras=')

# ---------------- P3 (G3: 2D FX upgrade inside mbm-titan-mobile-v2-script) ----------------
def rep_line(phase,label,anchor,new):
    """Replace the single line that contains `anchor` (must match exactly one line)."""
    global text
    if not active(phase):return
    lines=text.split('\n');hits=[i for i,l in enumerate(lines) if anchor in l]
    assert len(hits)==1,f'{phase} {label}: expected exactly 1 line, found {len(hits)}'
    lines[hits[0]]=new;text='\n'.join(lines);log.append(f'{phase} {label}: 1 line replaced')

rep('P3','G3 pool 96/48 + particle kinds',
 'this.maxParticles=low?24:48;for(var i=0;i<this.maxParticles;i++)this.pool.push({life:0,x:0,y:0,vx:0,vy:0,size:1,color:"#fff"});',
 'this.maxParticles=low?48:96;for(var i=0;i<this.maxParticles;i++)this.pool.push({life:0,ttl:1,x:0,y:0,vx:0,vy:0,size:1,color:"#fff",kind:"spark",g:180});this.glow=0;this.shock=0;')
rep('P3','G3 idle fix: setEnabled only re-arms on a real change',
 'TitanFallbackFX.prototype.setEnabled=function(on){this.visible=!!on;this.fighter.classList.toggle("mbm-v2-fx-off",!on);if(on)this.request(120);else{this.stop();if(this.ctx)this.ctx.clearRect(0,0,this.lastW,this.lastH);}};',
 'TitanFallbackFX.prototype.setEnabled=function(on){on=!!on;var changed=on!==this.visible||!this.everEnabled;this.everEnabled=true;this.visible=on;this.fighter.classList.toggle("mbm-v2-fx-off",!on);if(!changed)return;if(on)this.request(120);else{this.stop();if(this.ctx)this.ctx.clearRect(0,0,this.lastW,this.lastH);}};')
rep('P3','G3 chalk on DRIVE tap',
 'TitanFallbackFX.prototype.pulsePhase=function(){this.request(reduced()?80:720);};',
 'TitanFallbackFX.prototype.pulsePhase=function(){var track=refs.phaseTrack,drive=!track||!(track.classList.contains("iso")||track.classList.contains("eccentric"));if(drive&&!reduced())this.spawn(.5,"chalk");this.request(reduced()?80:520);};\n'
 '  TitanFallbackFX.prototype.zonePalette=function(){var z=this.fighter.getAttribute("data-mbm-zone");return z==="foundry"?["#ff5ce6","#ffb3f4","#b56bff"]:z==="citadel"?["#62e4ff","#d6fbff","#8fb8ff"]:["#ffd85c","#ff793f","#ffb347"];};\n'
 '  TitanFallbackFX.prototype.alloc=function(){for(var i=0;i<this.pool.length;i++)if(this.pool[i].life<=0)return this.pool[i];return null;};')
rep('P3','G3 lockout burst + glow + shock',
 'TitanFallbackFX.prototype.triggerLift=function(grade){this.grade=grade||"SOLID";this.impact=grade==="PERFECT"?1:grade==="GREAT"?.72:.44;this.pumpUntil=performance.now()+780;this.spawn(this.impact);this.request(reduced()?120:1150);};',
 'TitanFallbackFX.prototype.triggerLift=function(grade){this.grade=grade||"SOLID";this.impact=grade==="PERFECT"?1:grade==="GREAT"?.72:.44;this.pumpUntil=performance.now()+780;this.shock=this.impact;this.glow=grade==="PERFECT"&&!reduced()?1:0;if(this.glow)metrics.glowPasses=(metrics.glowPasses||0)+1;this.spawn(this.impact,"ember");this.spawn(this.impact,"spark");this.request(reduced()?120:900);};')
rep_line('P3','G3 spawn by kind','TitanFallbackFX.prototype.spawn=function(power){',
 '  TitanFallbackFX.prototype.spawn=function(power,kind){if(reduced())return;kind=kind||"spark";var pal=this.zonePalette(),w=this.lastW,h=this.lastH,count=kind==="chalk"?10:kind==="glint"?2:kind==="ember"?Math.round(10+power*26):Math.round(8+power*18),n=0;for(var i=0;i<count;i++){var p=this.alloc();if(!p)break;n++;p.kind=kind;if(kind==="chalk"){p.x=w*(.36+Math.random()*.28);p.y=h*(.5+Math.random()*.14);p.vx=(Math.random()-.5)*26;p.vy=-14-Math.random()*22;p.size=1.6+Math.random()*2.4;p.ttl=p.life=.7+Math.random()*.5;p.color="#f4f1ea";p.g=-8;}else if(kind==="glint"){p.x=w*(.34+Math.random()*.32);p.y=h*(.16+Math.random()*.2);p.vx=(Math.random()-.5)*10;p.vy=8+Math.random()*16;p.size=1+Math.random()*1.2;p.ttl=p.life=.22+Math.random()*.2;p.color="#ffffff";p.g=90;}else if(kind==="ember"){var a=Math.PI*(1.05+Math.random()*.9),sp=(60+Math.random()*150)*power;p.x=w*.5+(Math.random()-.5)*w*.16;p.y=h*.7;p.vx=Math.cos(a)*sp;p.vy=Math.sin(a)*sp-40;p.size=1.4+Math.random()*2.6;p.ttl=p.life=.45+Math.random()*.45;p.color=pal[i%3];p.g=150;}else{var b=Math.PI*(1.08+Math.random()*.84),s2=(45+Math.random()*135)*power;p.x=w*.5;p.y=h*.72;p.vx=Math.cos(b)*s2;p.vy=Math.sin(b)*s2-30;p.size=1+Math.random()*2.5;p.ttl=p.life=.45+Math.random()*.45;p.color=i%3===0?"#6ee7ff":i%2?"#ffd85c":"#ff793f";p.g=180;}}metrics.spawned=(metrics.spawned||0)+n;};')
rep_line('P3','G3 shockwave scaled by grade','TitanFallbackFX.prototype.drawImpact=function(ctx,t){',
 '  TitanFallbackFX.prototype.drawImpact=function(ctx,t){if(this.impact<=.01)return;var age=Math.max(0,1-(this.activeUntil-performance.now())/900),scale=.5+this.shock*.7,r=this.lastW*(.08+age*.46)*scale;ctx.save();ctx.globalAlpha=Math.max(0,(1-age)*this.impact*.75);ctx.strokeStyle=this.grade==="PERFECT"?"#ffd85c":this.zonePalette()[1];ctx.lineWidth=2+this.shock*3;ctx.beginPath();ctx.ellipse(this.lastW*.5,this.lastH*.9,r,r*.22,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha*=.3;ctx.lineWidth+=6;ctx.stroke();ctx.globalAlpha/=.3;if(this.shock>.8){ctx.globalAlpha*=.5;ctx.beginPath();ctx.ellipse(this.lastW*.5,this.lastH*.9,r*.62,r*.14,0,0,Math.PI*2);ctx.stroke();}ctx.restore();if(this.glow>0){var g=this.glow*Math.max(0,1-age*1.4);if(g>0){var pal=this.zonePalette(),grad=ctx.createRadialGradient(this.lastW*.5,this.lastH*.42,0,this.lastW*.5,this.lastH*.42,this.lastW*.42);grad.addColorStop(0,pal[0]);grad.addColorStop(.5,pal[2]);grad.addColorStop(1,"rgba(0,0,0,0)");ctx.save();ctx.globalCompositeOperation="lighter";ctx.globalAlpha=g*.45;ctx.fillStyle=grad;ctx.fillRect(0,0,this.lastW,this.lastH);ctx.restore();}}};')
rep_line('P3','G3 particle kinds draw','TitanFallbackFX.prototype.drawParticles=function(ctx,dt){',
 '  TitanFallbackFX.prototype.drawParticles=function(ctx,dt){var live=false;ctx.save();for(var i=0;i<this.pool.length;i++){var p=this.pool[i];if(p.life<=0)continue;live=true;p.life-=dt;p.vy+=(p.g||180)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;var a=Math.max(0,p.life/(p.ttl||1));ctx.fillStyle=p.color;if(p.kind==="chalk"){ctx.globalCompositeOperation="source-over";ctx.globalAlpha=a*.55;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1.4-a*.4),0,Math.PI*2);ctx.fill();}else if(p.kind==="glint"){ctx.globalCompositeOperation="lighter";ctx.globalAlpha=a;ctx.fillRect(p.x,p.y,p.size,p.size);}else if(p.kind==="ember"){ctx.globalCompositeOperation="lighter";ctx.globalAlpha=a*.95;ctx.beginPath();ctx.arc(p.x,p.y,p.size*.9,0,Math.PI*2);ctx.fill();}else{ctx.globalCompositeOperation="screen";ctx.globalAlpha=a;ctx.fillRect(p.x,p.y,p.size,p.size*2.4);}}ctx.restore();return live;};')
rep_line('P3','G3 frame: brace glints keep the loop only while bracing','TitanFallbackFX.prototype.frame=function(t){',
 '  TitanFallbackFX.prototype.frame=function(t){this.raf=0;if(!this.ctx||!this.visible||!this.inView||document.hidden)return;if(performance.now()<this.pausedUntil){var paused=this;this.raf=requestAnimationFrame(function(n){paused.frame(n);});return;}var dt=Math.min(.05,Math.max(.001,(t-this.lastFrame)/1000));this.lastFrame=t;if(window.__MBM_TITAN_KINETIC__&&window.__MBM_TITAN_KINETIC__.stepFallback)window.__MBM_TITAN_KINETIC__.stepFallback(dt);if(!(metrics.draws%12))this.resize();var ctx=this.ctx,w=this.lastW,h=this.lastH,bracing=!!(refs.phaseTrack&&refs.phaseTrack.classList.contains("iso"))&&!reduced();if(bracing&&Math.random()<.4)this.spawn(1,"glint");ctx.clearRect(0,0,w,h);ctx.save();ctx.globalCompositeOperation="screen";this.drawMuscles(ctx,t);this.drawBar(ctx,t);ctx.restore();this.drawImpact(ctx,t);var live=this.drawParticles(ctx,dt);metrics.draws++;if(performance.now()<this.activeUntil||live||bracing){var self=this;this.raf=requestAnimationFrame(function(n){self.frame(n);});}else{this.impact=0;this.glow=0;this.shock=0;}};')

rep('P3','perf: drawBar without canvas shadowBlur (halo = second stroke)',
 'ctx.strokeStyle=this.grade==="PERFECT"?"#ffe184":"#72eaff";ctx.lineWidth=3;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=9;ctx.beginPath();',
 'ctx.strokeStyle=this.grade==="PERFECT"?"#ffe184":"#72eaff";ctx.lineWidth=3;ctx.beginPath();')
rep('P3','perf: drawBar sleeve stroke without shadow',
 'if(i===0)ctx.moveTo(x,py);else ctx.lineTo(x,py);}ctx.stroke();ctx.lineWidth=7;ctx.shadowBlur=2;ctx.beginPath();',
 'if(i===0)ctx.moveTo(x,py);else ctx.lineTo(x,py);}ctx.stroke();ctx.globalAlpha=.16;ctx.lineWidth=10;ctx.stroke();ctx.globalAlpha=.52;ctx.lineWidth=7;ctx.beginPath();')
rep_line('P3','perf: muscle overlay cached offscreen, redrawn only when its inputs change','TitanFallbackFX.prototype.drawMuscles=function(ctx,t){',
 '  TitanFallbackFX.prototype.drawMuscles=function(ctx,t){var s=aaa(),rect=this.imageRect(),img=this.image,nowT=performance.now(),kickStep=nowT<this.pumpUntil?Math.ceil(((this.pumpUntil-nowT)/780)*8):0,kick=.035*(kickStep/8);if(!img||!img.complete||!img.naturalWidth)return;var key=[s.selectedGroup,kickStep,Math.round(rect.x),Math.round(rect.y),Math.round(rect.w),Math.round(rect.h),this.canvas.width,this.canvas.height];GROUPS.forEach(function(g){var m=s.muscles[g]||{};key.push(Math.round(clamp(m.xp,0,1e8)),Math.round(clamp(m.pump,0,100)));});key=key.join("|");var w=this.lastW,h=this.lastH,dpr=this.dpr||1;if(!this.muscleCache)this.muscleCache={canvas:document.createElement("canvas"),key:""};var mc=this.muscleCache;if(mc.key!==key){mc.canvas.width=this.canvas.width;mc.canvas.height=this.canvas.height;var c=mc.canvas.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);GROUPS.forEach(function(g){var m=s.muscles[g]||{},grow=growth(m.xp),pump=clamp(m.pump,0,100)/100,selected=g===s.selectedGroup,amount=.008+grow*.055+pump*.018+(selected?kick:.0);if(amount<.012&&!selected)return;(ZONES[g]||[]).forEach(function(z){var cx=rect.x+z.x*rect.w,cy=rect.y+z.y*rect.h,rx=z.rx*rect.w,ry=z.ry*rect.h;c.save();c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);c.clip();c.globalAlpha=.34+grow*.36;c.translate(cx,cy);c.scale(1+amount,1+amount*.46);c.translate(-cx,-cy);c.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,rect.x,rect.y,rect.w,rect.h);c.restore();if(selected||pump>.15){var glow=c.createRadialGradient(cx,cy,0,cx,cy,rx*1.25);glow.addColorStop(0,COLORS[g]+(selected?"66":"32"));glow.addColorStop(1,COLORS[g]+"00");c.fillStyle=glow;c.beginPath();c.ellipse(cx,cy,rx*1.35,ry*1.35,0,0,Math.PI*2);c.fill();}});});mc.key=key;metrics.muscleBakes=(metrics.muscleBakes||0)+1;}ctx.drawImage(mc.canvas,0,0,mc.canvas.width,mc.canvas.height,0,0,w,h);};')

# ---------------- P4 ----------------
rep('P4','V4 announcer seam (one live region for every announcement)',
 'API.saveKey=SAVE_KEY;API.dnaSaveKey=DNA_KEY;API.getState=function(){return JSON.parse(JSON.stringify(state));};',
 'API.saveKey=SAVE_KEY;API.dnaSaveKey=DNA_KEY;API.announce=announce;API.getState=function(){return JSON.parse(JSON.stringify(state));};')

# ---------------- P5 ----------------
rep('P5','A3 core hook __MBM_TITAN_GEM_GRANT__ consumed on the next lift',
 'gems:je.gems+(D0?1:0),reps:je.reps+1,',
 'gems:je.gems+(D0?1:0)+(window.__MBM_TITAN_GEM_GRANT__>0?(window.__MBM_TITAN_GEM_GRANT__=0,1):0),reps:je.reps+1,')
rep('P5','A1/A6 V3 fresh state carries music + coachSeen',
 'function fresh(){return {schema:1,build:"mobile-v3",owned:["ember"],aura:"ember",setIndex:-1,setGrades:[],nextMult:1,nextLabel:"",lastDay:"",streak:0,cleanSets:0,flawlessSets:0,hintSeen:false,auraOpen:false,updatedAt:Date.now()};}',
 'function fresh(){return {schema:1,build:"mobile-v3",owned:["ember"],aura:"ember",setIndex:-1,setGrades:[],nextMult:1,nextLabel:"",lastDay:"",streak:0,cleanSets:0,flawlessSets:0,hintSeen:false,auraOpen:false,music:false,coachSeen:false,updatedAt:Date.now()};}')
rep('P5','A1/A6 V3 load keeps music + coachSeen',
 'b.hintSeen=!!r.hintSeen;b.auraOpen=!!r.auraOpen;return b;}',
 'b.hintSeen=!!r.hintSeen;b.auraOpen=!!r.auraOpen;b.music=!!r.music;b.coachSeen=!!r.coachSeen;return b;}')
rep('P5','A6 V3 one-time hint retired (coach overlay replaces it)',
 'if(!state.hintSeen){var hint=node("div","mbm-v3-hint",',
 'if(false){var hint=node("div","mbm-v3-hint",')
rep('P5','A1/A6 V3 flag setter seam',
 'API.saveKey=V3_KEY;API.toast=toast;',
 'API.saveKey=V3_KEY;API.toast=toast;API.setFlag=function(k,v){if(k==="music"||k==="coachSeen"||k==="hintSeen"){state[k]=!!v;persist();return true;}return false;};')
rep('P5','A9 V3 toast forwards to the one announcer',
 'function toast(title,sub,gold){if(!refs.toast)return;',
 'function toast(title,sub,gold){var v4=window.__MBM_TITAN_V4__;if(v4&&v4.announce)v4.announce(title+(sub?" · "+sub:""));if(!refs.toast)return;')
rep('P5','A3 AAA brace hook __MBM_TITAN_BRACE_MS__',
 'if(elapsed>=(this.bossRep?1400:750))this.beginEccentric();',
 'if(elapsed>=(this.bossRep?1400:(window.__MBM_TITAN_BRACE_MS__>0?window.__MBM_TITAN_BRACE_MS__:750)))this.beginEccentric();')
rep('P5','A9 AAA prompt announcements go to the one announcer',
 'PhaseController.prototype.setPrompt=function(text,announce){if(refs.phasePrompt)refs.phasePrompt.textContent=text;if(announce&&refs.live)refs.live.textContent=text;};',
 'PhaseController.prototype.setPrompt=function(text,announce){if(refs.phasePrompt)refs.phasePrompt.textContent=text;if(announce){var v4=window.__MBM_TITAN_V4__;if(v4&&v4.announce)v4.announce(text);else if(refs.live)refs.live.textContent=text;}};')
rep('P5','A9 AAA trial announcements go to the one announcer',
 'if(refs.live)refs.live.textContent=live?"Trial started: rapid single-tap lifts on the gold timing meter":"Trial finished";',
 'var v4a=window.__MBM_TITAN_V4__,trialText=live?"Trial started: rapid single-tap lifts on the gold timing meter":"Trial finished";if(v4a&&v4a.announce)v4a.announce(trialText);else if(refs.live)refs.live.textContent=trialText;')

rep('P5','A9 V4 announcer keeps a lift line on screen for 1.5 s; later prompts append instead of replacing',
 'function announce(text){if(refs.live)refs.live.textContent=text;}',
 'function announce(text){if(!refs.live)return;var hold=window.__MBM_TITAN_ANNOUNCE_HOLD__;if(hold&&Date.now()<hold.until&&text!==hold.text){refs.live.textContent=hold.text+" · "+text;return;}refs.live.textContent=text;}')

# ---------------- V5 layer assembly ----------------
blocks=[]
def block(phase,name,kind):
    p=SRC/name
    if not active(phase) or not p.exists():return
    body=p.read_text(encoding='utf-8').rstrip('\n')
    sid=name.replace('.','-')
    if kind=='css':blocks.append(f'<style id="mbm-titan-{sid}">\n{body}\n</style>')
    else:blocks.append(f'<script id="mbm-titan-{sid}">\n{body}\n</script>')
    log.append(f'{phase} layer {name}: {len(body)} chars')
block('P2','v5-layout.css','css')
block('P3','v5-graphics.css','css')
block('P4','v5-duel.css','css')
block('P5','v5-polish.css','css')
block('P2','v5-core.js','js')
block('P3','v5-graphics.js','js')
block('P4','v5-qr.js','js')
block('P4','v5-duel.js','js')
block('P5','v5-music.js','js')
block('P5','v5-polish.js','js')
marker='<!-- MBM TITAN FORGE RELEASE V4: END -->\n'
assert text.count(marker)==1
layer='<!-- MBM TITAN FORGE V5: BEGIN -->\n'+'\n'.join(blocks)+'\n<!-- MBM TITAN FORGE V5: END -->\n'
text=text.replace(marker,marker+layer)

# version stamps (release object + title) -- P7 only touches the stamp
rep('P2','V5 release stamp',
 'window.__MBM_TITAN_RELEASE__={name:"Titan Forge: Strength Ascension",version:"4.0.0-rc1",build:"single-file-offline",released:"2026-09-01"};',
 'window.__MBM_TITAN_RELEASE__={name:"Titan Forge: Strength Ascension",version:"5.0.0",build:"single-file-offline",released:"2026-09-01"};')
rep('P2','title stamp','<title>Titan Forge: Strength Ascension — Release V4</title>','<title>Titan Forge: Strength Ascension — Release V5</title>')

out=HERE/'titanforge.html'
out.write_text(text,encoding='utf-8')
print('\n'.join(log))
print('built',out,len(text.encode('utf-8')),'bytes',hashlib.sha256(text.encode('utf-8')).hexdigest())
