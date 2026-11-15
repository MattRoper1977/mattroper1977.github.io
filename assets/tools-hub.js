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
var TOOLS_SYNS={timer:['clock','countdown','stopwatch','toolkit'],picker:['random','wheel','names','toolkit'],seating:['desk','room','plan'],register:['outcomes','portfolio','evidence','tracking'],phonics:['reading','sound'],rubric:['feedback','mark'],whiteboard:['draw','board'],evidence:['portfolio','binder','moderator']};
function toolsFuzzy(hw,w){if(w.length<5||!/^[a-z]+$/.test(w))return false;var maxD=w.length>=8?2:1;return hw.some(function(c){if(c.length<4||c[0]!==w[0]||(maxD===2&&c.slice(0,2)!==w.slice(0,2))||Math.abs(c.length-w.length)>maxD)return false;var p=[];for(var k=0;k<=w.length;k++)p[k]=k;for(var i=1;i<=c.length;i++){var cur=[i],m=i;for(var j=1;j<=w.length;j++){var cost=c[i-1]===w[j-1]?0:1;cur[j]=Math.min(cur[j-1]+1,p[j]+1,p[j-1]+cost);if(cur[j]<m)m=cur[j];}if(m>maxD)return false;p=cur;}return p[w.length]<=maxD})}
function apply(push){
  var q=norm(input.value),words=q?q.split(' '):[],shown=0;
  items.forEach(function(li){var hay=li.getAttribute('data-s')||'';var hw=hay.split(/[^a-z0-9]+/).filter(Boolean);var ok=(!CAT||li.getAttribute('data-cat')===CAT)&&words.every(function(w){if(hay.indexOf(w)>=0)return true;var sy=TOOLS_SYNS[w]||[];if(sy.some(function(s){return hay.indexOf(s)>=0}))return true;return toolsFuzzy(hw,w)});hide(li,!ok);if(ok&&li.querySelector('.th-card'))shown++});
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
