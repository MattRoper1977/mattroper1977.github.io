#!/usr/bin/env python3
"""One-shot source patch for measured site/runtime defects.

Sentinel: mbm-full-repair-upgrade-2026-08-07

The trusted full-estate workflow executes this patch, proves the changed files,
commits them to the authorised branch, and this transport is then removed.
The patch is idempotent because a PR synchronisation reruns the workflow after
the resulting source commit.
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

SAVE05_CONTROL_SHA = "44e2ca04cd39e26a91de0c61f925c690d12ceaf0"
SAVE05_CONTROL_PATH = Path("/tmp/ouroboros-save05-array-control.html")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new)


def write_save05_control(root: Path) -> None:
    """Freeze the exact merged build the readback found, even on reruns.

    Copying the current branch before patching works once, then becomes a fixed
    copy after the workflow commits and reruns. Reading the measured close SHA
    makes the negative control stable and prevents a green fix from erasing the
    defect that proves the verifier is capable of firing.
    """
    proc = subprocess.run(
        ["git", "-C", str(root), "show", f"{SAVE05_CONTROL_SHA}:ouroboros/index.html"],
        check=True,
        capture_output=True,
    )
    SAVE05_CONTROL_PATH.write_bytes(proc.stdout)


def patch_features(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "function probeRemoteCounters()" in text:
        return False

    text = replace_once(
        text,
        '      enabled: true, namespace: "madebymatt-uk", geo: true,',
        '      enabled: true, remoteCounters: false, namespace: "madebymatt-uk", geo: true,',
        "counter configuration",
    )
    text = replace_once(
        text,
        '''  var API = "https://api.counterapi.dev/v1/";
  function safeKey(k) { return String(k).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
''',
        '''  var API = "https://api.counterapi.dev/v1/";
  var counterProbe = null;
  var counterRemoteAvailable = null;
  function safeKey(k) { return String(k).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }

  /* CounterAPI began returning a browser challenge instead of JSON. The old
     implementation issued one failing request per displayed counter, creating
     a console/request storm on every page. Remote counters are therefore
     opt-in. If explicitly enabled, one shared probe establishes capability;
     one failed probe opens the circuit and every counter uses the existing
     device-local fallback without another network request. */
  function remoteCountersEnabled() {
    return !!(CFG.stats && CFG.stats.remoteCounters === true);
  }
  function probeRemoteCounters() {
    if (!remoteCountersEnabled()) return Promise.resolve(false);
    if (counterRemoteAvailable === true) return Promise.resolve(true);
    if (counterRemoteAvailable === false) return Promise.resolve(false);
    if (!counterProbe) {
      var probeKey = safeKey((CFG.stats && CFG.stats.visitKey) || "visits_total");
      counterProbe = timedJSON(API + CFG.stats.namespace + "/" + probeKey, 4000)
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
    count = text.count("return timedJSON(API + CFG.stats.namespace +")
    if count != 2:
        raise SystemExit(f"counter call replacement: expected two calls, found {count}")
    text = text.replace(
        "return timedJSON(API + CFG.stats.namespace +",
        "return counterJSON(API + CFG.stats.namespace +",
    )
    path.write_text(text, encoding="utf-8")
    return True


def patch_runtime(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "async function activateVisibleControl" in text:
        return False

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
    return True


def patch_ouroboros(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "if(Array.isArray(outVal))" in text:
        return False

    text = replace_once(
        text,
        '''       default it shadows, so a non-finite value can neither reach state nor be
       round-tripped into null on the next autosave. */
    const finiteMerge=(baseVal,inVal)=>{
      if(typeof baseVal==="number") return (typeof inVal==="number"&&Number.isFinite(inVal))?inVal:baseVal;
      return inVal===undefined?baseVal:inVal;
    };
    const sanitiseNumbers=(baseObj,outObj)=>{
      if(!outObj||typeof outObj!=="object")return outObj;
      for(const k of Object.keys(outObj)){
        const bv=baseObj?baseObj[k]:undefined, ov=outObj[k];
        if(ov&&typeof ov==="object"&&!Array.isArray(ov)) sanitiseNumbers(bv,ov);
        else if(typeof ov==="number"&&!Number.isFinite(ov)) outObj[k]=(typeof bv==="number")?bv:0;
      }
      return outObj;
    };
''',
        '''       default it shadows, so a non-finite value can neither reach state nor be
       round-tripped into null on the next autosave. This includes values nested inside arrays:
       JSON arrays can contain `1e999` too, and the first repair's object-only
       walk skipped them. */
    const sanitiseNumbers=(baseVal,outVal)=>{
      if(typeof outVal==="number") return Number.isFinite(outVal)?outVal:(typeof baseVal==="number"?baseVal:0);
      if(Array.isArray(outVal)){
        const baseArray=Array.isArray(baseVal)?baseVal:[];
        for(let i=0;i<outVal.length;i++) outVal[i]=sanitiseNumbers(baseArray[i],outVal[i]);
        return outVal;
      }
      if(outVal&&typeof outVal==="object"){
        const baseObject=(baseVal&&typeof baseVal==="object"&&!Array.isArray(baseVal))?baseVal:{};
        for(const k of Object.keys(outVal)) outVal[k]=sanitiseNumbers(baseObject[k],outVal[k]);
      }
      return outVal;
    };
''',
        "Ouroboros SAVE-05 recursive numeric sanitiser",
    )
    path.write_text(text, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()
    root = args.root.resolve()
    write_save05_control(root)
    changed = {
        "features": patch_features(root / "assets/mbm-features.js"),
        "runtime": patch_runtime(root / "tools/full_estate_runtime.mjs"),
        "ouroboros": patch_ouroboros(root / "ouroboros/index.html"),
    }
    print("patch result:", changed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
