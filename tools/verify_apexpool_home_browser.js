#!/usr/bin/env node
'use strict';
// Compatibility entry point for the authoritative four-game browser gates.
const path=require('path'),{spawnSync}=require('child_process');
const target=path.join(__dirname,'verify_apextennis_home_browser.js');
const env={...process.env};
if(env.APEXPOOL_BASE_URL&&!env.APEXTENNIS_HOME_BASE_URL)env.APEXTENNIS_HOME_BASE_URL=env.APEXPOOL_BASE_URL;
if(env.APEXPOOL_ARTIFACT_DIR&&!env.APEXTENNIS_HOME_ARTIFACT_DIR)env.APEXTENNIS_HOME_ARTIFACT_DIR=env.APEXPOOL_ARTIFACT_DIR;
const result=spawnSync(process.execPath,[target,...process.argv.slice(2)],{stdio:'inherit',env});
process.exit(result.status===null?1:result.status);
