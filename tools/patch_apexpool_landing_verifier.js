#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'verify_apexpool_landing_browser.js');
const source = fs.readFileSync(file, 'utf8');
const before = `    await page.waitForTimeout(1300);\n    await assertTargets(page, 'title');\n\n    await page.locator('#settingsBtn').click();`;
const after = `    await page.waitForTimeout(1300);\n    const rotateVisible = await page.locator('#rotateHint').isVisible();\n    ok('portrait-choice-overlay-renders', rotateVisible);\n    if (rotateVisible) {\n      await assertTargets(page, 'portrait-choice');\n      await page.locator('#dismissRotate').click();\n      await page.waitForFunction(() => getComputedStyle(document.getElementById('rotateHint')).display === 'none');\n    }\n    await assertTargets(page, 'title');\n\n    await page.locator('#settingsBtn').click();`;
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected one verifier setup block; found ${count}`);
fs.writeFileSync(file, source.replace(before, after));
console.log('Corrected the test setup to exercise and dismiss the intended portrait-choice overlay.');
