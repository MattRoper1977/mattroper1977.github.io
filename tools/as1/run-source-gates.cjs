'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'audit-output/as1/static-gates');
const PIN='f6b7814836fe5cecbd91ff2a530fd8362ab8f734';
fs.mkdirSync(OUT,{recursive:true});
const gates=path.join(OUT,'gates'),fixture=path.join(OUT,'pilot');
fs.mkdirSync(gates,{recursive:true});fs.mkdirSync(fixture,{recursive:true});
for(const name of ['verify_no_boilerplate_regressions.mjs','verify_no_shipped_placeholders.mjs','as1_placeholder_html.py']){
  const bytes=execFileSync('git',['show',PIN+':tools/'+name],{cwd:ROOT});
  fs.writeFileSync(path.join(gates,name),bytes);
}
const source=fs.readFileSync(path.join(ROOT,'rallyvector3d/index.html'));
fs.writeFileSync(path.join(fixture,'pilot.html'),source);assert(source.equals(fs.readFileSync(path.join(fixture,'pilot.html'))));
execFileSync('git',['init','--quiet',fixture]);execFileSync('git',['-C',fixture,'add','pilot.html']);
const runs=[];
function run(name,args){const p=spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});const record={name,status:p.status,signal:p.signal,stdout:p.stdout,stderr:p.stderr};runs.push(record);fs.writeFileSync(path.join(OUT,name+'.txt'),p.stdout+'\n'+p.stderr);console.log('AS1_STATIC '+JSON.stringify(record));}
run('regression-controls',[path.join(gates,'verify_no_boilerplate_regressions.mjs'),'--self-test']);
run('placeholder-controls',[path.join(gates,'verify_no_shipped_placeholders.mjs'),'--self-test']);
run('pilot-regression',[path.join(gates,'verify_no_boilerplate_regressions.mjs'),'--root',fixture,'--json']);
run('pilot-placeholder',[path.join(gates,'verify_no_shipped_placeholders.mjs'),'--root',fixture]);
const words=new RegExp(['dys'+'lexia','ir'+'len','scotopic sensitivity','clinical benefit'].join('|'),'i');
const files=['rallyvector3d/index.html','assets/arcade/shell.js','assets/arcade/shell.css','assets/arcade/rally-hooks.js','assets/arcade/cartridge.js','assets/arcade/ghost.js','docs/reference/AS1_BUILD.md','docs/reference/AS1_CODEC.md','docs/reference/AS1_STORAGE.md'];
const hits=files.filter(f=>words.test(fs.readFileSync(path.join(ROOT,f),'utf8')));
assert(words.test('Warm screen '+['dys','lexia'].join('')),'Wording firing control failed');
console.log('AS1_WORDING '+JSON.stringify({files,hits,planted:'RED',restored:hits.length?'RED':'GREEN'}));
fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({gateSource:PIN,scope:'Exact current pilot bytes in a tracked scratch fixture; not an estate-wide green claim.',runs,wording:{hits,redControl:true}},null,2));
if(hits.length||runs.some(r=>r.status!==0))process.exitCode=1;
