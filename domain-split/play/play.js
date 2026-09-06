/* Play discovery only. These exact keys never contain or clear game saves. */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('play-data').textContent);
  const games = data.games, byId = new Map(games.map(g => [g.id, g]));
  const form = document.getElementById('discovery-form');
  const fields = ['q', 'genre', 'group', 'control', 'mode', 'list'];
  const keys = {favourites:'mbm_play_favourites_v1',recent:'mbm_play_recently_opened_v1',position:'mbm_play_browse_position_v1'};
  let durable = true;
  function readList(name) {
    try {
      const parsed = JSON.parse(localStorage.getItem(keys[name]) || '[]');
      return Array.isArray(parsed) ? [...new Set(parsed.filter(id => typeof id === 'string' && byId.has(id)))].slice(0,69) : [];
    } catch (_) { durable = false; return []; }
  }
  let favourites = readList('favourites'), recent = readList('recent');
  function storageNotice(message) {
    document.getElementById('storage-status').textContent = message || (durable ? '' : 'Storage is unavailable. Your shortlist works for this open page only; games may have their own storage limits.');
  }
  function saveList(name, value) {
    try { localStorage.setItem(keys[name], JSON.stringify(value)); }
    catch (_) { durable=false; storageNotice(); }
  }
  const status=document.getElementById('result-count'), grid=document.getElementById('game-grid');
  const cards = [...grid.querySelectorAll('[data-card]')];
  const normalize = v => String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const searchable = new Map(games.map(g => [g.id, normalize([g.title,g.description,g.genre,g.subject,g.groupLabel,...(g.keywords||[])].join(' '))]));
  const dialog=document.getElementById('game-dialog');
  let activeGame=null, returnFocus=null;
  function state() { return Object.fromEntries(fields.map(k=>[k,String(form.elements[k].value).slice(0,k==='q'?160:80)])); }
  function syncUrl() {
    const url=new URL(location.href); fields.forEach(k=>url.searchParams.delete(k));
    Object.entries(state()).forEach(([k,v])=>{if(v) url.searchParams.set(k,v);});
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  }
  function applyUrl() {
    const params=new URLSearchParams(location.search);
    fields.forEach(k=>{const el=form.elements[k],v=params.get(k)||'';el.value=el.tagName==='SELECT'&&!Array.from(el.options).some(o=>o.value===v)?'':v.slice(0,160);});
  }
  function render({url=true}={}) {
    const focused=document.activeElement, focusedCard=focused?.closest('[data-card]');
    const s=state(),words=normalize(s.q).split(/\s+/).filter(Boolean);
    const selected=s.list==='favourites'?favourites:s.list==='recent'?recent:null;
    let shown=0;
    for(const card of cards) {
      const g=byId.get(card.dataset.card);
      const match=words.every(w=>searchable.get(g.id).includes(w))&&(!s.genre||g.genre===s.genre)&&(!s.group||g.group===s.group)&&
        (!s.control||(s.control==='unknown'?!g.controls.length:g.controls.includes(s.control)))&&
        (!s.mode||(s.mode==='unknown'?!g.modes.length:g.modes.includes(s.mode)))&&(!selected||selected.includes(g.id));
      card.hidden=!match;if(match)shown++;
    }
    const ordered=s.list==='recent'?[...cards].sort((a,b)=>recent.indexOf(a.dataset.card)-recent.indexOf(b.dataset.card)):cards;
    ordered.forEach(card=>grid.append(card));
    document.getElementById('empty-state').hidden=shown!==0;
    document.getElementById('empty-description').textContent=selected&&selected.length===0?(s.list==='favourites'?'Tap a heart on a game to start your favourites.':'Games appear here when you open them from this collection.'):'Try a different word or clear a filter.';
    status.textContent=shown+' of '+games.length+' games and activities'+(s.list==='favourites'?' · Favourites':s.list==='recent'?' · Recently opened':'');
    document.querySelectorAll('[data-favourite]').forEach(button=>{
      const saved=favourites.includes(button.dataset.favourite),g=byId.get(button.dataset.favourite);
      button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',(saved?'Remove favourite ':'Favourite ')+g.title);button.textContent=saved?'♥':'♡';
    });
    if(url)syncUrl();
    if(focusedCard){if(!focusedCard.hidden)focused.focus();else (grid.querySelector('[data-card]:not([hidden]) [data-favourite]')||document.getElementById('empty-reset')).focus();}
  }
  function rememberPosition() {
    try {sessionStorage.setItem(keys.position,JSON.stringify({url:location.pathname+location.search,y:scrollY}));}catch(_){}
  }
  function restorePosition() {
    try {const p=JSON.parse(sessionStorage.getItem(keys.position)||'null');if(p&&p.url===location.pathname+location.search&&Number.isFinite(p.y))requestAnimationFrame(()=>scrollTo(0,p.y));}catch(_){}
  }
  function reset() {form.reset();render();}
  form.addEventListener('submit',e=>{e.preventDefault();render();});
  form.addEventListener('input',()=>render());
  form.addEventListener('change',()=>render());
  form.addEventListener('reset',()=>queueMicrotask(()=>render()));
  document.getElementById('empty-reset').addEventListener('click',reset);
  document.addEventListener('click',e=>{
    const fav=e.target.closest('[data-favourite]');
    if(fav){const id=fav.dataset.favourite;favourites=favourites.includes(id)?favourites.filter(x=>x!==id):[...favourites,id];saveList('favourites',favourites);render({url:false});return;}
    const link=e.target.closest('a[data-play]');
    if(link){const id=link.dataset.play;if(byId.has(id)){recent=[id,...recent.filter(x=>x!==id)].slice(0,24);saveList('recent',recent);if(dialog.open&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey)closeInfo();rememberPosition();}return;}
    const filter=e.target.closest('a[href^="?"]');
    if(filter&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();history.pushState({},'',filter.getAttribute('href'));applyUrl();render({url:false});document.getElementById('browse').scrollIntoView();return;}
    const info=e.target.closest('[data-info], [data-watch]');
    if(info){openInfo(byId.get(info.dataset.info||info.dataset.watch),info,Boolean(info.dataset.watch));}
  });
  document.addEventListener('auxclick',e=>{const link=e.target.closest('a[data-play]');if(e.button===1&&link&&byId.has(link.dataset.play)){const id=link.dataset.play;recent=[id,...recent.filter(x=>x!==id)].slice(0,24);saveList('recent',recent);rememberPosition();}});
  ['favourites','recent'].forEach(name=>{
    const button=document.getElementById('clear-'+name);button.hidden=false;
    button.addEventListener('click',()=>{if(name==='favourites')favourites=[];else recent=[];saveList(name,[]);render({url:false});storageNotice((name==='favourites'?'Favourites':'Recently opened')+' cleared. Game saves were not changed.'+(durable?'':' Storage is unavailable.'));});
  });
  function stopMedia() {const video=dialog.querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}document.getElementById('dialog-media').replaceChildren();document.getElementById('media-status').textContent='';}
  const labels={touch:'Touch controls',keyboard:'Keyboard / mouse',gamepad:'Gamepad',single:'Single-player',local:'Local multiplayer — follow the game’s same-network or shared-device instructions','classroom-teams':'Classroom teams on a shared device'};
  function detail(label,value) {const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;document.getElementById('dialog-details').append(dt,dd);}
  function poster(g) {
    const m=g.media||{},source=m.poster||g.image;if(!source)return;
    const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.alt=m.description||g.title+' cover artwork';img.width=640;img.height=360;caption.textContent=m.poster?'In-game screenshot. '+m.description:'Cover artwork; this is not an in-game screenshot.';img.addEventListener('error',()=>{img.hidden=true;caption.textContent='Image unavailable. '+(m.description||g.description);});img.src=source;figure.append(img,caption);document.getElementById('dialog-media').append(figure);
  }
  function openInfo(g,trigger,watch=false) {
    if(!g||typeof dialog.showModal!=='function')return;
    stopMedia();activeGame=g;returnFocus=trigger;
    document.getElementById('dialog-title').textContent=g.title;document.getElementById('dialog-kind').textContent=g.genre+' · '+g.groupLabel;
    document.getElementById('dialog-description').textContent=g.description;
    const dl=document.getElementById('dialog-details');dl.replaceChildren();
    detail('Controls',g.controls.length?g.controls.map(k=>labels[k]).join(' · '):'Not yet verified');
    detail('Players',g.modes.length?g.modes.map(k=>labels[k]).join(' · '):'Not yet verified');
    detail('How to play',g.instructions);if(g.evidence.length)detail('Support evidence','Checked against the current game instructions. Device performance can vary.');
    const play=document.getElementById('dialog-play');play.href=g.route;play.dataset.play=g.id;play.textContent='Play '+g.title;
    const report=document.getElementById('dialog-report');report.href='mailto:contactmadebymatt@gmail.com?subject='+encodeURIComponent('Play problem: '+g.title)+'&body='+encodeURIComponent('Game: '+g.title+'\nURL: https://www.madebymatt-play.uk'+g.route+'\n\nWhat happened?\n\nDevice and browser:\n');
    document.getElementById('dialog-watch').hidden=!g.media.video;poster(g);
    if(!dialog.open)dialog.showModal();
    if(watch)playPreview();
  }
  function playPreview() {
    const g=activeGame;if(!g||!g.media.video)return;stopMedia();
    const figure=document.createElement('figure'),video=document.createElement('video'),caption=document.createElement('figcaption');
    video.controls=true;video.preload='none';video.playsInline=true;video.poster=g.media.poster;video.src=g.media.video;video.setAttribute('aria-label',g.title+' gameplay preview, silent');
    caption.textContent=g.media.duration_seconds+'-second silent gameplay. '+g.media.description;figure.append(video,caption);document.getElementById('dialog-media').append(figure);
    video.addEventListener('error',()=>{document.getElementById('media-status').textContent='This preview could not play. You can still open the game.';stopFailedVideo(video,g);});
    video.play().catch(()=>{document.getElementById('media-status').textContent='Use the video Play control to start this preview.';});
  }
  function stopFailedVideo(video,g){video.pause();video.removeAttribute('src');video.load();video.closest('figure').remove();poster(g);}
  function closeInfo(){if(!dialog.open)return;stopMedia();dialog.close();activeGame=null;returnFocus?.focus();}
  document.getElementById('dialog-watch').addEventListener('click',playPreview);
  document.getElementById('dialog-close').addEventListener('click',()=>closeInfo());
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeInfo();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeInfo();}});
  document.querySelector('.menu').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.currentTarget.open=false;e.currentTarget.querySelector('summary').focus();}});
  document.querySelectorAll('.menu a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('.menu').open=false;}));
  window.addEventListener('pagehide',()=>{rememberPosition();stopMedia();});
  window.addEventListener('pageshow',()=>{favourites=readList('favourites');recent=readList('recent');render({url:false});restorePosition();});
  window.addEventListener('popstate',()=>{if(dialog.open)closeInfo();applyUrl();render({url:false});});
  window.addEventListener('storage',e=>{if(e.key===keys.favourites||e.key===keys.recent){favourites=readList('favourites');recent=readList('recent');render({url:false});}});
  document.querySelectorAll('[data-favourite]').forEach(b=>b.hidden=false);
  if(typeof dialog.showModal==='function')document.querySelectorAll('[data-info],[data-watch]').forEach(b=>b.hidden=false);
  // Meaningful image failure without an unrelated invented picture.
  document.querySelectorAll('.game-card img').forEach(img=>{const failed=()=>{img.hidden=true;img.closest('figure').querySelector('figcaption').textContent='Image unavailable — game link still works';};img.addEventListener('error',failed);if(img.complete&&!img.naturalWidth)failed();});
  applyUrl();render({url:false});storageNotice();
})();
