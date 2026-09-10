// usage: node pinch26_run.cjs [variant] [controlFile] [outFile] [rowDir]
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const INST='/tmp/claude-0/-home-user-Lessons/db41bf53-c005-5b05-a736-7ebf5e2662a3/scratchpad/pinch/pinch_instrument.cjs';
const VARIANT=process.argv[2]||'shell-chain-default', CTLFILE=process.argv[3]||'pinch_control.json', OUTFILE=process.argv[4]||'pinch26.json', ROWDIR=process.argv[5]||'pinch_rows';
fs.mkdirSync(ROWDIR,{recursive:true});
const pop=JSON.parse(fs.readFileSync('population.json','utf8'));
const ctl=JSON.parse(fs.readFileSync(CTLFILE,'utf8'));
if(!ctl.pass) { console.error('pinch control did not pass; refusing to measure'); process.exit(2); }
if(ctl.variant!==VARIANT) { console.error(`control file variant ${ctl.variant} != requested ${VARIANT}`); process.exit(2); }
const EDU='http://127.0.0.1:4612', PLAY='http://127.0.0.1:4611';
const rows=[];
for(const r of pop.routes){
  const url=(r.kind==='education'?EDU:PLAY)+r.route;
  const out=path.join(ROWDIR, r.route.replace(/[^A-Za-z0-9._-]+/g,'_')+'.json');
  const p=spawnSync(process.execPath,[INST,'--url',url,'--out',out,'--variant',VARIANT],{encoding:'utf8',timeout:180000});
  let m=null; try{ m=JSON.parse(fs.readFileSync(out,'utf8')); }catch(e){}
  if(m && m.variant!==VARIANT) throw new Error('row variant mismatch '+m.variant);
  const row={route:r.route, kind:r.kind, repo:r.repo, path:r.path, pr:r.pr, url,
    httpStatus:m&&m.status, scaleBefore:m?m.scaleBefore:null, scaleAfter:m?m.scaleAfter:null, scaleAfterCdp:m?m.scaleAfterCdp:null,
    passed: !!(m && typeof m.scaleAfter==='number' && m.scaleAfter>1.0),
    marginal: !!(m && typeof m.scaleAfter==='number' && m.scaleAfter>1.0 && m.scaleAfter<=1.05),
    method:m?m.method:null, methodsTried:m?m.methodsTried:null, viewportMeta:m?m.viewportMeta:null,
    elementAtPinchPoint:m?m.elementAtPinchPoint:null, touchActionAtPoint:m?m.touchActionAtPinchPoint:null, touchActionChain:m?m.touchActionChain:null,
    visualViewportWidthAfter:m&&m.after&&m.after.js?m.after.js.width:null, exitCode:p.status, error:(m&&m.error)||(p.status!==0?(p.stderr||'').split('\n').slice(-3).join(' '):undefined), rowFile:out};
  rows.push(row);
  console.error(`${r.kind} ${r.route} before=${row.scaleBefore} after=${row.scaleAfter} method=${row.method} ta@pt=${row.touchActionAtPoint} => ${row.passed?'ZOOMED':'BLOCKED'}${row.error?' ERR '+row.error:''}`);
}
const n=rows.filter(r=>r.passed).length;
const result={generatedAt:new Date().toISOString(), instrument:INST, variant:VARIANT, methods:ctl.methods, browserVersion:ctl.browserVersion, playwright:ctl.playwright, node:ctl.node,
  emulation:{viewport:'390x844',isMobile:true,hasTouch:true,deviceScaleFactor:3,pinch:{x:195,y:400,scaleFactor:2.5,relativeSpeed:400}},
  origins:{education:EDU+' (edu_serve.cjs over edu-main build: / -> education-site, /Lessons/ -> education-lessons, /Matt-s-Apps-/ -> education-apps)', play:PLAY+' (domain-split/play/serve.cjs over play-main/games)'},
  control:{file:CTLFILE, variant:ctl.variant, pass:ctl.pass, runs:ctl.runs.map(r=>({label:r.label,kind:r.kind,url:r.url,scaleBefore:r.scaleBefore,scaleAfterJs:r.scaleAfter,scaleAfterCdp:r.scaleAfterCdp,method:r.method,pass:r.pass,finishedAt:r.finishedAt}))},
  passRule:'passed = scaleAfter > 1.0 (JS visualViewport.scale); rows with 1.0 < scaleAfter <= 1.05 are additionally flagged marginal',
  summary:{total:rows.length, zoomed:n, blocked:rows.length-n, marginal:rows.filter(r=>r.marginal).length,
    blockedRoutes:rows.filter(r=>!r.passed).map(r=>({route:r.route,scaleAfter:r.scaleAfter,touchActionAtPoint:r.touchActionAtPoint,elementAtPinchPoint:r.elementAtPinchPoint})),
    byKind:{education:{total:rows.filter(r=>r.kind==='education').length,zoomed:rows.filter(r=>r.kind==='education'&&r.passed).length},play:{total:rows.filter(r=>r.kind==='play').length,zoomed:rows.filter(r=>r.kind==='play'&&r.passed).length}}},
  routes:rows};
fs.writeFileSync(OUTFILE,JSON.stringify(result,null,2));
console.log(JSON.stringify(result.summary));
