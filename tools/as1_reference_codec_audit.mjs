#!/usr/bin/env node
// Read-only execution of the quarantined source method. This is an audit, not a codec repair.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const file=process.argv[2];
if(!file)throw new Error('Pass the exact original ArcadeHost HTML path');
const source=fs.readFileSync(file,'utf8');
const block=source.match(/<script>\s*\/\*\*[\s\S]*?class ArcadeHost[\s\S]*?<\/script>/);
assert(block,'Original ArcadeHost script not found');
const script=block[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
const sandbox={console:{warn(){}},Blob,Response,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,btoa,atob,Date,CompressionStream:undefined,DecompressionStream:undefined};
vm.runInNewContext(script+'\nthis.AuditHost=ArcadeHost;',sandbox);
assert.equal(sandbox.CompressionStream,undefined);
const results=[];
async function run(payload){const host=Object.create(sandbox.AuditHost.prototype);host.serializeState=()=>payload;let restored;host.deserializeState=x=>{restored=x;};sandbox.alert=message=>{throw new Error('Blocking alert: '+message);};try{const code=await host.generateCartridge();const ok=await host.restoreCartridge(code);return {ok,codeLength:code.length,restored};}catch(error){return {ok:false,error:error.name+': '+error.message};}}
const ascii=await run({label:'Ready',px:4});assert(ascii.ok);assert.equal(ascii.restored.label,'Ready');results.push({case:'CompressionStream disabled, ASCII original fallback',...ascii});
const unicode=await run({label:'漢字',px:4});assert(!unicode.ok);results.push({case:'CompressionStream disabled, non-Latin1 original fallback',...unicode});
// Firing control for the round-trip instrument: a known UTF-8 byte encoder
// passes, then replacing only that encoder with the original fallback reddens.
const payload={label:'漢字',px:4};
const safe=x=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(x))));
const broken=x=>btoa(JSON.stringify(x));
const probe=encoder=>{try{return JSON.stringify(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoder(payload)),c=>c.charCodeAt(0)))))===JSON.stringify(payload);}catch{return false;}};
assert(probe(safe));assert(!probe(broken));assert(probe(safe));
results.push({case:'UTF-8 round-trip measurement control',baseline:'GREEN',originalFallbackPlant:'RED',restored:'GREEN'});
console.log(JSON.stringify({source:file,CompressionStream:'explicitly disabled',DecompressionStream:'explicitly disabled',results},null,2));
