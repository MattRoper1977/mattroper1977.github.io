/* mbm-audience-discovery-teach-professional-hubs-closeout-2026-08-09
   Local-only recent discovery history. Records contain exactly a stable public
   ID, canonical route and last-opened timestamp. Search text is never stored. */
(function(){
  'use strict';
  var KEY='mbm_recent_items_v1';
  var MAX=12;
  var doc=document;

  function safeParse(value){
    try{return JSON.parse(value);}catch(_){return null;}
  }
  function clean(item){
    if(!item||typeof item.id!=='string'||typeof item.route!=='string')return null;
    var openedAt=Number(item.openedAt);
    if(!Number.isFinite(openedAt)||openedAt<=0)return null;
    if(!/^\/(?!\/)/.test(item.route)&&!/^https:\/\/github\.com\//.test(item.route))return null;
    return {id:item.id.slice(0,160),route:item.route.slice(0,600),openedAt:Math.floor(openedAt)};
  }
  function read(){
    var raw;
    try{raw=localStorage.getItem(KEY);}catch(_){return [];}
    var list=safeParse(raw);
    if(!Array.isArray(list))return [];
    return list.map(clean).filter(Boolean).sort(function(a,b){return b.openedAt-a.openedAt;}).slice(0,MAX);
  }
  function write(list){
    var cleaned=list.map(clean).filter(Boolean).slice(0,MAX);
    try{localStorage.setItem(KEY,JSON.stringify(cleaned));}catch(_){}
    return cleaned;
  }
  function add(id,route){
    if(typeof id!=='string'||typeof route!=='string')return read();
    var next=read().filter(function(item){return item.id!==id&&item.route!==route;});
    next.unshift({id:id,route:route,openedAt:Date.now()});
    var saved=write(next);
    doc.dispatchEvent(new CustomEvent('mbm:recent-changed',{detail:{items:saved}}));
    return saved;
  }
  function clear(){
    try{localStorage.removeItem(KEY);}catch(_){}
    doc.dispatchEvent(new CustomEvent('mbm:recent-changed',{detail:{items:[]}}));
  }
  function escapeText(value){return value==null?'':String(value);}
  function loadIndex(){
    if(window.MBMSearch&&typeof window.MBMSearch.loadIndex==='function')return window.MBMSearch.loadIndex();
    return fetch('/data/mbm-search-index.json',{credentials:'same-origin',cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('index '+r.status);return r.json();});
  }
  function renderOne(root,index){
    var list=root.querySelector('[data-mbm-recent-items]')||root;
    var empty=root.querySelector('[data-mbm-recent-empty]');
    var map=new Map((index.entries||[]).map(function(entry){return [entry.id,entry];}));
    var rows=read().map(function(item){
      var entry=map.get(item.id);
      if(!entry||entry.route!==item.route)return null;
      return entry;
    }).filter(Boolean);
    list.textContent='';
    rows.slice(0,6).forEach(function(entry){
      var a=doc.createElement('a');
      a.className='mbm-recent-card';
      a.href=entry.route;
      a.setAttribute('data-mbm-track-recent',entry.id);
      a.setAttribute('data-mbm-recent-route',entry.route);
      var kind=doc.createElement('span');kind.className='mbm-recent-kind';kind.textContent=escapeText(entry.contentType||entry.category);
      var title=doc.createElement('strong');title.textContent=escapeText(entry.title);
      var action=doc.createElement('span');action.className='mbm-recent-action';action.textContent=escapeText(entry.action||('Open '+entry.title));
      a.append(kind,title,action);list.appendChild(a);
    });
    if(empty)empty.hidden=rows.length>0;
    root.hidden=false;
  }
  function renderAll(){
    var roots=Array.prototype.slice.call(doc.querySelectorAll('[data-mbm-recent]'));
    if(!roots.length)return;
    loadIndex().then(function(index){roots.forEach(function(root){renderOne(root,index);});}).catch(function(){roots.forEach(function(root){root.hidden=true;});});
  }

  doc.addEventListener('click',function(event){
    var target=event.target&&event.target.closest?event.target.closest('[data-mbm-track-recent]'):null;
    if(target){
      var id=target.getAttribute('data-mbm-track-recent');
      var route=target.getAttribute('data-mbm-recent-route')||target.getAttribute('href');
      if(id&&route)add(id,route);
    }
    var clearButton=event.target&&event.target.closest?event.target.closest('[data-mbm-recent-clear]'):null;
    if(clearButton){clear();renderAll();}
  });
  doc.addEventListener('mbm:recent-changed',renderAll);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',renderAll,{once:true});else renderAll();

  window.MBMRecent={key:KEY,read:read,add:add,clear:clear,render:renderAll};
})();
