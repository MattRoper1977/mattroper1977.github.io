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
