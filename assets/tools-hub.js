/* Tools hub search: filters the cards already on the page. No fetch, no storage;
   the query lives in the URL (?q=) so a filtered view can be shared. */
(function(){
'use strict';
var form=document.querySelector('[data-tools-search]');if(!form)return;
var input=document.getElementById('tq'),status=document.getElementById('th-count'),empty=document.getElementById('th-empty'),clear=document.getElementById('th-clear');
var cards=Array.prototype.slice.call(document.querySelectorAll('.th-card'));
var groups=Array.prototype.slice.call(document.querySelectorAll('[data-group]'));
var shelves=Array.prototype.slice.call(document.querySelectorAll('[data-shelf-section]'));
var total=cards.length;
function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim()}
function apply(push){
  var q=norm(input.value),words=q?q.split(' '):[],shown=0;
  cards.forEach(function(c){var hay=c.getAttribute('data-search')||'';var ok=words.every(function(w){return hay.indexOf(w)>=0});c.parentElement.hidden=!ok;if(ok)shown++});
  groups.forEach(function(g){var any=Array.prototype.some.call(g.querySelectorAll('.th-card'),function(c){return !c.parentElement.hidden});g.hidden=!any;var n=g.querySelector('[data-group-count]');if(n)n.textContent=String(Array.prototype.filter.call(g.querySelectorAll('.th-card'),function(c){return !c.parentElement.hidden}).length)});
  shelves.forEach(function(s){s.hidden=q?!Array.prototype.some.call(s.querySelectorAll('[data-group]'),function(g){return !g.hidden}):false});
  empty.hidden=!(q&&shown===0);
  status.textContent=q?('Showing '+shown+' of '+total+' tools'):'';
  if(push&&window.history&&history.replaceState){var u=new URL(location.href);if(q)u.searchParams.set('q',input.value.trim());else u.searchParams.delete('q');history.replaceState(null,'',u.pathname+u.search+u.hash)}
}
try{var p=new URL(location.href).searchParams.get('q');if(p)input.value=p}catch(e){}
input.addEventListener('input',function(){apply(true)});
form.addEventListener('submit',function(e){e.preventDefault();apply(true);input.focus()});
if(clear)clear.addEventListener('click',function(){input.value='';apply(true);input.focus()});
apply(false);
})();
