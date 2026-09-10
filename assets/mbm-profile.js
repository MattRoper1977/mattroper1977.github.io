/* mbm-profile.js — zero-network account hint for standalone games.
 * mbm-accounts-members-mailing-2026-08-08
 *
 * WHY THIS EXISTS
 * Apex Kick / Voxel Frontier remain offline-first. This shim makes ZERO network
 * requests. It does not validate a Supabase session and therefore must never be
 * used as authorization. Real member data is protected by Supabase Auth + RLS.
 *
 * WHAT IT DOES
 *   1. Prefer the non-secret cloud identity hint written after a genuine
 *      Supabase session is established (`mbm_cloud_identity_v1`).
 *   2. Preserve the older device-local profile as a legacy save-slot identity,
 *      so existing local game saves are not orphaned before a user migrates.
 *   3. Keep signed-out storage keys byte-for-byte unchanged.
 *   4. Offer game bonus content as a convenience only. It is NOT a lock: this
 *      is a static public site and bonus assets are not confidential.
 */
(function (w) {
  "use strict";
  var CLOUD = "mbm_cloud_identity_v1", SESSION = "mbm_session", USERS = "mbm_users";

  function raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function parsedRaw(value, d) { try { return JSON.parse(value) || d; } catch (e) { return d; } }
  function json(k, d) { return parsedRaw(raw(k), d); }

  function cloudUser() {
    var rec = json(CLOUD, null);
    if (!rec || !rec.id || !rec.email) return null;
    return { id: String(rec.id), email: String(rec.email).toLowerCase(), name: String(rec.name || ""), cloud: true };
  }
  function legacyUser() {
    var email = raw(SESSION);
    if (!email) return null;
    var rec = json(USERS, {})[email];
    if (!rec) return null;
    return { email: String(email).toLowerCase(), name: rec.name || "", cloud: false, legacy: true };
  }
  function user() { return cloudUser() || legacyUser(); }

  /* A short stable tag avoids putting the email itself in a visible save key.
     It is not a security hash; the source email is already local to the device.
     Keeping the same email-based function preserves old per-account save slots
     when that person upgrades to a real cloud account with the same address. */
  function tag(email) {
    var h = 5381, s = String(email).toLowerCase();
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  var MBMProfile = {
    user: user,
    signedIn: function () { return !!user(); },
    cloud: function () { var u = user(); return !!(u && u.cloud); },
    legacy: function () { var u = user(); return !!(u && u.legacy); },
    name: function () { var u = user(); return u ? (u.name || "").split(" ")[0] : ""; },
    slot: function (key) { var u = user(); return u ? key + "~" + tag(u.email) : key; },
    bonus: function () { return !!user(); },
    onChange: function (cb) {
      w.addEventListener("storage", function (e) {
        if (e.key === CLOUD || e.key === SESSION || e.key === USERS) { try { cb(user()); } catch (err) {} }
      });
    }
  };

  w.MBMProfile = MBMProfile;
})(window);
