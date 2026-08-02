/* mbm-sync-ui.js — the sync panel on /members/.
 *
 * The whole point of this file is the ORDER it does things in:
 *
 *   1. read config          -> proves nothing
 *   2. build a transport    -> proves nothing
 *   3. verify() round-trip  -> THIS is what justifies showing anything
 *
 * Nothing is rendered until (3) passes. A sync UI on a site where sync does not
 * work is worse than no sync UI, because people stop keeping their own copies.
 * That is the same reasoning as MBM_CAPS itself; see mbm-features.js.
 *
 * While sync is unavailable the page states that plainly rather than hiding the
 * subject, because "it does not sync between devices" is currently true and the
 * page has said so since the account came back.
 */
(function (w, d) {
  "use strict";

  var host = d.getElementById("mbmSync");
  if (!host || !w.MBMSync) return;
  var S = w.MBMSync;

  var esc = function (s) { return String(s).replace(/[&<>"']/g,
    function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };

  function say(html) { host.innerHTML = html; }
  function unavailable(why) {
    /* Deliberately not silent. A missing panel with no explanation reads as a
       bug; this reads as a fact. */
    say('<div class="sy-off"><b>Syncing between devices is not switched on.</b> ' +
        'Your account and saves stay on this device only, exactly as described above. ' +
        '<span class="sy-why">' + esc(why) + '</span></div>');
  }

  if (!S.available()) { unavailable("This browser does not provide the encryption this needs."); return; }

  /* -------------------------------------------------------------- config */
  fetch("../site.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      var c = (cfg && cfg.features && cfg.features.sync) || {};
      if (!c.url || !c.anonKey) {
        unavailable("No sync backend is configured yet.");
        return;
      }
      S.useTransport(S.supabaseTransport(c.url, c.anonKey));
      say('<div class="sy-off">Checking whether syncing is working…</div>');
      /* (3) — a real write, a real read, a real match. */
      return S.verify().then(function (v) {
        if (!v.ok) { unavailable("The sync service did not answer correctly, so it has been left switched off. (" + v.why + ")"); return; }
        render();
      });
    })
    .catch(function (e) { unavailable("Could not check the sync service: " + (e && e.message || e)); });

  /* ---------------------------------------------------------------- panel */
  function render() {
    say(
      '<div class="sy-on">' +
      '<h3>Move your saves to another device</h3>' +
      '<p>Your games can follow you between a school computer and home. Everything is <b>encrypted in this browser before it is sent</b>, with a key made from a code that never leaves your device &mdash; so nobody who runs the server, including me, can read any of it.</p>' +
      '<p class="sy-warn"><b>The code is the only key, and there is no reset.</b> If you lose it the saved copy cannot be recovered by anyone. Write it down before you leave this page.</p>' +
      '<div class="sy-acts">' +
        '<button class="sy-btn" id="syNew" type="button">Get my sync code</button>' +
        '<button class="sy-btn sec" id="syHave" type="button">I already have a code</button>' +
      '</div>' +
      '<div class="sy-out" id="syOut" role="status" aria-live="polite"></div>' +
      '</div>');

    var out = d.getElementById("syOut");
    var msg = function (cls, html) { out.className = "sy-out " + cls; out.innerHTML = html; };

    d.getElementById("syNew").addEventListener("click", function () {
      var code = S.newCode();
      msg("busy", "Encrypting and uploading…");
      S.push(code).then(function (r) {
        msg("ok",
          '<p><b>Saved. This is your code.</b></p>' +
          '<p class="sy-code">' + esc(code) + '</p>' +
          '<div class="sy-acts"><button class="sy-btn" id="syCopy" type="button">Copy the code</button></div>' +
          '<p class="sy-warn">Write it down now. It is the only key, it is not stored anywhere, and it cannot be reset. ' +
          'On your other device, open this page, choose <b>I already have a code</b> and type it in.</p>' +
          '<p class="sy-meta">' + r.keys + ' saves, ' + Math.round(r.bytes / 1024) + ' KB, encrypted before sending.</p>');
        var cp = d.getElementById("syCopy");
        if (cp) cp.addEventListener("click", function () {
          if (navigator.clipboard) navigator.clipboard.writeText(code).then(
            function () { cp.textContent = "Copied"; },
            function () { cp.textContent = "Select it and copy by hand"; });
          else cp.textContent = "Select it and copy by hand";
        });
      }, function (e) { msg("err", "<p>" + esc(e && e.message || e) + "</p>"); });
    });

    d.getElementById("syHave").addEventListener("click", function () {
      msg("", '<label class="sy-lab" for="syCode">Your sync code</label>' +
              '<input class="sy-in" id="syCode" type="text" autocomplete="off" spellcheck="false" placeholder="seven-words-separated-by-dashes">' +
              '<div class="sy-acts"><button class="sy-btn" id="syGo" type="button">Bring my saves here</button></div>');
      d.getElementById("syGo").addEventListener("click", function () {
        var code = d.getElementById("syCode").value;
        if (!code.trim()) { msg("err", "<p>Type the code first.</p>"); return; }
        msg("busy", "Fetching and decrypting…");
        S.pull(code).then(function (r) {
          if (!r.found) { msg("err", "<p>No saved copy was found for that code. Check it and try again.</p>"); return; }
          var extra = r.conflicts.length
            ? '<p class="sy-warn">' + r.conflicts.length + ' save' + (r.conflicts.length > 1 ? 's' : '') +
              ' existed in two different versions. The newer one is now in place and <b>the older one was kept, not deleted</b> &mdash; it is stored alongside it.</p>'
            : '';
          msg("ok", "<p><b>Done &mdash; " + r.applied + " saves are now on this device.</b> Open the games to carry on.</p>" + extra);
        }, function (e) { msg("err", "<p>" + esc(e && e.message || e) + "</p>"); });
      });
    });
  }
})(window, document);
