/* HC3 old-origin native campaign handoff. No game code or network subresources.
 * Only entries whose native receiver has a reviewed release may be published.
 * Never enumerate storage or read account/profile/other-game keys.
 */
(function () {
  'use strict';
  const entries = Object.freeze({
    '/Lessons/Games/Glitch_Clash.html': Object.freeze({
      key: 'glitchclash_save',
      destination: 'https://www.madebymatt-play.uk/Lessons/Games/Glitch_Clash.html',
      filename: 'glitch-clash-save.json'
    })
  });
  const educationOrigins = new Set(['https://madebymatt.uk', 'https://www.madebymatt.uk']);
  const fragmentLimit = 32768;

  function entryFor(href) {
    const url = new URL(href);
    if (!educationOrigins.has(url.origin)) return null;
    return Object.hasOwn(entries, url.pathname) ? entries[url.pathname] : null;
  }

  function plan(href, storage) {
    const entry = entryFor(href);
    if (!entry) return null;
    const raw = storage.getItem(entry.key);
    if (raw === null || raw === '') return null;
    // Preserve the game's complete existing native JSON file, including fields
    // that the existing file importer preserves. The Play receiver validates it.
    const save = JSON.parse(raw);
    if (!save || Array.isArray(save) || save.v !== 3) throw new Error('Unreadable native campaign');
    const bytes = new TextEncoder().encode(raw);
    if (bytes.length > fragmentLimit) return {kind: 'file', raw, ...entry};
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    const hash = '#mbm_import=' + encoded;
    if (new TextEncoder().encode(hash).length > fragmentLimit) return {kind: 'file', raw, ...entry};
    return {kind: 'fragment', href: entry.destination + hash, ...entry};
  }

  const api = Object.freeze({entryFor, plan});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  const entry = entryFor(location.href);
  if (!entry || !document.body.hasAttribute('data-game-moved')) return;
  const host = document.getElementById('save-handoff');
  if (!host) return;
  try {
    const existing = localStorage.getItem(entry.key);
    if (existing === null || existing === '') return;
  } catch (_) { return; }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Bring my progress';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  host.append(button, status);
  button.addEventListener('click', function () {
    try {
      // Read again on the user's action; never transfer a stale boot-time copy.
      const transfer = plan(location.href, localStorage);
      if (!transfer) {
        status.textContent = 'No saved campaign was found in this browser.';
        button.disabled = true;
        return;
      }
      if (transfer.kind === 'fragment') {
        location.assign(transfer.href);
        return;
      }
      const file = new Blob([transfer.raw], {type: 'application/json'});
      const objectURL = URL.createObjectURL(file);
      const download = document.createElement('a');
      download.href = objectURL;
      download.download = transfer.filename;
      document.body.append(download);
      download.click();
      download.remove();
      setTimeout(function () { URL.revokeObjectURL(objectURL); }, 10000);
      status.textContent = 'Your campaign file is downloaded. Open the game below and use its Import button to choose this file. Your original progress stays here.';
    } catch (_) {
      status.textContent = 'This browser’s saved campaign could not be transferred. Your original progress is unchanged.';
    }
  });
}());
