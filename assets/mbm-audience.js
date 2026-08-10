/* mbm-audience-discovery-teach-professional-hubs-closeout-2026-08-09
   Audience choice and discovery enhancements. Audience preference and surprise
   selection are local-only; the owner-controlled video loads only on click. */
(function(){
'use strict';
var KEY='mbm_audience_view';
var doc=document;var body=doc.body;if(!body)return;
var face=body.getAttribute('data-mbm-audience-face')||'';

/* The homepage types a visitor can choose, and where each one lives. This is
   one list, not two: it is both the allow-list for the stored value and the
   route table for the brand link, so a type cannot be storable but unroutable
   or the reverse.

   /main/ is a homepage type. It is not an audience - it has no face page, no
   sections and no accent of its own on any page it serves - but a visitor can
   choose it here, so it has to be storable here.

   KNOWN LIABILITY: a static asset cannot read the JSON at build time, so these
   eight routes are a literal. verify_games_audience_faces.py asserts they equal
   the seven audiences plus mainOption in data/audience-homepages.json exactly,
   so the copy cannot drift silently - which is the only thing that makes a
   second literal tolerable. */
var ROUTES={pupils:'/for/pupils/',teachers:'/for/teachers/',parents:'/for/parents-carers/',schools:'/for/schools-semh/',trusts:'/for/trusts/',councils:'/for/councils-organisations/',partners:'/for/partners/',main:'/main/'};

/* THE WRITE ASYMMETRY, which is an invariant and not an accident.

   Choosing a homepage writes the preference. ARRIVING at one does not, for
   /main/. The seven audience pages each declare data-mbm-audience-face and are
   reached almost only by choosing them, so landing there is itself the choice.
   /main/ is different: it is the brand link's default, the footer's link, a
   nav item on every surface and the target of the hero call to action, so a
   visitor lands on it constantly without ever having chosen it. If landing
   wrote, the first accidental visit would silently overwrite a deliberate
   choice and the chooser would report it back as "last used on this device".

   Today /main/ carries no data-mbm-audience-face at all, so this guard is
   belt and braces - which is the point. The invariant should not depend on a
   hand-maintained page continuing not to have an attribute. Both halves are
   asserted: the guard here, and the absence of the attribute across the tree. */
var LANDING_EXCEPTION='main';

function read(){try{var value=localStorage.getItem(KEY)||'';return ROUTES[value]?value:'';}catch(_){return '';}}
function write(value){try{if(ROUTES[value])localStorage.setItem(KEY,value);}catch(_){}}
function clear(){try{localStorage.removeItem(KEY);}catch(_){}}
if(face&&face!==LANDING_EXCEPTION)write(face);

/* The brand link resolves to the homepage the visitor chose.

   The HTML keeps href="/main/" as the static default: it is the no-JS answer,
   the no-preference answer, and a stable literal for the byte-for-byte gate.
   Only the href is rewritten at run time, never the served bytes - the choice
   is a per-device preference on cached static pages.

   THE PUPIL RULE. /for/pupils/ carries data-mbm-adult-features="off" and its
   brand link pointed at /main/, the adult platform homepage. On any page
   carrying that flag the brand resolves to /for/pupils/, or to "/" when there
   is no usable preference - never to /main/. This is asserted in the browser
   harness, not left as a convention.

   /main/ becoming selectable does not loosen it. The suppressed branch answers
   with /for/pupils/ or "/" and has no path that returns ROUTES.main, so a
   stored 'main' cannot put the adult platform homepage behind the brand on a
   page that suppresses adult features. The browser harness asserts that, on
   the pupil page, with 'main' deliberately stored first. */
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
  /* The other half of the write asymmetry: the chooser records the choice at
     the moment it is made. Uniform across all eight cards rather than special
     handling for /main/ - the seven also write on landing, so writing here is
     redundant for them and load-bearing for /main/, and one rule with a
     redundant case is easier to keep true than a rule with an exception.
     setItem is synchronous, so it completes before the navigation the click
     also starts. */
  function recordChoice(card){write(card.getAttribute('data-mbm-face-choice')||'');paint();}
  cards.forEach(function(card){card.addEventListener('click',function(){recordChoice(card);});});
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
