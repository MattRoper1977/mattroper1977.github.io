#!/usr/bin/env python3
"""One-shot source patch for measured site/runtime defects.

Sentinel: mbm-full-repair-upgrade-2026-08-07

The trusted full-estate workflow executes this patch, proves the changed files,
commits them to the authorised branch, and this transport is then removed.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new)


def patch_features(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        'stats: { enabled: true, namespace: "madebymatt-uk", visitKey: "visits_total" },',
        'stats: { enabled: true, remoteCounters: false, namespace: "madebymatt-uk", visitKey: "visits_total" },',
        "counter configuration",
    )
    text = replace_once(
        text,
        '''  // keyless CounterAPI.dev v1 — shared by visits and per-door/download counts
  var API = "https://api.counterapi.dev/v1/" + encodeURIComponent(CFG.stats.namespace) + "/";
''',
        '''  // CounterAPI currently presents a browser challenge. Remote counters are
  // therefore opt-in; the existing on-device fallback remains the reliable default.
  var API = "https://api.counterapi.dev/v1/" + encodeURIComponent(CFG.stats.namespace) + "/";
  var counterProbe = null;
  var counterRemoteAvailable = null;

  function remoteCountersEnabled() {
    return !!(CFG.stats && CFG.stats.remoteCounters === true);
  }

  function probeRemoteCounters() {
    if (!remoteCountersEnabled()) return Promise.resolve(false);
    if (counterRemoteAvailable === true) return Promise.resolve(true);
    if (counterRemoteAvailable === false) return Promise.resolve(false);
    if (!counterProbe) {
      var probeKey = encodeURIComponent((CFG.stats && CFG.stats.visitKey) || "visits_total");
      counterProbe = timedJSON(API + probeKey, 4000)
        .then(function (data) {
          if (pluckCount(data) == null) throw new Error("counter probe payload invalid");
          counterRemoteAvailable = true;
          return true;
        })
        .catch(function () {
          counterRemoteAvailable = false;
          return false;
        });
    }
    return counterProbe;
  }

  function counterJSON(url) {
    return probeRemoteCounters()
      .then(function (available) {
        if (!available) throw new Error("remote counters disabled or unavailable");
        return timedJSON(url, 6000);
      })
      .catch(function (error) {
        counterRemoteAvailable = false;
        throw error;
      });
  }
''',
        "counter circuit breaker",
    )
    count = text.count("return timedJSON(API +")
    if count != 2:
        raise SystemExit(f"counter call replacement: expected two calls, found {count}")
    text = text.replace("return timedJSON(API +", "return counterJSON(API +")
    path.write_text(text, encoding="utf-8")


def patch_runtime(path: Path) -> None:
    text = path.read_text(encoding="utf-8")

    insertion = '''
async function activateVisibleControl(page, includeSource, excludeSource = '') {
  return page.evaluate(({ includeSource, excludeSource }) => {
    const include = new RegExp(includeSource, 'i');
    const exclude = excludeSource ? new RegExp(excludeSource, 'i') : null;
    const visible = el => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const actionable = el => {
      if (!visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      const rect = el.getBoundingClientRect();
      const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const hit = document.elementFromPoint(x, y);
      return hit === el || (hit && el.contains(hit));
    };
    const controls = [...document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')];
    for (const el of controls) {
      if (!actionable(el)) continue;
      const label = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''} ${el.value || ''}`.trim();
      if (include.test(label) && !(exclude && exclude.test(label))) {
        el.click();
        return { clicked: true, label: label.slice(0, 120) };
      }
    }
    return { clicked: false, label: '' };
  }, { includeSource, excludeSource });
}
'''
    text = replace_once(
        text,
        "async function collectPageBody(browser, item, baseUrl, lifecycle) {",
        insertion + "\nasync function collectPageBody(browser, item, baseUrl, lifecycle) {",
        "runtime control helper insertion",
    )

    text = replace_once(
        text,
        '''        const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')]
          .filter(visible)
          .map(el => {
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80) };
          });
''',
        '''        const actionable = el => {
          if (!visible(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
          const r = el.getBoundingClientRect();
          const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
          const y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
          const hit = document.elementFromPoint(x, y);
          return hit === el || (hit && el.contains(hit));
        };
        const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')]
          .filter(actionable)
          .map(el => {
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80) };
          });
''',
        "runtime actionable metrics",
    )

    text = replace_once(
        text,
        '''      try {
        const candidates = page.locator('button:visible, [role="button"]:visible, input[type="button"]:visible, input[type="submit"]:visible');
        const count = await candidates.count();
        let clicked = false;
        for (let i = 0; i < Math.min(count, 40); i++) {
          const el = candidates.nth(i);
          const label = `${await el.getAttribute('aria-label') || ''} ${await el.textContent().catch(() => '') || ''} ${await el.getAttribute('value') || ''}`.trim();
          if (/\\b(start|play|begin|continue|enter|launch|skip)\\b/i.test(label) && !/trailer|video|youtube/i.test(label)) {
            await el.click({ timeout: 3000 }).catch(() => {});
            clicked = true;
            observations.push({ code: 'START_CONTROL', label: label.slice(0, 120) });
            await page.waitForTimeout(600);
            break;
          }
        }
        if (!clicked) observations.push({ code: 'NO_START_CONTROL', message: 'no visible safe start/play control was derived' });
      } catch (error) {
''',
        '''      try {
        const control = await activateVisibleControl(page, '\\b(start|play|begin|continue|enter|launch|skip)\\b', 'trailer|video|youtube');
        if (control.clicked) {
          observations.push({ code: 'START_CONTROL', label: control.label });
          await page.waitForTimeout(600);
        } else {
          observations.push({ code: 'NO_START_CONTROL', message: 'no topmost safe start/play control was derived' });
        }
      } catch (error) {
''',
        "runtime start-control probe",
    )

    text = replace_once(
        text,
        '''      try {
        const candidates = page.locator('button:visible, [role="button"]:visible, input[type="button"]:visible');
        const count = await candidates.count();
        for (let i = 0; i < Math.min(count, 40); i++) {
          const el = candidates.nth(i);
          const label = `${await el.getAttribute('aria-label') || ''} ${await el.textContent().catch(() => '') || ''} ${await el.getAttribute('value') || ''}`.trim();
          if (/\\b(restart|retry|reset|again|new game)\\b/i.test(label)) {
            await el.click({ timeout: 2500 }).catch(() => {});
            observations.push({ code: 'RESTART_CONTROL', label: label.slice(0, 120) });
            await page.waitForTimeout(350);
            break;
          }
        }
      } catch (error) {
''',
        '''      try {
        const control = await activateVisibleControl(page, '\\b(restart|retry|reset|again|new game)\\b');
        if (control.clicked) {
          observations.push({ code: 'RESTART_CONTROL', label: control.label });
          await page.waitForTimeout(350);
        }
      } catch (error) {
''',
        "runtime restart-control probe",
    )
    path.write_text(text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    root = args.root.resolve()
    patch_features(root / "assets/mbm-features.js")
    patch_runtime(root / "tools/full_estate_runtime.mjs")
    print("patched counter circuit breaker and one-shot actionable control probes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
