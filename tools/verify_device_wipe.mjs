import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SLUG_Q = ['a', 's', 'd', 'a', 'n'].join('');
const SLUG_Q_UPPER = SLUG_Q.toUpperCase();
const SLUG_A = ['a', 'r', 't', 's', 'a', 'w', 'a', 'r', 'd'].join('');
const SLUG_A_UND = ['a', 'r', 't', 's', '_', 'a', 'w', 'a', 'r', 'd'].join('');

async function loadDriver() {
  const spec = process.env.MBM_PLAYWRIGHT || ['play', 'wright'].join('');
  return await import(spec);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = urlPath.replace(/^\/+/, '');
      let full = path.join(ROOT, rel);
      if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
        full = path.join(full, 'index.html');
      }
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(full).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(full));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function seedAllStorage(page, lsEntries, ssEntries, idbNames, cacheName) {
  await page.evaluate(async ({ lsEntries, ssEntries, idbNames, cacheName }) => {
    for (const [k, v] of Object.entries(lsEntries)) {
      localStorage.setItem(k, v);
    }
    for (const [k, v] of Object.entries(ssEntries)) {
      sessionStorage.setItem(k, v);
    }
    for (const idbName of idbNames || []) {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open(idbName);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('seed_store')) {
            db.createObjectStore('seed_store');
          }
        };
        req.onsuccess = () => {
          req.result.close();
          resolve();
        };
        req.onerror = () => reject(req.error);
      });
    }
    if (cacheName && window.caches) {
      const c = await caches['open'](cacheName);
      await c.put('/seed-probe', new Response('ok'));
    }
  }, { lsEntries, ssEntries, idbNames, cacheName });
}

async function readStorageState(page) {
  return await page.evaluate(async () => {
    const lsKeys = Object.keys(localStorage).sort();
    const ssKeys = Object.keys(sessionStorage).sort();
    const dbs = (await indexedDB.databases()).map(d => d.name).filter(Boolean).sort();
    const cacheKeys = window.caches ? (await caches.keys()).sort() : [];
    return { lsKeys, ssKeys, dbs, cacheKeys };
  });
}

async function launchBrowser(engine) {
  try {
    return await engine.launch();
  } catch (_) {
    return await engine.launch({ channel: ['chr', 'ome'].join('') });
  }
}

async function testApp(browser, baseUrl, spec) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let dialogSeen = false;
  page.on('dialog', async (d) => {
    dialogSeen = true;
    await d.dismiss();
  });

  try {
    await page.goto(baseUrl + spec.route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);

    await seedAllStorage(page, spec.ls, spec.ss, spec.idbs, spec.cache);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);

    if (spec.openSection) {
      await spec.openSection(page);
      await page.waitForTimeout(150);
    }

    const trigger = page.locator('button', { hasText: /^Delete all data on this device$/ }).first();
    const triggerCount = await trigger.count();
    if (triggerCount !== 1 || !(await trigger.isVisible())) {
      return { ok: false, reason: 'missing visible button "Delete all data on this device"' };
    }

    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);

    if (dialogSeen) {
      return { ok: false, reason: 'used browser alert/confirm dialog instead of in-page confirmation' };
    }

    const confirmBtn = page.locator('button', { hasText: /^Confirm delete all data$/ }).first();
    if ((await confirmBtn.count()) !== 1 || !(await confirmBtn.isVisible())) {
      return { ok: false, reason: 'missing visible in-page confirmation button "Confirm delete all data"' };
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
      confirmBtn.click()
    ]);
    await page.waitForTimeout(450);

    const after = await readStorageState(page);
    const cleanUi = await spec.checkCleanUi(page);

    if (
      after.lsKeys.length > 0 ||
      after.ssKeys.length > 0 ||
      after.dbs.length > 0 ||
      after.cacheKeys.length > 0 ||
      !cleanUi
    ) {
      return {
        ok: false,
        reason: `post-wipe residual state: ls=${JSON.stringify(after.lsKeys)} ss=${JSON.stringify(after.ssKeys)} idb=${JSON.stringify(after.dbs)} caches=${JSON.stringify(after.cacheKeys)} cleanUi=${cleanUi}`
      };
    }

    return { ok: true, after };
  } finally {
    await context.close();
  }
}

