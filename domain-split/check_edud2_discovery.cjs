/* EDU-D2: verify the actual metadata filters and guarded public title map. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
exports.verify = async ({page, origin}) => {
  const rows = await (await page.request.get(origin+'/Lessons/resources.json')).json();
  const mapResponse = await page.request.get(origin+'/Lessons/assets/catalogue/display-titles.json');
  const map = mapResponse.ok() ? await mapResponse.json() : null;
  const title = r => { const e = map?.schema === 1 && map.entries?.[r.file]; return e && e.id === (r.id||'') && e.originalTitle === r.title ? e.displayTitle : r.title; };
  const eligible = rows.filter(r => /^lesson$/i.test(r.type) && r.unit && r.file.includes('/Grow/'));
  assert(eligible.length, 'An existing GROW lesson supplies the unit filter journey');
  const lesson = eligible[0];
  for (const width of [320,390,900,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto(origin+'/resources/');
    await page.locator('#rxUnit option').nth(1).waitFor({state:'attached'});
    const actualUnits = await page.locator('#rxUnit option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean));
    assert(actualUnits.includes(lesson.unit));
    await page.locator('#rxSubs').selectOption('science');
    await page.locator('#rxPath').selectOption('GROW');
    await page.locator('#rxUnit').selectOption(lesson.unit);
    assert.equal(new URL(page.url()).searchParams.get('unit'),lesson.unit);
    await page.locator('#lessonList a').first().waitFor();
    const links = await page.locator('#lessonList > li > a').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),title:e.textContent})));
    assert(links.length);
    for (const link of links) {
      const r=rows.find(r=>'/Lessons/'+encodeURI(r.file)===link.href);
      assert(r && r.unit===lesson.unit && r.file.includes('/Grow/'), 'Subject/pathway/unit intersect on real records');
      assert.equal(link.title,title(r));
    }
    const geometry = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,small:[...document.querySelectorAll('.rx-filters select,.title-reference summary')].filter(e=>e.getClientRects().length).some(e=>e.getBoundingClientRect().height<44)}));
    assert.deepEqual(geometry,{overflow:false,small:false});
    fs.mkdirSync('audit-output/education-navigation/edud2-discovery',{recursive:true});
    await page.screenshot({path:`audit-output/education-navigation/edud2-discovery/resources-${width}.png`,fullPage:true});
    await page.locator('#rxSearch').fill('edud2-no-such-topic-9af68');
    await page.locator('#empty').waitFor({state:'visible'});
    await page.locator('#rxClear').click();
    assert.equal(new URL(page.url()).searchParams.get('unit'),null);
    assert.equal(await page.locator('#rxUnit').inputValue(),'');
    assert(await page.locator('#rxSearch').evaluate(e=>e===document.activeElement));
  }
  for (const q of [lesson.title,lesson.id]) {
    await page.goto(origin+'/resources/?q='+encodeURIComponent(q));
    const result=page.locator('#lessonList > li > a').filter({hasText:title(lesson)});
    await result.first().waitFor();
    assert((await result.first().getAttribute('href')).endsWith(encodeURI(lesson.file)));
  }
  await page.setViewportSize({width:390,height:844});
  return {widths:[320,390,900,1280],unit:lesson.unit,legacyReferenceSearch:true,titleMap:map?'available':'compatible fallback'};
};
