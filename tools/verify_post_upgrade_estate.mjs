import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const BASE=(process.env.MBM_BASE_URL||'https://madebymatt.uk/').replace(/\/?$/,'/');
const EXPECTED=process.env.MBM_EXPECTED_SHA||'';
const OUT=path.join(ROOT,'audit-output','post-upgrade-final-estate');
fs.mkdirSync(OUT,{recursive:true});
const report={sentinel:'mbm-post-upgrade-final-estate-closeout-2026-08-08',base:BASE,expectedMain:EXPECTED,started:new Date().toISOString(),repos:[],sameDay:[],static:{},deployment:{},crawl:{},browser:{},network:{},findings:[],warnings:[]};
const fail=(kind,message,data={})=>report.findings.push({kind,message,...data});
const warn=(kind,message,data={})=>report.warnings.push({kind,message,...data});
const sh=(cmd,args=[],cwd=ROOT)=>cp.execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cleanPath=u=>{const x=new URL(u,BASE);x.hash='';return x.href};
const sameOrigin=u=>{try{return new URL(u,BASE).origin===new URL(BASE).origin}catch{return false}};
function files(dir){const out=[];for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','audit-output'].includes(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...files(p));else out.push(p)}return out}
function rel(root,p){return path.relative(root,p).split(path.sep).join('/')}
function text(p){return fs.readFileSync(p,'utf8')}
function balanced(src,open,close){let n=0;for(const c of src){if(c===open)n++;if(c===close)n--;if(n<0)return false}return n===0}
function isProdFile(r){return !/(^|\/)(docs|reports|tools|tests?|fixtures?|audit-output|node_modules|\.github)(\/|$)/i.test(r)}
function inspectRepo(name,dir){
 const all=files(dir), rec={name,dir:path.relative(ROOT,dir)||'.',sha:sh('git',['rev-parse','HEAD'],dir),branch:sh('git',['branch','--show-current'],dir)||'(detached)',files:all.length,html:0,js:0,css:0,json:0,todayCommits:[],todayFiles:[],errors:[],warnings:[]};
 const status=sh('git',['status','--porcelain'],dir);if(status)rec.errors.push(`working tree not clean: ${status.split(/\n/).length} entries`);
 const log=sh('git',['log','--since=2026-08-08T00:00:00Z','--until=2026-08-09T00:00:00Z','--pretty=format:@@%H%x09%aI%x09%s','--name-only'],dir);
 let current=null;for(const line of log.split(/\n/)){if(!line)continue;if(line.startsWith('@@')){const [hash,date,...subject]=line.slice(2).split('\t');current={hash,date,subject:subject.join('\t'),files:[]};rec.todayCommits.push(current)}else if(current)current.files.push(line)}
 rec.todayFiles=[...new Set(rec.todayCommits.flatMap(x=>x.files))].sort();
 const lower=new Map();
 for(const p of all){const r=rel(dir,p), key=r.toLowerCase();if(lower.has(key)&&lower.get(key)!==r)rec.errors.push(`case-colliding paths: ${lower.get(key)} <> ${r}`);else lower.set(key,r);
   const st=fs.statSync(p);if(st.size===0&&isProdFile(r))rec.errors.push(`empty production file: ${r}`);if(st.size>12*1024*1024)continue;
   let s;try{s=text(p)}catch{continue}
   if(/^(<<<<<<<|=======|>>>>>>>) /m.test(s))rec.errors.push(`unresolved conflict marker: ${r}`);
   if(/sb_secret_[A-Za-z0-9._-]{12,}/.test(s)||/(?:SUPABASE_SERVICE_ROLE_KEY|BUTTONDOWN_API_KEY)\s*[:=]\s*["'][^"'$\{][^"']{8,}["']/.test(s)||/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(s)){
     if(!/(verify|test|fixture|docs|report|setup|workflow)/i.test(r))rec.errors.push(`possible private credential literal: ${r}`);
   }
   if(isProdFile(r)&&/(?:href|src|action)\s*=\s*["']https?:\/\/(?:localhost|127\.0\.0\.1|[^"']*codespaces)/i.test(s))rec.errors.push(`production local-development URL: ${r}`);
   const ext=path.extname(p).toLowerCase();
   if(ext==='.json'){rec.json++;try{JSON.parse(s)}catch(e){rec.errors.push(`invalid JSON ${r}: ${e.message}`)}}
   if(ext==='.html'||ext==='.htm'){rec.html++;if(/<html\b/i.test(s)&&!/<\/html>\s*$/i.test(s))rec.errors.push(`truncated HTML: ${r}`);if((s.match(/<script\b/gi)||[]).length!==(s.match(/<\/script>/gi)||[]).length)rec.errors.push(`unbalanced script tags: ${r}`)}
   if(['.js','.mjs','.cjs'].includes(ext)){rec.js++;try{cp.execFileSync(process.execPath,['--check',p],{stdio:'pipe'})}catch(e){try{cp.execFileSync(process.execPath,['--input-type=module','--check'],{input:s,stdio:['pipe','pipe','pipe']})}catch(e2){rec.errors.push(`JavaScript syntax ${r}`)}}}
   if(ext==='.css'){rec.css++;const stripped=s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');if(!balanced(stripped,'{','}'))rec.errors.push(`unbalanced CSS braces: ${r}`)}
 }
 if(name==='site'){
   const temporary=all.map(p=>rel(dir,p)).filter(r=>/(temporary|qa-only|diagnostic|pr99|one-shot)/i.test(r)&&isProdFile(r));
   if(temporary.length)rec.warnings.push(`temporary-name candidates preserved for review: ${temporary.join(', ')}`);
 }
 report.repos.push(rec);report.sameDay.push({repo:name,sha:rec.sha,commits:rec.todayCommits,changedFiles:rec.todayFiles});
 for(const e of rec.errors)fail('repository',`${name}: ${e}`);for(const w of rec.warnings)warn('repository',`${name}: ${w}`);
}

async function fetchRetry(url,opts={},tries=4){let last;for(let i=0;i<tries;i++){try{const r=await fetch(url,{redirect:'follow',...opts});if(r.status<500)return r;last=new Error(`${r.status} ${url}`)}catch(e){last=e}await sleep(500*(i+1))}throw last}
async function deployedExact(){
 const checks=[['index.html','/'],['assets/mbm-account.js','/assets/mbm-account.js'],['site.json','/site.json']];
 for(let attempt=1;attempt<=24;attempt++){
   const rows=[];let ok=true;
   for(const [file,route] of checks){const local=fs.readFileSync(path.join(ROOT,file));let r;try{r=await fetchRetry(new URL(route+`?mbm=${EXPECTED}-${attempt}`,BASE),{},2)}catch(e){ok=false;rows.push({file,status:0,error:String(e)});continue}const body=Buffer.from(await r.arrayBuffer());const match=r.ok&&sha(body)===sha(local);rows.push({file,status:r.status,localSha:sha(local),servedSha:sha(body),bytes:body.length,match});if(!match)ok=false}
   report.deployment={attempt,checks:rows,exact:ok};if(ok)return;await sleep(10000)
 }
 fail('deployment','production did not byte-match merged main within deployment gate',report.deployment);
}
function urlsFromJson(value,out){if(Array.isArray(value)){for(const x of value)urlsFromJson(x,out);return}if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value)){if(typeof v==='string'&&/(href|url|route|path|src|artwork|file)/i.test(k)&&(/^(?:\/|\.\/|\.\.\/)/.test(v)||/\.html?(?:[?#]|$)/i.test(v)))out.add(new URL(v,BASE).href);else urlsFromJson(v,out)}}}
function htmlRefs(html,pageUrl){const out=[];for(const m of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)){const v=m[2].trim();if(!v||/^(?:mailto:|tel:|javascript:|data:|blob:)/i.test(v))continue;try{out.push(new URL(v,pageUrl).href)}catch{}}return out}
function hasFragment(html,hash){if(!hash||hash==='#')return true;let id;try{id=decodeURIComponent(hash.slice(1))}catch{id=hash.slice(1)};const esc=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(?:id|name)\\s*=\\s*["']${esc}["']`,'i').test(html)}
async function crawl(){
 const routes=new Set(['/','/games/','/Lessons/','/Matt-s-Apps-/','/tools/','/resources/','/account/','/members/','/mailing-list/','/privacy/','/stats/'].map(x=>new URL(x,BASE).href));
 for(const file of ['site.json','games.json','resources.json','data/resources.json']){if(!fs.existsSync(path.join(ROOT,file)))continue;try{urlsFromJson(JSON.parse(text(path.join(ROOT,file))),routes)}catch{}}
 try{const r=await fetchRetry(new URL(`/sitemap.xml?mbm=${EXPECTED}`,BASE));const x=await r.text();for(const m of x.matchAll(/<loc>(.*?)<\/loc>/g))if(sameOrigin(m[1]))routes.add(m[1])}catch(e){fail('crawl',`sitemap fetch failed: ${e.message}`)}
 const seed=[...routes];for(const u of seed.slice(0,60)){try{const r=await fetchRetry(u,{},2);const ct=r.headers.get('content-type')||'';if(r.ok&&ct.includes('text/html')){const h=await r.text();for(const ref of htmlRefs(h,u))if(sameOrigin(ref))routes.add(ref)}}catch{}}
 const all=[...routes].map(cleanPath);const unique=[...new Set(all)];const rows=[];let next=0;
 async function worker(){while(true){const i=next++;if(i>=unique.length)return;const u=unique[i];try{const r=await fetchRetry(u,{},3);const ct=r.headers.get('content-type')||'';const body=Buffer.from(await r.arrayBuffer());const row={url:u,status:r.status,type:ct,bytes:body.length,final:r.url};if(!r.ok)fail('route',`HTTP ${r.status}: ${u}`);if(ct.includes('text/html')){const h=body.toString('utf8');if(/<title>\s*(?:404|Page not found)/i.test(h))fail('route',`404 fallback content: ${u}`);for(const ref of htmlRefs(h,u)){const x=new URL(ref);if(x.origin===new URL(BASE).origin&&x.hash&&!hasFragment(h,x.hash)&&cleanPath(x.href)===cleanPath(u))fail('fragment',`missing fragment ${x.hash} on ${u}`)}}rows.push(row)}catch(e){rows.push({url:u,status:0,error:String(e)});fail('route',`request failed: ${u}`,{error:String(e)})}}}
 await Promise.all(Array.from({length:12},worker));report.crawl={routes:unique.length,rows,failures:report.findings.filter(x=>['route','fragment'].includes(x.kind)).length};
}
async function browserAudit(){
 const widths=[320,360,390,430,768,1024,1280,1440];const pages=[['home','/'],['games','/games/'],['lessons','/Lessons/'],['apps','/Matt-s-Apps-/'],['tools','/tools/'],['resources','/resources/'],['account','/account/'],['members','/members/'],['mailing','/mailing-list/'],['privacy','/privacy/']];
 const browser=await chromium.launch({headless:true});const rows=[];const external=new Set();
 for(const width of widths){for(const [name,route] of pages){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_BLOCKED_BY_CLIENT/i.test(m.text()))errors.push(`console: ${m.text()}`)});page.on('request',req=>{try{const u=new URL(req.url());if(u.origin!==new URL(BASE).origin)external.add(u.origin)}catch{}});page.on('requestfailed',req=>{try{const u=new URL(req.url());if(u.origin===new URL(BASE).origin)errors.push(`requestfailed: ${u.pathname} ${req.failure()?.errorText||''}`)}catch{}});page.on('response',res=>{try{const u=new URL(res.url());if(u.origin===new URL(BASE).origin&&res.status()>=400)errors.push(`response ${res.status()}: ${u.pathname}`)}catch{}});
   let response;try{response=await page.goto(new URL(route+`?mbm=${EXPECTED}-${width}`,BASE).href,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(900)}catch(e){errors.push(`navigation: ${e.message}`)}
   const facts=await page.evaluate(({name,width})=>{const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');const body=(document.body?.innerText||'').replace(/\s+/g,' ');const controls=[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,[role=button],summary,.ma-btn,.dx-tbtn')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return{tag:e.tagName,id:e.id||'',w:r.width,h:r.height,text:(e.textContent||e.value||'').trim().slice(0,60)}});const badTargets=controls.filter(x=>x.w<40||x.h<40);const focused=controls.length?document.querySelector('button,input:not([type=hidden]),select,textarea,[role=button],summary,a[href]'):null;if(focused)focused.focus();const cs=focused?getComputedStyle(focused):null;return{title:document.title,h1:document.querySelector('h1')?.textContent?.trim()||'',overflow:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0)-innerWidth,menu:!!document.querySelector('.menu'),badTargets:badTargets.slice(0,12),focusVisible:!focused||!cs?true:(cs.outlineStyle!=='none'||cs.boxShadow!=='none'),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,body,account:{configured:!!window.MBMAccount,register:!!document.querySelector('#registerForm'),login:!!document.querySelector('#loginForm'),emailAuto:[...document.querySelectorAll('input[type=email]')].map(x=>x.autocomplete),passwordAuto:[...document.querySelectorAll('input[type=password]')].map(x=>x.autocomplete)},mailing:{consent:document.querySelector('input[type=checkbox][required]')?{checked:document.querySelector('input[type=checkbox][required]').checked,required:true}:null},signedOut:visible(document.querySelector('#membersSignedOut')),width,name};},{name,width});
   if(!response||!response.ok())errors.push(`document HTTP ${response?.status()||0}`);if(facts.overflow>2)errors.push(`horizontal overflow ${facts.overflow}px`);if(!facts.focusVisible)errors.push('focused control has no visible focus treatment');if(!facts.reduced)errors.push('reduced-motion media query not active');if(facts.badTargets.length)errors.push(`small controls: ${facts.badTargets.map(x=>`${x.tag}#${x.id} ${Math.round(x.w)}x${Math.round(x.h)}`).join(', ')}`);
   if(width<=768&&facts.menu){try{const menu=page.locator('.menu').first();if(await menu.isVisible()){await menu.click();if(await menu.getAttribute('aria-expanded')!=='true')errors.push('mobile menu did not expand');await page.keyboard.press('Escape');if(await menu.getAttribute('aria-expanded')!=='false')errors.push('mobile menu did not close on Escape');const locked=await page.evaluate(()=>document.body.classList.contains('mbm-nav-open')||getComputedStyle(document.body).overflow==='hidden');if(locked)errors.push('mobile menu left scroll locked')}}catch(e){errors.push(`menu interaction: ${e.message}`)}}
   if(name==='home'){if(/There is no account|There is no mailing list/i.test(facts.body))errors.push('stale no-account/no-mailing wording');if(!/Everything here is free to use/i.test(facts.body)||!/account is optional/i.test(facts.body))errors.push('public/optional account truth missing');const src=await page.content();if(/dx-tform/i.test(src)||/Teacher updates[\s\S]{0,3000}formsubmit\.co/i.test(src))errors.push('obsolete Teacher Updates FormSubmit implementation')}
   if(name==='account'){if(!facts.account.configured||!facts.account.register||!facts.account.login)errors.push('real account UI missing');if(!/Adult and teacher accounts/i.test(facts.body)||!/Pupils can use public/i.test(facts.body))errors.push('adult/pupil account boundary missing');if(!facts.account.emailAuto.includes('email')||!facts.account.passwordAuto.includes('current-password')||!facts.account.passwordAuto.includes('new-password'))errors.push('password-manager autocomplete semantics missing')}
   if(name==='members'){await page.waitForTimeout(1500);const state=await page.evaluate(()=>({out:!document.querySelector('#membersSignedOut')?.hidden,unavailable:!document.querySelector('#membersUnavailable')?.hidden}));if(!state.out||state.unavailable)errors.push('members signed-out production state incorrect')}
   if(name==='mailing'){if(!facts.mailing.consent||facts.mailing.consent.checked)errors.push('mailing consent absent or pre-checked');if(!/separate from an account/i.test(facts.body)||!/double opt-in/i.test(facts.body)||!/unsubscribe/i.test(facts.body))errors.push('mailing consent lifecycle wording missing')}
   if(name==='privacy'){if(!/Supabase/i.test(facts.body)||!/Buttondown/i.test(facts.body)||!/pupil/i.test(facts.body)||!/local/i.test(facts.body))errors.push('privacy provider/local-data distinction missing')}
   rows.push({name,route,width,status:response?.status()||0,...facts,body:undefined,errors});for(const e of errors)fail('browser',`${name} ${width}px: ${e}`);await context.close();
 }}
 await browser.close();const origins=[...external].sort();if(origins.some(x=>/buttondown/i.test(x)))fail('network','browser called Buttondown directly',{origins});report.browser={matrix:rows.length,rows,errors:report.findings.filter(x=>x.kind==='browser').length};report.network={externalOrigins:origins,buttondownDirect:origins.some(x=>/buttondown/i.test(x))};
}
function write(){
 report.finished=new Date().toISOString();report.result=report.findings.length?'FAIL':'PASS';
 fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(report,null,2));
 const lines=['# Made by Matt post-upgrade final estate audit','',`Result: **${report.result}**`,`Expected main: \`${EXPECTED}\``,`Repositories: ${report.repos.map(x=>`${x.name} \`${x.sha}\``).join(' · ')}`,`Same-day commits: ${report.sameDay.reduce((n,x)=>n+x.commits.length,0)}`,`Production routes crawled: ${report.crawl.routes||0}`,`Browser matrix: ${report.browser.matrix||0}`,`Findings: ${report.findings.length}`,`Warnings: ${report.warnings.length}`,''];
 if(report.findings.length){lines.push('## Findings','',...report.findings.map(x=>`- **${x.kind}** — ${x.message}`),'')}
 if(report.warnings.length){lines.push('## Preserved/review findings','',...report.warnings.map(x=>`- **${x.kind}** — ${x.message}`),'')}
 fs.writeFileSync(path.join(OUT,'summary.md'),lines.join('\n'));
 console.log(lines.join('\n'));if(report.findings.length)process.exitCode=1;
}

try{
 inspectRepo('site',ROOT);inspectRepo('Lessons',path.join(ROOT,'_estate','Lessons'));inspectRepo('Games',path.join(ROOT,'_estate','Games'));inspectRepo('Apps',path.join(ROOT,'_estate','Apps'));
 await deployedExact();await crawl();await browserAudit();
}catch(e){fail('fatal',e.stack||String(e))}finally{write()}
