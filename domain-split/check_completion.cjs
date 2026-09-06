'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173';
const output = process.env.MBM_COMPLETION_OUTPUT || 'audit-output/completion';
const lessonsRoot = process.env.MBM_COMPLETION_LESSONS || path.join(__dirname, 'output/education-lessons');
const requirePacks = process.env.MBM_REQUIRE_TEACHING_PACKS === 'true';
const report = { cases: [], powerpoints: 0, requirePacks, pageErrors: [] };
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
      page.on('pageerror', error => report.pageErrors.push(error.message));
      await page.goto(origin + '/');
      await page.locator('#custom-resources').waitFor();
      assert.match(await page.locator('#custom-resources').innerText(), /£5[\s\S]*£10/);
      assert.match(await page.locator('#about').innerText(), /Made by a teacher, for real classrooms/);
      // HC3 §8: the home page is a pupil entry, so the injected support footer is
      // gone from it; the £5/£10 commissioning copy above is Matt's own and held.
      assert.equal(await page.locator('[data-mbm-support-footer]').count(), 0);
      const cover = page.locator('.learning-shortcuts a[href*="David_Cover_Autumn1_W3-W7"]');
      assert.equal(await cover.innerText(), 'Cover teaching packs');
      assert(await page.locator('[data-mbm-navigation="education"] img').first().evaluate(e => e.complete && e.naturalWidth > 0));
      for (const theme of ['cream', 'dark']) {
        await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Homepage overflow');
        await page.locator('#custom-resources').screenshot({path: path.join(output, `requests-${width}-${theme}.png`)});
      }
      assert.equal((await page.goto(origin + '/for/pupils/')).status(), 200);
      assert.equal(await page.locator('[data-mbm-support-footer],a[href*="ko-fi.com"]').count(), 0);
      assert.equal((await page.goto(origin + '/Lessons/Science_Teesside/Build/SCI_B_W3_Backbones.html')).status(), 200);
      assert.equal(await page.locator('[data-mbm-support-footer],a[href*="ko-fi.com"]').count(), 0);
      await page.goto(origin + '/Lessons/');
      await page.waitForFunction(() => /\d+ of \d+ resources/.test(document.querySelector('#count')?.textContent || ''));
      const buildShortcut = page.locator('.catalogue-intro').getByRole('link', {name: /^BUILD Science\b/});
      assert.equal(await buildShortcut.count(), 1);
      assert.equal(await buildShortcut.locator('strong').innerText(), 'BUILD Science');
      const buildURL = new URL(await buildShortcut.getAttribute('href'), page.url());
      assert.equal(buildURL.pathname, '/Lessons/Science_Teesside/index.html');
      assert.equal(buildURL.searchParams.get('pathway'), 'BUILD');
      assert.equal(buildURL.searchParams.has('style'), false);
      assert.equal(await page.locator('nav,h1,h2,h3').filter({hasText: /David[’']s/}).count(), 0);
      await page.locator('.catalogue-intro').screenshot({path: path.join(output, `lesson-shortcuts-${width}.png`)});
      const science = JSON.parse(fs.readFileSync(path.join(lessonsRoot, 'assets/catalogue/science-shelf.json'), 'utf8')).lessons;
      const expectedBuild = science.filter(r => r.pathway === 'BUILD').map(r => r.path).sort();
      await page.goto(buildURL.href);
      await page.waitForFunction(() => document.querySelector('#science-pathway')?.value === 'BUILD');
      const visible = await page.locator('[data-lesson-path]:visible').evaluateAll(items => items.map(e => e.dataset.lessonPath).sort());
      assert.deepEqual(visible, expectedBuild, 'BUILD collection lost or duplicated teaching versions');
      await page.locator('#science-term').selectOption('Aut1');
      await page.locator('#science-style').selectOption('current');
      const currentBuild = science.filter(r => r.pathway === 'BUILD' && r.term === 'Aut1' && r.style === 'current').map(r => r.path);
      assert.equal(currentBuild.length, 5);
      assert.equal(await page.locator('[data-lesson-path]:visible a[href^="Teaching_Packs/#build-week-"]').count(), 5);
      await page.goto(origin + '/Lessons/?subject=Science&pathway=BUILD&year=all');
      await page.waitForFunction(() => document.querySelector('#pathway')?.value === 'BUILD' && /\d+ of \d+ resources/.test(document.querySelector('#count')?.textContent || ''));
      const catalogueLinks = await page.locator('#cards a.go').evaluateAll(items => items.map(a => new URL(a.href).pathname));
      for (const route of currentBuild) assert(catalogueLinks.includes('/Lessons/' + route), 'Current BUILD lesson absent from subject/pathway filters: ' + route);
      assert.equal(catalogueLinks.length, new Set(catalogueLinks).size, 'Duplicate catalogue entries');
      report.cases.push(`Public names, BUILD shortcut and subject/pathway coverage at ${width}px`);
      report.cases.push(`Homepage, supplied logo and pupil protection at ${width}px`);
      const packsPath = path.join(lessonsRoot, 'Science_Teesside/Teaching_Packs/index.html');
      if (requirePacks) assert(fs.existsSync(packsPath), 'Required Science download hub is missing from build');
      if (fs.existsSync(packsPath)) {
        await page.goto(origin + '/Lessons/Science_Teesside/Teaching_Packs/');
        assert.equal(await page.locator('h1').innerText(), 'Science teaching packs');
        assert.equal(await page.locator('[data-mbm-navigation="education"]').count(), 1);
        assert.equal(await page.locator('article.lesson').count(), 20);
        assert.equal(await page.locator('[data-mbm-support-footer]').count(), 1);
        const decks = await page.locator('a[href$=".pptx"]').evaluateAll(items => items.map(a => a.href));
        assert.equal(decks.length, 20);
        assert.equal(new Set(decks).size, 20, 'Duplicate PowerPoint links');
        for (const pathway of ['BUILD', 'GROW']) assert.equal(decks.filter(href => new URL(href).pathname.includes('/Teaching_Packs/' + pathway + '/')).length, 10);
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
    if (requirePacks) assert.equal(report.powerpoints, 20, 'Final release requires all 20 PowerPoint downloads');
    assert.deepEqual(report.pageErrors, [], 'Unexpected browser runtime error');
    report.status = 'PASS';
  } catch (error) { report.status = 'FAIL'; report.error = error.stack; process.exitCode = 1; }
  finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
})();
