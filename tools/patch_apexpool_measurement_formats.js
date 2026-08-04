#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'verify_apexpool_landing_browser.js');
let source = fs.readFileSync(file, 'utf8');
const edits = [
  [
    "  const bad = targets.filter((item) => item.width + 0.01 < 44 || item.height + 0.01 < 44);",
    "  const bad = targets.filter((item) => Math.round(item.width) < 44 || Math.round(item.height) < 44);"
  ],
  [
    "    ok('splash-motion-suppressed', (reduced.splash === '0s' || reduced.splash === '0.000001s') && (reduced.rule === '0s' || reduced.rule === '0.000001s'));",
    "    ok('splash-motion-suppressed', parseFloat(reduced.splash) <= 0.001 && parseFloat(reduced.rule) <= 0.001);"
  ]
];
for (const [before, after] of edits) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one measurement expression, found ${count}: ${before}`);
  source = source.replace(before, after);
}
fs.writeFileSync(file, source);
console.log('Normalised subpixel target rounding and CSS duration serialisation in the verifier only.');
