/* Run by the isolated Play CI capture job. Normal player input only; no engine
 * state writes, seeded wins, developer shortcuts, replaced game files or old media. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const base=process.env.PLAY_REVIEW_URL||'http://127.0.0.1:4173';
const root=path.resolve(process.env.PLAY_OUTPUT||'.play-review/output/games'),out=path.resolve(process.env.PLAY_CAPTURE||'.play-review/capture');
fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest={schema:1,captured_at:new Date().toISOString(),source_commit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),clips:[]};
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
  await page.locator('[data-mode="creative"]').click();await page.locator('#start').click();await wait(1000);
 }else if(id==='offbrand'){
  await page.locator('#btnCrew').click();await wait(700);
  await optional(page,'#howGo');await optional(page,'#btnHowGo');
 }else if(id==='lumins'){
  if(!await optional(page,'#go')){
   const first=page.getByText(/First Steps/).first();if(await first.isVisible())await first.click();await page.locator('#go').click();
  }
 }else if(id==='novasiege'){await page.locator('#start-run').click();}
 await wait(600);
}
async function action(page,id){
 if(id==='emberwild'){
  await page.locator('#ui-canvas').click({position:{x:160,y:160}});
  for(let i=0;i<3;i++){await press(page,'ArrowRight',1700);await press(page,'ArrowDown',1300);await page.keyboard.press('z');await wait(500);await press(page,'ArrowLeft',1600);await page.keyboard.press('z');}
  return 'Walk through the opening area and interact using the game’s ordinary controls.';
 }
 if(id==='apexkick'){
  await page.locator('canvas').first().click({position:{x:500,y:200}});
  for(let i=0;i<3;i++){await press(page,'ArrowRight',230);await page.keyboard.press('q');await page.keyboard.press('Space');await wait(4400);}
  return 'Aim and take practice free kicks, showing the real ball flight and result.';
 }
 if(id==='voxel'){
  await press(page,'w',900);await page.mouse.move(680,450);await page.keyboard.press('2');
  for(let i=0;i<3;i++){await page.mouse.click(640,410,{button:'right'});await wait(700);await press(page,'a',250);}
  await press(page,'s',700);await page.mouse.move(750,430);await wait(1200);await page.mouse.click(640,410);await press(page,'d',1200);await wait(6000);
  return 'Explore a fresh creative world and use the normal place/break controls.';
 }
 if(id==='offbrand'){
  await press(page,'ArrowLeft',1300);await press(page,'ArrowUp',900);await page.keyboard.press('e');await wait(800);
  await shot(page,'offbrand-task');
  await press(page,'ArrowRight',2300);await press(page,'ArrowDown',900);await page.keyboard.press('e');await wait(700);
  await page.keyboard.press('f');await wait(1200);await page.keyboard.press('Escape');await wait(800);await press(page,'ArrowLeft',2000);await wait(2000);
  return 'Move around the workshop, inspect a task and use the visible investigation controls.';
 }
 if(id==='lumins'){
  const bridge=page.locator('#tools button').filter({hasText:/Bridge/i}).first();if(await bridge.isVisible())await bridge.click();else await page.keyboard.press('2');
  const canvas=page.locator('canvas').filter({visible:true}).first();const box=await canvas.boundingBox();
  await page.mouse.click(box.x+box.width*.44,box.y+box.height*.64);await wait(1000);await page.mouse.click(box.x+box.width*.5,box.y+box.height*.64);await wait(12500);
  return 'Place a bridge intervention in the opening rescue puzzle and follow the Lumins.';
 }
 if(id==='novasiege'){
  await page.mouse.move(870,270);await page.mouse.down();
  for(const key of ['d','s','a','w']){await press(page,key,3000);await page.keyboard.press('Shift');await page.mouse.move(key==='s'?440:850,key==='w'?230:450);}
  await page.mouse.up();await wait(1500);
  return 'Move, aim and fire at the first arena wave, using a dash during the fight.';
 }
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});manifest.browser=browser.version();
for(const[id,title,route]of titles){const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir,size:{width:1280,height:720}},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(10000);const began=Date.now();let clipStart=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));const item={id,title,route,status:'needs-visual-review',viewport:{width:1280,height:720},device:'Desktop Chrome in CI; fresh isolated context',captured_at:new Date().toISOString(),source_commit:manifest.source_commit,published_sha256:hash(path.join(root,decodeURIComponent(route.replace(/^\//,'')),route.endsWith('/')?'index.html':''))};
try{
 await page.goto(base+'/404.html');if(await page.evaluate(()=>localStorage.length)!==0)throw Error('Capture profile was not empty');
 await page.goto(base+route,{waitUntil:'load'});await wait(2800);await shot(page,id+'-start');await start(page,id);await shot(page,id+'-ready');clipStart=(Date.now()-began)/1000;
 item.description=await action(page,id);await wait(Math.max(0,21000-(Date.now()-began-clipStart*1000)));await shot(page,id+'-after');
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
