/* Part R acceptance, called by the existing UX2 B5 job.
 * The catalogue is the oracle: census every unit key, companion identity, file,
 * drift flag and delivery target. Planted DOM defects must be rejected and restored.
 */
'use strict';
const assert = require('node:assert/strict');

exports.verify = async ({page, origin, rules}) => {
  const rows = await (await page.request.get(origin + '/Lessons/resources.json')).json();
  const keys = new Map();
  for (const row of rows) {
    if (/^(lesson|game)$/i.test(row.type || '') || !row.halfTerm) continue;
    const key = [rules.cardOf(row), rules.tierOf(row) || '', row.halfTerm, row.unit || ''].join('|');
    if (!keys.has(key)) keys.set(key, []);
    keys.get(key).push(row);
  }
  assert(keys.size, 'Unit census must be non-vacuous');
  await page.goto(origin + '/resources/');
  await page.waitForFunction(() => document.querySelector('#unitGrid .unit'));
  const observedKeys = await page.locator('#unitGrid .unit').evaluateAll(es => es.map(e => e.dataset.key));
  assert.deepEqual(observedKeys.slice().sort(), [...keys.keys()].sort(), 'Exactly the record-owned unit keys');
  assert.equal(await page.locator('#rxSearch').getAttribute('placeholder'), 'Search packs, schemes of work, evidence books');
  assert.equal(await page.locator('main input[type="search"]').count(), 1, 'One Resources search');
  assert.equal(await page.locator('main form').count(), 0, 'No search form or new route');
  assert.equal(await page.locator('.rx-hero.rx-intro h1').innerText(), 'Resources', 'The pinned consumer heading hook survives the new composition');
  const allPaths = new Set();
  const report = {units: keys.size, packs: 0, files: 0, groups: 0, viewportThemes: [], controls: []};
  let planted = false;
  const expectedFor = rs => rs.filter(r => r.kind === 'pack').map(r => ({id:r.id, lesson:r.companionOf || r.id, drift:!!r.packRevisionDrift,
    files:r.files.map(f => ({path:f.path, href:'/Lessons/'+f.path})).sort((a,b)=>a.path.localeCompare(b.path))})).sort((a,b)=>a.id.localeCompare(b.id));
  const measured = () => page.locator('#rxSheet .pack-version').evaluateAll(es => es.map(e => ({id:e.dataset.pack,lesson:e.closest('[data-lesson]').dataset.lesson,drift:!!e.querySelector('.drift'),
    files:[...e.querySelectorAll('[data-file]')].map(f=>({path:f.dataset.file,href:decodeURI(f.querySelector('a').getAttribute('href'))})).sort((a,b)=>a.path.localeCompare(b.path))})).sort((a,b)=>a.id.localeCompare(b.id)));
  const samePacks = async expected => assert.deepEqual(await measured(), expected, 'Every companion file belongs to its record lesson, exactly once per pack');
  const openAllFiles = async () => { const closed=page.locator('#rxSheet .pack-files:not([open]) > summary'); while(await closed.count()) await closed.first().click(); };
  const geometry = async () => {
    const bad = await page.evaluate(() => {
      const sheet=document.getElementById('rxSheet');
      const nodes=[document.documentElement,...document.querySelectorAll('main section,main .wrap,main .grid,dialog,.sheet-body,.lesson-pack')];
      const overflow=nodes.filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+1).map(e=>e.id||e.className||e.tagName);
      const small=[...sheet.querySelectorAll('a[href],button,summary')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.width<44||r.height<44}).map(e=>e.textContent.trim().slice(0,60));
      return {overflow,small};
    });
    assert.deepEqual(bad,{overflow:[],small:[]},'No sideways scrolling and every sheet control is at least 44px');
  };
  for (const key of observedKeys) {
    const rs=keys.get(key), expected=expectedFor(rs);
    // Select by the actual record key, not a fixed title or first-card assumption.
    const matching=page.locator('#unitGrid .chip.more[data-key='+JSON.stringify(key)+']');
    await matching.click();
    await samePacks(expected);
    const groupKeys=await page.locator('#rxSheet .lesson-pack').evaluateAll(es=>es.map(e=>e.dataset.lesson));
    assert.deepEqual(groupKeys.slice().sort(),[...new Set(expected.map(p=>p.lesson))].sort(),'One group for each distinct companion lesson');
    const actualDelivery=await page.locator('#rxSheet .pack-delivery').evaluateAll(es=>es.map(e=>decodeURI(e.getAttribute('href'))).sort());
    const wantedDelivery=[...new Set(rs.filter(r=>r.kind==='pack'&&r.companionOf).map(r=>'/Lessons/'+r.companionOf))].sort();
    assert.deepEqual(actualDelivery,wantedDelivery,'Every group returns to its exact companionOf lesson');
    const nonPackFiles=rs.filter(r=>r.kind!=='pack').flatMap(r=>r.files?.length?r.files:[{path:r.file||r.url,role:null}]);
    const expectedSections=[];
    if(nonPackFiles.some(f=>!f.role||['lesson','slides','teacher'].includes(f.role)))expectedSections.push('Planning');
    if(nonPackFiles.some(f=>f.role==='pupil'))expectedSections.push('Evidence');
    if(expected.length)expectedSections.push('Lesson packs');
    const [card,tier,halfTerm,unit]=key.split('|');
    if(rows.some(r=>/^lesson$/i.test(r.type||'')&&rules.cardOf(r)===card&&(rules.tierOf(r)||'')===tier&&r.halfTerm===halfTerm&&(!unit||r.unit===unit)))expectedSections.push('Delivery');
    assert.deepEqual(await page.locator('#rxSheet .sheet-sec > h3').allTextContents(),expectedSections,'Planning, Evidence, Lesson packs and Delivery render only from their records, in order');
    const allExpectedFiles=rs.flatMap(r=>r.files?.length?r.files.map(f=>f.path):[r.file||r.url]);
    const actualFiles=await page.locator('#rxSheet [data-file]').evaluateAll(es=>es.map(e=>e.dataset.file));
    assert.deepEqual(actualFiles.sort(),allExpectedFiles.sort(),'No file lost in the new grouping');
    allExpectedFiles.forEach(f=>allPaths.add(f));
    report.packs+=expected.length;report.files+=actualFiles.length;report.groups+=groupKeys.length;
    await openAllFiles();
    await geometry();
    if(!planted&&expected.length){
      const markup=await page.locator('#sheetBody').innerHTML();
      await page.locator('#rxSheet [data-file]').first().evaluate(e=>e.remove());
      await assert.rejects(()=>samePacks(expected));report.controls.push('removed file rejected');
      await page.locator('#sheetBody').evaluate((e,html)=>{e.innerHTML=html},markup);await samePacks(expected);
      await page.locator('#rxSheet .lesson-pack').first().evaluate(e=>{e.dataset.lesson='wrong-delivery'});
      await assert.rejects(()=>samePacks(expected));report.controls.push('wrong lesson binding rejected');
      await page.locator('#sheetBody').evaluate((e,html)=>{e.innerHTML=html},markup);await samePacks(expected);
      await page.locator('#sheetClose').evaluate(e=>{e.style.cssText='width:1px!important;min-width:1px!important;flex-basis:1px!important;padding:0!important'});
      await assert.rejects(geometry);report.controls.push('undersized control rejected');
      await page.locator('#sheetClose').evaluate(e=>e.removeAttribute('style'));await geometry();
      planted=true;
    }
    await page.keyboard.press('Escape');
    assert(await matching.evaluate(e=>e===document.activeElement),'Escape returns focus to the exact unit opener');
  }
  assert(planted,'Planted controls must have run');
  const first=page.locator('#unitGrid .chip.more').first();
  for(const width of [390,900,1280])for(const theme of ['cream','pink','blue','light','dark','highlumen']){
    await page.setViewportSize({width,height:900});
    await page.evaluate(t=>{if(t==='cream')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t)},theme);
    await first.click();await openAllFiles();await geometry();
    const focusables=page.locator('#rxSheet').locator('a[href],button,summary');
    const last=await focusables.evaluateAll(es=>es.filter(e=>e.getClientRects().length).at(-1).outerHTML);
    await page.locator('#sheetClose').focus();await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.outerHTML),last,'Shift+Tab wraps to the last visible control');
    await page.keyboard.press('Tab');assert(await page.locator('#sheetClose').evaluate(e=>e===document.activeElement),'Tab wraps to Close');
    await page.locator('#sheetClose').click();assert(await first.evaluate(e=>e===document.activeElement),'Close restores the opener');
    report.viewportThemes.push({width,theme,status:'PASS'});
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.removeAttribute('data-theme'));
  const paths=[...allPaths];let cursor=0;const failed=[];
  await Promise.all(Array.from({length:8},async()=>{while(cursor<paths.length){const p=paths[cursor++];const r=await page.request.get(origin+'/Lessons/'+encodeURI(p));if(!r.ok())failed.push({path:p,status:r.status()});await r.dispose();}}));
  assert.deepEqual(failed,[],'Every sheet file resolves on the publication');report.resolvedFiles=paths.length;
  return report;
};
