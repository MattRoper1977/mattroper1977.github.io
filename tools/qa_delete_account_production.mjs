import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const BASE='https://madebymatt.uk/';
const run=process.env.GITHUB_RUN_ID;
const repo=process.env.GITHUB_REPOSITORY;
const issue=Number(process.env.PR_NUMBER||0);
const token=process.env.GITHUB_TOKEN;
const out=path.join(process.cwd(),'audit-output','delete-account');
fs.mkdirSync(out,{recursive:true});
if(!run||!repo||!issue||!token)throw new Error('required runner coordination context is missing');
const email=`contactmadebymatt+delete-${run}@gmail.com`;
const password=`${crypto.randomBytes(36).toString('base64url')}!aA7`;
const result={sentinel:'mbm-post-upgrade-final-estate-closeout-2026-08-08',run,started:new Date().toISOString(),registration:false,verification:false,login:false,profile:false,member:false,uuid:null,unsignedRejected:false,invalidJwtRejected:false,uiDelete:false,localSessionCleared:false,oldSessionNoData:false,oldDeleteTokenRejected:false,credentialsRejected:false,finished:null,result:'FAIL'};
const ghHeaders={accept:'application/vnd.github+json',authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28','content-type':'application/json'};
const api=`https://api.github.com/repos/${repo}/issues/${issue}/comments`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function comment(stage,extra=''){const body=`<!-- mbm-qa-delete --> stage=${stage} run=${run}${extra?` ${extra}`:''}`;const r=await fetch(api,{method:'POST',headers:ghHeaders,body:JSON.stringify({body})});if(!r.ok)throw new Error(`coordination comment failed (${r.status})`)}
async function acknowledged(uuid){const r=await fetch(`${api}?per_page=100`,{headers:ghHeaders});if(!r.ok)return false;const rows=await r.json();return rows.some(x=>String(x.body||'').includes(`<!-- mbm-qa-delete-ack --> run=${run} uuid=${uuid}`))}
async function waitForAccount(page){await page.waitForFunction(()=>window.MBMAccount&&window.MBMAccount.state&&window.MBMAccount.state.ready,{timeout:30000})}
async function statusText(page,selector){return (await page.locator(selector).textContent().catch(()=>''))||''}
async function loginThroughUi(page){
 await page.goto(`${BASE}account/?mode=login&qa=${run}`,{waitUntil:'domcontentloaded',timeout:30000});await waitForAccount(page);
 if(await page.evaluate(()=>!!window.MBMAccount.state.user))return true;
 await page.locator('#loginTab').click();await page.locator('#loginEmail').fill(email);await page.locator('#loginPassword').fill(password);await page.locator('#loginForm button[type=submit]').click();
 for(let i=0;i<30;i++){if(await page.evaluate(()=>!!window.MBMAccount.state.user))return true;const t=await statusText(page,'#loginStatus');if(t&&/logged in/i.test(t))return true;if(t&&/invalid login|email not confirmed|verify|credentials/i.test(t))return false;await sleep(250)}return false;
}
function providerToken(storage){for(const [k,v] of Object.entries(storage)){if(!/^sb-.*-auth-token$/.test(k))continue;try{const x=JSON.parse(v);if(x&&x.access_token)return x.access_token;if(x&&x.currentSession&&x.currentSession.access_token)return x.currentSession.access_token}catch{}}return null}
async function writeResult(){result.finished=new Date().toISOString();result.result=(result.registration&&result.verification&&result.login&&result.profile&&result.member&&result.uiDelete&&result.localSessionCleared&&result.oldSessionNoData&&result.credentialsRejected&&result.unsignedRejected&&result.invalidJwtRejected&&result.oldDeleteTokenRejected)?'PASS':'FAIL';fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'summary.md'),`# Disposable production delete-account proof\n\nResult: **${result.result}**\n\nRun: \`${run}\`\n\nQA UUID: \`${result.uuid||'not obtained'}\`\n\nRegistration: ${result.registration?'PASS':'FAIL'}  \nVerification: ${result.verification?'PASS':'FAIL'}  \nLogin: ${result.login?'PASS':'FAIL'}  \nProfile data: ${result.profile?'PASS':'FAIL'}  \nMember data: ${result.member?'PASS':'FAIL'}  \nUI deletion: ${result.uiDelete?'PASS':'FAIL'}  \nLocal provider session cleared: ${result.localSessionCleared?'PASS':'FAIL'}  \nOld session cannot retrieve account data: ${result.oldSessionNoData?'PASS':'FAIL'}  \nDeleted credentials rejected: ${result.credentialsRejected?'PASS':'FAIL'}\n`)}

