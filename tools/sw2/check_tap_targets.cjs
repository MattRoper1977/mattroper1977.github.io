/**
 * SW2 T4 — 44px tap targets on pupil surfaces, at 390px, in BOTH chrome states.
 *
 * The pupil surfaces are read from data/adult-surfaces.json rather than typed
 * here, so adding one cannot quietly escape the gate.
 *
 * "Both states" is the nav disclosure: the header carries details.mbm-nav-more,
 * and its controls only exist once it is open. Measuring the closed page alone
 * would measure roughly half the navigation and report a pass over the half it
 * never saw. Each surface is therefore loaded twice, and every control found in
 * either state must clear 44x44.
 *
 * WHAT COUNTS AS A CONTROL, and the one exemption
 * -----------------------------------------------
 * Every visible a/button/input/select/summary/[role=button]/[tabindex] -- with
 * one exemption, which is WCAG 2.5.8's own: an anchor laid out INLINE inside a
 * run of text. A link in a sentence cannot be 44px tall without setting the
 * line-height of the prose around it, and padding it to 44px would overlap the
 * lines above and below.
 *
 * The test is layout and prose, not tag names. An anchor is exempt when its
 * computed display is inline AND its parent has PROSE OF ITS OWN around it --
 * measured as direct child text nodes, not descendant text. Both halves earn
 * their place:
 *
 *   direct text nodes, not textContent   a <nav> holding six links has plenty
 *     of descendant text and no prose; keying on textContent would exempt
 *     every navigation link in the estate.
 *   layout, not a tag whitelist          the first version of this gate
 *     whitelisted p/li/small/span/td/dd/figcaption and duly failed
 *     <div class="contact">Questions, ideas or bug reports -- <a>…</a></div>
 *     on /games/ while exempting the identical construction one element above
 *     it, whose only difference was a <p>. That was the gate being wrong about
 *     the page, not the page being wrong.
 *
 * A nav link, a button, or a link that is its own block gets no exemption.
 *
 * Exempted elements are COUNTED and printed, never silently dropped, so the
 * size of the exemption is visible in the same output as the pass.
 *
 *   node tools/sw2/check_tap_targets.cjs --origin http://127.0.0.1:PORT
 *   node tools/sw2/check_tap_targets.cjs --origin ... --min 48   # red proof
 */
const { createRequire } = require('module');
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright')('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WIDTH = 390;
const HEIGHT = 844;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function surfaces() {
  const record = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'adult-surfaces.json'), 'utf8'));
  return record.pupilReachableSurfaces
    .map((e) => String(e.page))
    .filter((p) => fs.existsSync(path.join(ROOT, p)))
    .map((p) => '/' + p.replace(/index\.html$/, ''));
}

const MEASURE = (min) => {
  const SEL = 'a[href], button, input, select, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
  const out = { small: [], exempt: [], counted: 0 };
  for (const el of document.querySelectorAll(SEL)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;

    const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const id = el.tagName.toLowerCase()
      + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '')
      + (label ? ` "${label}"` : '');

    // WCAG 2.5.8's inline-in-text exemption, narrowly: inline display, and the
    // parent's OWN text around it (direct child text nodes only).
    const parent = el.parentElement;
    const prose = parent
      ? [...parent.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join('').length
      : 0;
    const inlineInText = el.tagName === 'A' && cs.display === 'inline' && prose > 0;
    if (inlineInText) { out.exempt.push(id); continue; }

    out.counted++;
    if (r.width + 0.5 < min || r.height + 0.5 < min) {
      out.small.push(`${id} — ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
    }
  }
  return out;
};

(async () => {
  const origin = arg('--origin', 'http://127.0.0.1:4911').replace(/\/$/, '');
  const min = Number(arg('--min', '44'));

  const browser = await chromium.launch();
  const problems = [];
  let counted = 0;
  let exempted = 0;

  for (const route of surfaces()) {
    for (const state of ['closed', 'open']) {
      const context = await browser.newContext({
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 30000 });

      let opened = 0;
      if (state === 'open') {
        opened = await page.evaluate(() => {
          let n = 0;
          for (const d of document.querySelectorAll('details')) { if (!d.open) { d.open = true; n++; } }
          for (const b of document.querySelectorAll('button.menu, .menu button, [aria-expanded="false"]')) {
            try { b.click(); n++; } catch (e) { /* not clickable in this state */ }
          }
          return n;
        });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      }

      const found = await page.evaluate(MEASURE, min);
      counted += found.counted;
      exempted += found.exempt.length;
      const tag = `${route} [${state}${state === 'open' ? ` +${opened}` : ''}]`;
      console.log(`  ${tag.padEnd(30)} ${String(found.counted).padStart(3)} controls, `
        + `${String(found.exempt.length).padStart(2)} inline-in-text exempt, `
        + `${found.small.length} under ${min}px`);
      for (const s of found.small) problems.push(`${tag} ${s}`);
      if (found.exempt.length) console.log(`      exempt: ${found.exempt.join(' | ').slice(0, 150)}`);
      await context.close();
    }
  }

  await browser.close();

  console.log(`\ntap targets at ${WIDTH}px: ${counted} controls measured, ${exempted} exempt, minimum ${min}px`);
  if (problems.length) {
    console.error(`\nPROBLEMS: ${problems.length}`);
    for (const p of problems.slice(0, 30)) console.error('  ' + p);
    if (problems.length > 30) console.error(`  … and ${problems.length - 30} more`);
    process.exit(1);
  }
  console.log(`every control on every pupil surface clears ${min}x${min} in both chrome states`);
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(2); });
