import { chromium } from 'playwright';

const base = (process.env.MBM_BASE_URL || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const pageUrl = new URL('/main/', base).href;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const evidence = { pageUrl, responses: [], failed: [], console: [], pageErrors: [] };
page.on('response', response => {
  if (response.status() >= 400) {
    const request = response.request();
    evidence.responses.push({ status: response.status(), url: response.url(), resourceType: request.resourceType(), initiator: request.frame()?.url() || '' });
  }
});
page.on('requestfailed', request => evidence.failed.push({ url: request.url(), resourceType: request.resourceType(), failure: request.failure()?.errorText || '' }));
page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning') evidence.console.push({ type: message.type(), text: message.text(), location: message.location() });
});
page.on('pageerror', error => evidence.pageErrors.push(String(error)));
const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1000);
evidence.documentStatus = response?.status() || 0;
evidence.finalUrl = page.url();
evidence.title = await page.title();
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
