#!/usr/bin/env node
'use strict';
// Compatibility entry point: the four-game Apex Sports transform is authoritative.
const path=require('path'),{spawnSync}=require('child_process');
const target=path.join(__dirname,'apply_apextennis_home.js');
const result=spawnSync(process.execPath,[target,...process.argv.slice(2)],{stdio:'inherit',env:process.env});
process.exit(result.status===null?1:result.status);
