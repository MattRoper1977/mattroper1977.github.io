'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173';
const output = 'audit-output/completion';
const report = { cases: [], powerpoints: 0 };
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
      await page.goto(origin + '/');
      await page.locator('#custom-resources').waitFor();
      assert.match(await page.locator('#custom-resources').innerText(), /£5[\s\S]*£10/);
      assert.match(await page.locator('#about').innerText(), /Made by a teacher, for real classrooms/);
      assert.equal(await page.locator('[data-mbm-support-footer]').count(), 1);
      assert(await page.locator('[data-mbm-navigation="education"] img').first().evaluate(e => e.complete && e.naturalWidth > 0));
      for (const theme of ['cream', 'dark']) {
        await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Homepage overflow');
        await page.locator('#custom-resources').screenshot({path: path.join(output, `requests-${width}-${theme}.png`)});
      }
      await page.goto(origin + '/for/pupils/');
      assert.equal(await page.locator('[data-mbm-support-footer],a[href*="ko-fi.com"]').count(), 0);
      await page.goto(origin + '/Lessons/Science_Teesside/Build/SCI_B_W3_Backbones.html');
      assert.equal(await page.locator('[data-mbm-support-footer],a[href*="ko-fi.com"]').count(), 0);
      report.cases.push(`Homepage, supplied logo and pupil protection at ${width}px`);
      const packsPath = path.join(__dirname, 'output/education-lessons/Science_Teesside/Teaching_Packs/index.html');
      if (fs.existsSync(packsPath)) {
        await page.goto(origin + '/Lessons/Science_Teesside/Teaching_Packs/');
        assert.equal(await page.locator('h1').innerText(), 'Science teaching packs');
        assert.equal(await page.locator('[data-mbm-navigation="education"]').count(), 1);
        assert.equal(await page.locator('article.lesson').count(), 20);
        assert.equal(await page.locator('[data-mbm-support-footer]').count(), 1);
        const decks = await page.locator('a[href$=".pptx"]').evaluateAll(items => items.map(a => a.href));
        assert.equal(decks.length, 20);
        if (width === 390) {
          for (const href of decks) {
            const response = await page.request.get(href);
            assert(response.ok(), href);
            const body = await response.body();
            assert(body.length > 1000 && body.subarray(0, 2).toString() === 'PK', href);
          }
          report.powerpoints = decks.length;
        }
        for (const scale of [1, 2]) {
          await page.evaluate(s => document.documentElement.style.fontSize = `${s * 100}%`, scale);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Download shelf overflow');
        }
        await page.evaluate(() => document.documentElement.style.fontSize = '100%');
        await page.locator('#build-week-3').screenshot({path: path.join(output, `build-downloads-${width}.png`)});
        report.cases.push(`20 teaching entries, downloads and enlarged text at ${width}px`);
      }
      await page.close();
    }
    report.status = 'PASS';
  } catch (error) { report.status = 'FAIL'; report.error = error.stack; process.exitCode = 1; }
  finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
})();
