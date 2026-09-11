'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),fixture=path.join(root,'audit-output/as1/baseline-suite');
fs.mkdirSync(path.join(fixture,'rallyvector3d'),{recursive:true});fs.mkdirSync(path.join(fixture,'tools/driving-games'),{recursive:true});
fs.writeFileSync(path.join(fixture,'rallyvector3d/index.html'),execFileSync('git',['show','85e3e02059c3e3314eddab03d6e3c842f0da7ec7:rallyvector3d/index.html'],{cwd:root}));
fs.copyFileSync(path.join(root,'tools/driving-games/verify_new_stages.mjs'),path.join(fixture,'tools/driving-games/verify_new_stages.mjs'));
const run=spawnSync(process.execPath,[path.join(fixture,'tools/driving-games/verify_new_stages.mjs')],{cwd:fixture,encoding:'utf8'});
process.stdout.write(run.stdout||'');process.stderr.write(run.stderr||'');console.log('AS1_BASELINE_STAGE_EXIT '+run.status);process.exitCode=run.status||0;
