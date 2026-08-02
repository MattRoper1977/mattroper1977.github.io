/* Proves the sync PANEL fails closed. Four backend states, and the UI may
 * only appear in the fourth:
 *   1. no keys configured (what ships today)
 *   2. keys present, backend unreachable
 *   3. backend accepts writes but returns nothing on read — a LIAR, and the
 *      state a config-driven gate would happily call 'working'
 *   4. a backend that genuinely round-trips
 *
 * State 3 is the one worth the whole file. A sync that accepts your work and
 * quietly loses it is worse than no sync, because people stop keeping their
 * own copies. site.json is intercepted in flight; the file on disk is never
 * touched.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const base=process.argv[2]; const b=await chromium.launch();
const fails=[]; const ck=(n,ok,got)=>{if(!ok)fails.push(n);console.log('  '+(ok?'PASS  ':'FAIL  ')+n+(ok?'':'   got: '+JSON.stringify(got)));};

async function run(label, cfgMut, routeSupabase) {
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  const hits=[];
  await ctx.route('**/*', async r=>{
    const u=r.request().url();
    if (/supabase|sync_blobs/.test(u)) { hits.push(r.request().method()+' '+u.split('?')[0]);
      return routeSupabase ? routeSupabase(r) : r.abort(); }
    if (u.startsWith(base)) {
      if (/site\.json/.test(u) && cfgMut) {
        const res=await r.fetch(); const j=JSON.parse(await res.text()); cfgMut(j);
        return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(j)});
      }
      return r.continue();
    }
    return r.abort();
  });
  const p=await ctx.newPage(); const errs=[];
  p.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  await p.goto(base+'/members/',{waitUntil:'networkidle'});
  await p.waitForTimeout(1600);
  const s=await p.evaluate(()=>{
    const h=document.getElementById('mbmSync');
    return { text:(h.textContent||'').replace(/\s+/g,' ').trim(),
             hasPanel:!!h.querySelector('.sy-on'),
             hasOff:!!h.querySelector('.sy-off'),
             buttons:[...h.querySelectorAll('button')].map(x=>x.textContent.trim()),
             cap: !!(window.MBM_CAPS && window.MBM_CAPS['cloud-sync']) };
  });
  await ctx.close();
  console.log('\n'+label);
  console.log('   says: "'+s.text.slice(0,140)+'…"');
  console.log('   panel='+s.hasPanel+'  cap='+s.cap+'  buttons='+JSON.stringify(s.buttons)+'  supabase calls='+hits.length);
  return {...s, hits, errs};
}

// 1. no keys configured (what ships today)
const a = await run('STATE 1 — no backend configured (as shipped)', null, null);
ck('no sync UI offered', a.hasPanel===false);
ck('says so plainly rather than vanishing', a.hasOff===true && /not switched on/i.test(a.text));
ck('capability NOT set', a.cap===false);
ck('made 0 calls to any backend', a.hits.length===0, a.hits);

// 2. keys present but the backend is down
const down = j=>{ j.features.sync={url:'https://example.supabase.co',anonKey:'k'}; };
const c = await run('STATE 2 — keys present, backend unreachable', down, r=>r.abort());
ck('still NO sync UI', c.hasPanel===false);
ck('capability NOT set on a dead backend', c.cap===false);
ck('explains why instead of failing silently', /did not answer|could not check/i.test(c.text), c.text);

// 3. keys present, backend answers but LIES (accepts writes, returns nothing)
const liar = r => r.request().method()==='POST'
  ? r.fulfill({status:201,body:''})
  : r.fulfill({status:200,contentType:'application/json',body:'[]'});
const e = await run('STATE 3 — backend accepts writes but returns nothing', down, liar);
ck('a lying backend does NOT unlock the UI', e.hasPanel===false, e.text);
ck('capability NOT set', e.cap===false);

// 4. a backend that genuinely round-trips
let store={};
const good = async r => {
  const req=r.request();
  if (req.method()==='POST'){ const body=JSON.parse(req.postData()); store[body.id]={blob:body.blob};
    return r.fulfill({status:201,body:''}); }
  if (req.method()==='DELETE'){ const id=(req.url().match(/id=eq\.([0-9a-f]+)/)||[])[1]; delete store[id];
    return r.fulfill({status:204,body:''}); }
  const id=(req.url().match(/id=eq\.([0-9a-f]+)/)||[])[1];
  return r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify(store[id]?[{blob:store[id].blob,updated_at:'2026-08-02T00:00:00Z'}]:[])});
};
const g = await run('STATE 4 — backend that genuinely round-trips', down, good);
ck('UI appears ONLY here', g.hasPanel===true, g.text);
ck('capability set', g.cap===true);
ck('offers both directions', g.buttons.length===2 && /sync code/i.test(g.buttons[0]) && /already have/i.test(g.buttons[1]), g.buttons);
ck('warns the code cannot be reset', /no reset|cannot be recovered|only key/i.test(g.text), g.text);
ck('probe row cleaned up', Object.keys(store).length===0, Object.keys(store));

const allErrs=[a,c,e,g].flatMap(x=>x.errs);
ck('0 page errors across all four states', allErrs.length===0, allErrs);
await b.close();
console.log('\n'+(fails.length===0?'RESULT: PASS':'RESULT: FAIL — '+fails.length));
process.exit(fails.length?1:0);
