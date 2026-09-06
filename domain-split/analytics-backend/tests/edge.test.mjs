import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../../../supabase/functions/usage-shared/handler.ts";
const id="a".repeat(64),nonce="11111111-1111-4111-8111-111111111111";
const event={source:"education",resource_id:id,event_type:"lesson_open",event_nonce:nonce};
const origins={education:"https://madebymatt.uk",play:"https://madebymatt-play.uk"};
const valid={schema:1,source:"education",enabled:false,measured_since:null};
function request(mode,{body=event,origin=origins.education,method=mode==="ingest"?"POST":"GET",headers={},query="source=education"}={}){
  return new Request("https://example.supabase.co/functions/v1/usage-"+mode+"?"+query,{
    method,headers:{...(origin?{origin}:{}),...(method==="POST"?{"content-type":"application/json"}:{}),...headers},
    ...(method==="POST"?{body:typeof body==="string"?body:JSON.stringify(body)}:{})
  });
}
function fixture(mode,{env={},fetcher}={}){
  const calls=[];const fn=createHandler(mode,{env:n=>({SUPABASE_URL:"https://example.supabase.co",SUPABASE_ANON_KEY:"public-test-key",SUPABASE_SERVICE_ROLE_KEY:"private-test-key",...env})[n],
    fetch:async(url,options)=>{calls.push({url,options});return fetcher?fetcher(url,options):Response.json(mode==="ingest"?{counted:true}:valid);}
  });return {fn,calls};
}
test("collector accepts minimal registered-shape event and sends no raw request metadata upstream",async()=>{
  const f=fixture("ingest");const r=await f.fn(request("ingest",{headers:{"user-agent":"must-not-forward","referer":"https://madebymatt.uk/?pupil=private"}}));
  assert.equal(r.status,202);assert.deepEqual(await r.json(),{ok:true,counted:true});
  const wire=JSON.stringify(f.calls);assert(!wire.includes("must-not-forward"));assert(!wire.includes("pupil"));assert(!wire.includes("referer"));
  assert.equal(f.calls[0].options.headers.apikey,"private-test-key");
  assert(!JSON.stringify([...r.headers]).includes("private-test-key"));
});
test("extra fields, location, identity, invalid IDs/event types and caller timestamps fail before upstream",async()=>{
  for(const body of [{...event,country:"GB"},{...event,timestamp:1},{...event,pupil:"x"},{...event,account_id:"x"},{...event,resource_id:"title"},{...event,event_type:"game_launch"},{...event,event_nonce:"stable-visitor"}]){
    const f=fixture("ingest");assert.equal((await f.fn(request("ingest",{body}))).status,400);assert.equal(f.calls.length,0);
  }
});
test("origin and source restrictions reject off-estate writes but allow education showcase game launches",async()=>{
  for(const origin of [null,"https://evil.invalid","http://madebymatt.uk"]){
    const f=fixture("ingest");assert.equal((await f.fn(request("ingest",{origin}))).status,403);assert.equal(f.calls.length,0);
  }
  const f=fixture("ingest");assert.equal((await f.fn(request("ingest",{origin:origins.play}))).status,400);
  assert.equal((await f.fn(request("ingest",{body:{...event,source:"play",event_type:"game_launch"}}))).status,202);
});
test("streaming size/type/method guards reject oversized or malformed inputs",async()=>{
  for(const [options,status] of [[{body:" ".repeat(513)},413],[{body:"{"},400],[{body:[]},400],[{headers:{"content-type":"text/plain"}},415],[{method:"PUT"},405]]){
    const f=fixture("ingest");assert.equal((await f.fn(request("ingest",options))).status,status);assert.equal(f.calls.length,0);
  }
  const f=fixture("ingest");const r=await f.fn(request("ingest",{method:"OPTIONS"}));assert.equal(r.status,204);assert.equal(f.calls.length,0);
});
test("backend failures are unavailable, replay conflicts and caps have honest status codes",async()=>{
  for(const [remote,status,error] of [[{code:"54000"},429,"rate_limited"],[{code:"23505"},409,"event_nonce_conflict"],[{message:"usage_disabled"},503,"collection_disabled"],[{code:"22023"},400,"invalid_event"],[{message:"private database details"},503,"service_unavailable"]]){
    const f=fixture("ingest",{fetcher:()=>Response.json(remote,{status:400})});const r=await f.fn(request("ingest"));
    assert.equal(r.status,status);assert.equal((await r.json()).error,error);
  }
  const f=fixture("ingest",{env:{SUPABASE_SERVICE_ROLE_KEY:""}});assert.equal((await f.fn(request("ingest"))).status,503);assert.equal(f.calls.length,0);
  const offline=fixture("ingest",{fetcher:()=>{throw new Error("secret details")}});assert.deepEqual(await(await offline.fn(request("ingest"))).json(),{ok:false,error:"service_unavailable"});
});
test("public query validates bounds and never uses the service credential",async()=>{
  const f=fixture("public");const r=await f.fn(request("public",{query:"source=education&ids="+id}));assert.equal(r.status,200);
  assert.equal(f.calls[0].options.headers.apikey,"public-test-key");assert(!JSON.stringify(f.calls).includes("private-test-key"));
  for(const query of ["source=bad","source=education&country=GB","source=education&source=play","source=education&ids="+Array(51).fill(id).join(",")]){
    const x=fixture("public");assert.equal((await x.fn(request("public",{query}))).status,400);assert.equal(x.calls.length,0);
  }
});
test("owner requires existing Auth verification and database allowlist; no user-controlled owner ID",async()=>{
  let f=fixture("owner");assert.equal((await f.fn(request("owner"))).status,401);assert.equal(f.calls.length,0);
  f=fixture("owner",{fetcher:url=>url.endsWith("/user")?Response.json({id:"ordinary"}):Response.json({code:"42501",message:"usage_owner_required"},{status:403})});
  assert.equal((await f.fn(request("owner",{headers:{authorization:"Bearer valid-user-token"}}))).status,403);
  assert.equal(f.calls[1].options.headers.Authorization,"Bearer valid-user-token");
  assert.equal(JSON.parse(f.calls[1].options.body).p_source,"education");
  f=fixture("owner",{fetcher:()=>Response.json({id:"anonymous",is_anonymous:true})});
  assert.equal((await f.fn(request("owner",{headers:{authorization:"Bearer anonymous-token"}}))).status,401);assert.equal(f.calls.length,1);
  f=fixture("owner",{fetcher:url=>Response.json(url.endsWith("/user")?{id:"verified-owner"}:{...valid,geography:{enabled:false,status:"not_collected",rows:[]}})});
  const r=await f.fn(request("owner",{headers:{authorization:"Bearer owner-token"}}));assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");
  assert.equal((await r.json()).geography.status,"not_collected");
});
