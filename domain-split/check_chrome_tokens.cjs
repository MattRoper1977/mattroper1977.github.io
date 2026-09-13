'use strict';
// Shared by the real publication browser gate and its focused local proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const canonicalCSS = fs.readFileSync(path.join(__dirname, '../assets/mbm-tokens.css'), 'utf8');
const names = [...new Set([...canonicalCSS.matchAll(/(--mbm-[a-z0-9-]+)\s*:/g)].map(m => m[1]))].sort();
const pairs = [];
for (const ink of names.filter(n => n.endsWith('-ink'))) {
  const stem = ink.slice(0, -4);
  const surface = [stem, stem + '-bg'].find(n => names.includes(n));
  assert(surface, 'Token ink has no paired surface: ' + ink);
  pairs.push([ink, surface]);
}
for (const surface of ['--mbm-bg', '--mbm-card', '--mbm-card-raised']) {
  for (const ink of ['--mbm-primary', '--mbm-accent']) pairs.push([ink, surface]);
}
assert(names.length > 0 && pairs.length > 0, 'Empty token census');

async function resolvedTokens(page) {
  return page.evaluate(names => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map(name => [name, style.getPropertyValue(name).trim()]));
  }, names);
}

async function tokenReference(browser) {
  const context = await browser.newContext({colorScheme: 'light', contrast: 'no-preference'});
  try {
    const page = await context.newPage();
    await page.setContent('<style>' + canonicalCSS + '</style>');
    const expected = await resolvedTokens(page);
    assert(Object.values(expected).every(Boolean), 'Canonical tokens must all resolve');
    return expected;
  } finally { await context.close(); }
}

async function assertChrome(page, route, expected) {
  const evidence = await page.evaluate(() => {
    const links = [...document.querySelectorAll('link[rel~="stylesheet"]')]
      .map(el => el.getAttribute('href'))
      .filter(href => new URL(href, location.href).pathname.split('/').pop() === 'mbm-tokens.css');
    const body = document.body.cloneNode(true);
    for (const el of body.querySelectorAll('script,style,template')) el.remove();
    const count = text => (text.match(/Learn\s*•\s*Build\s*•\s*Explore/g) || []).length;
    return {links, taglines: {
      all: count(body.textContent),
      header: [...body.querySelectorAll('header')].reduce((n, el) => n + count(el.textContent), 0),
      footer: [...body.querySelectorAll('footer')].reduce((n, el) => n + count(el.textContent), 0),
    }};
  });
  assert.deepEqual(evidence.links, ['/assets/mbm-tokens.css'], 'One origin-root token link: ' + route);
  assert.deepEqual(evidence.taglines, {all: 1, header: 0, footer: 1}, 'One footer-only tagline: ' + route);
  assert.deepEqual(await resolvedTokens(page), expected, 'Computed token census: ' + route);
  return evidence;
}

function contrast(a, b) {
  const luminance = value => {
    const channels = value.match(/[\d.]+/g).map(Number);
    assert(channels.length === 3 || channels.length === 4 && channels[3] === 1, 'Opaque computed colour: ' + value);
    const [r, g, b] = channels.slice(0, 3).map(n => {
      n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
    });
    return .2126*r + .7152*g + .0722*b;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

async function assertPalette(page, label) {
  const rows = await page.evaluate(pairs => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;left:-10000px;top:0';
    document.body.append(probe);
    try {
      return pairs.map(([ink, surface]) => {
        probe.style.color = 'var(' + ink + ')';
        probe.style.backgroundColor = 'var(' + surface + ')';
        const style = getComputedStyle(probe);
        return {ink, surface, foreground: style.color, background: style.backgroundColor};
      });
    } finally { probe.remove(); }
  }, pairs);
  for (const row of rows) {
    row.ratio = contrast(row.foreground, row.background);
    assert(row.ratio >= 4.5, 'Token contrast ' + label + ': ' + JSON.stringify(row));
  }
  return {label, pairs: rows.length, minimum: Math.min(...rows.map(r => r.ratio)), rows};
}

async function proveChromeControls(page, origin, expected) {
  await page.goto(origin + '/stats/');
  await assertChrome(page, '/stats/', expected);
  await page.locator('link[href="/assets/mbm-tokens.css"]').evaluate(el => el.remove());
  await assert.rejects(() => assertChrome(page, '/stats/', expected), /One origin-root token link/);
  assert.notDeepEqual(await resolvedTokens(page), expected, 'Unlinking must change the computed census');
  await page.reload();
  await assertChrome(page, '/stats/', expected);
  await page.locator('[data-mbm-navigation="education"]').evaluate(el => {
    el.append(document.createTextNode('Learn • Build • Explore'));
  });
  await assert.rejects(() => assertChrome(page, '/stats/', expected), /One footer-only tagline/);
  await page.reload();
  await assertChrome(page, '/stats/', expected);
  const palettes = [];
  for (const theme of ['cream', 'dark']) for (const preference of ['no-preference', 'more']) {
    await page.emulateMedia({contrast: preference});
    await page.locator('html').evaluate((el, theme) => el.setAttribute('data-theme', theme), theme);
    palettes.push(await assertPalette(page, theme + '/' + preference));
  }
  // Reproduce the original dark + increased-contrast bug in the cascade.
  const planted = await page.addStyleTag({content: ':root{--mbm-primary' + ':#0B1020!important}'});
  await assert.rejects(() => assertPalette(page, 'planted dark/more'), /Token contrast/);
  await planted.evaluate(el => el.remove());
  await assertPalette(page, 'restored dark/more');
  await page.emulateMedia({contrast: 'no-preference'});
  await page.reload();
  await assertChrome(page, '/stats/', expected);
  console.log('PASS chrome tokens: ' + names.length + ' computed tokens; ' +
    palettes.reduce((n, p) => n + p.pairs, 0) + ' pairs in four browser palettes; ' +
    'unlinked tokens, duplicate/header tagline and dark/contrast mutations rejected and restored');
  return palettes;
}

module.exports = {assertChrome, tokenReference, proveChromeControls};
