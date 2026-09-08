'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173';
const output = process.env.MBM_COMPLETION_OUTPUT || 'audit-output/completion';
const lessonsRoot = process.env.MBM_COMPLETION_LESSONS || path.join(__dirname, 'output/education-lessons');
const requirePacks = process.env.MBM_REQUIRE_TEACHING_PACKS === 'true';
// Derive the installed pack contract from the reviewed, pinned Lessons source.
function sciencePackContract(root) {
  const contract = { lessons: [], decks: [], archives: [] };
  for (const pathway of ['BUILD', 'GROW', 'LAUNCH']) {
    const packRoot = path.join(root, 'Science_Teesside/Teaching_Packs', pathway);
    const source = JSON.parse(fs.readFileSync(path.join(packRoot, 'SOURCE_MANIFEST.json'), 'utf8'));
    const archives = JSON.parse(fs.readFileSync(path.join(packRoot, 'DOWNLOAD_INDEX.json'), 'utf8')).archives;
    const route = file => '/Lessons/Science_Teesside/Teaching_Packs/' + pathway + '/' + file;
    assert.equal(source.lessons.length, source.lessonCount, pathway + ' source lesson count');
    assert(source.lessons.length > 0, pathway + ' source lessons missing');
    assert.deepEqual(archives.filter(a => a.kind === 'format').map(a => a.format).sort(), ['DOCX', 'PDF', 'PPTX'], pathway + ' format collections');
    for (const lesson of source.lessons) {
      const decks = lesson.files.filter(f => f.format === 'PPTX');
      assert.equal(decks.length, 1, pathway + '/' + lesson.id + ' requires one PowerPoint');
      for (const format of ['PPTX', 'DOCX', 'PDF']) assert(lesson.files.some(f => f.format === format), pathway + '/' + lesson.id + ' missing ' + format);
      const bundle = archives.filter(a => a.kind === 'lesson' && a.lessonIds.length === 1 && a.lessonIds[0] === lesson.id);
      assert.equal(bundle.length, 1, pathway + '/' + lesson.id + ' lesson bundle');
      contract.lessons.push({
        id: pathway.toLowerCase() + '-' + lesson.id.toLowerCase(),
        files: [...lesson.files, ...bundle].map(f => route(f.file)).sort(),
      });
      contract.decks.push(route(decks[0].file));
    }
    contract.archives.push(...archives.map(a => route(a.file)));
  }
  contract.lessons.sort((a, b) => a.id.localeCompare(b.id));
  contract.decks.sort();
  contract.archives.sort();
  assert.equal(new Set(contract.decks).size, contract.decks.length, 'Duplicate source PowerPoints');
  return contract;
}
function assertSciencePackMembership(actual, expected) {
  assert.deepEqual(actual.lessons, expected.lessons, 'Science lesson identities or companion file links differ from the reviewed source');
  assert.deepEqual(actual.decks, expected.decks, 'Science PowerPoint routes differ from the reviewed source');
  assert.deepEqual(actual.archives, expected.archives, 'Science lesson, week, whole or format archives differ from the reviewed source');
}
const report = { cases: [], powerpoints: 0, requirePacks, pageErrors: [] };
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const packsPath = path.join(lessonsRoot, 'Science_Teesside/Teaching_Packs/index.html');
    if (requirePacks) assert(fs.existsSync(packsPath), 'Required Science download hub is missing from build');
    const expectedPacks = fs.existsSync(packsPath) ? sciencePackContract(lessonsRoot) : null;
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
      page.on('pageerror', error => report.pageErrors.push(error.message));
      await page.goto(origin + '/');
      assert.match(await page.locator('#about').innerText(), /Made by a teacher, for real classrooms/);
      // HC3 §8: the home page is a pupil entry, so the injected support footer is
      // gone from it. UX2 B2: the £5–£50 commissioning block moved verbatim to
      // /commission/, linked from the maker panel; no money copy stays on /.
      assert.equal(await page.locator('[data-mbm-support-footer]').count(), 0);
      assert.equal(await page.locator('#custom-resources').count(), 0, 'The commission block is no longer on the homepage');
      assert(!/£/.test(await page.locator('body').innerText()), 'No money copy on the homepage');
      const commissionLink = page.locator('#about a[href="/commission/"]');
      assert.equal(await commissionLink.innerText(), 'Commission a resource');
      assert(await page.locator('[data-mbm-navigation="education"] img').first().evaluate(e => e.complete && e.naturalWidth > 0));
      for (const theme of ['cream', 'dark']) {
        await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Homepage overflow');
      }
      assert.equal((await page.goto(origin + '/commission/')).status(), 200);
      await page.locator('#custom-resources').waitFor();
      assert.match(await page.locator('#custom-resources').innerText(), /£5[\s\S]*£10/);
      assert.equal(await page.locator('h1').innerText(), 'Commission a resource');
      for (const theme of ['cream', 'dark']) {
        await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Commission page overflow');
        await page.locator('#custom-resources').screenshot({path: path.join(output, `requests-${width}-${theme}.png`)});
      }
      // The cover teaching packs stay reachable within two taps of /: the Resources
      // place on the homepage, then the pack link on /resources/ (a unit card after B4).
      assert.equal((await page.goto(origin + '/resources/')).status(), 200);
      const cover = page.locator('a[href*="David_Cover_Autumn1_W3-W7"]').first();
      await cover.waitFor();
      assert((await page.request.get(new URL(await cover.getAttribute('href'), page.url()).href)).ok(), 'Cover teaching packs destination resolves');
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
      if (expectedPacks) {
        await page.goto(origin + '/Lessons/Science_Teesside/Teaching_Packs/');
        assert.equal(await page.locator('h1').innerText(), 'Science teaching packs');
        assert.equal(await page.locator('[data-mbm-navigation="education"]').count(), 1);
        assert.equal(await page.locator('[data-mbm-support-footer]').count(), 1);
        const membership = await page.evaluate(() => {
          const routes = selector => [...document.querySelectorAll(selector)].map(a => new URL(a.href).pathname).sort();
          return {
            lessons: [...document.querySelectorAll('article.lesson')].map(article => ({
              id: article.id,
              files: [...article.querySelectorAll('a[download]')].map(a => new URL(a.href).pathname).sort(),
            })).sort((a, b) => a.id.localeCompare(b.id)),
            decks: routes('a[href$=".pptx"]'),
            archives: routes('a[download][href$=".zip"]'),
          };
        });
        assertSciencePackMembership(membership, expectedPacks);
        const decks = await page.locator('a[href$=".pptx"]').evaluateAll(items => items.map(a => a.href));
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
        report.cases.push(`${expectedPacks.lessons.length} teaching entries with exact companion and archive links, downloads and enlarged text at ${width}px`);
      }
      await page.close();
    }
    if (requirePacks) assert.equal(report.powerpoints, expectedPacks.decks.length, 'Final release requires every reviewed PowerPoint download');
    assert.deepEqual(report.pageErrors, [], 'Unexpected browser runtime error');
    report.status = 'PASS';
  } catch (error) { report.status = 'FAIL'; report.error = error.stack; process.exitCode = 1; }
  finally { await browser.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
})();
