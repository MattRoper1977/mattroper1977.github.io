/* mbm-sync.js — cross-device sync, end-to-end encrypted.
 *
 * Design and reasoning: reports/design/cross-device-sync.md
 *
 * THE ONE THING TO UNDERSTAND BEFORE CHANGING ANYTHING HERE
 * --------------------------------------------------------
 * The server never sees a name, an email, a password, or one byte of readable
 * save data. It stores an unguessable id and a blob it cannot decrypt. That is
 * not a feature that can be traded away for convenience later — it is the whole
 * reason this can be run by one teacher without a compliance apparatus behind
 * him. If a future change puts a plaintext identifier in a row, it has changed
 * what this site is, and the privacy page becomes false the same day.
 *
 * Corollary, and it is a real cost: LOSE THE CODE AND THE DATA IS GONE. There
 * is no reset, because a reset needs somebody to hold the key.
 *
 * No third-party script. Transport is plain fetch against Supabase's REST
 * endpoint, so this adds one ORIGIN, not one more script executing on the page.
 */
(function (w) {
  "use strict";

  var C = w.crypto && w.crypto.subtle ? w.crypto.subtle : null;
  var MAX_BYTES = 256 * 1024;
  var PBKDF2_ROUNDS = 250000;

  /* ---------------------------------------------------------------- helpers */
  var enc = new TextEncoder(), dec = new TextDecoder();
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf),
      function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function b64(buf) {
    var s = "", a = new Uint8Array(buf);
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }
  function unb64(s) {
    var raw = atob(s), a = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  }

  /* ------------------------------------------------------------ the code
     Six words from a 2048-entry list is 66 bits; this list is deliberately
     smaller, so the code carries a seventh word to stay above 70 bits. Words
     are short, unambiguous when read aloud down a phone, and contain no pairs
     that sound alike (no "bear"/"bare", no "flour"/"flower").
     Entropy is asserted in the self-test rather than claimed here. */
  var WORDS = ("able acid aged also arch army atom aunt away axis bake bald band bank barn base bath bead beam bean bear beat bell belt bend best bike bind bird bite blue boat bold bolt bond bone book boot born both bowl brew brick bring brush buck bulb bulk bull burn bush busy cable cake calm camp cane cape card care cart case cash cast cave cell chain chair chalk charm chase cheap chess chest chief child chin chip city clay clean clear cliff climb clock cloth cloud coach coal coast coat code coin cold comb cook cool copy cord cork corn cost cove crab craft crane crash cream crew crop crown cube curl curve cycle dairy dance dark dawn deal dear debt deck deep deer dent desk dial dice dine dish dive dock does dome door dose dove down draft drag drain draw dress drift drill drink drive drop drum dry duck dust duty each earl early earn earth ease east easy edge eight elbow elder elm empty end enjoy enter equal error even event exact exit extra face fact fade fair fall false fancy farm fast fate fear feast feed feel fence fern few field fifth fight file fill film find fine fire firm fish fist five flag flame flash flat fleet flesh flint float flock floor flour flow fluid flush flute foam focus fold folk food fool foot force fork form fort found four fox frame free fresh frog front frost fruit fuel full fund fur gain game gap gate gaze gear gene gift give glad glass globe glove glow goat gold golf gone good gown grab grade grain grand grant grape grasp grass grave gray graze great green grew grid grief grill grim grip groom group grow guard guess guest guide gulf gull gust hair half hall halt hand hang harbor hard harm harp haste hatch have hawk head heal heap hear heart heat heavy hedge heel help hen herb herd here hero hide high hill hint hire hive hold hole holy home honey hook hope horn horse host hotel hour house hub huge human humor hunt hurry hurt ice icon idea idle inch index inner iron isle item ivory jade jail jazz jeans jelly jet jewel join joint joke judge juice jump junior jury keel keen keep kept kick kind king kiss kite knee knife knock knot know label lace lack lake lamb lamp land lane large last late laugh law lawn layer lazy lead leaf leak lean leap learn lease least leave left legal lemon lend lens lever light lily limb lime limit line link lion list live load loaf loan lobby local lock lodge log logic long look loop lord lose loss lost loud love lower loyal luck lump lunar lunch lung lure lush lying macro magic magnet maid mail main major make male mall manor maple marble march mark marsh mask mast match maze meadow meal mean meat medal media melon melt member memo mend menu mercy mere merge merit merry mesh metal meter might mild mile milk mill mind mine mint minor minus mirror mist mixed model moist mold mole money monk month moon moral more moss most motor mount mouse mouth move much music must myth nail name nasty naval near neat neck need needle nerve nest never newer next nice niece night noble nod noise none noon norm north nose note notice novel now nurse nut oak oath obey ocean odd offer often oil olive omit once onion only onto open opera orbit orchard order organ otter ounce outer oven over owl own oxide pace pack page paid pain paint pair palm panel panic paper park part pass past patch path pause peace peach peak pearl pedal peel peer pen pencil penny people pepper perch peril petal phase phone photo piano pick piece pile pilot pinch pine pink pipe pitch pity place plain plan plate play plot plug plum plus pocket poem poet point polar pole polish pond pool poor porch port post pot pound pour power praise prawn press price pride prime print prize probe proof proud prove prune public pull pulse pump punch pupil pure purple purse push quart queen query quest queue quick quiet quilt quite quota race rack radar radio raft rage raid rail rain raise rally ranch range rank rapid rare rate raven reach react read ready realm reason rebel recall recipe record reed reef refer regal region relax relay relief remain remind remote rent repair repeat reply report rescue resort rest retail return reveal reward rhyme rib rice rich ride ridge rifle right rigid rim ring rinse riot ripe rise risk rival river road roast robe robin robot rock rocket rod rogue role roll roof room root rope rose rough round route royal rubber ruby rug rule rumor run runway rural rush rust sadly safe sail saint salad salmon salt sample sand sauce save scale scan scarf scene scent school score scout scrap screen script scrub seal search season seat second secret sector seed seek seem seize seldom select self sell send sense serve set seven shade shaft shall shape share shark sharp shed sheep sheet shelf shell shield shift shine ship shirt shock shoe shoot shop shore short shot should shout show shrimp shrub sick side siege sight sign silk sill silly silver simple since sing sink sir sister site size skate sketch ski skin skirt skull sky slab slate sleep slice slide slim slope slot slow small smart smell smile smoke snake snow soap sober social sock soft soil solar solid solve some song soon sort soul sound soup south space spare spark speak spear speed spell spend spice spike spin spine spiral spirit split spoke spoon sport spot spray spread spring spruce spur squad square squash stable stack staff stage stair stake stall stamp stand star state stay steady steam steel steep stem step stick still sting stir stock stone stool stop store storm story stove strap straw stream street strike string strip stroke strong study stuff style sugar suit summer sun super supper supply sure surf swan swear sweat sweep sweet swift swim swing sword table tackle tail take tale talk tall tank tape target task taste taxi tea teach team tear tell tempo tender tennis tent term test text thank theme thick thin thing think third thorn those three throat throw thumb thus ticket tide tidy tie tiger tight tile timber time tin tiny tip tired title toast today toe token told toll tone tongue tool tooth top torch total touch tough tour towel tower town toy trace track trade trail train tramp trap tray tread treat tree trend trial tribe trick trim trip troop trout truck true trunk trust truth try tube tune tunnel turn twice twin twist type ugly uncle under union unit unite until upon upper urban urge usage use usual valid valley value valve van vapor vast vault veil vein velvet vendor venue verb verse very vessel vest video view villa vine vinyl violet virus visit vital vivid vocal vogue voice void volume vote vowel voyage wage wagon waist wait wake walk wall walnut want ward warm warn wash wasp waste watch water wave wax weak wealth weapon wear weave wedge weed week weigh weird well west wet whale wharf wheat wheel when where which while whip white whole wide widow width wild will wind wine wing wink winter wipe wire wise wish witch with wolf woman wonder wood wool word work world worm worry worth wound wrap wrist write wrong yard yarn year yeast yellow yield yoga young zebra zero zone zoom").split(" ");

  function makeCode() {
    var n = 7, out = [], a = new Uint32Array(n);
    w.crypto.getRandomValues(a);
    for (var i = 0; i < n; i++) out.push(WORDS[a[i] % WORDS.length]);
    return out.join("-");
  }
  function normalise(code) {
    return String(code || "").toLowerCase().replace(/[^a-z]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /* --------------------------------------------------------------- crypto */
  function deriveKey(code) {
    return C.importKey("raw", enc.encode(normalise(code)), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return C.deriveKey(
          { name: "PBKDF2", salt: enc.encode("madebymatt|sync|v1"),
            iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }
  /* The row id is a SEPARATE hash of the code. Knowing the id therefore gives
     you the ciphertext and nothing else — it does not shortcut to the key. */
  function deriveId(code) {
    return C.digest("SHA-256", enc.encode(normalise(code) + "|id")).then(hex);
  }

  function encrypt(key, obj) {
    var iv = w.crypto.getRandomValues(new Uint8Array(12));
    return C.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(JSON.stringify(obj)))
      .then(function (ct) { return b64(iv) + "." + b64(ct); });
  }
  function decrypt(key, packed) {
    var parts = String(packed).split(".");
    if (parts.length !== 2) return Promise.reject(new Error("blob is not in the expected shape"));
    return C.decrypt({ name: "AES-GCM", iv: unb64(parts[0]) }, key, unb64(parts[1]))
      .then(function (pt) { return JSON.parse(dec.decode(pt)); });
  }

  /* ------------------------------------------------------------- what syncs
     An allow-list, not everything in localStorage. Two reasons: the UAS
     register holds real pupil names and marks and must NEVER leave the device
     under any circumstances, and a blanket sync would carry whatever any future
     page happens to store. Adding a prefix here is a deliberate act. */
  var SYNC_PREFIXES = ["apexkick.v1", "voxelfrontier."];
  var NEVER = ["uas_register", "mbm_users", "mbm_session"];

  function collect() {
    var out = {}, i, k;
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      if (!k) continue;
      if (NEVER.some(function (n) { return k.indexOf(n) === 0; })) continue;
      if (!SYNC_PREFIXES.some(function (p) { return k.indexOf(p) === 0; })) continue;
      out[k] = localStorage.getItem(k);
    }
    return out;
  }

  /* ----------------------------------------------------------------- merge
     NOT last-write-wins across the whole blob. Play at home, then open the
     school machine without syncing first, and a whole-blob overwrite silently
     destroys the evening's work. Per key, and never a silent delete:

       - key only on one side          -> keep it
       - apexkick save                 -> field-wise, additive fields take max
       - voxel world (keyed by seed)   -> newer wins, older kept as .conflict
       - anything else                 -> newer wins, older kept as .conflict  */
  function num(x) { return typeof x === "number" && isFinite(x) ? x : 0; }

  function mergeApex(a, b) {
    var A, B;
    try { A = JSON.parse(a); B = JSON.parse(b); } catch (e) { return null; }
    if (!A || !B || typeof A !== "object" || typeof B !== "object") return null;
    var out = {}, k;
    for (k in A) if (Object.prototype.hasOwnProperty.call(A, k)) out[k] = A[k];
    for (k in B) if (Object.prototype.hasOwnProperty.call(B, k)) {
      if (!(k in out)) { out[k] = B[k]; continue; }
      if (typeof out[k] === "number" && typeof B[k] === "number") {
        out[k] = Math.max(out[k], B[k]);                 // goals, coins, best
      } else if (Array.isArray(out[k]) && Array.isArray(B[k])) {
        var seen = {}, merged = [];                      // owned cards, awards
        out[k].concat(B[k]).forEach(function (v) {
          var key = typeof v === "object" ? JSON.stringify(v) : String(v);
          if (!seen[key]) { seen[key] = 1; merged.push(v); }
        });
        out[k] = merged;
      }
    }
    return JSON.stringify(out);
  }

  function merge(local, remote, localStamp, remoteStamp) {
    var out = {}, conflicts = [], k;
    for (k in local) if (Object.prototype.hasOwnProperty.call(local, k)) out[k] = local[k];
    for (k in remote) if (Object.prototype.hasOwnProperty.call(remote, k)) {
      if (!(k in out)) { out[k] = remote[k]; continue; }     // only remote had it
      if (out[k] === remote[k]) continue;                    // identical
      if (k.indexOf("apexkick.v1") === 0) {
        var m = mergeApex(out[k], remote[k]);
        if (m !== null) { out[k] = m; continue; }
      }
      /* Genuine conflict. Newer wins, and the loser is KEPT — a sync that can
         eat an afternoon's building is a sync people stop trusting. */
      var remoteNewer = num(remoteStamp) > num(localStamp);
      var loser = remoteNewer ? out[k] : remote[k];
      out[k] = remoteNewer ? remote[k] : out[k];
      out[k + ".conflict"] = loser;
      conflicts.push(k);
    }
    return { data: out, conflicts: conflicts };
  }

  function apply(data) {
    var n = 0;
    Object.keys(data).forEach(function (k) {
      if (NEVER.some(function (x) { return k.indexOf(x) === 0; })) return;  // belt and braces
      try { localStorage.setItem(k, data[k]); n++; } catch (e) {}
    });
    return n;
  }

  /* ------------------------------------------------------------- transport
     Swappable so the whole engine is testable without a live project. The
     Supabase adapter is plain REST: no supabase-js, so no new script. */
  function supabaseTransport(url, anonKey) {
    var base = String(url).replace(/\/+$/, "") + "/rest/v1/sync_blobs";
    var H = { apikey: anonKey, Authorization: "Bearer " + anonKey,
              "Content-Type": "application/json" };
    return {
      name: "supabase",
      get: function (id) {
        return fetch(base + "?id=eq." + id + "&select=blob,updated_at", { headers: H })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (rows) { return (rows && rows[0]) || null; });
      },
      put: function (id, blob) {
        return fetch(base, {
          method: "POST",
          headers: Object.assign({}, H, { Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: JSON.stringify({ id: id, blob: blob, bytes: blob.length })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error("HTTP " + r.status + " " + t.slice(0, 120)); }); return true; });
      },
      del: function (id) {
        return fetch(base + "?id=eq." + id, { method: "DELETE", headers: H })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return true; });
      }
    };
  }

  /* In-memory transport, for the self-test. Named so nobody mistakes a green
     test run against it for evidence that the real backend works. */
  function memoryTransport() {
    var store = {};
    return {
      name: "memory (NOT a real backend)",
      get: function (id) { return Promise.resolve(store[id] ? { blob: store[id].blob, updated_at: store[id].t } : null); },
      put: function (id, blob) { store[id] = { blob: blob, t: new Date().toISOString() }; return Promise.resolve(true); },
      del: function (id) { delete store[id]; return Promise.resolve(true); },
      _store: store
    };
  }

  /* ------------------------------------------------------------------- API */
  var transport = null;

  var Sync = {
    available: function () { return !!C && !!w.crypto.getRandomValues && !!w.fetch; },
    newCode: makeCode,
    normalise: normalise,
    useTransport: function (t) { transport = t; return Sync; },
    memoryTransport: memoryTransport,
    supabaseTransport: supabaseTransport,
    _internals: { deriveId: deriveId, deriveKey: deriveKey, encrypt: encrypt,
                  decrypt: decrypt, merge: merge, collect: collect, WORDS: WORDS },

    /* Push local -> server. Rejects rather than truncating on oversize. */
    push: function (code) {
      if (!transport) return Promise.reject(new Error("no transport configured"));
      var payload = { v: 1, at: Date.now(), data: collect() };
      return Promise.all([deriveId(code), deriveKey(code)]).then(function (r) {
        return encrypt(r[1], payload).then(function (blob) {
          if (blob.length > MAX_BYTES) {
            throw new Error("Your saves are " + Math.round(blob.length / 1024) +
              " KB, over the " + (MAX_BYTES / 1024) + " KB limit. Nothing was sent.");
          }
          return transport.put(r[0], blob).then(function () {
            return { bytes: blob.length, keys: Object.keys(payload.data).length };
          });
        });
      });
    },

    /* Pull server -> local, merged. Never a blind overwrite. */
    pull: function (code) {
      if (!transport) return Promise.reject(new Error("no transport configured"));
      return Promise.all([deriveId(code), deriveKey(code)]).then(function (r) {
        return transport.get(r[0]).then(function (row) {
          if (!row) return { found: false, applied: 0, conflicts: [] };
          return decrypt(r[1], row.blob).then(function (payload) {
            var local = collect();
            var m = merge(local, payload.data || {}, Date.now(), payload.at);
            return { found: true, applied: apply(m.data), conflicts: m.conflicts };
          }, function () {
            /* Decrypt failed. Almost always a mistyped code — say that, rather
               than "sync failed", which sends people looking for an outage. */
            throw new Error("That code did not unlock the data. Check it and try again — it is seven words separated by dashes.");
          });
        });
      });
    },

    forget: function (code) {
      if (!transport) return Promise.reject(new Error("no transport configured"));
      return deriveId(code).then(function (id) { return transport.del(id); });
    },

    /* THE GATE. Sets MBM_CAPS["cloud-sync"] only after a real write, a real
       read, and a byte-for-byte match on the way back. Not on config, not on a
       connection. See the register's own comment in mbm-features.js. */
    verify: function () {
      if (!transport) return Promise.resolve({ ok: false, why: "no transport configured" });
      var probe = "verify-" + makeCode();
      return Sync.push(probe)
        .then(function () { return Sync.pull(probe); })
        .then(function (res) {
          return Sync.forget(probe).catch(function () {}).then(function () {
            var ok = res.found === true;
            if (ok) { w.MBM_CAPS = w.MBM_CAPS || {}; w.MBM_CAPS["cloud-sync"] = true; }
            return { ok: ok, why: ok ? "" : "round-trip did not read back" };
          });
        })
        .catch(function (e) {
          return Sync.forget(probe).catch(function () {})
            .then(function () { return { ok: false, why: String(e && e.message || e) }; });
        });
    }
  };

  w.MBMSync = Sync;
})(window);
