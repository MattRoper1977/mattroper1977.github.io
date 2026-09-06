// Execute a reviewed metadata import in an isolated genuine PostgreSQL runtime.
// Never connects to Supabase and never inserts traffic or owner identities.
import {PGlite} from "@electric-sql/pglite";
import {readFile,readdir} from "node:fs/promises";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
if(process.argv.length!==3) throw new Error("Usage: node verify_registry.mjs reviewed-registry.sql");
const dir=new URL("../../supabase/migrations/",import.meta.url);
const name=(await readdir(dir)).find(n=>/_mbm_usage\.sql$/.test(n));
const migration=await readFile(new URL(name,dir),"utf8");
const sql=await readFile(process.argv[2],"utf8");
const db=new PGlite();
try{
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;");
  await db.exec(migration);await db.exec(sql);
  const kinds=(await db.query("select source,kind,count(*)::int records from usage_private.resources group by source,kind order by source,kind")).rows;
  await db.exec("set role anon");
  const states=[];
  for(const source of ["education","play"]){
    const state=(await db.query("select public.mbm_usage_public_summary($1) summary",[source])).rows[0].summary;
    assert.equal(state.enabled,false);assert.equal(state.measured_since,null);
    assert.deepEqual(state.windows.alltime.totals,{lesson_open:0,download_request:0,game_launch:0});
    assert.deepEqual(state.windows.alltime.top,{lessons:[],packs:[],games:[]});
    states.push({source,enabled:state.enabled,measured_since:state.measured_since,totals:state.windows.alltime.totals});
  }
  await db.exec("reset role");
  const traffic=(await db.query("select (select count(*) from usage_private.daily)::int daily,(select count(*) from usage_private.totals)::int totals,(select count(*) from usage_private.event_nonces)::int nonces")).rows[0];
  assert.deepEqual(traffic,{daily:0,totals:0,nonces:0});
  console.log(JSON.stringify({status:"PASS",runtime:"PGlite 0.5.8 / PostgreSQL18.3",migration:name,registry_sql_sha256:createHash("sha256").update(sql).digest("hex"),kinds,states,traffic},null,2));
}finally{await db.close();}
