#!/usr/bin/env node
'use strict';
// Verify the actual assembled publication with the existing CI browser runtime.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const out = path.resolve(process.env.MBM_GOVERNANCE_OUTPUT || 'audit-output/governors-discovery');
const route = '/for/governors-trustees/';
const report = { origin, route, startedAt: new Date().toISOString(), cases: [], pageErrors: [] };
fs.mkdirSync(out, { recursive: true });
const url = p => new URL(p, origin).href;
const expectedReused = ['dfe-kcsie-2026', 'dfe-send-code-0-25', 'dfe-national-curriculum', 'dfe-academy-trust-handbook-2025', 'dfe-academy-trust-handbook-2026', 'page-lesson-hub', 'resource-asdan-master-hub', 'page-resources', 'page-teach'];
async function check(name, action) {
  const row = { name, ok: false }; report.cases.push(row);
  try { row.evidence = await action(); row.ok = true; }
  catch (error) { row.error = error.stack || String(error); }
  console.log(`${row.ok ? 'PASS' : 'FAIL'} ${name}${row.error ? ': ' + row.error.split('\n')[0] : ''}`);
}
async function target(locator) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.evaluate(el => { const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.x+b.width/2, b.y+b.height/2); return { w: b.width, h: b.height, left: b.left, right: b.right, viewport: innerWidth, hit: hit === el || el.contains(hit) }; });
  assert(r.w >= 44 && r.h >= 44 && r.left >= -.5 && r.right <= r.viewport+.5 && r.hit, JSON.stringify(r));
}
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const requestContext = await browser.newContext();
    let records;
    await check('published-records-and-preserved-identities', async () => {
      const response = await requestContext.request.get(url('/data/governance-resources.json'));
      assert.equal(response.status(), 200);
      const data = await response.json(); records = data.resources;
      assert.equal(data.checkedDate, '2026-09-06'); assert.equal(records.length, 17);
      assert.equal(new Set(records.map(r => r.id)).size, records.length);
      for (const id of expectedReused) assert(records.some(r => r.id === id && r.reusedRecordId === id), 'Missing reused source '+id);
      for (const record of records) for (const key of ['title', 'source', 'origin', 'topic', 'type', 'jurisdiction', 'audience', 'url', 'summary', 'access', 'lastReviewed']) assert(record[key], 'Missing '+key+' in '+record.id);
      for (const record of records.filter(r => r.origin === 'made-by-matt')) assert.equal((await requestContext.request.get(url(record.url))).status(), 200, record.url);
      assert.equal(records.filter(r => r.origin === 'official').length, 8);
      assert.match(records.find(r => r.id === 'boards-for-education-induction').access, /£30.*£150 plus VAT/);
      assert.match(records.find(r => r.id === 'nga-introduction-governance').access, /Gold or MAT membership required/);
      return { records: records.length, reused: expectedReused.length, internalDestinations: 4 };
    });
    await requestContext.close();
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', e => report.pageErrors.push({ width, message: e.message }));
      const response = await page.goto(url(route), { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await check(`${width}-navigation-layout-and-record-metadata`, async () => {
        assert.equal(await page.getByRole('heading', { name: 'Governors & trustees', exact: true }).count(), 1);
        assert.equal(await page.locator('[data-governance-card]').count(), 17);
        for (const href of ['/Lessons/', '/resources/', '/Matt-s-Apps-/', '/tools/']) await target(page.locator(`nav[aria-label="Learning areas"] a[href="${href}"]`));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), 'Horizontal overflow');
        if (records) for (const row of records) {
          const card = page.locator(`[data-governance-card][data-id="${row.id}"]`);
          assert.equal(await card.locator('dl dt').count(), 5);
          assert.equal(await card.locator('.gv-open').getAttribute('href'), row.url);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(out, `${width}-governors-start.png`), animations: 'disabled' });
        return { screenshot: `${width}-governors-start.png`, visibleLearningAreas: 4 };
      });
      await check(`${width}-real-search-filters-and-empty-state`, async () => {
        const visible = '[data-governance-card]:not([hidden])';
        for (const query of ['safeguarding', 'SEND', 'induction']) {
          await page.getByLabel('Search governance resources').fill(query); await settle(page);
          assert(await page.locator(visible).count() > 0, query+' has no results');
          await target(page.locator(visible+' .gv-open').first());
          await page.locator(visible).first().screenshot({ path: path.join(out, `${width}-governors-${query}.png`), animations: 'disabled' });
        }
        await page.getByRole('button', { name: 'Clear filters' }).click(); await settle(page);
        assert.equal(await page.locator(visible).count(), 17);
        assert(await page.getByLabel('Search governance resources').evaluate(el => el === document.activeElement));
        await page.getByLabel('Publisher group').selectOption('official'); await settle(page);
        assert.equal(await page.locator(visible).count(), 8);
        await page.getByLabel('Topic', { exact: true }).selectOption('SEND & inclusion'); await settle(page);
        assert.equal(await page.locator(visible).count(), 2);
        await page.getByRole('button', { name: 'Clear filters' }).click(); await settle(page);
        await page.getByLabel('Publisher group').selectOption('made-by-matt'); await settle(page);
        assert.equal(await page.locator(visible).count(), 4);
        await page.getByLabel('Search governance resources').fill('this cannot match any resource 8675309'); await settle(page);
        assert.equal(await page.locator(visible).count(), 0);
        assert(await page.locator('#gv-empty').isVisible());
        await page.getByRole('button', { name: 'Clear filters' }).click(); await settle(page);
        assert.equal(await page.locator(visible).count(), 17);
        return { queries: ['safeguarding', 'SEND', 'induction'], officialResults: 8, officialSendResults: 2, ownCollections: 4, emptyState: true, reset: true };
      });
      await context.close();
    }
    await check('resources-remain-available-without-javascript', async () => {
      const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
      await page.goto(url(route)); assert.equal(await page.locator('[data-governance-card] a.gv-open').count(), 17);
      assert(await page.locator('noscript').isVisible()); await context.close(); return { links: 17 };
    });
    await check('no-browser-errors', async () => { assert.deepEqual(report.pageErrors, []); return { pageErrors: 0 }; });
  } finally {
    report.completedAt = new Date().toISOString();
    report.ok = report.cases.length === 9 && report.cases.every(row => row.ok) && report.pageErrors.length === 0;
    fs.writeFileSync(path.join(out, 'governors-discovery.json'), JSON.stringify(report, null, 2)+'\n');
    await browser.close(); if (!report.ok) process.exitCode = 1;
  }
})().catch(error => { report.fatal = error.stack || String(error); fs.writeFileSync(path.join(out, 'governors-discovery.json'), JSON.stringify(report, null, 2)+'\n'); console.error(error); process.exitCode = 1; });
