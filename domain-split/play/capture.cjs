/* Run by the isolated Play CI capture job. Normal player input only; no engine
 * state writes, seeded wins, developer shortcuts, replaced game files or old media. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const base=process.env.PLAY_REVIEW_URL||'http://127.0.0.1:4173';
const root=path.resolve(process.env.PLAY_OUTPUT||'.play-review/output/games'),out=path.resolve(process.env.PLAY_CAPTURE||'.play-review/capture');
fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest={schema:1,captured_at:new Date().toISOString(),lessons_commit:cp.execFileSync('git',['-C','.sources/Lessons','rev-parse','HEAD'],{encoding:'utf8'}).trim(),source_commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),clips:[]};
const requested=JSON.parse(fs.readFileSync(path.join(__dirname,'capture-request.json')));
const titles=[['emberwild','Emberwild','/emberwild/'],['apexkick','Apex Kick','/apexkick/'],['voxel','Voxel Frontier','/voxel/'],['offbrand','Off-Brand: After Hours','/offbrand/'],['lumins','Lumins','/Lessons/Games/Lumins.html'],['novasiege','Vector Overdrive: Nova Siege','/novasiege/']];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function press(page,key,ms=400){await page.keyboard.down(key);await wait(ms);await page.keyboard.up(key);}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png')});fs.writeFileSync(path.join(out,name+'.txt'),await page.locator('body').innerText());}
async function optional(page,selector){const l=page.locator(selector);if(await l.count()&&await l.first().isVisible()){await l.first().click();await wait(300);return true;}return false;}
async function start(page,id){
 if(id==='emberwild'){
  await page.locator('#start-new').click();await wait(500);
  const vigil=page.getByRole('button',{name:'Continue to the Hearthside Vigil',exact:true});if(await vigil.isVisible())await vigil.press('Enter');
  for(let i=0;i<65;i++){
   const dialogue=page.getByRole('button',{name:'Continue dialogue',exact:true});
   if(await dialogue.isVisible()){await dialogue.press('Enter');await wait(120);continue;}
   const sit=page.getByRole('button',{name:/^Sit with Spriglet/});if(await sit.isVisible()){await sit.press('Enter');await wait(300);continue;}
   const harmonize=page.getByRole('button',{name:/^Harmonize with/});if(await harmonize.isVisible()){await harmonize.press('Enter');await wait(380);continue;}
   const labels=await page.locator('#semantic-actions button').allTextContents();
   if(labels.some(t=>/bond is being secured/.test(t))){await wait(600);continue;}
   if(i>3)break;await wait(500);
  }
 }else if(id==='apexkick'){
  if(!await optional(page,'#bPractice')){await optional(page,'#bModes');await page.locator('#mPractice').click();}
  await wait(4000);await optional(page,'#v6SkipFlyin');
 }else if(id==='voxel'){
  await page.locator('[data-mode="creative"]').click();const b=await page.locator('#start').boundingBox();page.capturePointer={x:b.x+b.width/2,y:b.y+b.height/2};await page.locator('#start').click();await wait(1800);if(!await page.evaluate(()=>!!document.pointerLockElement))await page.locator('#start').click();await page.waitForFunction(()=>!!document.pointerLockElement);
 }else if(id==='offbrand'){
  await page.locator('#btnCrew').click();await page.locator('#btnCnBegin').click();await page.locator('#btnHowOk').click();await optional(page,'#tutSkip');
 }else if(id==='lumins'){
  if(!await optional(page,'#go')){
   const first=page.getByText(/First Steps/).first();if(await first.isVisible())await first.click();await page.locator('#go').click();
  }
 }else if(id==='novasiege'){await page.locator('#start-run').press('Enter');const intro=page.locator('#v6NovaIntro');await intro.waitFor({state:'visible'});await page.locator('#v6NovaSkip').press('Enter');await intro.waitFor({state:'hidden'});await page.waitForFunction(()=>{const s=window.VectorOverdrive.getSnapshot();return s.state==='PLAYING'&&s.enemies>=3;},null,{timeout:30000});}
 await wait(600);
}
async function action(page,id){
 if(id==='emberwild'){
  const rest=page.getByRole('button',{name:'Interact: Rest & restore',exact:true});
  if(await rest.isVisible()){await rest.press('Enter');await wait(1400);}
  for(let i=0;i<8;i++){const next=page.getByRole('button',{name:'Continue dialogue',exact:true});if(!await next.isVisible())break;await next.press('Enter');await wait(300);}
  const canvas=page.locator('#ui-canvas');await canvas.focus();const observed=[];
  // Normal focused keyboard taps; wait for the real walking animation, which
  // can run slower than wall time in the software renderer. Observations only.
  for(const [key,n] of [['ArrowUp',3],['ArrowRight',4],['ArrowUp',3],['ArrowLeft',2]]){for(let i=0;i<n;i++){await page.waitForFunction(()=>window.__EMBERWILD__.player.motionState==='IDLE');await canvas.press(key);await page.waitForFunction(()=>window.__EMBERWILD__.player.motionState==='IDLE');await wait(150);observed.push(await page.evaluate(()=>({grid:window.__EMBERWILD__.player.grid,steps:window.__EMBERWILD__.steps,focus:document.activeElement.id})));}}
  fs.writeFileSync(path.join(out,'emberwild-walk-observations.json'),JSON.stringify(observed,null,2));
  return 'Restore a companion at the hearth, then walk from Wayfinder’s Rest into the village.';
 }
 if(id==='apexkick'){
  await page.locator('canvas').first().click({position:{x:500,y:200}});
  for(let i=0;i<3;i++){await press(page,'ArrowRight',230);await page.keyboard.press('q');await page.keyboard.press('Space');await wait(4400);}
  return 'Aim and take practice free kicks, showing the real ball flight and result.';
 }
 if(id==='voxel'){
  const point=page.capturePointer;await page.mouse.move(point.x,point.y+380,{steps:12});await wait(700);await page.keyboard.press('7');
  for(let i=0;i<3;i++){await page.mouse.down({button:'right'});await wait(90);await page.mouse.up({button:'right'});await wait(1600);await press(page,'a',200);}
  await page.mouse.down();await wait(250);await page.mouse.up();await wait(1700);await press(page,'d',350);await page.mouse.move(point.x+100,point.y+300,{steps:10});await wait(2000);
  return 'Look down at the shoreline and place, inspect and remove plank blocks in a fresh creative world.';
 }
 if(id==='offbrand'){
  const box=await page.locator('#cv').boundingBox(),scale=Math.min(box.width/960,box.height/640);
  await page.mouse.click(box.x+(box.width-960*scale)/2+775*scale,box.y+(box.height-640*scale)/2+167*scale);
  await page.locator('#actLbl').filter({hasText:/Do the work/}).waitFor();await page.locator('#btnAct').click();await wait(700);
  for(const n of ['1','2','3','4','5']){await page.locator('#mgStage .tdot').filter({hasText:new RegExp('^'+n+'$')}).click();await wait(650);}
  await wait(1800);await shot(page,'offbrand-work-banked');
  await press(page,'ArrowLeft',2600);await press(page,'ArrowDown',1200);await wait(2000);
  return 'Cross the workshop to the Ink Store, trace its five-point M commission and bank the completed work.';
 }
 if(id==='lumins'){
  await page.keyboard.press('4');
  const box=await page.locator('#cv').boundingBox();
  for(const [c,r] of [[15,13],[17,12]]){await page.mouse.click(box.x+(c+.5)*box.width/40,box.y+(r+.5)*box.height/24);await wait(300);}
  await wait(17000);
  return 'Build two bridge sections across the first gap and guide Lumins toward the rescue portal.';
 }
 if(id==='novasiege'){
  await page.keyboard.down('Space');
  for(const key of ['a','d','w','s','a','d']){await press(page,key,800);await page.keyboard.press('Shift');await wait(1700);}
  await page.keyboard.up('Space');await wait(1000);
  const result=await page.evaluate(()=>window.VectorOverdrive.getSnapshot());fs.writeFileSync(path.join(out,'novasiege-score.json'),JSON.stringify(result,null,2));
  return 'Strafe and dash through the opening arena wave while firing at the drones with the standard keyboard aim support.';
 }
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});manifest.browser=browser.version();
for(const[id,title,route]of titles.filter(t=>requested.includes(t[0]))){const viewport={width:960,height:540};const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});const context=await browser.newContext({viewport,recordVideo:{dir,size:viewport},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(10000);const began=Date.now();let clipStart=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={id,title,route,status:'needs-visual-review',viewport,device:'Desktop Chrome in CI; fresh isolated context',captured_at:new Date().toISOString(),source_commit:manifest.source_commit,lessons_commit:manifest.lessons_commit,published_sha256:hash(path.join(root,decodeURIComponent(route.replace(/^\//,'')),route.endsWith('/')?'index.html':''))};
try{
 await page.goto(base+'/404.html');if(await page.evaluate(()=>localStorage.length)!==0)throw Error('Capture profile was not empty');
 await page.goto(base+route,{waitUntil:'load'});await wait(2800);await shot(page,id+'-start');await start(page,id);await shot(page,id+'-ready');clipStart=(Date.now()-began)/1000;
 item.trim_start_seconds=clipStart;item.description=await action(page,id);await wait(Math.max(0,21000-(Date.now()-began-clipStart*1000)));await shot(page,id+'-after');
 const storage=await page.evaluate(()=>Object.keys(localStorage));if(storage.some(k=>/mbm_cc_v1|hud_names|uas_register|asdan_register|pupil|marks/i.test(k)))throw Error('Disallowed capture storage key');item.storage_keys=storage;item.errors=errors;
}catch(e){item.status='capture-blocked';item.error=e.message;await shot(page,id+'-failure').catch(()=>{});}
const video=page.video();await context.close();item.source_recording=path.relative(out,await video.path());
if(item.status==='needs-visual-review'){
 const source=path.join(out,item.source_recording),dest=path.join(out,id+'.mp4');
 cp.execFileSync('ffmpeg',['-y','-ss',String(clipStart),'-i',source,'-t','20','-an','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',dest],{stdio:'ignore'});
 cp.execFileSync('ffmpeg',['-y','-ss','8','-i',dest,'-frames:v','1','-vf','scale=960:-2','-quality','82',path.join(out,id+'.webp')],{stdio:'ignore'});
 const probe=JSON.parse(cp.execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',dest],{encoding:'utf8'}));item.duration_seconds=Number(probe.format.duration);item.codec=probe.streams[0].codec_name;item.bytes=fs.statSync(dest).size;item.video_sha256=hash(dest);item.poster_sha256=hash(path.join(out,id+'.webp'));item.video='/assets/play/media/'+id+'.mp4';item.poster='/assets/play/media/'+id+'.webp';
}manifest.clips.push(item);fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({id,status:item.status,error:item.error}));}
await browser.close();})().catch(e=>{console.error(e);process.exit(1);});
