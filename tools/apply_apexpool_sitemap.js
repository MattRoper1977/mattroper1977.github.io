#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'sitemap.xml');
const url = 'https://madebymatt.uk/apexpool/';
const source = fs.readFileSync(file, 'utf8');
const count = source.split(url).length - 1;
if (count !== 0) throw new Error(`Expected Apex Pool to be absent before insertion; found ${count}`);
const marker = '</urlset>';
if (source.split(marker).length - 1 !== 1) throw new Error('Expected exactly one </urlset> marker');
const block = '  <url>\n    <loc>https://madebymatt.uk/apexpool/</loc>\n    <lastmod>2026-08-04</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n';
const result = source.replace(marker, block + marker);
fs.writeFileSync(file, result);
const after = result.split(url).length - 1;
if (after !== 1) throw new Error(`Expected exactly one Apex Pool URL after insertion; found ${after}`);
console.log('Inserted exactly one canonical Apex Pool sitemap URL.');
