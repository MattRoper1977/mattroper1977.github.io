import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
const migrations = new URL("../../../supabase/migrations/", import.meta.url);
const migrationName = (await readdir(migrations)).find(p => /_mbm_usage\.sql$/.test(p));
const migration = await readFile(new URL(migrationName,migrations),"utf8");
const hash = text => createHash("sha256").update(text).digest("hex");
const lesson=hash("education\n/Lessons/real.html"), pack=hash("education\n/pack.pdf"), game=hash("play\n/game.html");
const owner="11111111-1111-4111-8111-111111111111", ordinary="22222222-2222-4222-8222-222222222222";
let db;
async function query(sql,args=[]) { return (await db.query(sql,args)).rows; }
async function as(role,sql,args=[]) {
  await db.exec("set role "+role);
  try { return await query(sql,args); } finally { await db.exec("reset role"); }
}
const call = (src,id,event,nonce=randomUUID()) => as("service_role",
  "select public.mbm_usage_record_event($1,$2,$3,$4::uuid) as data",[src,id,event,nonce]);
const summary = (src="education",ids=[]) => as("anon",
  "select public.mbm_usage_public_summary($1,$2::text[]) as data",[src,ids]).then(r=>r[0].data);
const rejectsCode = (fn,code) => assert.rejects(fn,e=>e.code===code);
test.before(async()=>{
  db=new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as
      $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  await db.exec(migration);
  await query("insert into auth.users(id) values($1),($2)",[owner,ordinary]);
  await query("insert into usage_private.owners(user_id) values($1)",[owner]);
  await query(`insert into usage_private.resources(source,resource_id,kind,title,route,event_types) values
    ('education',$1,'lesson','Actual lesson','/Lessons/real.html',array['lesson_open']),
    ('education',$2,'pack','Actual pack','/pack.pdf',array['download_request']),
    ('play',$3,'game','Actual game','/game.html',array['game_launch'])`,[lesson,pack,game]);
});
test.after(()=>db.close());
test("empty means no measurement history and no invented top ten",async()=>{
  const s=await summary("education",[lesson,pack]);
  assert.equal(s.enabled,false); assert.equal(s.measured_since,null); assert.equal(s.windows.alltime.from,null);
  assert.deepEqual(s.windows.alltime.top,{lessons:[],packs:[],games:[]});
  assert.equal(s.resources[0].alltime,0);
  await rejectsCode(()=>call("education",lesson,"lesson_open"),"P0001");
  assert.equal((await summary()).measured_since,null);
  await db.exec("update usage_private.sources set enabled=true");
});
test("all private tables have RLS; public and ordinary users cannot read or mutate them",async()=>{
  const tables=await query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='usage_private' and c.relkind='r'");
  assert.equal(tables.length,7);assert(tables.every(t=>t.relrowsecurity));
  for(const role of ["anon","authenticated","service_role"]){
    await rejectsCode(()=>as(role,"select * from usage_private.totals"),"42501");
    await rejectsCode(()=>as(role,"insert into usage_private.owners(user_id) values($1)",[ordinary]),"42501");
  }
  for(const role of ["anon","authenticated"])
    await rejectsCode(()=>as(role,"select public.mbm_usage_record_event($1,$2,$3,$4::uuid)",["education",lesson,"lesson_open",randomUUID()]),"42501");
});
test("first committed event sets start, retry remains once, conflicting nonce rolls back",async()=>{
  const n=randomUUID(); assert.equal((await call("education",lesson,"lesson_open",n))[0].data.counted,true);
  const first=await summary("education",[lesson]); assert(first.measured_since);assert.equal(first.resources[0].alltime,1);
  assert.equal((await call("education",lesson,"lesson_open",n))[0].data.counted,false);
  await rejectsCode(()=>call("education",pack,"download_request",n),"23505");
  const after=await summary("education",[lesson]); assert.equal(after.resources[0].alltime,1);assert.equal(after.measured_since,first.measured_since);
});
test("source/event/resource whitelists reject fabricated telemetry",async()=>{
  await rejectsCode(()=>call("education",game,"game_launch"),"22023");
  await rejectsCode(()=>call("play",lesson,"lesson_open"),"22023");
  await rejectsCode(()=>call("education",hash("unknown"),"lesson_open"),"22023");
  await rejectsCode(()=>call("education",lesson,"download_request"),"22023");
  await rejectsCode(()=>call("education",lesson,"lesson_open",owner.replace("-4111-","-1111-")),"22023");
  await rejectsCode(()=>summary("education",[hash("unknown")]),"22023");
});
test("independent source totals and public summaries expose only aggregates",async()=>{
  await call("play",game,"game_launch");await call("education",pack,"download_request");
  const s=await summary(),p=await summary("play");
  assert.equal(s.windows.alltime.totals.lesson_open,1);assert.equal(s.windows.alltime.totals.game_launch,0);
  assert.equal(p.windows.alltime.totals.game_launch,1);
  assert.equal(s.windows.alltime.top.packs[0].resource_id,pack);
  assert(!JSON.stringify(s).includes("nonce"));assert(!("geography" in s));
});
test("owner-only authorization denies anonymous, ordinary, disabled and anonymous-auth identities",async()=>{
  await rejectsCode(()=>as("anon","select public.mbm_usage_owner_summary('education')"),"42501");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ordinary]);
  await rejectsCode(()=>as("authenticated","select public.mbm_usage_owner_summary('education')"),"42501");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
  let r=await as("authenticated","select public.mbm_usage_owner_summary('education') as data");
  assert.deepEqual(r[0].data.geography,{enabled:false,status:"not_collected",rows:[]});
  await db.exec("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");
  await rejectsCode(()=>as("authenticated","select public.mbm_usage_owner_summary('education')"),"42501");
  await db.exec("select set_config('request.jwt.claims','{}',false);update usage_private.owners set enabled=false");
  await rejectsCode(()=>as("authenticated","select public.mbm_usage_owner_summary('education')"),"42501");
  await db.exec("update usage_private.owners set enabled=true");
});
test("per-source and resource caps are atomic and failed events do not poison replay state",async()=>{
  await db.exec("delete from usage_private.budgets;update usage_private.sources set max_resource_events_per_minute=1 where source='education'");
  await call("education",lesson,"lesson_open");const nonce=randomUUID();
  const before=(await summary()).windows.alltime.totals.lesson_open;
  await rejectsCode(()=>call("education",lesson,"lesson_open",nonce),"54000");
  assert.equal((await summary()).windows.alltime.totals.lesson_open,before);
  assert.equal((await query("select count(*)::int n from usage_private.event_nonces where nonce=$1",[nonce]))[0].n,0);
  await db.exec("delete from usage_private.budgets;update usage_private.sources set max_resource_events_per_minute=120,max_events_per_minute=1 where source='education'");
  await call("education",lesson,"lesson_open");
  await rejectsCode(()=>call("education",pack,"download_request"),"54000");
  await db.exec("delete from usage_private.budgets;update usage_private.sources set max_events_per_minute=600 where source='education'");
});
test("parallel submitted writes lose no increments; PGlite is a single-connection runtime",async()=>{
  const before=(await summary()).windows.alltime.totals.lesson_open;
  // SET ROLE is established once; PGlite serializes these concurrent API promises.
  await db.exec("set role service_role");
  try{await Promise.all(Array.from({length:20},()=>query("select public.mbm_usage_record_event($1,$2,$3,$4::uuid)",["education",lesson,"lesson_open",randomUUID()])));}
  finally{await db.exec("reset role");}
  assert.equal((await summary()).windows.alltime.totals.lesson_open,before+20);
});
test("UTC 30-day boundaries are separate from preserved all-time counts",async()=>{
  await query(`insert into usage_private.daily(source,resource_id,event_type,day,event_count) values
    ('education',$1,'lesson_open',(current_timestamp at time zone 'UTC')::date-29,7),
    ('education',$1,'lesson_open',(current_timestamp at time zone 'UTC')::date-30,13),
    ('education',$1,'lesson_open',(current_timestamp at time zone 'UTC')::date-90,17)`,[lesson]);
  await query("update usage_private.totals set event_count=event_count+37 where source='education' and resource_id=$1",[lesson]);
  const s=await summary("education",[lesson]);assert.equal(s.resources[0].alltime-s.resources[0].last30days,30);
  const all=s.resources[0].alltime;await call("education",lesson,"lesson_open");
  assert.equal((await summary("education",[lesson])).resources[0].alltime,all+1);
  assert.equal((await query("select count(*)::int n from usage_private.daily where day<(current_timestamp at time zone 'UTC')::date-30"))[0].n,0);
});
test("short-lived event retry state expires without claiming visitor deduplication",async()=>{
  const n=randomUUID();await call("education",pack,"download_request",n);
  await query("update usage_private.event_nonces set expires_at=current_timestamp-interval '1 second' where nonce=$1",[n]);
  assert.equal((await call("education",pack,"download_request",n))[0].data.counted,true);
});
test("top ten is deterministic and excludes zero rows",async()=>{
  for(let i=0;i<12;i++){
    const id=hash("rank-"+i);
    await query("insert into usage_private.resources(source,resource_id,kind,title,route,event_types) values('education',$1,'pack',$2,$3,array['download_request'])",[id,"Pack "+i,"/rank-"+i+".pdf"]);
    await call("education",id,"download_request");
  }
  const top=(await summary()).windows.alltime.top.packs;assert.equal(top.length,10);
  const ones=top.filter(r=>r.count===1).map(r=>r.resource_id);assert.deepEqual(ones,[...ones].sort());
});
test("registry metadata changes preserve stable-ID history and no raw visitor columns exist",async()=>{
  const before=(await summary("education",[lesson])).resources[0].alltime;
  await query("update usage_private.resources set route='/Lessons/renamed.html',title='Renamed lesson' where resource_id=$1",[lesson]);
  const s=await summary("education",[lesson]);assert.equal(s.resources[0].alltime,before);assert.equal(s.windows.alltime.top.lessons[0].route,"/Lessons/renamed.html");
  const cols=await query("select column_name from information_schema.columns where table_schema='usage_private'");
  assert(!cols.some(r=>/ip_address|user_agent|country|timezone|visitor|email|search|payload|session/.test(r.column_name)));
});
test("individual worksheet downloads are counted but never labelled as Top 10 packs",async()=>{
  const id=hash("worksheet");
  await query("insert into usage_private.resources(source,resource_id,kind,title,route,event_types) values('education',$1,'resource','Worksheet','/worksheet.pdf',array['download_request'])",[id]);
  await call("education",id,"download_request");
  const s=await summary("education",[id]);assert.equal(s.resources[0].alltime,1);
  assert(!s.windows.alltime.top.packs.some(row=>row.resource_id===id));
});
test("scheduled cleanup removes expired retry state during idle traffic without changing totals",async()=>{
  const before=(await summary()).windows.alltime.totals;
  await db.exec("update usage_private.event_nonces set expires_at=current_timestamp-interval '1 minute';select usage_private.purge_expired()");
  assert.equal((await query("select count(*)::int n from usage_private.event_nonces"))[0].n,0);
  assert.deepEqual((await summary()).windows.alltime.totals,before);
  await rejectsCode(()=>as("authenticated","select usage_private.purge_expired()"),"42501");
});
