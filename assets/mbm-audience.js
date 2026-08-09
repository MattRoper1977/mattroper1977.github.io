/* mbm-audience-discovery-teach-professional-hubs-closeout-2026-08-09
   Audience choice and discovery enhancements. Audience preference and surprise
   selection are local-only; the owner-controlled video loads only on click. */
(function(){
'use strict';
var KEY='mbm_audience_view';
var doc=document;var body=doc.body;if(!body)return;
var face=body.getAttribute('data-mbm-audience-face')||'';
var allowed={pupils:1,teachers:1,parents:1,schools:1,trusts:1,councils:1,partners:1};
function read(){try{var value=localStorage.getItem(KEY)||'';return allowed[value]?value:'';}catch(_){return '';}}
function write(value){try{if(allowed[value])localStorage.setItem(KEY,value);}catch(_){}}
function clear(){try{localStorage.removeItem(KEY);}catch(_){}}
if(allowed[face])write(face);

/* The brand link resolves to the homepage the visitor chose.

   The HTML keeps href="/main/" as the static default: it is the no-JS answer,
   the no-preference answer, and a stable literal for the byte-for-byte gate.
   Only the href is rewritten at run time, never the served bytes - the choice
   is a per-device preference on cached static pages.

   THE PUPIL RULE. /for/pupils/ carries data-mbm-adult-features="off" and its
   brand link pointed at /main/, the adult platform homepage. On any page
   carrying that flag the brand resolves to /for/pupils/, or to "/" when there
   is no usable preference - never to /main/. This is asserted in the browser
   harness, not left as a convention. */
/* KNOWN LIABILITY: a static asset cannot read the JSON at build time, so
   these seven routes are a literal. verify_games_audience_faces.py asserts
   they equal data/audience-homepages.json exactly, so the copy cannot drift
   silently - which is the only thing that makes a second literal tolerable. */
var ROUTES={pupils:'/for/pupils/',teachers:'/for/teachers/',parents:'/for/parents-carers/',schools:'/for/schools-semh/',trusts:'/for/trusts/',councils:'/for/councils-organisations/',partners:'/for/partners/'};
function adultSuppressed(){return body.getAttribute('data-mbm-adult-features')==='off';}
function brandTarget(){
  var saved=read();
  if(adultSuppressed())return saved==='pupils'?ROUTES.pupils:'/';
  return saved&&ROUTES[saved]?ROUTES[saved]:'/main/';
}
function paintBrand(){
  var links=doc.querySelectorAll('a.brand');
  for(var i=0;i<links.length;i+=1){links[i].setAttribute('href',brandTarget());}
}
function initBrand(){
  paintBrand();
  window.addEventListener('storage',function(event){if(event.key===KEY)paintBrand();});
}

function initChooser(){
  if(face!=='chooser')return;
  var cards=Array.prototype.slice.call(doc.querySelectorAll('[data-mbm-face-choice]'));
  var box=doc.querySelector('[data-mbm-face-continue]');
  var continueLink=box&&box.querySelector('a');
  var clearButton=box&&box.querySelector('[data-mbm-face-clear]');
  function selectedCard(value){for(var i=0;i<cards.length;i+=1){if(cards[i].getAttribute('data-mbm-face-choice')===value)return cards[i];}return null;}
  function paint(){
    var saved=read();
    cards.forEach(function(card){card.classList.toggle('is-last',card.getAttribute('data-mbm-face-choice')===saved);});
    if(!box)return;
    box.classList.toggle('is-visible',!!saved);box.setAttribute('aria-hidden',saved?'false':'true');
    if(!saved||!continueLink)return;
    var card=selectedCard(saved);if(!card)return;
    continueLink.setAttribute('href',card.getAttribute('href')||card.href);
    continueLink.textContent='Continue with '+(card.getAttribute('data-mbm-face-label')||'your last homepage');
  }
  if(clearButton)clearButton.addEventListener('click',function(){clear();paint();clearButton.focus();});
  window.addEventListener('storage',function(event){if(event.key===KEY)paint();});
  paint();
}
function initSurprise(){
  doc.querySelectorAll('[data-mbm-surprise-set]').forEach(function(root){
    var button=root.querySelector('[data-mbm-surprise]');var result=root.querySelector('[data-mbm-surprise-result]');if(!button||!result)return;
    var games=[];try{games=JSON.parse(root.getAttribute('data-mbm-surprise-set')||'[]');}catch(_){}
    games=games.filter(function(game){return game&&typeof game.id==='string'&&typeof game.route==='string'&&/^\/(apexkick|voxel|novasiege|ouroboros|fracture|apextennis|apexpool|olympics)\/$/.test(game.route);});
    button.addEventListener('click',function(){
      if(!games.length){result.textContent='No pupil-safe game is available.';return;}
      var game=games[Math.floor(Math.random()*games.length)];
      result.textContent='';var link=doc.createElement('a');link.className='mf-btn quiet';link.href=game.route;link.textContent='Play '+game.title;
      link.setAttribute('data-mbm-track-recent',game.id);link.setAttribute('data-mbm-recent-route',game.route);
      result.append('Your game: ',link);link.focus();
    });
  });
}
function initVideos(){
  doc.querySelectorAll('[data-mbm-video]').forEach(function(button){
    button.addEventListener('click',function(){
      var id=button.getAttribute('data-mbm-video');if(!/^[A-Za-z0-9_-]{11}$/.test(id||''))return;
      var shell=button.closest('[data-mbm-video-shell]')||button.parentNode;
      var iframe=doc.createElement('iframe');
      iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0';
      iframe.title=button.getAttribute('aria-label')||'Made by Matt video';
      iframe.setAttribute('allow','autoplay; encrypted-media; picture-in-picture; fullscreen');iframe.setAttribute('allowfullscreen','');
      iframe.width='1280';iframe.height='720';
      button.replaceWith(iframe);iframe.focus();
      if(shell){var note=shell.querySelector('p');if(note)note.textContent='The privacy-enhanced player was loaded after your click.';}
    },{once:true});
  });
}
function init(){initBrand();initChooser();initSurprise();initVideos();}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
