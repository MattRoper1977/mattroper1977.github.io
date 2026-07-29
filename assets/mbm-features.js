/* ============================================================================
   Made by Matt — feature layer
   ----------------------------------------------------------------------------
   Adds three things to a static (GitHub Pages) site, with no server of its own:

     1. Live visitor stats  — total visits + where in the world people come from
     2. Open / download counts — a running tally next to each resource or tool
     3. Device accounts — optional sign-up / log-in kept on the visitor's device

   How the counting works
   ----------------------
   GitHub Pages can't count anything by itself, so the shared tallies live in a
   free public counter service (counterapi.dev). Each visit bumps a global
   counter and a per-country counter; the numbers are read straight back out.
   Everything is wrapped in try/catch and falls back to a private, on-device
   tally, so the page always shows something sensible even if a service is down
   or the visitor is offline.

   Privacy
   -------
   Only anonymous country tallies ever leave the browser. A visitor's approximate
   location is looked up client-side to colour the map; their IP address is never
   stored by this site. Accounts are hashed and saved on the device — nothing is
   uploaded. See FEATURES.md for how to move accounts + stats onto a real backend
   later.
   ========================================================================== */
(function () {
  "use strict";

  /* ----- tiny helpers ----------------------------------------------------- */
  var doc = document;
  var qs = function (s, r) { return (r || doc).querySelector(s); };
  var ce = function (t, cls) { var e = doc.createElement(t); if (cls) e.className = cls; return e; };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var fmt = function (n) { try { return Number(n).toLocaleString(); } catch (e) { return String(n); } };

  /* fetch with a timeout so a slow service never hangs the widget */
  function timedJSON(url, ms) {
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 6000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) { if (t) clearTimeout(t); return j; })
      .catch(function (e) { if (t) clearTimeout(t); throw e; });
  }

  /* ISO-3166 alpha-2 -> flag emoji + display name -------------------------- */
  function flag(cc) {
    if (!cc || cc.length !== 2) return "🏳️";
    try {
      var A = 0x1F1E6;
      return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65);
    } catch (e) { return "🏳️"; }
  }
  var _names = null;
  function countryName(cc) {
    if (!cc) return "";
    try { if (!_names && window.Intl && Intl.DisplayNames) _names = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) {}
    try { return (_names && _names.of(cc)) || cc; } catch (e) { return cc; }
  }

  /* ----- config ----------------------------------------------------------- */
  var CFG = {
    stats: {
      enabled: true,
      namespace: "madebymatt-uk",
      geo: true,
      roster: ["GB", "US", "IE", "CA", "AU", "NZ", "IN", "DE", "FR", "ES", "NL", "IT", "SE", "PL", "ZA", "NG", "KE", "AE", "SG", "PH", "PK", "MY", "BR", "MX", "JP"]
    },
    downloads: { enabled: true },
    accounts: { enabled: true }
  };

  function loadConfig() {
    // Resolve site.json from the site root regardless of which page we're on.
    var url = (location.pathname.indexOf("/") === 0 ? "/site.json" : "site.json");
    return timedJSON(url, 5000).then(function (j) {
      if (j && j.features) {
        if (j.features.stats) for (var k in j.features.stats) CFG.stats[k] = j.features.stats[k];
        if (j.features.downloads) CFG.downloads.enabled = j.features.downloads.enabled !== false;
        if (j.features.accounts) CFG.accounts.enabled = j.features.accounts.enabled !== false;
      }
    }).catch(function () { /* defaults are fine */ });
  }

  /* ========================================================================
     COUNTER SERVICE (counterapi.dev v1 — keyless, public)
     ------------------------------------------------------------------------
     bump(key)  -> increments and resolves to the new total (or null)
     read(key)  -> reads without incrementing (or null)
     Every result is mirrored into localStorage so we degrade to on-device
     numbers when the network / service is unavailable.
     ===================================================================== */
  var API = "https://api.counterapi.dev/v1/";
  function safeKey(k) { return String(k).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60); }
  function pluckCount(j) {
    if (j == null) return null;
    if (typeof j === "number") return j;
    var f = ["count", "value", "up_count", "Count", "data"];
    for (var i = 0; i < f.length; i++) {
      var v = j[f[i]];
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && typeof v.count === "number") return v.count;
    }
    return null;
  }
  function bump(key) {
    var k = safeKey(key), lk = "mbm_c_" + k;
    return timedJSON(API + CFG.stats.namespace + "/" + k + "/up", 6000)
      .then(function (j) { var n = pluckCount(j); if (n != null) { ls.set(lk, n); return n; } throw 0; })
      .catch(function () { var n = (ls.get(lk, 0) || 0) + 1; ls.set(lk, n); return n; });
  }
  function read(key) {
    var k = safeKey(key), lk = "mbm_c_" + k;
    return timedJSON(API + CFG.stats.namespace + "/" + k, 6000)
      .then(function (j) { var n = pluckCount(j); if (n != null) { ls.set(lk, n); return n; } throw 0; })
      .catch(function () { return ls.get(lk, null); });
  }

  /* ========================================================================
     GEOLOCATION (client-side, best effort)
     ===================================================================== */
  function locate() {
    if (!CFG.stats.geo) return Promise.resolve(null);
    var cached = ls.get("mbm_geo", null);
    // re-use a fix for 12h so we don't hammer the geo service
    if (cached && cached.cc && cached._t && (nowIsh() - cached._t) < 43200000) return Promise.resolve(cached);
    return timedJSON("https://ipwho.is/", 6000)
      .then(function (j) {
        if (!j || j.success === false || !j.country_code) throw 0;
        return { cc: j.country_code, country: j.country, city: j.city, region: j.region };
      })
      .catch(function () {
        return timedJSON("https://ipapi.co/json/", 6000)
          .then(function (j) { if (!j || !j.country_code) throw 0; return { cc: j.country_code, country: j.country_name, city: j.city, region: j.region }; })
          .catch(function () { return null; });
      })
      .then(function (g) { if (g) { g._t = nowIsh(); ls.set("mbm_geo", g); } return g; });
  }
  // Date.now without importing anything unusual; falls back gracefully.
  function nowIsh() { try { return Date.now(); } catch (e) { return +new Date(); } }

  /* ========================================================================
     LIVE STATS WIDGET
     ===================================================================== */
  function initStats() {
    var mount = qs("#mbmStats");
    if (!mount || !CFG.stats.enabled) return;
    var oncePerVisit = !sessionStorage.getItem("mbm_counted");
    try { sessionStorage.setItem("mbm_counted", "1"); } catch (e) {}

    var elVisits = qs("#mbmVisits", mount);
    var elHere = qs("#mbmHere", mount);
    var elBoard = qs("#mbmBoard", mount);
    var elCountries = qs("#mbmCountries", mount);

    // 1) headline total
    (oncePerVisit ? bump("visits_total") : read("visits_total")).then(function (n) {
      if (elVisits && n != null) elVisits.textContent = fmt(n);
    });

    // 2) locate the visitor, credit their country, then paint the board
    locate().then(function (g) {
      if (g && elHere) {
        var where = [g.city, g.country].filter(Boolean).join(", ") || g.country || g.cc;
        elHere.innerHTML = 'You\u2019re visiting from <b>' + esc(where) + "</b> " + flag(g.cc);
      } else if (elHere) {
        elHere.textContent = "Welcome \u2014 wherever you\u2019re reading this from.";
      }

      // Make sure the visitor's own country is part of the board.
      var roster = (CFG.stats.roster || []).slice();
      if (g && g.cc && roster.indexOf(g.cc) === -1) roster.push(g.cc);

      var myBump = (g && g.cc && oncePerVisit)
        ? bump("country_" + g.cc)
        : Promise.resolve(null);

      myBump.then(function () {
        var jobs = roster.map(function (cc) {
          return read("country_" + cc).then(function (n) { return { cc: cc, n: n || 0 }; }).catch(function () { return { cc: cc, n: 0 }; });
        });
        Promise.all(jobs).then(function (rows) {
          rows = rows.filter(function (r) { return r.n > 0; }).sort(function (a, b) { return b.n - a.n; });
          renderBoard(elBoard, rows, g && g.cc);
          if (elCountries) elCountries.textContent = rows.length ? String(rows.length) : "\u2014";
        });
      });
    });
  }

  function renderBoard(el, rows, myCC) {
    if (!el) return;
    el.innerHTML = "";
    if (!rows.length) {
      el.innerHTML = '<p class="mbm-board-empty">Counting the first visitors\u2026 check back soon.</p>';
      return;
    }
    var max = rows[0].n || 1;
    rows.slice(0, 12).forEach(function (r) {
      var row = ce("div", "mbm-row" + (r.cc === myCC ? " is-you" : ""));
      row.innerHTML =
        '<span class="mbm-fl">' + flag(r.cc) + "</span>" +
        '<span class="mbm-cn">' + esc(countryName(r.cc)) + (r.cc === myCC ? ' <em>\u2014 you</em>' : "") + "</span>" +
        '<span class="mbm-track"><span class="mbm-fill" style="width:' + Math.max(6, Math.round((r.n / max) * 100)) + '%"></span></span>' +
        '<span class="mbm-num">' + fmt(r.n) + "</span>";
      el.appendChild(row);
    });
  }

  /* ========================================================================
     OPEN / DOWNLOAD COUNTERS
     ------------------------------------------------------------------------
     Any link/button with  data-mbm-count="some-key"  gets a live tally, and
     the click is recorded. Optionally  data-mbm-label="opened|downloaded".
     A <span data-mbm-count-for="some-key"></span> anywhere shows the number.
     ===================================================================== */
  function initDownloads() {
    if (!CFG.downloads.enabled) return;
    var counted = doc.querySelectorAll("[data-mbm-count]");
    var byKey = {};

    // paint current counts (read-only) on both triggers and standalone badges
    var keys = {};
    counted.forEach(function (el) { keys[el.getAttribute("data-mbm-count")] = 1; });
    doc.querySelectorAll("[data-mbm-count-for]").forEach(function (el) { keys[el.getAttribute("data-mbm-count-for")] = 1; });

    Object.keys(keys).forEach(function (key) {
      read("dl_" + key).then(function (n) { paintCount(key, n); });
    });

    // record clicks (once per element click; don't block navigation)
    counted.forEach(function (el) {
      el.addEventListener("click", function () {
        var key = el.getAttribute("data-mbm-count");
        if (!key) return;
        bump("dl_" + key).then(function (n) { paintCount(key, n); });
      }, { passive: true });
    });

    function paintCount(key, n) {
      var txt = (n == null) ? "" : fmt(n);
      doc.querySelectorAll('[data-mbm-count-for="' + cssEsc(key) + '"]').forEach(function (b) {
        b.textContent = txt;
        if (n != null) b.setAttribute("data-ready", "1");
      });
      // also update a badge that lives inside the trigger, if present
      doc.querySelectorAll('[data-mbm-count="' + cssEsc(key) + '"] .mbm-hits').forEach(function (b) {
        if (n != null) b.textContent = fmt(n);
      });
    }
    function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }
  }

  /* ========================================================================
     DEVICE ACCOUNTS (optional, on-device, hashed)
     ------------------------------------------------------------------------
     A genuine, working sign-up / log-in that keeps everything on the visitor's
     own device — on brand with the rest of the site ("nothing uploaded").
     Cloud accounts + member bonuses are the planned next step (see FEATURES.md).
     ===================================================================== */
  var Accounts = (function () {
    var USERS = "mbm_users", SESSION = "mbm_session";

    function rndSalt() {
      try {
        var a = new Uint8Array(16); crypto.getRandomValues(a);
        return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      } catch (e) { return String(nowIsh()) + Math.abs((Math.sin(nowIsh()) * 1e9) | 0); }
    }
    function sha256(str) {
      if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        var buf = new TextEncoder().encode(str);
        return crypto.subtle.digest("SHA-256", buf).then(function (d) {
          return Array.prototype.map.call(new Uint8Array(d), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
        });
      }
      // Fallback (non-crypto) hash for very old browsers — still never stores plaintext.
      var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
      return Promise.resolve("x" + h.toString(16));
    }
    function all() { return ls.get(USERS, {}); }
    function norm(email) { return String(email || "").trim().toLowerCase(); }

    return {
      current: function () { var e = ls.get(SESSION, null); if (!e) return null; var u = all()[e]; return u ? { email: e, name: u.name } : null; },
      register: function (name, email, pass) {
        email = norm(email);
        if (!name || !email || !pass) return Promise.reject("Please fill in every field.");
        if (pass.length < 6) return Promise.reject("Please choose a password of at least 6 characters.");
        var users = all();
        if (users[email]) return Promise.reject("There\u2019s already an account on this device for that email \u2014 try logging in.");
        var salt = rndSalt();
        return sha256(salt + pass).then(function (hash) {
          users[email] = { name: String(name).trim(), salt: salt, hash: hash, created: nowIsh() };
          ls.set(USERS, users); ls.set(SESSION, email);
          return { email: email, name: users[email].name };
        });
      },
      login: function (email, pass) {
        email = norm(email);
        var u = all()[email];
        if (!u) return Promise.reject("No account on this device for that email. New here? Create one \u2014 it only takes a moment.");
        return sha256(u.salt + pass).then(function (hash) {
          if (hash !== u.hash) return Promise.reject("That password doesn\u2019t match. Give it another go.");
          ls.set(SESSION, email); return { email: email, name: u.name };
        });
      },
      logout: function () { try { localStorage.removeItem(SESSION); } catch (e) {} }
    };
  })();

  function initAccounts() {
    if (!CFG.accounts.enabled) return;
    var btn = qs("#mbmAccountBtn");
    var modal = qs("#mbmAuth");
    if (!btn || !modal) return;

    var form = qs("#mbmAuthForm", modal);
    var nameField = qs("#mbmAuthNameField", modal);
    var msg = qs("#mbmAuthMsg", modal);
    var title = qs("#mbmAuthTitle", modal);
    var submit = qs("#mbmAuthSubmit", modal);
    var toggle = qs("#mbmAuthToggle", modal);
    var mode = "login";

    function reflectNav() {
      var u = Accounts.current();
      if (u) {
        btn.innerHTML = 'Hi, ' + esc(u.name.split(" ")[0]) + " \u2022 <span class=\"mbm-signout\">Sign out</span>";
        btn.setAttribute("data-signed-in", "1");
      } else {
        btn.textContent = "Log in";
        btn.removeAttribute("data-signed-in");
      }
      var badge = qs("#mbmMemberBadge");
      if (badge) badge.hidden = !u;
    }

    function setMode(m) {
      mode = m;
      title.textContent = (m === "login") ? "Welcome back" : "Create your account";
      submit.textContent = (m === "login") ? "Log in" : "Create account";
      nameField.hidden = (m === "login");
      qs("#mbmAuthName", modal).required = (m !== "login");
      toggle.innerHTML = (m === "login")
        ? "New here? <b>Create an account</b>"
        : "Already have an account? <b>Log in</b>";
      msg.textContent = "";
      msg.className = "mbm-auth-msg";
    }

    function open() {
      if (Accounts.current()) return; // signed in: nav click handled as sign-out
      setMode("login");
      modal.hidden = false;
      doc.body.style.overflow = "hidden";
      setTimeout(function () { try { qs("#mbmAuthEmail", modal).focus(); } catch (e) {} }, 30);
    }
    function close() { modal.hidden = true; doc.body.style.overflow = ""; }

    btn.addEventListener("click", function (e) {
      if (btn.getAttribute("data-signed-in")) {
        Accounts.logout(); reflectNav();
        return;
      }
      open();
    });

    modal.addEventListener("click", function (e) {
      if (e.target === modal || (e.target.hasAttribute && e.target.hasAttribute("data-close"))) close();
    });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) close(); });
    toggle.addEventListener("click", function () { setMode(mode === "login" ? "register" : "login"); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = "Working\u2026"; msg.className = "mbm-auth-msg";
      var name = qs("#mbmAuthName", modal).value;
      var email = qs("#mbmAuthEmail", modal).value;
      var pass = qs("#mbmAuthPass", modal).value;
      var p = (mode === "login") ? Accounts.login(email, pass) : Accounts.register(name, email, pass);
      p.then(function (u) {
        msg.textContent = (mode === "login") ? ("Logged in \u2014 good to see you, " + u.name.split(" ")[0] + ".") : ("You\u2019re in, " + u.name.split(" ")[0] + "! Bonus features are on the way.");
        msg.className = "mbm-auth-msg ok";
        reflectNav();
        setTimeout(close, 1100);
        form.reset();
      }).catch(function (err) {
        msg.textContent = String(err || "Something went wrong \u2014 please try again.");
        msg.className = "mbm-auth-msg err";
      });
    });

    reflectNav();
  }

  /* ========================================================================
     BOOT
     ===================================================================== */
  function boot() {
    loadConfig().then(function () {
      initStats();
      initDownloads();
      initAccounts();
    });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
