/* mbm-accounts-members-mailing-2026-08-08
   Cloud-only Made by Matt account client.

   SECURITY BOUNDARY
   - Supabase Auth is the password authority. This file never hashes, stores,
     logs or compares a password itself.
   - The browser may keep Supabase's provider-managed session because that is
     how a static SPA stays signed in. Do not copy tokens into custom storage.
   - mbm_cloud_identity_v1 is deliberately NOT authentication. It is a small,
     non-secret offline hint used only so standalone games can keep choosing the
     same local save slot when the network is unavailable. RLS-protected data
     always requires a real Supabase session.
   - Missing cloud configuration fails CLOSED. There is no local-password
     fallback in this module.
*/
(function (w, d) {
  'use strict';
  if (w.MBMAccount) return;

  var SENTINEL = 'mbm-accounts-members-mailing-2026-08-08';
  var IDENTITY_KEY = 'mbm_cloud_identity_v1';
  var LEGACY_SESSION = 'mbm_session';
  var LEGACY_USERS = 'mbm_users';
  var listeners = [];
  var sb = null;
  var authSubscription = null;
  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });

  var state = {
    sentinel: SENTINEL,
    ready: false,
    configured: false,
    online: navigator.onLine !== false,
    provider: 'supabase',
    user: null,
    profile: null,
    member: null,
    recovery: false,
    config: null,
    error: ''
  };

  function clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }
  function safeJSON(value, fallback) {
    try { return JSON.parse(value); } catch (e) { return fallback; }
  }
  function normaliseEmail(value) { return String(value || '').trim().toLowerCase(); }
  function emailLooksValid(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(value)); }
  function nowISO() { return new Date().toISOString(); }
  function originURL(path) { return location.origin + path; }
  function emit() {
    var snap = snapshot();
    listeners.slice().forEach(function (fn) { try { fn(snap); } catch (e) {} });
    try { w.dispatchEvent(new CustomEvent('mbm:account-state', { detail: snap })); } catch (e) {}
  }
  function snapshot() {
    return {
      sentinel: state.sentinel,
      ready: state.ready,
      configured: state.configured,
      online: state.online,
      provider: state.provider,
      user: clone(state.user),
      profile: clone(state.profile),
      member: clone(state.member),
      recovery: state.recovery,
      config: state.config ? {
        mailing: clone(state.config.mailing || {}),
        accountsEnabled: !!(state.config.accounts && state.config.accounts.enabled)
      } : null,
      error: state.error
    };
  }
  function publicError(err, fallback) {
    var message = String((err && err.message) || err || '').toLowerCase();
    if (/invalid login|invalid.*credential/.test(message)) return 'That email and password did not match.';
    if (/email not confirmed/.test(message)) return 'Please confirm your email before signing in.';
    if (/already registered|already been registered|user already/.test(message)) return 'An account already exists for that email. Try logging in or resetting the password.';
    if (/password.*(short|least|weak)|weak password/.test(message)) return 'Please choose a stronger password of at least 10 characters.';
    if (/rate limit|too many/.test(message)) return 'Too many attempts. Please wait a little and try again.';
    if (/network|fetch|offline|failed to fetch/.test(message)) return 'The account service could not be reached. Check your connection and try again.';
    if (/version_conflict|40001/.test(message)) return 'Your account changed on another device. Reloading the latest copy…';
    return fallback || 'Something went wrong. Please try again.';
  }

  function readOfflineIdentity() {
    try {
      var x = safeJSON(localStorage.getItem(IDENTITY_KEY), null);
      if (!x || !x.id || !x.email) return null;
      return { id: String(x.id), email: normaliseEmail(x.email), name: String(x.name || ''), cloud: true, offlineHint: true };
    } catch (e) { return null; }
  }
  function writeOfflineIdentity(user, profile) {
    try {
      if (!user) { localStorage.removeItem(IDENTITY_KEY); return; }
      localStorage.setItem(IDENTITY_KEY, JSON.stringify({
        id: user.id,
        email: user.email,
        name: (profile && (profile.display_name || profile.name)) || user.name || '',
        savedAt: Date.now()
      }));
    } catch (e) {}
  }
  function legacyLocalProfile() {
    try {
      var email = normaliseEmail(localStorage.getItem(LEGACY_SESSION));
      var users = safeJSON(localStorage.getItem(LEGACY_USERS), {});
      var rec = email && users && users[email];
      if (!email || !rec) return null;
      return { email: email, name: String(rec.name || '') };
    } catch (e) { return null; }
  }

  function configLooksReal(a) {
    if (!a || a.enabled !== true || a.provider !== 'supabase') return false;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(a.supabaseUrl || '').trim())) return false;
    return String(a.supabaseAnonKey || '').trim().length >= 20;
  }

  function loadConfig() {
    return fetch('/site.json', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('site config HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var f = (j && j.features) || {};
        state.config = { accounts: f.accounts || {}, mailing: f.mailing || {} };
        state.configured = configLooksReal(state.config.accounts);
        return state.config;
      });
  }

  function fromSession(session) {
    if (!session || !session.user) return null;
    var u = session.user, md = u.user_metadata || {};
    return {
      id: u.id,
      email: normaliseEmail(u.email),
      name: String(md.display_name || md.name || md.full_name || ''),
      emailVerified: !!u.email_confirmed_at,
      createdAt: u.created_at || '',
      cloud: true
    };
  }

  function emptyMember() {
    return { schema: 1, favourites: {} };
  }
  function normaliseMemberData(value) {
    var data = value && typeof value === 'object' ? clone(value) : emptyMember();
    if (data.schema !== 1) data.schema = 1;
    if (!data.favourites || typeof data.favourites !== 'object' || Array.isArray(data.favourites)) data.favourites = {};
    return data;
  }
  function mergeFavouriteMaps(a, b) {
    var out = {}, keys = {};
    Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { keys[k] = true; });
    Object.keys(keys).forEach(function (href) {
      var A = (a || {})[href], B = (b || {})[href];
      if (!A) { out[href] = B; return; }
      if (!B) { out[href] = A; return; }
      var at = Date.parse(A.updatedAt || 0) || 0, bt = Date.parse(B.updatedAt || 0) || 0;
      out[href] = bt > at ? B : A;
    });
    return out;
  }
  function mergeMemberData(a, b) {
    a = normaliseMemberData(a); b = normaliseMemberData(b);
    return { schema: 1, favourites: mergeFavouriteMaps(a.favourites, b.favourites) };
  }

  function loadProfile(userId) {
    return sb.from('profiles').select('id,display_name,name,tier,created_at,updated_at').eq('id', userId).maybeSingle()
      .then(function (r) {
        if (r.error) throw r.error;
        return r.data || null;
      });
  }
  function loadMember(userId) {
    return sb.from('member_data').select('user_id,data,version,updated_at').eq('user_id', userId).maybeSingle()
      .then(function (r) {
        if (r.error) throw r.error;
        if (r.data) return r.data;
        return sb.from('member_data').insert({ user_id: userId, data: emptyMember(), version: 1 }).select('user_id,data,version,updated_at').single()
          .then(function (ins) { if (ins.error) throw ins.error; return ins.data; });
      });
  }
  function hydrate(session) {
    var user = fromSession(session);
    state.user = user;
    state.profile = null;
    state.member = null;
    if (!user) { writeOfflineIdentity(null); emit(); return Promise.resolve(null); }
    return Promise.all([loadProfile(user.id), loadMember(user.id)])
      .then(function (rows) {
        state.profile = rows[0];
        state.member = rows[1];
        if (state.profile) state.user.name = state.profile.display_name || state.profile.name || state.user.name;
        writeOfflineIdentity(state.user, state.profile);
        state.error = '';
        emit();
        return state.user;
      }).catch(function (err) {
        state.error = publicError(err, 'You are signed in, but your member data could not be loaded.');
        writeOfflineIdentity(state.user, state.profile);
        emit();
        return state.user;
      });
  }

  function initSupabase() {
    var a = state.config.accounts;
    return import(/* @vite-ignore */ '/assets/vendor/supabase-js-2.112.2.esm.js')
      .then(function (mod) {
        sb = mod.createClient(String(a.supabaseUrl).replace(/\/+$/, ''), String(a.supabaseAnonKey), {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        var sub = sb.auth.onAuthStateChange(function (event, session) {
          state.recovery = event === 'PASSWORD_RECOVERY' ? true : (event === 'SIGNED_OUT' ? false : state.recovery);
          setTimeout(function () { hydrate(session); }, 0);
        });
        authSubscription = sub && sub.data && sub.data.subscription;
        return sb.auth.getSession().then(function (r) {
          if (r.error) throw r.error;
          return hydrate(r.data && r.data.session);
        });
      });
  }

  function requireConfigured() {
    if (!state.configured) return Promise.reject(new Error('Account service is not configured.'));
    if (navigator.onLine === false) return Promise.reject(new Error('offline'));
    // The client is loaded on demand. Every action route reaches the service
    // through here, so this is the one place that has to make sure it exists.
    if (sb) return Promise.resolve();
    return initSupabase().then(function () {
      if (!sb) throw new Error('Account service is not configured.');
    });
  }
  function requireUser() {
    return requireConfigured().then(function () {
      if (!state.user) throw new Error('Please log in first.');
      return state.user;
    });
  }

  function register(displayName, email, password) {
    displayName = String(displayName || '').trim(); email = normaliseEmail(email); password = String(password || '');
    if (!emailLooksValid(email)) return Promise.reject(new Error('Please enter a valid email address.'));
    if (password.length < 10) return Promise.reject(new Error('Please choose a stronger password of at least 10 characters.'));
    return requireConfigured().then(function () {
      return sb.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: originURL('/account/'),
          data: { display_name: displayName, name: displayName }
        }
      });
    }).then(function (r) {
      if (r.error) throw r.error;
      return { needsConfirmation: !(r.data && r.data.session), email: email };
    }).catch(function (err) { throw new Error(publicError(err, 'Could not create the account.')); });
  }
  function login(email, password) {
    email = normaliseEmail(email); password = String(password || '');
    if (!emailLooksValid(email) || !password) return Promise.reject(new Error('Enter your email and password.'));
    return requireConfigured().then(function () { return sb.auth.signInWithPassword({ email: email, password: password }); })
      .then(function (r) { if (r.error) throw r.error; return hydrate(r.data && r.data.session); })
      .catch(function (err) { throw new Error(publicError(err, 'Could not log in.')); });
  }
  function logout() {
    if (!sb) { state.user = null; state.profile = null; state.member = null; writeOfflineIdentity(null); emit(); return Promise.resolve(); }
    return sb.auth.signOut({ scope: 'local' }).then(function (r) {
      if (r.error) throw r.error;
      state.user = null; state.profile = null; state.member = null; state.recovery = false; writeOfflineIdentity(null); emit();
    }).catch(function (err) { throw new Error(publicError(err, 'Could not log out cleanly.')); });
  }
  function resetPassword(email) {
    email = normaliseEmail(email);
    if (!emailLooksValid(email)) return Promise.reject(new Error('Enter the email address used for your account.'));
    return requireConfigured().then(function () {
      return sb.auth.resetPasswordForEmail(email, { redirectTo: originURL('/account/?mode=recovery') });
    }).then(function (r) { if (r.error) throw r.error; return true; })
      .catch(function (err) { throw new Error(publicError(err, 'Could not send a reset link.')); });
  }
  function resendVerification(email) {
    email = normaliseEmail(email);
    if (!emailLooksValid(email)) return Promise.reject(new Error('Enter the account email address.'));
    return requireConfigured().then(function () {
      return sb.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: originURL('/account/') } });
    }).then(function (r) { if (r.error) throw r.error; return true; })
      .catch(function (err) { throw new Error(publicError(err, 'Could not resend the verification email.')); });
  }
  function updatePassword(password) {
    password = String(password || '');
    if (password.length < 10) return Promise.reject(new Error('Please choose a password of at least 10 characters.'));
    return requireUser().then(function () { return sb.auth.updateUser({ password: password }); })
      .then(function (r) { if (r.error) throw r.error; state.recovery = false; emit(); return true; })
      .catch(function (err) { throw new Error(publicError(err, 'Could not update the password.')); });
  }
  function updateDisplayName(name) {
    name = String(name || '').trim().slice(0, 80);
    if (!name) return Promise.reject(new Error('Enter a display name first.'));
    return requireUser().then(function (u) {
      return sb.from('profiles')
        .update({ display_name: name, name: name, updated_at: nowISO() })
        .eq('id', u.id)
        .select('id,display_name,name,tier,created_at,updated_at')
        .single();
    }).then(function (r) {
      if (r.error) throw r.error;
      state.profile = r.data; state.user.name = name; writeOfflineIdentity(state.user, state.profile); emit(); return clone(r.data);
    }).catch(function (err) { throw new Error(publicError(err, 'Could not update your account name.')); });
  }

  function saveMemberData(localPatch, attempt) {
    attempt = attempt || 0;
    return requireUser().then(function (u) {
      return loadMember(u.id).then(function (fresh) {
        var merged = mergeMemberData(fresh.data, localPatch);
        return sb.rpc('update_member_data', { p_expected_version: fresh.version, p_data: merged })
          .then(function (r) {
            if (r.error) throw r.error;
            var row = Array.isArray(r.data) ? r.data[0] : r.data;
            if (!row) throw new Error('version_conflict');
            state.member = row; state.error = ''; emit(); return clone(row);
          });
      });
    }).catch(function (err) {
      if (/version_conflict|40001/i.test(String((err && err.message) || err)) && attempt < 2) return saveMemberData(localPatch, attempt + 1);
      throw new Error(publicError(err, 'Could not sync that change. Your existing server copy has not been deleted.'));
    });
  }
  function setFavourite(href, title, saved) {
    href = String(href || '').trim(); title = String(title || '').trim().slice(0, 120);
    if (!/^\//.test(href) || /^\/\//.test(href)) return Promise.reject(new Error('Only Made by Matt links can be saved here.'));
    var current = state.member ? normaliseMemberData(state.member.data) : emptyMember();
    current.favourites[href] = { href: href, title: title || href, saved: !!saved, updatedAt: nowISO() };
    return saveMemberData(current);
  }
  function favouriteMap() {
    return state.member ? clone(normaliseMemberData(state.member.data).favourites) : {};
  }
  function savedFavourites() {
    var map = favouriteMap();
    return Object.keys(map).map(function (k) { return map[k]; }).filter(function (x) { return x && x.saved; })
      .sort(function (a, b) { return String(a.title).localeCompare(String(b.title)); });
  }

  function migrateLegacyDisplayName() {
    var legacy = legacyLocalProfile();
    if (!legacy || !legacy.name) return Promise.reject(new Error('No old on-device display name was found.'));
    return updateDisplayName(legacy.name).then(function (r) {
      try { localStorage.setItem('mbm_legacy_profile_migrated_v1', JSON.stringify({ at: Date.now(), from: legacy.email, to: state.user && state.user.email })); } catch (e) {}
      return r;
    });
  }
  function clearLegacyAccount() {
    try { localStorage.removeItem(LEGACY_SESSION); localStorage.removeItem(LEGACY_USERS); return true; } catch (e) { return false; }
  }

  function deleteAccount() {
  return requireUser().then(function () {
    return sb.functions.invoke('delete-account', { body: { confirm: true } });
  }).then(function (r) {
    if (r.error) throw r.error;
    // The Edge Function has removed the Auth identity and account rows.
    // Also clear Supabase's provider-managed browser session so a reload
    // cannot revive a stale local session after successful deletion.
    return sb.auth.signOut({ scope: 'local' }).catch(function () { return null; });
  }).then(function () {
    state.user = null; state.profile = null; state.member = null; state.recovery = false;
    writeOfflineIdentity(null); emit(); return true;
  }).catch(function (err) { throw new Error(publicError(err, 'Automatic deletion is not available yet. Please use the deletion contact shown on this page.')); });
}

  /* Mailing unsubscribe for a signed-in user. The address is derived from the
     verified JWT server-side and is deliberately never sent from here, so this
     control cannot be pointed at anybody else's address. */
  function unsubscribeMailing() {
    return requireUser().then(function () {
      return sb.functions.invoke('unsubscribe-mailing-list', { body: {} });
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data && r.data.state) || 'unsubscribed';
    }).catch(function (err) {
      throw new Error(publicError(err, 'Could not update your mailing preferences. You can still use the unsubscribe link in any mailing.'));
    });
  }

  function applyAccountAudienceNotice() {
    var form = d.getElementById('registerForm');
    if (!form || d.getElementById('adultAccountNotice')) return;
    var notice = d.createElement('p');
    notice.id = 'adultAccountNotice';
    notice.className = 'ma-account-audience';
    notice.innerHTML = '<b>Adult and teacher accounts.</b> Made by Matt accounts are intended for adults and teachers. Pupils can use public Games, Lessons, Apps, Tools and Resources without creating an account.';
    form.insertBefore(notice, form.firstChild);
  }

  function refresh() {
    if (!sb || !state.configured) return Promise.resolve(snapshot());
    return sb.auth.getSession().then(function (r) { if (r.error) throw r.error; return hydrate(r.data && r.data.session); }).then(snapshot);
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    try { fn(snapshot()); } catch (e) {}
    return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
  }

  function needsClientAtBoot() {
    // A discovery page has no reason to pull an auth client before anyone has
    // asked for an account - the same principle as making no network request
    // on typing, and none to YouTube before a deliberate Play. Load it at boot
    // only where there is a session to restore or an account surface to serve;
    // everywhere else requireConfigured() loads it on first use.
    try {
      var path = String(w.location && w.location.pathname || '');
      if (/^\/(account|members)\//.test(path)) return true;
      if (d.querySelector('[data-mbm-account-form], [data-mbm-account-panel], [data-mbm-member-panel]')) return true;
      var store = w.localStorage;
      for (var i = 0; i < store.length; i++) {
        var key = store.key(i);
        // supabase-js persists its session under sb-<project-ref>-auth-token
        if (key && /^sb-.*-auth-token$/.test(key)) return true;
      }
    } catch (e) { return true; }
    return false;
  }

  function boot() {
    applyAccountAudienceNotice();
    loadConfig().then(function () {
      if (!state.configured) {
        state.error = 'Cloud account configuration is not active yet.';
        state.user = null;
        state.profile = null;
        state.member = null;
        return null;
      }
      if (!needsClientAtBoot()) return null;
      return initSupabase();
    }).catch(function (err) {
      state.configured = false;
      state.error = publicError(err, 'The account service could not be initialised.');
      state.user = null;
      state.profile = null;
      state.member = null;
    }).then(function () {
      state.ready = true;
      emit();
      readyResolve(snapshot());
    });
  }

  w.addEventListener('online', function () { state.online = true; emit(); if (state.configured) refresh(); });
  w.addEventListener('offline', function () { state.online = false; emit(); });
  w.addEventListener('pagehide', function () { try { if (authSubscription) authSubscription.unsubscribe(); } catch (e) {} }, { once: true });

  w.MBMAccount = {
    sentinel: SENTINEL,
    ready: ready,
    get state() { return snapshot(); },
    subscribe: subscribe,
    register: register,
    login: login,
    logout: logout,
    resetPassword: resetPassword,
    resendVerification: resendVerification,
    updatePassword: updatePassword,
    updateDisplayName: updateDisplayName,
    setFavourite: setFavourite,
    favouriteMap: favouriteMap,
    savedFavourites: savedFavourites,
    migrateLegacyDisplayName: migrateLegacyDisplayName,
    legacyLocalProfile: legacyLocalProfile,
    clearLegacyAccount: clearLegacyAccount,
    readOfflineIdentity: readOfflineIdentity,
    deleteAccount: deleteAccount,
    unsubscribeMailing: unsubscribeMailing,
    refresh: refresh,
    _mergeMemberData: mergeMemberData,
    _normaliseMemberData: normaliseMemberData,
    _publicError: publicError
  };

  boot();
})(window, document);
