/* mbm-games-audience-faces-2026-08-08
   Remembers only the locally chosen audience route. It never redirects, gates
   content or sends the preference anywhere. */
(function(){
'use strict';
var KEY='mbm_audience_view';
var body=document.body;
if(!body)return;
var face=body.getAttribute('data-mbm-audience-face')||'';
var allowed={pupils:1,teachers:1,parents:1,schools:1,trusts:1,councils:1,partners:1};
function read(){try{var v=localStorage.getItem(KEY)||'';return allowed[v]?v:''}catch(e){return ''}}
function write(v){try{if(allowed[v])localStorage.setItem(KEY,v)}catch(e){}}
function clear(){try{localStorage.removeItem(KEY)}catch(e){}}
if(allowed[face])write(face);
if(face!=='chooser')return;
var saved=read();
var cards=[].slice.call(document.querySelectorAll('[data-mbm-face-choice]'));
var cont=document.querySelector('[data-mbm-face-continue]');
var contLink=cont&&cont.querySelector('a');
var clearBtn=cont&&cont.querySelector('[data-mbm-face-clear]');
function paint(){
 saved=read();
 cards.forEach(function(card){card.classList.toggle('is-last',card.getAttribute('data-mbm-face-choice')===saved)});
 if(cont){
  cont.classList.toggle('is-visible',!!saved);
  if(contLink&&saved){
   var card=cards.find(function(c){return c.getAttribute('data-mbm-face-choice')===saved});
   if(card){contLink.href=card.href;contLink.textContent='Continue with '+(card.getAttribute('data-mbm-face-label')||'your last view')}
  }
 }
}
if(clearBtn)clearBtn.addEventListener('click',function(){clear();paint()});
paint();
})();
