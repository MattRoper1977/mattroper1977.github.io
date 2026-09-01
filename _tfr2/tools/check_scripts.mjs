// P6 gate: every <script> block passes node --check. Usage: node check_scripts.mjs <html>
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
const html=fs.readFileSync(process.argv[2],'utf8');
const re=/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;let m,i=0,fail=0;const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tfr2-'));
while((m=re.exec(html))){i++;const attrs=m[1]||'';if(/type\s*=\s*"(?!text\/javascript|module)/.test(attrs))continue;const id=(attrs.match(/id="([^"]+)"/)||[])[1]||('block'+i);const f=path.join(tmp,id+'.js');fs.writeFileSync(f,m[2]);try{execFileSync('node',['--check',f],{stdio:'pipe'});console.log(`ok   ${id} (${m[2].length} chars)`);}catch(e){fail++;console.log(`FAIL ${id}: ${String(e.stderr).split('\n').slice(0,3).join(' | ')}`);}}
console.log(`${i} script blocks, ${fail} failures`);process.exit(fail?1:0);
