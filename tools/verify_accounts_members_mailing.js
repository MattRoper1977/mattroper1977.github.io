#!/usr/bin/env node
/* mbm-accounts-members-mailing-2026-08-08
   Permanent static acceptance gate. This cannot prove a live external provider;
   it proves the repository fails closed when config is absent, accepts only
   deliberately public Supabase browser configuration when provisioned, keeps
   privileged secrets out of the browser, wires the required routes/RLS/provider
   functions, and contains positive controls that demonstrate the security scan
   can fail. */
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));
let pass=0,fail=0;
function ok(cond,label){if(cond){pass++;console.log('PASS',label)}else{fail++;console.error('FAIL',label)}}
function publicSupabaseConfig(accounts){
  const url=String((accounts&&accounts.supabaseUrl)||'').trim();
  const key=String((accounts&&accounts.supabaseAnonKey)||'').trim();
  if(!url&&!key)return {configured:false,safe:true};
  const urlSafe=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);
  // Modern publishable keys are the preferred browser key. A legacy anon JWT is
  // still accepted for compatibility, but a modern secret key/service-role JWT
  // must never be accepted by this public configuration gate.
  const publishable=/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key);
  let legacyAnon=false;
  if(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)){
    try{
      const payload=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const padded=payload+'='.repeat((4-payload.length%4)%4);
      const data=JSON.parse(Buffer.from(padded,'base64').toString('utf8'));
      legacyAnon=data&&data.role==='anon';
    }catch(_){legacyAnon=false}
  }
  const privileged=/^sb_secret_/i.test(key)||/service[_-]?role/i.test(key);
  return {configured:true,safe:urlSafe&&!privileged&&(publishable||legacyAnon)};
}
function ownPolicy(schema,column){
  // Accept both auth.uid() = column and Supabase's recommended optimized form
  // (select auth.uid()) = column, while still requiring an authenticated role.
  const escaped=column.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const uid='(?:\\(\\s*select\\s+)?auth\\.uid\\(\\)\\s*\\)?';
  const ownership=new RegExp(uid+'\\s*=\\s*'+escaped,'i');
  return /to\s+authenticated/i.test(schema)&&ownership.test(schema);
}
function scan(overrides={}){
  const get=p=>Object.prototype.hasOwnProperty.call(overrides,p)?overrides[p]:read(p);
  const account=get('assets/mbm-account.js');
  const schema=get('supabase-schema.sql');
  const site=JSON.parse(get('site.json'));
  const members=get('members/index.html');
  const accountPage=get('account/index.html');
  const mailing=get('mailing-list/index.html');
  const mailingJs=get('assets/mbm-mailing.js');
  const profile=get('assets/mbm-profile.js');
  const del=get('supabase/functions/delete-account/index.ts');
  const sub=get('supabase/functions/subscribe-mailing-list/index.ts');
  const cfg=get('supabase/config.toml');
  const findings=[];
  function need(cond,msg){if(!cond)findings.push(msg)}
  const accounts=site.features&&site.features.accounts;
  const pub=publicSupabaseConfig(accounts);
  need(accounts&&accounts.provider==='supabase','accounts provider is not supabase');
  need(accounts&&accounts.legacyLocalFallback===false,'legacy local auth fallback is not explicitly false');
  need(accounts&&typeof accounts.supabaseUrl==='string','missing public supabase URL slot');
  need(accounts&&typeof accounts.supabaseAnonKey==='string','missing public supabase key slot');
  need(pub.safe,'Supabase browser configuration is malformed or privileged');
  need(!/localStorage\s*\.\s*setItem\s*\(\s*['"](?:password|.*pass)/i.test(account),'account client writes a password-like key to localStorage');
  need(!/(service[_-]?role|BUTTONDOWN_API_KEY)\s*[:=]\s*['"][^'"]{8,}/i.test(account+mailingJs+accountPage+members+mailing),'private secret appears in browser code');
  need(!/sb_secret_[A-Za-z0-9_-]{8,}/i.test(account+mailingJs+accountPage+members+mailing+get('site.json')),'Supabase secret key appears in public/browser files');
  need(/Missing cloud configuration fails CLOSED|fail/i.test(account),'account fail-closed security boundary missing');
  need(/auth\.signUp/.test(account)&&/auth\.signInWithPassword/.test(account)&&/resetPasswordForEmail/.test(account)&&/auth\.signOut/.test(account),'real Supabase auth primitives missing');
  need(ownPolicy(schema,'id')&&ownPolicy(schema,'user_id'),'own-row RLS policies missing');
  need(/update_member_data/.test(schema)&&/version_conflict/.test(schema),'optimistic member-data conflict gate missing');
  need(!/\bpassword\b\s+(text|varchar|bytea)/i.test(schema),'schema contains a password column');
  need(/revoke all on function public\.handle_new_user\(\) from public/i.test(schema),'trigger security-definer function remains directly executable by PUBLIC');
  need(/grant update\s*\(\s*name\s*,\s*display_name\s*,\s*updated_at\s*\)\s+on table public\.profiles to authenticated/i.test(schema),'profile client grants are not column-restricted');
  need(/\/account\/\?mode=login/.test(members)&&/\/account\/\?mode=register/.test(members),'Members signed-out login/create routes missing');
  need(/autocomplete="username"/.test(accountPage)&&/autocomplete="current-password"/.test(accountPage)&&/autocomplete="new-password"/.test(accountPage),'password-manager semantics missing');
  need(/resendVerification/.test(account)&&/Resend verification email/.test(accountPage),'verification resend path missing');
  need(/otp_expired/.test(accountPage),'expired verification/recovery link handling missing');
  need(/mbm_cloud_identity_v1/.test(profile)&&/mbm_session/.test(profile),'offline game profile does not preserve cloud/legacy slot continuity');
  need(/type="checkbox"[^>]+required/.test(mailing),'mailing consent checkbox is not required');
  need(/Creating an account never joins|creating an account never joins|account.*never.*subscrib/i.test(mailing+accountPage),'account/mailing consent separation copy missing');
  need(/BUTTONDOWN_API_KEY/.test(sub)&&/Deno\.env\.get/.test(sub),'Buttondown token is not server-side env configuration');
  need(/SUPABASE_SERVICE_ROLE_KEY/.test(del)&&/auth\.admin\.deleteUser/.test(del),'server-side account deletion path missing');
  need(/\[functions\.subscribe-mailing-list\][\s\S]*verify_jwt\s*=\s*false/.test(cfg),'public subscription function configuration missing');
  need(/\[functions\.delete-account\][\s\S]*verify_jwt\s*=\s*true/.test(cfg),'account deletion JWT verification missing');
  return findings;
}

[
 'assets/mbm-account.js','assets/mbm-account.css','assets/mbm-mailing.js','assets/mbm-profile.js','account/index.html','members/index.html','mailing-list/index.html','privacy/index.html','supabase-schema.sql','supabase/functions/delete-account/index.ts','supabase/functions/subscribe-mailing-list/index.ts','supabase/config.toml','docs/ACCOUNTS_MAILING_SETUP.md'
].forEach(p=>ok(exists(p),'required file '+p));
const real=scan();ok(real.length===0,'real tree passes account/security static gate');if(real.length)real.forEach(x=>console.error('  ',x));
const tampered=read('assets/mbm-account.js')+'\nlocalStorage.setItem("password","positive-control");\n';
const positive=scan({'assets/mbm-account.js':tampered});
ok(positive.some(x=>/password-like key/.test(x)),'positive control: injected localStorage password is rejected');
const site=JSON.parse(read('site.json'));
const pub=publicSupabaseConfig(site.features.accounts);
ok(pub.safe&&(pub.configured||(!site.features.accounts.supabaseUrl&&!site.features.accounts.supabaseAnonKey)),'Supabase browser config is absent or deliberately public — never privileged');
const secretFixture=JSON.parse(read('site.json'));
secretFixture.features.accounts.supabaseAnonKey='sb_'+'secret_'+'positive_control_not_a_real_key';
const secretPositive=scan({'site.json':JSON.stringify(secretFixture)});
ok(secretPositive.some(x=>/malformed or privileged|secret key appears/i.test(x)),'positive control: injected Supabase secret is rejected');
ok(site.features.mailing.enabled===false,'mailing remains disabled until real provider proof');
console.log(`\n${pass} passed · ${fail} failed`);
if(fail)process.exit(1);
console.log(pub.configured?'SUPABASE PUBLIC CONFIG: configured; live auth/cross-device acceptance still requires provider QA.':'EXTERNAL BLOCK: live account acceptance requires Supabase public configuration and provider QA.');
console.log('MAILING EXTERNAL BLOCK: Buttondown secret/provider readback and production subscribe/unsubscribe QA are still required before enabling mailing.');
