import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migrationDir = new URL('../../../supabase/migrations/', import.meta.url);
const migration = await readFile(new URL((await readdir(migrationDir)).find(n => n.endsWith('_mbm_account_admin.sql')), migrationDir), 'utf8');
const admin='11111111-1111-4111-8111-111111111111', member='22222222-2222-4222-8222-222222222222';
const adminSession='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', memberSession='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let db;
const query=async (sql, args=[]) => (await db.query(sql,args)).rows;
async function as(role, uid, session, sql, args=[]) {
  await query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,session_id:session,user_metadata:{role:'admin'}})]);
  await db.exec('set role '+role);
  try {return await query(sql,args);} finally {await db.exec('reset role');}
}
const list=(role='authenticated',uid=admin,session=adminSession,page=1,size=25,search='') => as(role,uid,session,
  'select public.mbm_account_admin_members($1,$2,$3) as data',[page,size,search]).then(r=>r[0].data);
test.before(async()=>{
  db=new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,
      deleted_at timestamptz,banned_until timestamptz,created_at timestamptz default now(),last_sign_in_at timestamptz,raw_user_meta_data jsonb default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create table public.profiles(id uuid primary key,display_name text,name text);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated;`);
  await db.exec(migration);
  await query("insert into auth.users(id,email,email_confirmed_at,last_sign_in_at) values($1,'admin@example.test',now(),now()),($2,'member@example.test',null,null)",[admin,member]);
  await query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[adminSession,admin,memberSession,member]);
  await query('insert into account_private.admins(user_id) values($1)',[admin]);
});
test.after(()=>db.close());
test('anonymous, ordinary member and forged display metadata cannot list accounts',async()=>{
  for (const params of [['anon',null,null],['authenticated',null,null],['authenticated',member,memberSession]])
    await assert.rejects(()=>list(...params), e=>e.code==='42501');
});
test('admin list returns the deliberately limited fields, counts, pagination and literal search',async()=>{
  const data=await list(); assert.equal(data.summary.registered,2);assert.equal(data.summary.verified,1);assert.equal(data.summary.signed_in_last_7_days,1);
  assert.equal(data.members.length,2);assert.deepEqual(Object.keys(data.members[0]).sort(),['created_at','display_name','email','email_verified','id','last_sign_in_at','recorded_sessions']);
  const one=await list('authenticated',admin,adminSession,1,1);const two=await list('authenticated',admin,adminSession,2,1);
  assert.notEqual(one.members[0].id,two.members[0].id);assert.equal(one.total,2);
  assert.equal((await list('authenticated',admin,adminSession,1,25,'MEMBER@')).members[0].id,member);
  assert.equal((await list('authenticated',admin,adminSession,1,25,'%')).total,0);
});
test('missing, expired, wrong-user and deleted sessions deny even an admin',async()=>{
  await assert.rejects(()=>list('authenticated',admin,null),e=>e.code==='42501');
  await assert.rejects(()=>list('authenticated',admin,memberSession),e=>e.code==='42501');
  await query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[adminSession]);
  await assert.rejects(()=>list(),e=>e.code==='42501');
  await query('delete from auth.sessions where id=$1',[adminSession]);
  await assert.rejects(()=>list(),e=>e.code==='42501');
  await query('insert into auth.sessions(id,user_id) values($1,$2)',[adminSession,admin]);
});
test('revocation, unverified email and disabled identity immediately deny admin reads',async()=>{
  await db.exec('update account_private.admins set enabled=false');await assert.rejects(()=>list(),e=>e.code==='42501');
  await db.exec('update account_private.admins set enabled=true');
  await query('update auth.users set email_confirmed_at=null where id=$1',[admin]);await assert.rejects(()=>list(),e=>e.code==='42501');
  await query("update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 day' where id=$1",[admin]);await assert.rejects(()=>list(),e=>e.code==='42501');
  await query('update auth.users set banned_until=null where id=$1',[admin]);
});
test('no client role can self-promote or directly read the private tables',async()=>{
  for(const role of ['anon','authenticated'])for(const sql of ['select * from account_private.admins',`insert into account_private.admins(user_id) values('${member}')`,'select email from auth.users'])
    await assert.rejects(()=>as(role,member,memberSession,sql),e=>e.code==='42501');
  const rows=await query("select relrowsecurity from pg_class where oid='account_private.admins'::regclass");assert.equal(rows[0].relrowsecurity,true);
});
test('page size, offset and query length have server limits',async()=>{
  for(const [page,size,search] of [[0,25,''],[10001,25,''],[1,51,''],[1,25,'x'.repeat(121)]])
    await assert.rejects(()=>list('authenticated',admin,adminSession,page,size,search),e=>e.code==='22023');
});
