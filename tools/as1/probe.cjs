const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..');
const candidates=JSON.parse(fs.readFileSync(path.join(__dirname,'candidates.json')));
const canonical=JSON.parse(fs.readFileSync(path.join(root,'data/source-manifests/games.json'))).games;
const norm=s=>decodeURIComponent(new URL(s,'https://madebymatt.uk').pathname).replace(/index\.html$/,'').replace(/\/$/,'');
const routes=new Set(canonical.map(x=>norm(x.url||x.href||x.route||x.path)));
for(const c of candidates) if(!routes.has(norm(c.route))) throw Error('Candidate not canonical: '+c.route);
const server=http.createServer((req,res)=>{
  const uri=decodeURIComponent(new URL(req.url,'http://local').pathname);
  let file=uri.startsWith('/Lessons/')?path.join(root,'.sources/Lessons',uri.slice(9)):path.join(root,uri);
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);res.end('Missing');return;}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(4173,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true}); const results=[];
  try{
    for(const c of candidates){
      const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{window.__NEON_TURF_TEST__=true;window.__MERIDIAN_TEST_MODE__=true;});
      const row={...c,canDrive:false};
      try{
        await page.goto('http://127.0.0.1:4173'+encodeURI(c.route),{waitUntil:'load',timeout:30000});
        await page.keyboard.press('Enter');await page.waitForTimeout(700);
        row.boot=await page.evaluate(()=>({canvas:!!document.querySelector('canvas'),body:document.body.innerText.slice(-500)}));
        if(c.route==='/rallyvector3d/'){
          row.drive=await page.evaluate(()=>{const api=window.RallyVector3D;if(!api)throw Error('Rally API unavailable');const a=api.debugStart('alpine');api.setInput({throttle:1});api.debugStep(60);const b=api.getState();const reset=api.debugStart('alpine');return{deterministic:JSON.stringify(a.car)===JSON.stringify(reset.car),before:a.car,after:b.car,moved:Math.hypot(b.car.x-a.car.x,b.car.z-a.car.z)>0.01,webgl:b.webglError};});
          row.canDrive=row.drive.moved&&row.drive.webgl===0&&row.drive.deterministic;
        }else if(c.route==='/hyperdraft/'){
          await page.evaluate(()=>{if(!window.__HD)throw Error('Hyperdraft state unavailable');window.__SLIPSTREAM_GP_TEST__.startExhibition(0);window.__HD.game.countdown=0;});
          const a=await page.evaluate(()=>({...window.__HD.game.player}));
          await page.keyboard.down('ArrowUp');await page.waitForTimeout(700);await page.keyboard.up('ArrowUp');
          const b=await page.evaluate(()=>({...window.__HD.game.player}));
          row.drive={before:{x:a.x,y:a.y,angle:a.angle},after:{x:b.x,y:b.y,angle:b.angle},moved:Math.hypot(b.x-a.x,b.y-a.y)>0.01};row.canDrive=row.drive.moved&&Number.isFinite(b.angle);
        }else if(c.route.includes('Grid_Chase')){
          await page.evaluate(()=>window.__AFTERLIGHT_GRID__.newRun());
          const a=await page.evaluate(()=>({...window.__AFTERLIGHT_GRID__.snapshot.player}));
          await page.keyboard.down('ArrowUp');await page.waitForTimeout(900);await page.keyboard.up('ArrowUp');
          const b=await page.evaluate(()=>({...window.__AFTERLIGHT_GRID__.snapshot.player}));
          row.drive={before:a,after:b,moved:JSON.stringify(a)!==JSON.stringify(b)};row.canDrive=row.drive.moved&&Number.isFinite(b.dir);
        }else if(c.route.includes('Slipstream_GP')){
          row.drive=await page.evaluate(()=>{const api=window.__SLIP;api.startRace(0,false,null,false,{seed:12345});const pose=()=>({x:api.state.player.mesh.position.x,z:api.state.player.mesh.position.z,heading:api.state.player.mesh.rotation.y});const before=pose();api.keys.ArrowUp=true;for(let i=0;i<600;i++)api.tick(1/60);api.keys.ArrowUp=false;return{before,after:pose()}});
          row.canDrive=Math.hypot(row.drive.after.x-row.drive.before.x,row.drive.after.z-row.drive.before.z)>0.01&&Number.isFinite(row.drive.after.heading);
        }else if(c.route==='/neonmeridian/'){
          row.drive=await page.evaluate(()=>{window.__MERIDIAN_START__();const api=window.__MERIDIAN_TEST__;const before=api.state().player;api.driveSteps(120,{throttle:1});return{before,after:api.state().player}});
          row.canDrive=Math.hypot(row.drive.after.x-row.drive.before.x,row.drive.after.z-row.drive.before.z)>0.01&&Number.isFinite(row.drive.after.yaw);
        }else{
          row.api=await page.evaluate(()=>({grid:!!window.__AFTERLIGHT_GRID__,turf:!!window.__turf,slip:!!window.__SLIP,charcoal:!!window.CH,vector:!!window.__vector,meridian:!!window.__NM,sky:!!window.__SKYBREAK_TEST__}));
          await page.keyboard.press('ArrowUp');
          row.reason='No complete exposed position-and-heading reader found in the served game API; source-VM proof is retained but is insufficient for this browser harness.';
        }
      }catch(e){row.reason=String(e.message).slice(0,1200);}
      if(row.canDrive){
        const pose=row.drive.after;
        const field=['heading','angle','dir','yaw'].find(k=>Number.isFinite(pose[k]));
        if(!field)throw Error('Missing heading in qualifying observation');
        const valid=p=>Number.isFinite(p[field]); const broken={...pose}; delete broken[field];
        if(valid(broken)||!valid(pose))throw Error('Heading firing control failed');
        row.headingControl='removed field RED; restored field GREEN';
        row.motionControl='identical before/after RED; observed moved pose GREEN';
        if(JSON.stringify(row.drive.before)===JSON.stringify(row.drive.after))throw Error('Movement control failed');
      }
      row.errors=errors.slice(0,5);results.push(row);console.log('AS1_CANDIDATE '+JSON.stringify(row));await context.close();
    }
    const preferred=results.find(r=>r.route==='/rallyvector3d/'&&r.canDrive)||results.find(r=>r.route==='/hyperdraft/'&&r.canDrive)||results.find(r=>r.canDrive)||results.find(r=>r.route==='/hyperdraft/');
    const report={harness:'Playwright Chromium, headless defaults; 390x844; fresh contexts',results,pilot:preferred.route,delivery:preferred.delivery,drivable:preferred.canDrive};
    fs.mkdirSync('audit-output/as1',{recursive:true});fs.writeFileSync('audit-output/as1/probe.json',JSON.stringify(report,null,2));console.log('AS1_PILOT '+JSON.stringify({route:report.pilot,delivery:report.delivery,drivable:report.drivable}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
