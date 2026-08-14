import fs from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { IDBFactory as FDBFactory, IDBKeyRange as FDBKeyRange } from "fake-indexeddb";

// GATE: every page number the folder index prints must be the page that item is
// actually printed on. Seed shape matters — a 2-item portfolio passes vacuously,
// so this seeds 3 photo plates + 5 short witness slips, which straddles three
// weighted pages and is the shape that exposed the defect.
const SRC = process.argv[2];
const raw = fs.readFileSync(SRC, "utf8");
const appScript = raw.match(/<script>\n"use strict";([\s\S]*?)<\/script>/)[0].replace(/^<script>|<\/script>$/g, "");
const html = raw.replace(appScript, "");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(String(e.message || e)));
vc.on("error", (...a) => errors.push(a.map(String).join(" ")));

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://madebymatt.uk/asdan/moderation-lab/", virtualConsole: vc });
const w = dom.window;
w.indexedDB = new FDBFactory(); w.IDBKeyRange = FDBKeyRange;
try { Object.defineProperty(w, "crypto", { value: globalThis.crypto, configurable: true }); } catch (e) {}
w.structuredClone = globalThis.structuredClone;
w.URL.createObjectURL = () => "blob:stub"; w.URL.revokeObjectURL = () => {};
w.matchMedia = w.matchMedia || (q => ({ matches: false, media: q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
w.print = () => {}; w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
if (!w.navigator.storage) Object.defineProperty(w.navigator, "storage", { value: { estimate: async () => ({ usage: 1, quota: 5e8 }) } });
const ctxStub = new Proxy({ canvas: { width: 100, height: 100 }, measureText: () => ({ width: 4 }) }, { get: (t, k) => (k in t ? t[k] : () => {}) });
w.HTMLCanvasElement.prototype.getContext = function () { ctxStub.canvas = this; return ctxStub; };
w.HTMLCanvasElement.prototype.toBlob = function (cb, type) { cb(new w.Blob(["x".repeat(512)], { type: type || "image/webp" })); };
// strict-mode eval keeps declarations local, so append a probe inside the same
// scope — this lets the identical gate run against a build that exposes nothing
const probe = `;window.__PACK={buildEvidencePages:typeof buildEvidencePages==="function"?buildEvidencePages:null,buildIndexPage:typeof buildIndexPage==="function"?buildIndexPage:null,evidencePlateItems:typeof evidencePlateItems==="function"?evidencePlateItems:null};`;
w.eval(appScript + probe);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const t = (n, f) => {
  try {
    const r = f();
    if (r && typeof r === "object" && "ok" in r) out.push([r.ok ? "PASS" : "FAIL", n, r.detail || ""]);
    else out.push([r === false ? "FAIL" : "PASS", n, r === true ? "" : String(r)]);
  } catch (e) { out.push(["FAIL", n, e.message]); }
};

(async () => {
  for (let i = 0; i < 120 && !w.ASDAN_TEST; i++) await sleep(50);
  const API = w.ASDAN_TEST; if (!API) { console.log("BOOT FAIL"); process.exit(1); }
  const S = API.state;
  const prog = S.programmes[0];
  const pup = S.pupils.find(p => S.enrolments.some(e => e.programId === prog.id && e.pupilId === p.id)) || S.pupils[0];
  const target = (S.programmes[0].modules?.[0]?.challenges?.[0]?.id) || (S.programmes[0].criteria?.[0]?.id) || "";

  // --- the seed that matters: 3 photo plates + 5 SHORT witness slips ---------
  S.evidenceLinks.length = 0; S.witnessStatements.length = 0;
  const code = "GATE";
  for (let i = 1; i <= 3; i++) S.evidenceLinks.push({ id: `ev${i}`, assetId: "asset-demo-worksheet", ref: `${code}-P${i}`, pupilId: pup.id, programId: prog.id, targetId: target, evidenceType: "photo", caption: `plate ${i}`, date: "2026-08-14", assessorInitials: "MR", createdAt: new Date().toISOString() });
  for (let i = 1; i <= 5; i++) S.witnessStatements.push({ id: `ws${i}`, ref: `${code}-W${i}`, pupilId: pup.id, programId: prog.id, targetId: target, text: `Short witness slip ${i}.`, date: "2026-08-14", createdAt: new Date().toISOString() });

  const START = 7;
  // reach the functions in the page realm so the SAME gate runs against a build
  // that does not expose them on the test surface (the pre-fix control)
  const P = w.__PACK || {};
  const buildEvidencePages = P.buildEvidencePages, buildIndexPage = P.buildIndexPage, evidencePlateItems = P.evidencePlateItems;
  if (!buildEvidencePages || !buildIndexPage) { console.log("cannot reach pack builders in this build"); process.exit(1); }
  const plates = evidencePlateItems ? evidencePlateItems(prog, pup) : null;
  const pages = await buildEvidencePages(prog, pup);

  t("seed shape straddles multiple weighted pages", () => ({ ok: pages.length >= 3, detail: pages.length >= 3 ? `${pages.length} appendix pages from 3 photos + 5 slips` : `only ${pages.length} page(s) — seed too small, gate would be vacuous` }));

  // where is each ref ACTUALLY printed?
  const actual = new Map();
  pages.forEach((p, gi) => {
    const found = String(p.body).match(/GATE-[PW]\d/g) || [];
    [...new Set(found)].forEach(ref => { if (!actual.has(ref)) actual.set(ref, START + gi); });
  });
  t("every seeded item is printed somewhere", () => ({ ok: actual.size === 8, detail: `${actual.size}/8 printed` }));

  // what does the index CLAIM?
  const indexPage = buildIndexPage(prog, pup, START);
  const body = String(indexPage.body);
  const tbody = body.slice(body.indexOf("<tbody>"), body.indexOf("</tbody>"));
  const claimed = new Map();
  (tbody.match(/<tr>[\s\S]*?<\/tr>/g) || []).forEach(row => {
    const ref = (row.match(/<b>(GATE-[PW]\d)<\/b>/) || [])[1];
    const cells = row.match(/<td>([^<]*)<\/td>/g) || [];
    const pageCell = cells[cells.length - 2];
    if (ref) claimed.set(ref, (pageCell || "").replace(/<\/?td>/g, "").trim());
  });
  t("index lists every seeded item", () => ({ ok: claimed.size === 8, detail: `${claimed.size}/8 rows` }));

  const wrong = [];
  for (const [ref, page] of claimed) {
    const real = actual.get(ref);
    if (String(page) !== String(real)) wrong.push(`${ref}: index says p${page}, printed on p${real}`);
  }
  const totalPages = 6 + pages.length;
  const overrun = [...claimed.values()].filter(p => Number(p) > totalPages);

  t("INDEX POINTS AT THE RIGHT PLATE", () => ({ ok: wrong.length === 0, detail: wrong.length === 0 ? "8/8 references correct" : `${wrong.length} of 8 WRONG → ${wrong.join(" · ")}` }));
  t("no index row cites a page beyond the pack", () => ({ ok: overrun.length === 0, detail: overrun.length === 0 ? `max cited ${Math.max(...[...claimed.values()].map(Number))} of ${totalPages}` : `cites p${overrun.join(",")} in a ${totalPages}-page pack` }));
  t("index order equals folder order", () => {
    if (!plates) return { ok: false, detail: "no single ordered source of truth in this build" };
    const idxOrder = [...claimed.keys()].join(",");
    const plateOrder = plates.map(p => p.ref).join(",");
    return { ok: idxOrder === plateOrder, detail: idxOrder === plateOrder ? "identical" : `index [${idxOrder}] vs folder [${plateOrder}]` };
  });

  console.log(out.map(([s, n, d]) => `${s === "PASS" ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`).join("\n"));
  const f = out.filter(x => x[0] === "FAIL").length;
  console.log(`\n${out.length - f}/${out.length} passed`);
  if (errors.length) console.log("errors: " + [...new Set(errors)].slice(0, 5).join(" | "));
  process.exit(f ? 1 : 0);
})();
