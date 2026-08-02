/* mbm-profile.js — the smallest thing that makes a game account-aware.
 *
 * WHY THIS EXISTS AND NOT mbm-features.js. Apex Kick and Voxel Frontier are
 * self-contained single files with one vendored dependency each, and they work
 * with the network cut. mbm-features.js would drag the visit counter
 * (api.counterapi.dev) into a game page that today makes zero external
 * requests. This file makes ZERO network requests of any kind — it only reads
 * localStorage keys that MBMAuth already writes.
 *
 * WHAT IT HONESTLY DOES
 *   1. Per-account save slots. Two people on one classroom laptop stop
 *      overwriting each other's world. Signed out behaves exactly as before,
 *      byte for byte — the same key, so no existing save is orphaned.
 *   2. A signed-in flag, which the games use to offer bonus content.
 *
 * WHAT IT DOES NOT DO, SAID PLAINLY
 *   It is NOT a lock. This is a static site: every file, including every bonus
 *   asset, is served in full to anyone who asks for the URL. Bonus content here
 *   is ENABLED for account holders, not hidden from anyone else. Any page that
 *   implies otherwise is lying, and this estate has spent a whole day removing
 *   claims of exactly that shape.
 *
 *   It is also NOT cross-device sync. A device-local account cannot sync — it
 *   has nowhere to sync to. Nothing here may claim otherwise.
 */
(function (w) {
  "use strict";
  var SESSION = "mbm_session", USERS = "mbm_users";

  function raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function json(k, d) { try { return JSON.parse(raw(k)) || d; } catch (e) { return d; } }

  function user() {
    var email = raw(SESSION);
    if (!email) return null;
    var rec = json(USERS, {})[email];
    if (!rec) return null;                       // session pointing at a deleted account
    return { email: email, name: rec.name || "" };
  }

  /* A short, stable, non-reversible tag for the slot suffix. The email is
     already in localStorage in clear — this is not protecting it, it is keeping
     an address out of every save key so a shared screen does not show it. */
  function tag(email) {
    var h = 5381, s = String(email).toLowerCase();
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  var MBMProfile = {
    user: user,
    signedIn: function () { return !!user(); },
    name: function () { var u = user(); return u ? (u.name || "").split(" ")[0] : ""; },

    /* Signed out -> the original key, unchanged. That is deliberate: an
       existing save must not disappear the day this ships. */
    slot: function (key) {
      var u = user();
      return u ? key + "~" + tag(u.email) : key;
    },

    /* Bonus content is offered, never hidden. See the note above. */
    bonus: function () { return !!user(); },

    /* Fires when another tab signs in or out. Same-tab changes do not raise
       `storage`, so games should also re-check on visibilitychange if they
       care; both games here read at load, which is enough. */
    onChange: function (cb) {
      w.addEventListener("storage", function (e) {
        if (e.key === SESSION || e.key === USERS) { try { cb(user()); } catch (err) {} }
      });
    }
  };

  w.MBMProfile = MBMProfile;
})(window);
