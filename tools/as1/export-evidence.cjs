'use strict';
const fs=require('node:fs'),zlib=require('node:zlib');
const paths=['data/pin-dependents.json','data/as1-storage-registry.json','docs/reference/AS1_STORAGE.md','docs/reference/AS1_STORAGE_CENSUS.json.gz','audit-output/as1/verification.json','audit-output/as1/phone-more-greyscale.png','audit-output/as1/phone-running.png','audit-output/as1/390-save.png'];
const files=paths.filter(p=>fs.existsSync(p)).map(path=>({path,base64:fs.readFileSync(path).toString('base64')}));
console.log('AS1_EVIDENCE_BUNDLE '+zlib.gzipSync(Buffer.from(JSON.stringify(files))).toString('base64'));
