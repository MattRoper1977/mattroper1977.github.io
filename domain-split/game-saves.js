(function (root) {
  'use strict';
  const FORMAT = 'madebymatt-game-transfer';
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  function allowedKey(key, rules) {
    if (rules.localStorageExactKeys.includes(key)) return true;
    return rules.localStorageDynamicFamilies.some(f => {
      if (!new RegExp(f.keyRegex).test(key)) return false;
      const n = Number(key.slice(f.prefix.length));
      return Number.isInteger(n) && n >= f.numericSuffixRange[0] && n <= f.numericSuffixRange[1];
    });
  }
  function validate(data, rules) {
    if (!plain(data) || data.format !== FORMAT || data.version !== 1 || !plain(data.localStorage) || !plain(data.sharedProfiles) || !Array.isArray(data.touchline)) throw Error('This is not a supported Made by Matt game-save file.');
    for (const [key, value] of Object.entries(data.localStorage)) {
      if (!allowedKey(key, rules) || typeof value !== 'string' || value.length > 12000000) throw Error('The file contains an unrecognised game-save entry.');
    }
    for (const [key, games] of Object.entries(data.sharedProfiles)) {
      const rule = rules.sharedGameProfileSubtrees.find(r => r.key === key);
      if (!rule || !plain(games) || Object.keys(games).some(k => !rule.gameIds.includes(k))) throw Error('The file contains an unrecognised game profile.');
    }
    const slots = rules.indexedDB[0].stores[0].allowedKeys;
    if (data.touchline.length > slots.length || new Set(data.touchline.map(x => x.slotId)).size !== data.touchline.length) throw Error('Duplicate career slots.');
    for (const value of data.touchline) {
      if (!plain(value) || !slots.includes(value.slotId) || value.format !== 'touchline-dynasty-career' || value.formatVersion !== 2 || !plain(value.state) || !plain(value.integrity)) throw Error('A Touchline career slot is invalid.');
    }
    return data;
  }
  function capture(storage, rules) {
    const data = { format: FORMAT, version: 1, createdAt: new Date().toISOString(), localStorage: {}, sharedProfiles: {}, touchline: [] };
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (allowedKey(key, rules)) data.localStorage[key] = storage.getItem(key);
    }
    for (const rule of rules.sharedGameProfileSubtrees) {
      let value; try { value = JSON.parse(storage.getItem(rule.key) || 'null'); } catch (_) { continue; }
      if (!plain(value) || !plain(value.games)) continue;
      const games = {};
      for (const key of rule.gameIds) if (own(value.games, key)) games[key] = value.games[key];
      if (Object.keys(games).length) data.sharedProfiles[rule.key] = games;
    }
    return data;
  }
  function planImport(storage, data, rules, overwrite) {
    validate(data, rules);
    const writes = [], skipped = [];
    for (const [key, value] of Object.entries(data.localStorage)) {
      const old = storage.getItem(key);
      if (old !== null && !overwrite) { skipped.push(key); continue; }
      writes.push({ key, value, old });
    }
    for (const [key, games] of Object.entries(data.sharedProfiles)) {
      const old = storage.getItem(key);
      let current; try { current = JSON.parse(old || 'null'); } catch (_) {}
      if (old !== null && !plain(current)) throw Error('An existing game profile is unreadable; export it before replacing it.');
      current = current || { version: 6, schema: 6, games: {} };
      if (!plain(current.games)) current.games = {};
      let changed = false;
      for (const [id, value] of Object.entries(games)) {
        if (own(current.games, id) && !overwrite) { skipped.push(key + '/' + id); continue; }
        current.games[id] = value; changed = true;
      }
      if (changed) writes.push({ key, value: JSON.stringify(current), old });
    }
    return { writes, skipped };
  }
  function restore(storage, writes) {
    for (const item of [...writes].reverse()) item.old === null ? storage.removeItem(item.key) : storage.setItem(item.key, item.old);
  }
  function apply(storage, writes) {
    const done = [];
    try { for (const item of writes) { storage.setItem(item.key, item.value); done.push(item); } }
    catch (error) { restore(storage, done); throw error; }
  }
  const api = { allowedKey, validate, capture, planImport, apply, restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  const status = document.getElementById('save-status');
  const exportButton = document.getElementById('save-export');
  const importButton = document.getElementById('save-import');
  const picker = document.getElementById('save-file');
  let rules, candidate;
  function count(data) { return Object.keys(data.localStorage).length + Object.values(data.sharedProfiles).reduce((n, x) => n + Object.keys(x).length, 0) + data.touchline.length; }
  function download(data, prefix) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = prefix + '-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function openCareer(create) {
    if (!root.indexedDB) return null;
    const spec = rules.indexedDB[0];
    if (!create && root.indexedDB.databases) {
      const found = await root.indexedDB.databases();
      if (!found.some(x => x.name === spec.database)) return null;
    }
    return new Promise((resolve, reject) => {
      const request = root.indexedDB.open(spec.database, spec.version);
      let absent = false;
      request.onupgradeneeded = () => {
        if (!create) { absent = true; request.transaction.abort(); return; }
        const store = spec.stores[0];
        if (!request.result.objectStoreNames.contains(store.name)) request.result.createObjectStore(store.name, { keyPath: store.keyPath });
      };
      request.onerror = () => absent ? resolve(null) : reject(request.error);
      request.onblocked = () => reject(Error('Close any open Touchline game tabs and try again.'));
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    });
  }
  async function careers() {
    const db = await openCareer(false); if (!db) return [];
    try {
      const store = rules.indexedDB[0].stores[0];
      if (!db.objectStoreNames.contains(store.name)) return [];
      return await new Promise((resolve, reject) => {
        const request = db.transaction(store.name, 'readonly').objectStore(store.name).getAll();
        request.onsuccess = () => resolve(request.result.filter(x => store.allowedKeys.includes(x.slotId)));
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }
  async function writeCareers(values, overwrite) {
    if (!values.length) return 0;
    const db = await openCareer(true);
    if (!db) throw Error('This browser cannot import Touchline careers.');
    try {
      return await new Promise((resolve, reject) => {
        const spec = rules.indexedDB[0].stores[0], tx = db.transaction(spec.name, 'readwrite'), store = tx.objectStore(spec.name);
        let written = 0;
        for (const value of values) {
          const req = store.get(value.slotId);
          req.onsuccess = () => { if (req.result === undefined || overwrite) { store.put(value); written++; } };
        }
        tx.oncomplete = () => resolve(written);
        tx.onerror = tx.onabort = () => reject(tx.error || Error('Career import failed.'));
      });
    } finally { db.close(); }
  }
  async function snapshot() { const data = capture(root.localStorage, rules); data.touchline = await careers(); return data; }
  fetch('/data/game-storage-allowlist.json').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
    rules = data; exportButton.disabled = false; picker.disabled = false;
    const host = location.hostname;
    const canImport = host === 'madebymatt-play.uk' || host === 'www.madebymatt-play.uk';
    document.getElementById('import-area').hidden = !canImport;
    status.textContent = 'Ready. Nothing is transferred until you choose a button.';
    exportButton.addEventListener('click', async () => {
      exportButton.disabled = true;
      try { const data = await snapshot(); download(data, 'madebymatt-game-saves'); status.textContent = 'Downloaded ' + count(data) + ' game-save entries. Keep this file until your games are working at the new address.'; }
      catch (_) { status.textContent = 'The browser could not read all game saves. Close game tabs and try again; no saved data was changed.'; }
      finally { exportButton.disabled = false; }
    });
    picker.addEventListener('change', async () => {
      candidate = null; importButton.disabled = true;
      try {
        const file = picker.files[0]; if (!file) return;
        if (file.size > 50000000) throw Error('This file is too large. Use the individual game’s export instead.');
        candidate = validate(JSON.parse(await file.text()), rules);
        status.textContent = 'Ready to import ' + count(candidate) + ' game-save entries. Existing saves will be kept unless you choose replacement.';
        importButton.disabled = !canImport;
      } catch (error) { status.textContent = error.message || 'This file could not be read.'; }
    });
    importButton.addEventListener('click', async () => {
      if (!canImport || !candidate) return;
      importButton.disabled = true; let plan, written = false;
      try {
        const overwrite = document.getElementById('save-overwrite').checked;
        // Download an exact game-only recovery copy before any replacement.
        if (overwrite) download(await snapshot(), 'madebymatt-before-import');
        plan = planImport(root.localStorage, candidate, rules, overwrite);
        apply(root.localStorage, plan.writes); written = true;
        const n = await writeCareers(candidate.touchline, overwrite);
        status.textContent = 'Imported ' + (plan.writes.length + n) + ' entries. Existing entries were kept where replacement was not selected. Open your game to check the save.';
        candidate = null; picker.value = '';
      } catch (error) {
        if (written) { try { restore(root.localStorage, plan.writes); } catch (_) { status.textContent = 'Import failed and browser storage also blocked recovery. Keep your downloaded backup.'; return; } }
        status.textContent = 'Import did not complete. Existing saves were preserved. ' + (error.message || 'Try closing your game tabs.');
      } finally { importButton.disabled = !candidate; }
    });
  }).catch(() => { status.textContent = 'Save transfer could not load. Reload this page before continuing.'; });
})(typeof window !== 'undefined' ? window : globalThis);
