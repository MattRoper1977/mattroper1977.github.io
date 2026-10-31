/* Tools hub search: filters the drawer items already on the page (.tcard: the tool
   cards and the lesson collections) by search words and by the category chips.
   No fetch, no storage; the query lives in the URL (?q=) so a filtered view can be
   shared. The status counts tools only (the registry count), always shown. */
(function(){
'use strict';
var form=document.querySelector('[data-tools-search]');if(!form)return;
var input=document.getElementById('tq'),status=document.getElementById('tcount'),empty=document.getElementById('th-empty'),clear=document.getElementById('th-clear');
var drawer=document.getElementById('drawer');
var items=Array.prototype.slice.call(drawer.querySelectorAll('.tcard'));
var groups=Array.prototype.slice.call(drawer.querySelectorAll('[data-group]'));
var shelves=Array.prototype.slice.call(drawer.querySelectorAll('[data-shelf-section]'));
var collections=drawer.querySelector('.th-collections');
var chips=Array.prototype.slice.call(drawer.querySelectorAll('.tchip'));
var total=drawer.querySelectorAll('.th-card').length,CAT='';
function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim()}
function hide(el,h){el.hidden=h;el.classList.toggle('hidden',h)}
function visible(el){return !el.hidden}
function apply(push){
  var q=norm(input.value),words=q?q.split(' '):[],shown=0;
  items.forEach(function(li){var hay=li.getAttribute('data-s')||'';var ok=(!CAT||li.getAttribute('data-cat')===CAT)&&words.every(function(w){return hay.indexOf(w)>=0});hide(li,!ok);if(ok&&li.querySelector('.th-card'))shown++});
  groups.forEach(function(g){var n=Array.prototype.filter.call(g.querySelectorAll('.tcard'),visible).length;hide(g,n===0);var c=g.querySelector('[data-group-count]');if(c)c.textContent=String(n)});
  if(collections)hide(collections,!Array.prototype.some.call(collections.querySelectorAll('.tcard'),visible));
  shelves.forEach(function(s){hide(s,!!(q||CAT)&&!Array.prototype.some.call(s.querySelectorAll('.tcard'),visible))});
  hide(empty,!((q||CAT)&&shown===0));
  status.textContent='Showing '+shown+' of '+total+' tools';
  if(push&&window.history&&history.replaceState){var u=new URL(location.href);if(q)u.searchParams.set('q',input.value.trim());else u.searchParams.delete('q');history.replaceState(null,'',u.pathname+u.search+u.hash)}
}
function choose(cat){CAT=cat;chips.forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-cat')===cat?'true':'false')})}
chips.forEach(function(b){b.addEventListener('click',function(){choose(b.getAttribute('data-cat')||'');apply(true)})});
try{var p=new URL(location.href).searchParams.get('q');if(p)input.value=p}catch(e){}
input.addEventListener('input',function(){apply(true)});
form.addEventListener('submit',function(e){e.preventDefault();apply(true);input.focus()});
if(clear)clear.addEventListener('click',function(){input.value='';choose('');apply(true);input.focus()});
apply(false);
})();
