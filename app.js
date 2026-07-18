const $=s=>document.querySelector(s),state={all:[]};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ACCENTS=['#5EEAD4','#F6AD55','#63B3ED','#B794F4','#F687B3','#68D391'];
function accentFor(s){let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return ACCENTS[h%ACCENTS.length]}
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
function normLessons(list){return list.map(r=>({
  title:r.title||'Untitled',
  description:r.desc||'',
  subject:r.subject||'General',
  type:cap(r.type||'Resource'),
  path:r.file?(/^https?:/.test(r.file)?r.file:'/Lessons/'+encodeURI(r.file)):null,
  tags:Array.isArray(r.keywords)?r.keywords:[],
  status:r.new?'New':'Published',
  age:r.age||null,duration:r.duration||null,
  accent:accentFor(r.subject||'General')}))}
function normSite(list){return list.map(r=>({
  title:r.title||'Untitled',
  description:r.description||'',
  subject:r.subject||'General',
  type:r.type||'Resource',
  path:r.path||null,
  tags:Array.isArray(r.tags)?r.tags:[],
  status:r.status||'Published',
  age:r.age||null,duration:r.duration||null,
  accent:r.accent||accentFor(r.subject||'General')}))}
function card(r){
  const link=r.path?`<a href="${esc(r.path)}">View resource →</a>`:'<span class="muted">Details coming soon</span>';
  const chips=[r.age,r.duration].filter(Boolean).map(v=>`<span class="chip">${esc(v)}</span>`).join('');
  return `<article class="card" style="--accent:${esc(r.accent)}"><div class="kind">${esc(r.type)} · ${esc(r.subject)}</div><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p>${chips?`<div class="chips">${chips}</div>`:''}<div class="foot"><span class="badge">${esc(r.status)}</span>${link}</div></article>`}
function render(){
  let q=$('#search').value.toLowerCase(),s=$('#subject').value,t=$('#type').value;
  let a=state.all.filter(r=>
    (!q||[r.title,r.description,r.subject,r.type,...(r.tags||[])].join(' ').toLowerCase().includes(q))
    &&(!s||r.subject===s)&&(!t||r.type===t));
  $('#cards').innerHTML=a.map(card).join('')||'<p>No matching resources.</p>';
  $('#count').textContent=`Showing ${a.length} of ${state.all.length} resources`}
function fillSelect(id,vals){const el=$('#'+id),keep=el.querySelector('option');el.innerHTML='';el.appendChild(keep);
  [...new Set(vals)].sort().forEach(v=>{const o=document.createElement('option');o.textContent=v;el.appendChild(o)})}
const grab=u=>fetch(u).then(r=>{if(!r.ok)throw 0;return r.json()}).catch(()=>[]);
Promise.all([grab('/Lessons/resources.json'),grab('data/resources.json')]).then(([les,site])=>{
  state.all=[...normLessons(Array.isArray(les)?les:[]),...normSite(Array.isArray(site)?site:[])];
  if(!state.all.length){$('#count').textContent="Couldn't load the catalogue — please refresh.";return}
  fillSelect('subject',state.all.map(r=>r.subject));
  fillSelect('type',state.all.map(r=>r.type));
  render()});
['search','subject','type'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',render));
$('#menu').addEventListener('click',()=>{let n=$('#nav'),o=n.classList.toggle('open');$('#menu').setAttribute('aria-expanded',o)});
