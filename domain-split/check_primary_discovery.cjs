#!/usr/bin/env node
'use strict';
// Exercises already assembled files. Does not inject or reconstruct product UI.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const origin = process.env.MBM_PRIMARY_ORIGIN || 'http://127.0.0.1:4189';
const out = path.resolve(process.env.MBM_PRIMARY_QA_OUT || 'audit-output/primary-discovery');
const source = process.env.MBM_PRIMARY_LESSONS_SOURCE;
assert(source, 'MBM_PRIMARY_LESSONS_SOURCE must name the exact source checkout');
fs.mkdirSync(out, { recursive: true });
const report = { result: 'RUNNING', cases: [], pageErrors: [], downloads: [] };
const primary = '/Lessons/primary/';
const force = primary + 'year5/science/autumn/forces/Lesson1_Friction.html';
const normal = value => { const url = new URL(value, origin); return url.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/'; };
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function open(page, route) {
  const response = await page.goto(new URL(route, origin).href, { waitUntil: 'domcontentloaded' });
  assert.equal(response.status(), 200, route);
  await settle(page);
}
async function record(name, page, fn) {
  const row = { name, ok: false }; report.cases.push(row);
  try { row.evidence = await fn(); row.ok = true; }
  catch (error) { row.error = error.stack || String(error); if (page) await page.screenshot({ path: path.join(out, 'FAIL-'+name+'.png') }).catch(() => {}); }
  console.log((row.ok ? 'PASS ' : 'FAIL ') + name + (row.error ? ': '+row.error.split('\n')[0] : ''));
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => report.pageErrors.push({ url: page.url(), error: String(error) }));
      await record(width+'-hub-and-filters', page, async () => {
        await open(page, primary);
        assert.equal(await page.locator('.primary-unit:visible').count(), 6);
        assert.equal(await page.locator('.primary-lesson:visible').count(), 46);
        assert.equal(await page.locator('#mbm-lesson-tools').count(), 0, 'Primary hub must not receive a lesson toolbar');
        const links = await page.locator('.primary-lesson,.primary-scheme,.primary-download').evaluateAll(nodes => nodes.map(node => node.href));
        const rows = JSON.parse(fs.readFileSync(path.join(source, 'resources.json'), 'utf8')).filter(row => row.file?.startsWith('primary/'));
        assert(rows.every(row => links.some(href => normal(href) === normal('/Lessons/'+row.file))));
        assert.equal(await page.locator('.primary-header a[data-primary-global]').getAttribute('href'), '/Lessons/');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow');
        const search = await page.locator('#primary-search').boundingBox();
        assert(search.y + search.height < 500, 'Primary search is below the first viewport');
        for (const selector of ['#primary-search', '#primary-year', '#primary-subject', '#primary-term', '#primary-unit', '#primary-clear']) {
          const box = await page.locator(selector).boundingBox(); assert(box.width >= 44 && box.height >= 44, selector+' target is too small');
        }
        await page.screenshot({ path: path.join(out, width+'-primary-hub.png'), animations: 'disabled' });
        await page.locator('#primary-year').selectOption('4');
        assert.equal(await page.locator('.primary-unit:visible').count(), 2);
        assert.equal(await page.locator('.primary-lesson:visible').count(), 15);
        await page.locator('#primary-unit').selectOption('year4-states-of-matter');
        assert.equal(await page.locator('.primary-lesson:visible').count(), 10);
        await page.locator('#primary-subject').selectOption('Science');
        await page.locator('#primary-term').selectOption('Autumn');
        await page.locator('#primary-search').fill('evaporation');
        assert(await page.locator('a[href*="Lesson8_PlanEvaporation.html"]:visible').count());
        assert.equal(await page.locator('.primary-unit:visible').count(), 1);
        await page.screenshot({ path: path.join(out, width+'-primary-filtered.png'), animations: 'disabled' });
        await page.locator('#primary-search').fill('noexistingprimarymaterialzz');
        assert(await page.locator('#primary-empty').isVisible());
        await page.locator('#primary-clear').click();
        assert.equal(await page.locator('.primary-lesson:visible').count(), 46);
        return { preservedCatalogueLinks: rows.length, searchBottom: search.y+search.height, screenshots: [width+'-primary-hub.png', width+'-primary-filtered.png'] };
      });
      await record(width+'-filtered-scheme-lesson-return', page, async () => {
        const selection = primary+'?q=friction&year_group=5&subject=Science&term=Autumn&unit=year5-forces';
        await open(page, selection);
        await page.locator('.primary-unit:visible .primary-scheme').click();
        await settle(page);
        const schemeBack = page.locator('a').filter({ hasText: /Primary hub/ }).first();
        assert.equal(new URL(await schemeBack.getAttribute('href'), origin).pathname, primary);
        const schemeQuery = new URL(await schemeBack.getAttribute('href'), origin).searchParams;
        assert.equal(schemeQuery.get('q'), 'friction');
        await page.locator('a[href*="Lesson1_Friction.html"]').first().click();
        await page.waitForSelector('#mbmhud-back'); await settle(page);
        const back = await page.locator('#mbmhud-back').getAttribute('href');
        assert.equal(new URL(back, origin).pathname, primary);
        assert.equal(new URL(back, origin).searchParams.get('unit'), 'year5-forces');
        assert.equal(new URL(back, origin).searchParams.get('q'), 'friction');
        await page.locator('#mbmhud-back').click();
        await page.waitForSelector('#primary-search');
        assert.equal(await page.locator('#primary-search').inputValue(), 'friction');
        assert.equal(await page.locator('#primary-unit').inputValue(), 'year5-forces');
        return { returned: back };
      });
      await context.close();
    }
    const context = await browser.newContext(); const page = await context.newPage();
    await record('direct-and-untrusted-return', page, async () => {
      await open(page, force+'?primary_return=https%3A%2F%2Fexample.com%2F');
      await page.waitForSelector('#mbmhud-back'); await settle(page);
      const href = await page.locator('#mbmhud-back').getAttribute('href');
      assert.equal(new URL(href, origin).origin, new URL(origin).origin);
      assert.equal(new URL(href, origin).pathname, primary);
      assert.equal(new URL(href, origin).searchParams.get('year_group'), '5');
      return { fallback: href };
    });
    await record('main-catalogue-context-kept', page, async () => {
      await page.evaluate(({ force }) => sessionStorage.setItem('mbm.lesson.return.v1', JSON.stringify({ [force]: '/Lessons/?subject=Science&collection=Primary%20Science&year=all' })), { force });
      await open(page, force);
      await page.waitForSelector('#mbmhud-back'); await settle(page);
      const href = await page.locator('#mbmhud-back').getAttribute('href');
      assert.equal(new URL(href, origin).pathname, '/Lessons/');
      assert.equal(new URL(href, origin).searchParams.get('collection'), 'Primary Science');
      return { mainReturn: href };
    });
    await record('six-word-downloads-exact', null, async () => {
      const response = await context.request.get(new URL(primary+'catalogue.json', origin).href);
      assert.equal(response.status(), 200); const catalogue = await response.json();
      for (const unit of catalogue.units) {
        const result = await context.request.get(new URL(unit.download.route, origin).href);
        assert.equal(result.status(), 200);
        const bytes = await result.body(), original = fs.readFileSync(path.join(source, unit.download.route.slice('/Lessons/'.length)));
        assert(bytes.equals(original), unit.download.route+' Word payload changed');
        report.downloads.push({ route: unit.download.route, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
      }
      assert.equal(report.downloads.length, 6);
      return { exactWordFiles: report.downloads.length };
    });
    await context.close();
  } finally { await browser.close(); }
  report.result = report.cases.every(row => row.ok) && !report.pageErrors.length ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(out, 'primary-discovery-results.json'), JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify({ result: report.result, cases: report.cases.length, passed: report.cases.filter(row => row.ok).length, pageErrors: report.pageErrors.length }));
  process.exitCode = report.result === 'PASS' ? 0 : 1;
})().catch(error => { report.result='FAIL'; report.fatal=error.stack; fs.writeFileSync(path.join(out, 'primary-discovery-results.json'), JSON.stringify(report,null,2)+'\n'); console.error(error); process.exitCode=1; });
