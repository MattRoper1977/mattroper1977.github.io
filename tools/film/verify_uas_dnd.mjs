/* Proves the four drag-and-drop fixes in uas/app.html, each against the
 * behaviour it replaced. Every check is run on the live page with synthetic
 * DataTransfer events, not by reading the source.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const base = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
await p.goto(base + '/uas/app.html', { waitUntil: 'networkidle', timeout: 40000 });
await p.waitForTimeout(1200);

// open the import screen so the drop zones are laid out
await p.evaluate(() => {
  const b = [...document.querySelectorAll('button,a')]
    .find(x => /import|add a unit|new unit/i.test(x.textContent || ''));
  if (b) b.click();
});
await p.waitForTimeout(700);

const r = await p.evaluate(async () => {
  const out = {};
  const mkDT = (files) => {
    const dt = new DataTransfer();
    for (const [name, type, body] of files) dt.items.add(new File([body], name, { type }));
    return dt;
  };
  const fire = (el, type, dt) => {
    const e = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
    el.dispatchEvent(e);
    return e;
  };

  const pdfZone = document.querySelector('#pdf-drop');
  out.zoneFound = !!pdfZone;
  out.hasDropzoneAttr = pdfZone ? pdfZone.hasAttribute('data-dropzone') : false;

  // --- 1. a stray drop on the document must be CANCELLED, or the browser
  //        navigates away from a page holding a class register
  const stray = fire(document.body, 'drop', mkDT([['x.pdf', 'application/pdf', '%PDF-']]));
  out.strayDropPrevented = stray.defaultPrevented;
  const strayOver = fire(document.body, 'dragover', mkDT([['x.pdf', 'application/pdf', '%PDF-']]));
  out.strayDragoverPrevented = strayOver.defaultPrevented;

  // --- 2. dragleave onto a CHILD must not clear the highlight
  const child = pdfZone.querySelector('button') || pdfZone.firstElementChild;
  out.childFound = !!child;
  fire(pdfZone, 'dragenter', mkDT([['a.pdf', 'application/pdf', '%PDF-']]));
  out.highlightOnEnter = pdfZone.classList.contains('drag');
  fire(child, 'dragenter', mkDT([['a.pdf', 'application/pdf', '%PDF-']]));   // into the button
  fire(pdfZone, 'dragleave', mkDT([['a.pdf', 'application/pdf', '%PDF-']])); // out of the parent
  out.highlightSurvivesChild = pdfZone.classList.contains('drag');
  // and a real leave must clear it
  fire(pdfZone, 'dragleave', mkDT([['a.pdf', 'application/pdf', '%PDF-']]));
  out.highlightClearsOnRealLeave = !pdfZone.classList.contains('drag');

  // --- 3. a file the picker would reject must be refused, with an explanation
  const st = document.querySelector('#pdf-status');
  st.innerHTML = '';
  fire(pdfZone, 'drop', mkDT([['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK']]));
  await new Promise(r => setTimeout(r, 200));
  out.wrongTypeMessage = (st.textContent || '').trim().slice(0, 120);
  out.wrongTypeRefused = /cannot be read here/i.test(st.textContent || '');

  // --- 4. dragover on the ZONE must be preventDefault'd, or the browser
  //        refuses the drop entirely. This is the observable half.
  //
  //        The code also sets dataTransfer.dropEffect = "copy" for the cursor
  //        affordance, and that is NOT assertable here: Chromium only honours
  //        dropEffect during a real drag, so on a synthetic DataTransfer a
  //        plain assignment reads back "none" even outside any handler.
  //        Probed directly before writing this off — before/after a bare
  //        `dt.dropEffect = "copy"` are both "none". Unobservable, not absent.
  const dt4 = mkDT([['a.pdf', 'application/pdf', '%PDF-']]);
  const ev4 = fire(pdfZone, 'dragover', dt4);
  out.zoneDragoverPrevented = ev4.defaultPrevented;
  out.dropEffectObservable = dt4.dropEffect !== 'none';

  return out;
});

await b.close();

const checks = [
  ['drop zone found and registered',            r.zoneFound && r.hasDropzoneAttr],
  ['1. stray DROP on document is cancelled',    r.strayDropPrevented],
  ['1. stray DRAGOVER is cancelled',            r.strayDragoverPrevented],
  ['2. highlight appears on dragenter',         r.highlightOnEnter],
  ['2. highlight SURVIVES crossing a child',    r.highlightSurvivesChild],
  ['2. highlight clears on a real leave',       r.highlightClearsOnRealLeave],
  ['3. wrong file type refused with a message', r.wrongTypeRefused],
  ['4. dragover on the zone is preventDefault-ed', r.zoneDragoverPrevented],
];
console.log('DRAG AND DROP — ' + checks.length + ' checks');
let bad = 0;
for (const [name, ok] of checks) { if (!ok) bad++; console.log('  ' + (ok ? 'PASS  ' : 'FAIL  ') + name); }
console.log('');
console.log('  message shown on a .docx drop: "' + r.wrongTypeMessage + '"');
console.log('  dropEffect observable in a synthetic event: ' + r.dropEffectObservable +
  '   (expected false — set in code, unassertable here)');
console.log('  page errors: ' + errs.length);
errs.slice(0, 3).forEach(e => console.log('    ' + e));
console.log('');
console.log(bad === 0 ? 'RESULT: PASS — ' + checks.length + '/' + checks.length
                      : 'RESULT: FAIL — ' + bad + ' of ' + checks.length);
process.exit(bad === 0 ? 0 : 1);
