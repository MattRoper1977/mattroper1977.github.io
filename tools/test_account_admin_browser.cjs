/* Real-browser checks with an isolated provider fixture; never creates users,
   sends mail, or submits credentials to a live service. */
'use strict';
const { chromium } = require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), evidence=process.env.ACCOUNT_EVIDENCE_DIR;
const fixture=`(function(){
 var listeners=[],user=window.__adminMode?{id:'fixture-admin',email:'admin@example.test',name:'Admin'}:null;
 function state(){return {ready:true,configured:true,user:user,online:true,profile:null}}
 window.testAuthUpdate=function(value){user=value;listeners.forEach(fn=>fn(state()))};
 window.testRequests=0;window.testDelay=0;
 window.MBMAccount={subscribe:function(fn){listeners.push(fn);fn(state());return function(){}},
 ready:Promise.resolve(),register:function(){window.testRequests++;return Promise.reject(new Error('The account service could not be reached. Try again.'))},
 login:function(){return Promise.reject(new Error('That email and password did not match.'))},
 resetPassword:function(){return Promise.reject(new Error('Try again.'))},legacyLocalProfile:function(){return null},
 adminMembers:function(){return new Promise(function(resolve,reject){setTimeout(function(){
 if(window.__adminMode==='ordinary')return reject(new Error('Administrator access is required.'));
 resolve({schema:1,as_of:'2026-09-15T09:00:00Z',summary:{registered:1,verified:1,joined_last_7_days:1,signed_in_last_7_days:1},total:1,
 members:[{display_name:'<img src=x onerror=alert(1)>',email:'member@example.test',email_verified:true,created_at:'2026-09-14T09:00:00Z',last_sign_in_at:'2026-09-15T09:00:00Z',recorded_sessions:1}]});
 },window.testDelay)})},refresh:function(){listeners.forEach(fn=>fn(state()));return Promise.resolve(state())}};
})();`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local'), rel=decodeURIComponent(url.pathname).replace(/^\//,'');
 const target=path.resolve(root,rel.endsWith('/')?rel+'index.html':rel);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try {let body=fs.readFileSync(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(body);}
 catch {res.writeHead(404);res.end('Not found');}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port, browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin!==base)return route.abort();
   if(u.pathname==='/assets/mbm-account.js')return route.fulfill({contentType:'text/javascript',body:fixture});
   // Keep the provider/furniture fixture independent from platform async work.
   if(u.pathname==='/assets/mbm-platform.js')return route.fulfill({contentType:'text/javascript',body:''});
   return route.continue();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/account/?mode=register');
  await page.locator('#registerEmail').fill('member@example.test');
  await page.locator('#registerPassword').fill('short');await page.locator('#registerConfirm').fill('short');
  await page.locator('#registerForm button[type=submit]').click();
  assert.match(await page.locator('#registerStatus').innerText(),/at least 10/);
  assert.equal(await page.locator('#registerPassword').isEnabled(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'registerPassword');
  await page.locator('#registerPassword').fill('StrongFixture_2026');await page.locator('#registerConfirm').fill('StrongFixture_2026');
  await page.locator('#registerForm button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('registerStatus').textContent.includes('could not be reached'));
  for(const id of ['registerName','registerEmail','registerPassword','registerConfirm']) assert.equal(await page.locator('#'+id).isEnabled(),true,id+' editable after rejected request');
  await page.locator('#registerEmail').fill('corrected@example.test');
  await page.locator('#registerForm button[type=submit]').click();await page.waitForFunction(()=>window.testRequests===2);
  await page.waitForFunction(()=>!document.getElementById('registerForm').hasAttribute('aria-busy'));
  // The original busy() is a negative control: the same rejected submission
  // must reproduce the user's frozen fields instead of passing this test.
  const original=fs.readFileSync(path.join(root,'account/index.html'),'utf8').replace(/var busyControls=new WeakMap\(\);[\s\S]*?(?=function showMode)/,
   "function busy(form,on){Array.prototype.forEach.call(form.querySelectorAll('button,input'),function(el){if(el.type!=='email'&&el.type!=='password'&&el.type!=='text'||on)el.disabled=!!on;});}\n");
  await page.route('**/account/?old-control',r=>r.fulfill({contentType:'text/html',body:original}));
  await page.goto(base+'/account/?old-control');await page.locator('#registerTab').click();
  await page.locator('#registerEmail').fill('member@example.test');await page.locator('#registerPassword').fill('StrongFixture_2026');await page.locator('#registerConfirm').fill('StrongFixture_2026');
  await page.locator('#registerForm button[type=submit]').click();
  await page.waitForFunction(()=>document.getElementById('registerStatus').textContent.includes('could not be reached'));
  assert.equal(await page.locator('#registerEmail').isDisabled(),true,'original defect reproduced');
  await page.addInitScript(()=>{window.__adminMode='admin'});
  await page.goto(base+'/account/admin/');await page.waitForFunction(()=>!document.getElementById('adminResults').hidden);
  assert.equal(await page.locator('#memberRows tr').count(),1);assert.equal(await page.locator('#memberRows img').count(),0);
  assert.match(await page.locator('#memberRows').innerText(),/<img src=x/);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).length),0,'no member data persisted');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'phone page has no horizontal overflow');
  if(evidence){fs.mkdirSync(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'member-admin-phone.png'),fullPage:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(evidence,'member-admin-desktop.png'),fullPage:true});}
  await page.evaluate(()=>{window.testDelay=100;document.getElementById('refreshButton').click();window.testAuthUpdate(null)});
  await page.waitForTimeout(160);assert.equal(await page.locator('#memberRows tr').count(),0);assert.equal(await page.locator('#adminResults').isHidden(),true,'logout cannot revive a pending member response');
  await page.evaluate(()=>{window.__adminMode='ordinary';window.testAuthUpdate({id:'ordinary',email:'ordinary@example.test'})});
  await page.waitForFunction(()=>document.getElementById('adminStatus').textContent.includes('Administrator access'));
  assert.equal(await page.locator('#memberRows tr').count(),0);assert.equal(await page.locator('#adminResults').isHidden(),true);
  assert.deepEqual(errors,[]);console.log('PASS: form retry/validation, original-defect control, admin display, escaped names, no persistent member cache, responsive layout, logout race and ordinary-user denial.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
