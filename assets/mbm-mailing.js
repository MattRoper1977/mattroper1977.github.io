/* mbm-accounts-members-mailing-2026-08-08
   Mailing-list client. Marketing consent is deliberately separate from auth.
   The browser sends subscription requests only to a configured Made by Matt
   Supabase Edge Function. Buttondown's private API key stays server-side.
*/
(function(w,d){
'use strict';
if(w.MBMMailing)return;
var SENTINEL='mbm-accounts-members-mailing-2026-08-08';
var state={ready:false,configured:false,config:null,error:''},readyResolve,ready=new Promise(function(r){readyResolve=r});
function snap(){return{sentinel:SENTINEL,ready:state.ready,configured:state.configured,error:state.error,provider:state.config&&state.config.mailing?state.config.mailing.provider:null}}
function valid(a,m){return !!(m&&m.enabled===true&&m.provider==='buttondown'&&m.functionName&&a&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(a.supabaseUrl||'')))}
function load(){return fetch('/site.json',{cache:'no-store',credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('config');return r.json()}).then(function(j){var f=(j&&j.features)||{};state.config={accounts:f.accounts||{},mailing:f.mailing||{}};state.configured=valid(state.config.accounts,state.config.mailing)})}
function emailOK(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}
function subscribe(input){
 input=input||{};var email=String(input.email||'').trim().toLowerCase(),consent=input.consent===true,hp=String(input.company||'');
 if(!state.configured)return Promise.reject(new Error('The mailing list is not configured yet.'));
 if(!emailOK(email))return Promise.reject(new Error('Enter a valid email address.'));
 if(!consent)return Promise.reject(new Error('Tick the consent box if you want to join the mailing list.'));
 if(hp)return Promise.resolve({ok:true,state:'accepted'});
 var a=state.config.accounts,m=state.config.mailing,url=String(a.supabaseUrl).replace(/\/+$/,'')+'/functions/v1/'+encodeURIComponent(m.functionName);
 return fetch(url,{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,consent:true,company:''})})
  .then(function(r){return r.json().catch(function(){return{}}).then(function(body){if(!r.ok)throw new Error(body&&body.message?body.message:'Subscription could not be completed.');return body})})
  .then(function(body){return body&&body.state?body:{ok:true,state:'pending_confirmation'}})
  .catch(function(err){var s=String((err&&err.message)||err);if(/network|fetch/i.test(s))throw new Error('The mailing service could not be reached. Check your connection and try again.');throw new Error(s||'Subscription could not be completed.')});
}
function bind(form){
 if(!form||form.getAttribute('data-mbm-bound')==='1')return;form.setAttribute('data-mbm-bound','1');
 var status=form.querySelector('[data-mailing-status]'),submit=form.querySelector('[type="submit"]');
 function say(text,kind){if(!status)return;status.textContent=text||'';status.className='ma-status'+(kind?' '+kind:'')}
 form.addEventListener('submit',function(e){e.preventDefault();var fd=new FormData(form);say('Joining the mailing list…');if(submit)submit.disabled=true;
  subscribe({email:fd.get('email'),consent:fd.get('consent')==='yes',company:fd.get('company')}).then(function(result){
   if(result.state==='already_subscribed')say('That address is already on the list. You can use the unsubscribe link in any mailing if you want to leave.','ok');
   else say('Nearly done — check your inbox and confirm the subscription.','ok');
   form.reset();
  }).catch(function(err){say(err.message,'err')}).finally(function(){if(submit)submit.disabled=false});
 });
}
function reflect(){Array.prototype.forEach.call(d.querySelectorAll('[data-mbm-mailing]'),function(root){var form=root.querySelector('form[data-mbm-mailing-form]'),off=root.querySelector('[data-mailing-off]');if(form)form.hidden=!state.configured;if(off)off.hidden=state.configured;if(state.configured&&form)bind(form)})}
function boot(){load().catch(function(){state.configured=false;state.error='Mailing-list configuration could not be read.'}).then(function(){state.ready=true;reflect();readyResolve(snap())})}
w.MBMMailing={sentinel:SENTINEL,ready:ready,get state(){return snap()},subscribe:subscribe,bind:bind};
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window,document);