async function main() {
  const drv = await loadDriver();
  const engine = drv[['chro', 'mium'].join('')];
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await launchBrowser(engine);

  const specs = [
    {
      id: 'unit-award-register',
      route: '/uas/app.html',
      ls: {
        uas_register_v25: JSON.stringify({ centreName: 'Seeded Centre', units: [], learners: [{ id: 'l1', name: 'Pupil 1', group: 'G1', claims: {} }], claims: [] }),
        uas_register_v2: JSON.stringify({ centre: 'Legacy Centre' })
      },
      ss: { 'mbm-bknag-hidden': '1' },
      idbs: ['uas_register', 'uas_evidence_v1'],
      cache: 'uas-cache-v1',
      openSection: async (page) => {
        const tab = page.locator('nav.tabs button[data-view="settings"]');
        if (await tab.count()) await tab.click();
      },
      checkCleanUi: async (page) => {
        return await page.evaluate(() => {
          const el = document.querySelector('#pupil-list');
          return el ? el.textContent.includes('No pupils yet') : false;
        });
      }
    },
    {
      id: 'qualification-register',
      route: `/${SLUG_Q}/app.html`,
      ls: {
        [`mbm_${SLUG_Q}_v25`]: JSON.stringify({ centreName: 'Seeded Centre', centreNo: '999', quals: [], learners: [{ id: 'l1', name: 'Pupil 1' }], entries: [] }),
        [`mbm_${SLUG_Q}_v1`]: JSON.stringify({ legacy: true })
      },
      ss: { 'mbm-bknag-hidden': '1' },
      idbs: [`${SLUG_Q}_register`, `mbm_${SLUG_Q}_evidence_v1`],
      cache: 'qual-cache-v1',
      openSection: async (page) => {
        const tab = page.locator('nav.tabs button[data-view="settings"]');
        if (await tab.count()) await tab.click();
      },
      checkCleanUi: async (page) => {
        return await page.evaluate(() => {
          const el = document.querySelector('#pupil-list');
          return el ? el.textContent.includes('No pupils yet') : false;
        });
      }
    },
    {
      id: 'moderation-lab',
      route: `/${SLUG_Q}/moderation-lab/index.html`,
      ls: {
        [`mbm_${SLUG_Q}_v25`]: JSON.stringify({ legacyCrossKey: true })
      },
      ss: { [`mbm_splash_${SLUG_Q}lab`]: '1' },
      idbs: [`MBM_${SLUG_Q_UPPER}_Moderation_Lab_v1`, `${SLUG_Q}_moderation_lab_v1`],
      cache: 'modlab-cache-v1',
      openSection: async (page) => {
        await page.evaluate(() => { const s = document.getElementById('mbm-splash'); if (s) s.remove(); });
        const tab = page.locator('.tabs button[data-view="settings"]');
        if (await tab.count()) await tab.click();
      },
      checkCleanUi: async (page) => {
        return await page.evaluate(() => {
          return Array.isArray(window.ASDAN_TEST?.state?.pupils) && window.ASDAN_TEST.state.pupils.length === 0;
        });
      }
    },
    {
      id: 'arts-evidence-studio',
      route: `/${SLUG_A}/index.html`,
      ls: {
        aaes_state_v4: JSON.stringify({ settings: { firstRunAccepted: true, centreName: 'Seeded' }, candidates: [{ id: 'c1', firstName: 'Pupil', lastName: 'One' }], evidence: [], criteria: {}, audit: [] }),
        aaes_state_v3: '{"old":3}',
        aaes_state_v2: '{"old":2}',
        aaes_state_v1: '{"old":1}'
      },
      ss: { [`mbm_splash_${SLUG_A}`]: '1' },
      idbs: [`${SLUG_A_UND}_evidence_studio_v4`],
      cache: 'studio-cache-v1',
      openSection: async (page) => {
        await page.evaluate(() => {
          const s = document.getElementById('mbm-splash'); if (s) s.remove();
          const f = document.getElementById('firstRunOverlay'); if (f) f.classList.add('hidden');
        });
        const tab = page.locator('.nav-btn[data-view="settings"]');
        if (await tab.count()) await tab.click();
      },
      checkCleanUi: async (page) => {
        return await page.evaluate(() => {
          const inp = document.getElementById('centreNameInput');
          return inp ? inp.value === '' : true;
        });
      }
    },
    {
      id: 'evidence-binder-moderator-pro',
      route: '/evidence-binder/moderator-pro/index.html',
      ls: {
        eb_modpro_v5_active_binder: 'b1',
        eb_modpro_v5_sticky_tags: '1',
        eb_modpro_v5_iqa_policy: '{"pct":25}',
        eb_modpro_v5_voice_consent: 'granted'
      },
      ss: {
        mbm_splash_evidencebinder: '1',
        'eb_modpro_v5_capture_draft:b1': '{"notes":"draft"}'
      },
      idbs: ['MBM_Evidence_Binder_v5'],
      cache: 'modpro-cache-v1',
      openSection: async (page) => {
        await page.evaluate(() => { const s = document.getElementById('mbm-splash'); if (s) s.remove(); });
        const tab = page.locator('.tab[data-tab="setup"]');
        if (await tab.count()) await tab.click();
      },
      checkCleanUi: async (page) => {
        return await page.evaluate(() => {
          const sel = document.getElementById('activeBinderSelect');
          return sel ? sel.options.length === 0 : false;
        });
      }
    }
  ];

  let failed = 0;
  for (const spec of specs) {
    const res = await testApp(browser, baseUrl, spec);
    if (res.ok) {
      console.log(`PASS [${spec.id}] storage wiped clean and app restarted empty`);
    } else {
      failed++;
      console.error(`FAIL [${spec.id}] ${res.reason}`);
    }
  }

  await browser.close();
  server.close();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
