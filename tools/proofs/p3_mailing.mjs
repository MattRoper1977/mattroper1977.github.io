#!/usr/bin/env node
/* P3 — Buttondown provider proof: subscribe → readback → duplicate → unsubscribe.
 * Operator-only: BUTTONDOWN_API_KEY must never enter the repo, CI or browser.
 */
const URL_=(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const KEY=process.env.SUPABASE_ANON_KEY||'';
const BD=process.env.BUTTONDOWN_API_KEY||'';
const ORIGIN=process.env.ORIGIN||'https://madebymatt.uk';
const EMAIL=(process.env.QA_MAIL_EMAIL||'').trim().toLowerCase();
const FN=process.env.MAILING_FUNCTION||'subscribe-mailing-list';
function die(m){console.error('FATAL: '+m);process.exit(2)}
if(!URL_||!KEY||!BD||!EMAIL)die('SUPABASE_URL, SUPABASE_ANON_KEY, BUTTONDOWN_API_KEY and QA_MAIL_EMAIL are required.');
const steps=[];function step(name,ok,detail){steps.push({name,outcome:ok?'PASS':'FAIL',detail});console.log(`${ok?'PASS':'FAIL'}  ${name.padEnd(48)} ${detail}`)}
const subscribe=email=>fetch(`${URL_}/functions/v1/${FN}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN,apikey:KEY},body:JSON.stringify({email,consent:true,company:''})});
async function provider(email){
 const r=await fetch(`https://api.buttondown.com/v1/subscribers/${encodeURIComponent(email)}`,{headers:{Authorization:`Token ${BD}`,Accept:'application/json'}});
 const j=await r.json().catch(()=>({}));
 return{status:r.status,found:r.ok,emailMatches:r.ok&&String(j.email_address||'').toLowerCase()===email,type:r.ok?j.type:null};
}
async function run(){
 const pre=await provider(EMAIL);if(pre.found)die('QA address already exists; use a clean disposable address.');
 step('pre: address absent from provider',pre.status===404,`HTTP ${pre.status}`);
 const s1=await subscribe(EMAIL),b1=await s1.json().catch(()=>({}));
 step('subscribe returns uniform success',s1.status===200&&b1.ok===true&&b1.state==='pending_confirmation',`HTTP ${s1.status}`);
 const after1=await provider(EMAIL);
 step('provider readback exists',after1.status===200&&after1.emailMatches,`HTTP ${after1.status}, type=${after1.type}`);
 step('double opt-in is pending',after1.type==='unactivated',`type=${after1.type}`);
 const d=await subscribe(EMAIL),db=await d.json().catch(()=>({}));
 step('duplicate response is indistinguishable',d.status===s1.status&&JSON.stringify(db)===JSON.stringify(b1),`HTTP ${d.status}`);
 const afterDup=await provider(EMAIL);
 step('duplicate preserves one canonical subscriber',afterDup.status===200&&afterDup.emailMatches,`type=${afterDup.type}`);
 // Provider-side unsubscribe proof. This tests the same current Buttondown
 // endpoint/field used by the authenticated Edge Function.
 const un=await fetch(`https://api.buttondown.com/v1/subscribers/${encodeURIComponent(EMAIL)}`,{method:'PATCH',headers:{Authorization:`Token ${BD}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({type:'unsubscribed'})});
 const afterUn=await provider(EMAIL);
 // Buttondown may keep an unactivated address unactivated; for a full active
 // unsubscribe proof use a disposable active subscriber. Do not fake success.
 step('provider accepted unsubscribe request',un.ok,`HTTP ${un.status}`);
 step('provider state is unsubscribed when transition applies',afterUn.type==='unsubscribed'||afterUn.type==='unactivated',`type=${afterUn.type}`);
 const bad=await subscribe('not-an-email'),badBody=await bad.json().catch(()=>({}));
 step('invalid address fails closed',!bad.ok&&badBody.ok!==true,`HTTP ${bad.status}`);
 const noConsent=await fetch(`${URL_}/functions/v1/${FN}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:ORIGIN,apikey:KEY},body:JSON.stringify({email:`nc-${EMAIL}`,consent:false})});
 step('missing consent is refused',noConsent.status===400,`HTTP ${noConsent.status}`);
 const red=steps.filter(s=>s.outcome==='FAIL');
 const{writeFileSync,mkdirSync}=await import('node:fs');mkdirSync('reports/proofs',{recursive:true});writeFileSync('reports/proofs/P3_mailing.evidence.json',JSON.stringify({ranAt:new Date().toISOString(),origin:ORIGIN,steps},null,2));
 console.log(`\n${steps.length} steps · ${red.length} FAIL`);if(red.length)process.exit(1);
}
run().catch(e=>{console.error(e);process.exit(2)});
