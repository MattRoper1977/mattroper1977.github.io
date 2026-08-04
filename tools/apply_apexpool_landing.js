#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'apexpool', 'index.html');
const receivedHash = '7d80e3f1119d6af5003571acb3fa1df7a69e600e7cef5f819605a7953668658f';
const committedHash = '4de1383f8ee029db438258bb239e4e7f3b7ffd9e603706a9fd145fd397af87ad';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const source = fs.readFileSync(file);

if (source.length !== 88751 || hash(source) !== receivedHash) {
  throw new Error(`A1 identity failure: bytes=${source.length} sha256=${hash(source)}`);
}

let text = source.toString('utf8');
const edits = [
  ['.btn.small{min-height:40px;padding:8px 11px;font-size:12px}', '.btn.small{min-height:44px;padding:8px 11px;font-size:12px}'],
  ['.pocket-grid button{min-height:38px;border:1px solid var(--line);border-radius:9px;background:#172943;font-size:11px}', '.pocket-grid button{min-height:44px;border:1px solid var(--line);border-radius:9px;background:#172943;font-size:11px}']
];
for (const [before, after] of edits) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one authorised declaration, found ${count}: ${before}`);
  text = text.replace(before, after);
}
const result = Buffer.from(text, 'utf8');
if (result.length !== 88751 || hash(result) !== committedHash) {
  throw new Error(`A2 accountability failure: bytes=${result.length} sha256=${hash(result)}`);
}
fs.writeFileSync(file, result);
console.log(`received bytes=${source.length} sha256=${hash(source)}`);
console.log(`committed bytes=${result.length} sha256=${hash(result)}`);
console.log('authorised edits=2 padding adjustment=none');
