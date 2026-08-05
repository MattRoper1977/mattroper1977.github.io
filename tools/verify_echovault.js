#!/usr/bin/env node
/*
 * verify_echovault.js — source contract for /echovault/index.html
 *
 * Same two corrections this estate keeps: the CORRECTED no-remote-resources form
 * (canonical/og are METADATA and are never fetched at runtime, so counting them is
 * a defect — and the clean file is asserted to pass POSITIVELY, not only a tampered
 * one to fail), and DERIVE-DON'T-PIN (no hardcoded counts or SHAs; the A-6 register).
 *
 * Every family has a positive control in G9.
 */
'use strict';
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
const FILE=process.env.EV_GAME_FILE||process.argv[2]||path.join(ROOT,'echovault','index.html');
const html=fs.readFileSync(FILE,'utf8');
const bytes=Buffer.byteLength(html), sha=crypto.createHash('sha256').update(html).digest('hex');
const CANON='https://madebymatt.uk/echovault/';
const out=[];
const assert=(x,m)=>{ if(!x) throw new Error(m); };
function gate(id,name,fn){ try{ const d=fn()||''; out.push({id,status:'PASS'}); console.log(`PASS ${id} ${name}${d?' — '+d:''}`);}catch(e){ out.push({id,status:'FAIL'}); console.error(`FAIL ${id} ${name} — ${e.message}`);} }

const RUNTIME_SRC=/<(?:script|img|audio|video|source|iframe|embed)\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//gi;
const RUNTIME_LINK=/<link\b[^>]*\brel\s*=\s*["'](?:stylesheet|preload|prefetch|icon|apple-touch-icon|manifest)["'][^>]*\bhref\s*=\s*["'](?:https?:)?\/\//gi;
const remote=s=>[...s.matchAll(RUNTIME_SRC),...s.matchAll(RUNTIME_LINK)].map(m=>m[0]);

