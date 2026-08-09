/* mbm-homepage-audience-routing-2026-08-09
   Local-only homepage preference. It never redirects, gates content, identifies
   a person, creates consent or sends the selected audience to any service. */
(function(){
'use strict';
var KEY='mbm_audience_view';
var body=document.body;
if(!body)return;
var face=body.getAttribute('data-mbm-audience-face')||'';
var allowed={pupils:1,teachers:1,parents:1,schools:1,trusts:1,councils:1,partners:1};
function read(){try{var value=localStorage.getItem(KEY)||'';return allowed[value]?value:''}catch(error){return ''}}
function write(value){try{if(allowed[value])localStorage.setItem(KEY,value)}catch(error){}}
function clear(){try{localStorage.removeItem(KEY)}catch(error){}}
if(allowed[face])write(face);
if(face!=='chooser')return;
var cards=Array.prototype.slice.call(document.querySelectorAll('[data-mbm-face-choice]'));
var box=document.querySelector('[data-mbm-face-continue]');
var continueLink=box&&box.querySelector('a');
var clearButton=box&&box.querySelector('[data-mbm-face-clear]');
function selectedCard(value){
  for(var i=0;i<cards.length;i+=1){if(cards[i].getAttribute('data-mbm-face-choice')===value)return cards[i]}
  return null;
}
function paint(){
  var saved=read();
  cards.forEach(function(card){card.classList.toggle('is-last',card.getAttribute('data-mbm-face-choice')===saved)});
  if(!box)return;
  box.classList.toggle('is-visible',!!saved);
  box.setAttribute('aria-hidden',saved?'false':'true');
  if(!saved||!continueLink)return;
  var card=selectedCard(saved);
  if(!card)return;
  continueLink.setAttribute('href',card.getAttribute('href')||card.href);
  continueLink.textContent='Continue with '+(card.getAttribute('data-mbm-face-label')||'your last homepage');
}
if(clearButton)clearButton.addEventListener('click',function(){clear();paint();clearButton.focus()});
window.addEventListener('storage',function(event){if(event.key===KEY)paint()});
paint();
})();