let browser,context,page;
try{
 browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:390,height:844}});page=await context.newPage();
 await page.goto(`${BASE}account/?mode=register&qa=${run}`,{waitUntil:'domcontentloaded',timeout:30000});await waitForAccount(page);await page.locator('#registerTab').click();await page.locator('#registerName').fill(`Made by Matt QA ${run}`);await page.locator('#registerEmail').fill(email);await page.locator('#registerPassword').fill(password);await page.locator('#registerConfirm').fill(password);await page.locator('#registerForm button[type=submit]').click();
 await page.waitForFunction(()=>{const e=document.querySelector('#registerStatus');return e&&(/Account created/i.test(e.textContent)||e.classList.contains('err'))},{timeout:30000});const registerStatus=await statusText(page,'#registerStatus');if(!/Account created/i.test(registerStatus))throw new Error('production UI registration did not reach account-created state');result.registration=true;if(!/check your email/i.test(registerStatus))throw new Error('production account verification was not required');await comment('registered');
 let logged=false;
 for(let i=0;!logged&&i<120;i++){await sleep(10000);logged=await loginThroughUi(page)}
 if(!logged)throw new Error('verified production UI login did not become available');result.login=true;result.verification=true;
 await page.goto(`${BASE}account/?qa=${run}`,{waitUntil:'domcontentloaded',timeout:30000});await waitForAccount(page);await page.waitForSelector('#signedIn:not([hidden])',{timeout:30000});await page.locator('#profileName').fill(`Made by Matt QA ${run}`);await page.locator('#profileForm button[type=submit]').click();await page.waitForFunction(()=>/Display name saved/i.test(document.querySelector('#profileStatus')?.textContent||''),{timeout:30000});result.profile=true;
 await page.goto(`${BASE}members/?qa=${run}`,{waitUntil:'domcontentloaded',timeout:30000});await waitForAccount(page);await page.waitForSelector('#membersSignedIn:not([hidden])',{timeout:30000});const first=page.locator('.ma-save').first();await first.click();await page.waitForFunction(()=>{const b=document.querySelector('.ma-save');return b&&b.getAttribute('aria-pressed')==='true'},{timeout:30000});result.member=true;result.uuid=await page.evaluate(()=>window.MBMAccount.state.user&&window.MBMAccount.state.user.id);if(!result.uuid)throw new Error('authenticated QA UUID unavailable');
 await comment('predelete',`uuid=${result.uuid}`);
 for(let i=0;i<180&&!await acknowledged(result.uuid);i++)await sleep(5000);if(!await acknowledged(result.uuid))throw new Error('server-side pre-delete readback was not acknowledged');
 const config=await (await fetch(`${BASE}site.json?qa=${run}`)).json();const supabaseUrl=config.features.accounts.supabaseUrl;const anon=config.features.accounts.supabaseAnonKey;const fn=`${supabaseUrl}/functions/v1/delete-account`;
 let r=await fetch(fn,{method:'POST',headers:{'content-type':'application/json',apikey:anon},body:'{"confirm":true}'});result.unsignedRejected=[401,403].includes(r.status);
 r=await fetch(fn,{method:'POST',headers:{'content-type':'application/json',apikey:anon,authorization:'Bearer invalid.qa.jwt'},body:'{"confirm":true,"user_id":"00000000-0000-0000-0000-000000000000"}'});result.invalidJwtRejected=[401,403].includes(r.status);
 await page.goto(`${BASE}account/?qa=${run}`,{waitUntil:'domcontentloaded',timeout:30000});await waitForAccount(page);await page.waitForSelector('#signedIn:not([hidden])',{timeout:30000});const storage=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));const oldToken=providerToken(storage);if(!oldToken)throw new Error('provider-managed session token was not present before UI deletion');
 await page.locator('#deleteConfirm').fill('DELETE');await page.locator('#deleteBtn').click();await page.waitForURL(u=>u.pathname==='/',{timeout:30000});result.uiDelete=true;const remaining=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/^sb-.*-auth-token$/.test(k)));result.localSessionCleared=remaining.length===0;
 const profileUrl=`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(result.uuid)}&select=id`;r=await fetch(profileUrl,{headers:{apikey:anon,authorization:`Bearer ${oldToken}`}});let rows=[];try{rows=await r.json()}catch{}result.oldSessionNoData=(r.status===401||r.status===403||(r.ok&&Array.isArray(rows)&&rows.length===0));
 r=await fetch(fn,{method:'POST',headers:{'content-type':'application/json',apikey:anon,authorization:`Bearer ${oldToken}`},body:'{"confirm":true}'});result.oldDeleteTokenRejected=[401,403].includes(r.status);
 result.credentialsRejected=!(await loginThroughUi(page));
 await comment('deleted',`uuid=${result.uuid} ui=${result.uiDelete?'pass':'fail'} local=${result.localSessionCleared?'pass':'fail'} olddata=${result.oldSessionNoData?'pass':'fail'} credentials=${result.credentialsRejected?'pass':'fail'}`);
}catch(e){result.error=String(e&&e.message||e).slice(0,500);try{await comment('failed',result.uuid?`uuid=${result.uuid}`:'')}catch{}}finally{await writeResult();if(context)await context.close().catch(()=>{});if(browser)await browser.close().catch(()=>{})}
if(result.result!=='PASS')process.exit(1);