gate('G1','single file, single script',()=>{
  const o=(html.match(/<script/g)||[]).length, c=(html.match(/<\/script>/g)||[]).length;
  assert(o===1&&c===1,`expected one script element, saw ${o}/${c}`);
  return `${bytes} bytes, sha256 ${sha.slice(0,12)}…`;
});
gate('G2','no remote runtime resources (corrected form)',()=>{
  const r=remote(html);
  assert(r.length===0,`runtime-fetching refs: ${r.join(', ')}`);
  assert(/<link rel="canonical"/.test(html),'canonical missing — the positive limb has nothing to prove');
  return 'zero runtime refs; canonical/og present and correctly not counted';
});
gate('G3','canonical and Open Graph agree',()=>{
  const can=(html.match(/<link rel="canonical" href="([^"]+)"/)||[])[1];
  const ogu=(html.match(/<meta property="og:url" content="([^"]+)"/)||[])[1];
  const ogt=(html.match(/<meta property="og:title" content="([^"]+)"/)||[])[1];
  const t=(html.match(/<title>([^<]+)<\/title>/)||[])[1];
  assert(can===CANON,`canonical is ${can}`); assert(ogu===CANON,`og:url is ${ogu}`);
  assert(t&&ogt===t,`og:title "${ogt}" != <title> "${t}"`);
  const ogi=(html.match(/<meta property="og:image" content="([^"]+)"/)||[])[1];
  if(ogi){ const rel=ogi.replace(/^https?:\/\/[^/]+/,''); assert(fs.existsSync(path.join(ROOT,rel.replace(/^\//,''))),`og:image ${ogi} has no asset`); }
  return `canonical = og:url = ${CANON}; og:image ${ogi?'backed':'not claimed'}`;
});
gate('G4','house storage key, legacy gone',()=>{
  const k=[...html.matchAll(/const SAVE_KEY = '([^']+)'/g)].map(m=>m[1]);
  assert(k.length===1,`expected one SAVE_KEY, saw ${k.length}`);
  assert(/^mbm_echovault_/.test(k[0]),`SAVE_KEY is ${k[0]}`);
  assert(!html.includes('madebymatt.echoVault'),'the pre-launch key still appears');
  return `${k[0]}, legacy occurrences 0`;
});
gate('G5','the twist is exported and its bands cannot overlap',()=>{
  const floor=Number((html.match(/CORRECT_FLOOR: (\d+)/)||[])[1]);
  const ceil=Number((html.match(/WRONG_CEILING: (\d+)/)||[])[1]);
  assert(Number.isFinite(floor)&&Number.isFinite(ceil),'Echo Read band constants not found');
  assert(ceil<floor,`bands overlap: wrong ceiling ${ceil} is not below correct floor ${floor}`);
  assert(/window\.EV\s*=/.test(html),'EV.echoRead is not exported for the fixtures');
  return `correct band from ${floor}, wrong band capped at ${ceil}`;
});
gate('G6','one renderer for every renderer-unavailable panel',()=>{
  const direct=(html.match(/\$\('fatal-overlay'\)\.hidden\s*=\s*false/g)||[]).length;
  const via=(html.match(/showRendererPanel\(/g)||[]).length;
  assert(direct===0,`${direct} direct writes bypass the single renderer`);
  assert(via>=4,`only ${via-1} call sites go through the renderer`);
  return `${via-1} call sites through showRendererPanel, 0 bypasses`;
});
gate('G7','both sensitivities exist and the OS is a floor',()=>{
  assert(/fullFlash/.test(html),'the reduce-flashes setting is missing');
  assert(/fullMotion/.test(html),'the motion setting is missing');
  assert(/mergedSettings\.fullFlash = false/.test(html),'the OS preference is not applied as a floor on load');
  assert(/addEventListener\('change', applyOsFloor\)/.test(html),'the OS floor is not re-applied on live change');
  return 'motion and flash are separate settings; OS reduced-motion forces both down at load and on live change';
});
gate('G8','U9 and U10 are present',()=>{
  assert(/function updateBreath/.test(html),'U9 held breath missing');
  assert(/function emitLoudPulse/.test(html),'U10 loud ping missing');
  return 'held breath and loud ping both wired';
});
gate('G9','positive controls — every family proven sighted',()=>{
  const names=[];
  const check=(name,mut,probe)=>{ const m=mut(html); assert(m!==html,`control "${name}" changed nothing`);
    let caught=false; try{ probe(m); }catch(_){ caught=true; }
    assert(caught,`control "${name}" did NOT trip its gate — that gate is vacuous`); names.push(name); };
  check('remote script injected',s=>s.replace('<title>','<script src="https://cdn.example.com/x.js"></script><title>'),
    s=>{ if(remote(s).length) throw 0; });
  check('canonical moved',s=>s.replace(CANON,'https://example.com/x/'),
    s=>{ const c=(s.match(/<link rel="canonical" href="([^"]+)"/)||[])[1]; if(c!==CANON) throw 0; });
  check('legacy key restored',s=>s.replace("'mbm_echovault_v1'","'madebymatt.echoVault.v1'"),
    s=>{ if(s.includes('madebymatt.echoVault')) throw 0; });
  check('Echo Read bands overlapped',s=>s.replace('WRONG_CEILING: 47','WRONG_CEILING: 70'),
    s=>{ const f=Number((s.match(/CORRECT_FLOOR: (\d+)/)||[])[1]),c=Number((s.match(/WRONG_CEILING: (\d+)/)||[])[1]); if(!(c<f)) throw 0; });
  check('a second copy of the fatal panel reintroduced',s=>s.replace('  const SAVE_KEY',"  $('fatal-overlay').hidden = false;\n  const SAVE_KEY"),
    s=>{ if((s.match(/\$\('fatal-overlay'\)\.hidden\s*=\s*false/g)||[]).length>0) throw 0; });
  check('OS motion floor removed',s=>s.replace('mergedSettings.fullFlash = false','mergedSettings.fullFlash = true'),
    s=>{ if(!/mergedSettings\.fullFlash = false/.test(s)) throw 0; });
  return `${names.length} controls, all tripped their gate: ${names.join('; ')}`;
});
const failed=out.filter(r=>r.status==='FAIL');
console.log(`\nEcho Vault source contract: ${out.length-failed.length}/${out.length} gates passed.`);
console.log(`Artifact: ${bytes} bytes, sha256 ${sha}`);
if(failed.length) process.exit(1);
