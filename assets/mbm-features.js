/* ============================================================================
   Made by Matt — feature layer
   ----------------------------------------------------------------------------
   Adds to a static (GitHub Pages) site, with no server of its own required:

     1. Live visitor stats  — total visits + where in the world people come from
     2. Open / download counts — a running tally next to each resource or tool
     3. Accounts — device-local by default, REAL cross-device cloud accounts
        (Supabase) the moment you paste keys into site.json
     4. Analytics — optional GoatCounter page-view tracking + an on-site dashboard

   Everything degrades gracefully: if a service is unconfigured, down, or blocked,
   the page falls back to on-device behaviour and never breaks.

   Shared helpers are exposed on window.MBM (read/bump/flag/…) and window.MBMAuth
   so the members' area and the analytics dashboard can reuse them.

   Privacy: only anonymous country tallies ever leave the browser for the stats.
   Device accounts are hashed and never uploaded. Cloud accounts use Supabase Auth
   (the anon key is public by design and protected by row-level security).
   See FEATURES.md for the full setup + upgrade guide.
   ========================================================================== */
(function () {
  "use strict";

  /* ----- tiny helpers ----------------------------------------------------- */
  var doc = document;
  var qs = function (s, r) { return (r || doc).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var ce = function (t, cls) { var e = doc.createElement(t); if (cls) e.className = cls; return e; };
  var ls = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var fmt = function (n) { try { return Number(n).toLocaleString(); } catch (e) { return String(n); } };
  function nowIsh() { try { return Date.now(); } catch (e) { return +new Date(); } }

  function timedJSON(url, ms, opts) {
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 6000) : null;
    var o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o)
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) { if (t) clearTimeout(t); return j; })
      .catch(function (e) { if (t) clearTimeout(t); throw e; });
  }

  /* Data files go through the stamp; the counter API deliberately does not.
     This function fetched site.json with the browser's default cache policy
     while mbm-doors.js fetched the same url with cache:"no-cache" — so the two
     renderers could, and did, draw different versions of the same file on the
     same page load. See tools/stamp-data.py. */
  function stampedJSON(url, ms) {
    var s = window.MBM_STAMP ? window.MBM_STAMP(url) : { url: url, opts: { cache: "no-cache" } };
    return timedJSON(s.url, ms, s.opts);
  }


  function flag(cc) {
    if (!cc || cc.length !== 2) return "🏳️";
    try { var A = 0x1F1E6; return String.fromCodePoint(A + cc.charCodeAt(0) - 65, A + cc.charCodeAt(1) - 65); }
    catch (e) { return "🏳️"; }
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
      enabled: true, namespace: "madebymatt-uk", geo: true,
      roster: ["GB", "US", "IE", "CA", "AU", "NZ", "IN", "DE", "FR", "ES", "NL", "IT", "SE", "PL", "ZA", "NG", "KE", "AE", "SG", "PH", "PK", "MY", "BR", "MX", "JP"]
    },
    downloads: { enabled: true, catalog: [] },
    accounts: { enabled: true, provider: "auto", supabaseUrl: "", supabaseAnonKey: "" },
    analytics: { goatcounter: "" }
  };

  function siteRoot() {
    // works from /, /members/, /stats/ etc.
    return (location.pathname.indexOf("/") === 0) ? "/" : "";
  }

  function loadConfig() {
    return stampedJSON(siteRoot() + "site.json", 5000).then(function (j) {
      var f = (j && j.features) || {};
      if (f.stats) for (var k in f.stats) CFG.stats[k] = f.stats[k];
      if (f.downloads) { CFG.downloads.enabled = f.downloads.enabled !== false; if (f.downloads.catalog) CFG.downloads.catalog = f.downloads.catalog; }
      if (f.accounts) for (var a in f.accounts) CFG.accounts[a] = f.accounts[a];
      if (f.analytics) for (var g in f.analytics) CFG.analytics[g] = f.analytics[g];
    }).catch(function () { /* defaults are fine */ }).then(function () { return CFG; });
  }

  /* ========================================================================
     COUNTER SERVICE (counterapi.dev v1 — keyless, public) + local fallback
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
     LOCATION (client-side, NO NETWORK)
     ------------------------------------------------------------------------
     The visitor's country is inferred from their device's own time zone via
     Intl.DateTimeFormat — nothing is looked up, no IP is read, and nothing
     about the visitor's location is sent anywhere to derive it. Deliberately
     coarse (country-level, approximate) — it's a friendly flourish, not
     tracking. Unmapped time zones simply yield no country.
     ===================================================================== */
  var TZ_CC = {
    "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Berlin": "DE", "Europe/Paris": "FR",
    "Europe/Madrid": "ES", "Europe/Amsterdam": "NL", "Europe/Rome": "IT", "Europe/Stockholm": "SE",
    "Europe/Warsaw": "PL", "Europe/Lisbon": "PT", "Europe/Brussels": "BE", "Europe/Zurich": "CH",
    "Europe/Vienna": "AT", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI",
    "Europe/Athens": "GR", "Europe/Bucharest": "RO", "Europe/Prague": "CZ", "Europe/Budapest": "HU",
    "Europe/Moscow": "RU", "Europe/Istanbul": "TR", "Europe/Kiev": "UA", "Europe/Kyiv": "UA",
    "America/New_York": "US", "America/Detroit": "US", "America/Chicago": "US", "America/Denver": "US",
    "America/Phoenix": "US", "America/Los_Angeles": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US",
    "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA",
    "America/Halifax": "CA", "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "America/Bogota": "CO",
    "America/Lima": "PE", "America/Argentina/Buenos_Aires": "AR", "America/Santiago": "CL",
    "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Dubai": "AE",
    "Asia/Singapore": "SG", "Asia/Manila": "PH", "Asia/Kuala_Lumpur": "MY", "Asia/Tokyo": "JP",
    "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Seoul": "KR", "Asia/Bangkok": "TH",
    "Asia/Jakarta": "ID", "Asia/Dhaka": "BD", "Asia/Colombo": "LK", "Asia/Riyadh": "SA",
    "Asia/Jerusalem": "IL", "Asia/Tehran": "IR",
    "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
    "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ",
    "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG", "Africa/Nairobi": "KE", "Africa/Cairo": "EG",
    "Africa/Accra": "GH", "Africa/Casablanca": "MA"
  };
  function tzCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { tz: tz || "", cc: (tz && TZ_CC[tz]) || "" };
    } catch (e) { return { tz: "", cc: "" }; }
  }
  function locate() {
    if (!CFG.stats.geo) return Promise.resolve(null);
    var r = tzCountry();
    if (!r.cc) return Promise.resolve(null);
    return Promise.resolve({ cc: r.cc, country: countryName(r.cc), tz: r.tz, approx: true });
  }

  /* ========================================================================
     LIVE STATS WIDGET (homepage) — also reusable helpers for the dashboard
     ===================================================================== */
  function collectBoard(myCC) {
    var roster = (CFG.stats.roster || []).slice();
    if (myCC && roster.indexOf(myCC) === -1) roster.push(myCC);
    var jobs = roster.map(function (cc) {
      return read("country_" + cc).then(function (n) { return { cc: cc, n: n || 0 }; }).catch(function () { return { cc: cc, n: 0 }; });
    });
    return Promise.all(jobs).then(function (rows) {
      return rows.filter(function (r) { return r.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    });
  }

  function initStats() {
    var mount = qs("#mbmStats");
    if (!mount || !CFG.stats.enabled) return;
    var oncePerVisit = !sessionStorage.getItem("mbm_counted");
    try { sessionStorage.setItem("mbm_counted", "1"); } catch (e) {}

    var elVisits = qs("#mbmVisits", mount), elHere = qs("#mbmHere", mount);
    var elBoard = qs("#mbmBoard", mount), elCountries = qs("#mbmCountries", mount);

    (oncePerVisit ? bump("visits_total") : read("visits_total")).then(function (n) {
      if (elVisits && n != null) elVisits.textContent = fmt(n);
      if (n != null && n < 100) mount.classList.add("mbm-quiet"); /* social-proof floor */
    });

    locate().then(function (g) {
      if (g && elHere) {
        elHere.innerHTML = "Looks like you\u2019re in <b>" + esc(g.country || g.cc) + "</b> " + flag(g.cc);
      } else if (elHere) {
        elHere.textContent = "Welcome \u2014 wherever you\u2019re reading this from.";
      }
      var myBump = (g && g.cc && oncePerVisit) ? bump("country_" + g.cc) : Promise.resolve(null);
      myBump.then(function () {
        collectBoard(g && g.cc).then(function (rows) {
          renderBoard(elBoard, rows, g && g.cc, 12);
          if (elCountries) elCountries.textContent = rows.length ? String(rows.length) : "\u2014";
        });
      });
    });
  }

  function renderBoard(el, rows, myCC, limit) {
    if (!el) return;
    el.innerHTML = "";
    if (!rows.length) { el.innerHTML = '<p class="mbm-board-empty">Counting the first visitors\u2026 check back soon.</p>'; return; }
    var max = rows[0].n || 1;
    rows.slice(0, limit || 12).forEach(function (r) {
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
     ===================================================================== */
  function initDownloads() {
    if (!CFG.downloads.enabled) return;
    var counted = qsa("[data-mbm-count]");
    var keys = {};
    counted.forEach(function (el) { keys[el.getAttribute("data-mbm-count")] = 1; });
    qsa("[data-mbm-count-for]").forEach(function (el) { keys[el.getAttribute("data-mbm-count-for")] = 1; });

    Object.keys(keys).forEach(function (key) { read("dl_" + key).then(function (n) { paintCount(key, n); }); });

    counted.forEach(function (el) {
      el.addEventListener("click", function () {
        var key = el.getAttribute("data-mbm-count"); if (!key) return;
        bump("dl_" + key).then(function (n) { paintCount(key, n); });
      }, { passive: true });
    });

    function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }
    function paintCount(key, n) {
      var txt = (n == null) ? "" : fmt(n);
      qsa('[data-mbm-count-for="' + cssEsc(key) + '"]').forEach(function (b) { b.textContent = txt; if (n != null) b.setAttribute("data-ready", "1"); });
      qsa('[data-mbm-count="' + cssEsc(key) + '"] .mbm-hits').forEach(function (b) { if (n != null) b.textContent = fmt(n); });
    }
  }

  /* ========================================================================
     ANALYTICS — GoatCounter (optional, privacy-friendly page-view tracking)
     ===================================================================== */
  function initAnalytics() {
    var code = (CFG.analytics && CFG.analytics.goatcounter || "").trim();
    if (!code) return;
    if (doc.querySelector("script[data-goatcounter]")) return;
    // Accept either a bare code ("madebymatt") or a full endpoint URL.
    var endpoint = /^https?:\/\//.test(code) ? code : ("https://" + code + ".goatcounter.com/count");
    var s = ce("script");
    s.async = true;
    s.setAttribute("data-goatcounter", endpoint);
    s.src = "//gc.zgo.at/count.js";
    doc.body.appendChild(s);
  }

  /* ========================================================================
     ACCOUNTS — provider-abstracted (Supabase cloud OR device-local)
     ------------------------------------------------------------------------
     window.MBMAuth:
       .ready            Promise (resolves once the initial session is known)
       .user             cached { email, name, tier, cloud } or null
       .provider         "supabase" | "local"
       .subscribe(cb)    called now + on every change
       .register(name,email,pass) -> Promise<{needsConfirm?}>
       .login(email,pass)         -> Promise
       .logout()                  -> Promise
       .resetPassword(email)      -> Promise   (cloud only)
     ===================================================================== */
  var MBMAuth = (function () {
    var subs = [], user = null, provider = "local", sb = null, resolveReady;
    var ready = new Promise(function (r) { resolveReady = r; });

    function emit() { subs.forEach(function (f) { try { f(user); } catch (e) {} }); }
    function setUser(u) { user = u; emit(); }

    /* ---- device-local backend (hashed, on device) ---- */
    var Local = (function () {
      var USERS = "mbm_users", SESSION = "mbm_session";
      function rndSalt() {
        try { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
        catch (e) { return String(nowIsh()) + Math.abs((Math.sin(nowIsh()) * 1e9) | 0); }
      }
      function sha256(str) {
        if (window.crypto && crypto.subtle && crypto.subtle.digest) {
          return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (d) {
            return Array.prototype.map.call(new Uint8Array(d), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
          });
        }
        var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
        return Promise.resolve("x" + h.toString(16));
      }
      var all = function () { return ls.get(USERS, {}); };
      var norm = function (e) { return String(e || "").trim().toLowerCase(); };
      function toUser(email) { var u = all()[email]; return u ? { email: email, name: u.name, tier: "member", cloud: false } : null; }
      return {
        current: function () { var e = ls.get(SESSION, null); return e ? toUser(e) : null; },
        register: function (name, email, pass) {
          email = norm(email);
          if (!name || !email || !pass) return Promise.reject("Please fill in every field.");
          if (pass.length < 8) return Promise.reject("Please choose a password of at least 8 characters.");
          var users = all();
          if (users[email]) return Promise.reject("There\u2019s already an account on this device for that email \u2014 try logging in.");
          var salt = rndSalt();
          return sha256(salt + pass).then(function (hash) {
            users[email] = { name: String(name).trim(), salt: salt, hash: hash, created: nowIsh() };
            ls.set(USERS, users); ls.set(SESSION, email);
            setUser(toUser(email)); return {};
          });
        },
        login: function (email, pass) {
          email = norm(email); var u = all()[email];
          if (!u) return Promise.reject("No account on this device for that email. New here? Create one \u2014 it only takes a moment.");
          return sha256(u.salt + pass).then(function (hash) {
            if (hash !== u.hash) return Promise.reject("That password doesn\u2019t match. Give it another go.");
            ls.set(SESSION, email); setUser(toUser(email)); return {};
          });
        },
        logout: function () { try { localStorage.removeItem(SESSION); } catch (e) {} setUser(null); return Promise.resolve(); },
        resetPassword: function () { return Promise.reject("Password reset needs cloud accounts \u2014 set those up to enable it."); }
      };
    })();

    /* ---- Supabase cloud backend ---- */
    function sbUser(session) {
      if (!session || !session.user) return null;
      var u = session.user, md = u.user_metadata || {};
      return { email: u.email, name: md.name || md.full_name || (u.email || "").split("@")[0], tier: md.tier || "member", cloud: true };
    }
    function initSupabase(url, key) {
      return import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm").then(function (m) {
        sb = m.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
        sb.auth.onAuthStateChange(function (_ev, session) { setUser(sbUser(session)); });
        return sb.auth.getSession().then(function (r) { setUser(sbUser(r.data && r.data.session)); provider = "supabase"; });
      });
    }
    var Cloud = {
      register: function (name, email, pass) {
        if (!name || !email || !pass) return Promise.reject("Please fill in every field.");
        if (pass.length < 8) return Promise.reject("Please choose a password of at least 8 characters.");
        return sb.auth.signUp({ email: String(email).trim(), password: pass, options: { data: { name: String(name).trim(), tier: "member" } } })
          .then(function (r) {
            if (r.error) throw r.error.message || "Sign-up failed.";
            var hasSession = r.data && r.data.session;
            if (!hasSession) return { needsConfirm: true };
            return {};
          });
      },
      login: function (email, pass) {
        return sb.auth.signInWithPassword({ email: String(email).trim(), password: pass })
          .then(function (r) { if (r.error) throw r.error.message || "Could not log in."; return {}; });
      },
      logout: function () { return sb.auth.signOut().then(function () { setUser(null); }); },
      resetPassword: function (email) {
        return sb.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: location.origin + "/members/" })
          .then(function (r) { if (r.error) throw r.error.message || "Could not send reset email."; return {}; });
      }
    };

    function boot(cfg) {
      var a = cfg.accounts || {};
      var wantCloud = (a.provider === "supabase") || (a.provider === "auto" && a.supabaseUrl && a.supabaseAnonKey);
      if (wantCloud && a.supabaseUrl && a.supabaseAnonKey) {
        return initSupabase(a.supabaseUrl, a.supabaseAnonKey)
          .then(function () { resolveReady(user); })
          .catch(function () { provider = "local"; setUser(Local.current()); resolveReady(user); });
      }
      provider = "local"; setUser(Local.current()); resolveReady(user);
      return Promise.resolve();
    }

    function backend() { return provider === "supabase" ? Cloud : Local; }

    return {
      ready: ready,
      get user() { return user; },
      get provider() { return provider; },
      subscribe: function (cb) { subs.push(cb); try { cb(user); } catch (e) {} },
      register: function (n, e, p) { return backend().register(n, e, p); },
      login: function (e, p) { return backend().login(e, p); },
      logout: function () { return backend().logout(); },
      resetPassword: function (e) { return backend().resetPassword(e); },
      _boot: boot
    };
  })();

  /* ---- account modal wiring (present on any page that includes it) -------- */
  function initAccountUI() {
    if (!CFG.accounts.enabled) return;
    var btn = qs("#mbmAccountBtn");
    var modal = qs("#mbmAuth");

    function firstName(u) { return (u && u.name ? u.name.split(" ")[0] : ""); }

    function reflectNav(u) {
      if (!btn) return;
      if (u) { btn.innerHTML = "Hi, " + esc(firstName(u)) + " \u2022 <span class=\"mbm-signout\">Sign out</span>"; btn.setAttribute("data-signed-in", "1"); }
      else { btn.textContent = "Log in"; btn.removeAttribute("data-signed-in"); }
      var badge = qs("#mbmMemberBadge"); if (badge) badge.hidden = !u;
    }
    MBMAuth.subscribe(reflectNav);

    if (!btn || !modal) return; // page may show nav state only (e.g. members page uses its own UI)

    var form = qs("#mbmAuthForm", modal), nameField = qs("#mbmAuthNameField", modal);
    var msg = qs("#mbmAuthMsg", modal), title = qs("#mbmAuthTitle", modal);
    var submit = qs("#mbmAuthSubmit", modal), toggle = qs("#mbmAuthToggle", modal);
    var forgot = qs("#mbmAuthForgot", modal);
    var passInput = qs("#mbmAuthPass", modal), strengthBox = qs("#mbmStrength", modal);
    var mode = "login";

    function setReq(id, ok) { var el = qs("#" + id, modal); if (!el) return; el.setAttribute("data-ok", ok ? "1" : "0"); var t = qs(".tick", el); if (t) t.textContent = ok ? "✓" : "·"; }
    function updateStrength() {
      if (!strengthBox) return;
      var v = passInput ? passInput.value : "";
      if (mode === "login" || !v) { strengthBox.hidden = true; return; }
      strengthBox.hidden = false;
      var len = v.length >= 8, mix = /[a-z]/.test(v) && /[A-Z]/.test(v), num = /[0-9\W]/.test(v);
      setReq("mbmReqLen", len); setReq("mbmReqCase", mix); setReq("mbmReqNum", num);
      var score = (len ? 1 : 0) + (mix ? 1 : 0) + (num ? 1 : 0);
      var bar = qs("#mbmStrBar", modal), txt = qs("#mbmStrText", modal);
      if (bar) bar.className = "mbm-strbar-fill lvl-" + score;
      if (txt) txt.textContent = score <= 1 ? "Weak" : (score === 2 ? "Okay" : "Strong");
    }

    function setMode(m) {
      mode = m;
      title.textContent = (m === "login") ? "Welcome back" : "Create your account";
      submit.textContent = (m === "login") ? "Log in" : "Create account";
      nameField.hidden = (m === "login");
      qs("#mbmAuthName", modal).required = (m !== "login");
      toggle.innerHTML = (m === "login") ? "New here? <b>Create an account</b>" : "Already have an account? <b>Log in</b>";
      if (forgot) forgot.hidden = (m !== "login") || (MBMAuth.provider !== "supabase");
      msg.textContent = ""; msg.className = "mbm-auth-msg";
      updateStrength();
    }
    function open() { if (MBMAuth.user) return; setMode("login"); modal.hidden = false; doc.body.style.overflow = "hidden"; setTimeout(function () { try { qs("#mbmAuthEmail", modal).focus(); } catch (e) {} }, 30); }
    function close() { modal.hidden = true; doc.body.style.overflow = ""; }

    if (btn) btn.addEventListener("click", function () { if (btn.getAttribute("data-signed-in")) { MBMAuth.logout(); } else { open(); } });
    modal.addEventListener("click", function (e) { if (e.target === modal || (e.target.hasAttribute && e.target.hasAttribute("data-close"))) close(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) close(); });
    toggle.addEventListener("click", function () { setMode(mode === "login" ? "register" : "login"); });
    if (passInput) passInput.addEventListener("input", updateStrength);

    if (forgot) forgot.addEventListener("click", function () {
      var email = qs("#mbmAuthEmail", modal).value;
      if (!email) { msg.textContent = "Enter your email above first, then tap reset."; msg.className = "mbm-auth-msg err"; return; }
      msg.textContent = "Sending reset link\u2026"; msg.className = "mbm-auth-msg";
      MBMAuth.resetPassword(email).then(function () { msg.textContent = "Check your inbox for a reset link."; msg.className = "mbm-auth-msg ok"; })
        .catch(function (err) { msg.textContent = String(err); msg.className = "mbm-auth-msg err"; });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = "Working\u2026"; msg.className = "mbm-auth-msg";
      var name = qs("#mbmAuthName", modal).value, email = qs("#mbmAuthEmail", modal).value, pass = qs("#mbmAuthPass", modal).value;
      var p = (mode === "login") ? MBMAuth.login(email, pass) : MBMAuth.register(name, email, pass);
      p.then(function (res) {
        if (res && res.needsConfirm) {
          msg.textContent = "Almost there \u2014 check your email to confirm your account.";
          msg.className = "mbm-auth-msg ok"; form.reset(); return;
        }
        msg.textContent = (mode === "login") ? "Logged in \u2014 good to see you." : "You\u2019re in \u2014 your account is saved on this device.";
        msg.className = "mbm-auth-msg ok"; form.reset(); setTimeout(close, 1100);
      }).catch(function (err) {
        msg.textContent = String(err || "Something went wrong \u2014 please try again.");
        msg.className = "mbm-auth-msg err";
      });
    });
  }

  /* ========================================================================
     PUBLIC API + BOOT
     ===================================================================== */
  var mbmReadyResolve, mbmReady = new Promise(function (r) { mbmReadyResolve = r; });
  window.MBMAuth = MBMAuth;
  window.MBM = {
    ready: mbmReady, cfg: CFG,
    read: read, bump: bump, collectBoard: collectBoard, renderBoard: renderBoard,
    locate: locate, flag: flag, countryName: countryName, fmt: fmt, esc: esc
  };

  /* ========================================================================
     DOORS — removed 2026-08-01. site.json doors[] is rendered by
     assets/mbm-doors.js, into the [data-zone] strips.
     ===================================================================== */
  /* initDoors() lived here. Removed 2026-08-01.

     It was superseded by assets/mbm-doors.js, which renders the same
     site.json doors[] into the [data-zone] strips — but it was never deleted,
     so both ran and the homepage drew all nine doors twice. The copy here read
     only door.image and ignored door.art entirely, so eight of the nine
     rendered as bare text while the identical cards a few hundred pixels above
     rendered their SVG correctly. Studio Suite looked fine only because it is
     the one door that also carries an image.

     If a second doors rail is ever wanted, extend mbm-doors.js — do not
     reintroduce a parallel renderer that has to be kept in step by hand. */

  function boot() {
    loadConfig().then(function (cfg) {
      initAnalytics();
      initStats();
      initDownloads();
      initAccountUI();
      MBMAuth._boot(cfg);
      mbmReadyResolve(cfg);
      return cfg;
    });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
