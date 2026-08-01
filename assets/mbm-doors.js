/* ============================================================================
   mbm-doors.js — renders site.json's doors[] into the homepage directory.

   Why this exists. site.json has carried a doors[] array for a long time and
   nothing ever read it: mbm-features.js consumes only j.features, so three
   games were added to doors[] over time and every one of them silently failed
   to appear on the homepage. Voxel Frontier, Medevac Frontier and Apex Kick
   were all configured correctly and all invisible. This makes doors[] a real
   consumer, so a correct entry appears and a wrong entry says so out loud.

   Contract
   --------
   Each door declares the zone it belongs to and is placed in that zone only:

     { "zone": "games",              // must match a [data-zone] container
       "title": "Apex Kick",
       "desc":  "...",
       "href":  "apexkick/",
       "countKey": "apex-kick",      // optional — wires the hits badge
       "art":   "apex-kick",         // optional — id of a <template> of SVG
       "badgeIcon": "🎮",            // optional — badge glyph
       "badgeLabel": "plays" }       // optional — badge noun

   Failure is loud. An unknown zone, a missing href or a malformed entry is
   reported to the console and skipped — the original fault was that a wrong
   entry did nothing whatsoever, so silence is the one behaviour this must not
   have. Rendering never throws: a bad door costs its own card, not the page.
   ========================================================================= */
(function () {
  "use strict";
  if (window.__mbmDoors) return;
  window.__mbmDoors = 1;

  var TAG = "[mbm-doors]";
  var problems = [];   // faults that cost a door its card
  var generated = 0;   // cards that fell through to generated art
  function bad(msg, door) {
    problems.push(msg);
    try {
      console.error(TAG + " " + msg + (door ? " — " + JSON.stringify(door) : ""));
    } catch (e) { /* console is not load-bearing */ }
  }
  /* Loud, but not a skip. `problems` is counted and reported as doors that did
     not render, so anything that still produces a card has to stay out of it —
     otherwise the tally at the end of render() states a number that is wrong. */
  function note(msg, door) {
    try {
      console.warn(TAG + " " + msg + (door ? " — " + JSON.stringify(door) : ""));
    } catch (e) { /* console is not load-bearing */ }
  }

  function siteRoot() {
    return location.pathname.indexOf("/") === 0 ? "/" : "";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ------------------------------------------------------------------------
     Generated card art — the floor under every door.

     buildCard() used to have a silent bare path: a door carrying neither
     `image` nor a resolvable `art` template got no artwork at all, and in the
     no-field case did not even say so. Two adversarial fixtures — a door with
     neither field, and a door whose `art` id has no <template> — rendered bare
     at every viewport. Removing the duplicate rail (792d903) did not close
     that; it removed one caller, not the hole.

     So: art is now derived rather than looked up. Nothing here is fetched,
     nothing is AI-made and nothing is stock — it is estate palette, estate
     geometry and the door's own words, composed deterministically. Same door,
     same card, every load and every machine.

     The recipe deliberately mirrors the Arcade's generated cards (0866d61):
     ground mixed over the estate navy, one geometric motif, the title's letters
     in Poppins, and the M mark in the corner. A reader who has seen one should
     recognise the other as the same thing.

     Doors carry no `hue` and no `icon`, so the seed is what a door actually
     has — title, badgeIcon, zone. The hash folds all three for the reason the
     Arcade commit records: seeding on one field alone made distinct entries
     come out as literally the same card.
     --------------------------------------------------------------------- */

  var NAVY = "#161D3D";
  var INK  = "#F6F1E4";
  /* Every one of these is already load-bearing in the nine hand-authored
     art-* templates in index.html. No new colour is introduced here. */
  var ACCENTS = ["#B9E6CD", "#F2A24A", "#A78BFA", "#6BAF57",
                 "#8FA3C8", "#F2E2A8", "#2F6BD1", "#D8AB86"];
  var MOTIFS = 8;

  /* FNV-1a with a murmur3 finaliser. The finaliser is not decoration: FNV's
     low bits are weak, and `hash % 8` reads only those. Without it the accent
     and motif draws came out correlated — 22 of the 64 combinations were ever
     used and one bucket took 54 of 396 samples. Avalanching first spreads them
     to 62 of 64 with a flat-ish histogram. */
  function hash32(s) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function mix(hexA, hexB, t) {
    function ch(h, i) { return parseInt(h.substr(1 + i * 2, 2), 16); }
    function hx(n) { n = Math.round(n); return (n < 16 ? "0" : "") + n.toString(16); }
    return "#" + hx(ch(hexA, 0) * t + ch(hexB, 0) * (1 - t)) +
                 hx(ch(hexA, 1) * t + ch(hexB, 1) * (1 - t)) +
                 hx(ch(hexA, 2) * t + ch(hexB, 2) * (1 - t));
  }

  /* Initials of the first two words that begin with a letter. "Y4–6 Science"
     gives YS rather than Y6, which is why the filter is on the leading
     character and not on the whole word. */
  function monogram(title) {
    var w = String(title == null ? "" : title).split(/[^0-9A-Za-z]+/)
      .filter(function (x) { return /^[A-Za-z]/.test(x); });
    if (!w.length) return "?";
    if (w.length === 1) return w[0].substr(0, 2).toUpperCase();
    return (w[0].charAt(0) + w[1].charAt(0)).toUpperCase();
  }

  /* Eight motifs, drawn recessed so the letters stay the subject. Each is sized
     and placed for the 120x96 box the estate's other card art uses, so the
     generated card sits at the same height as the authored ones under
     `.dx-prod svg{height:120px}` with no per-case CSS. */
  function motif(i, c) {
    switch (i % MOTIFS) {
      case 0: return '<circle cx="84" cy="44" r="29" fill="none" stroke="' + c + '" stroke-width="8"/>' +
                     '<circle cx="84" cy="44" r="12" fill="' + c + '"/>';
      case 1: return '<path d="M84 15 l21 21 -21 21 -21 -21Z" fill="' + c + '"/>' +
                     '<path d="M84 51 l14 14 -14 14 -14 -14Z" fill="' + c + '" opacity=".72"/>';
      case 2: return '<rect x="58" y="52" width="12" height="30" rx="3" fill="' + c + '"/>' +
                     '<rect x="76" y="34" width="12" height="48" rx="3" fill="' + c + '"/>' +
                     '<rect x="94" y="18" width="12" height="64" rx="3" fill="' + c + '"/>';
      case 3: return '<path d="M84 16 l30 52 -60 0Z" fill="' + c + '"/>';
      case 4: return '<g fill="' + c + '">' +
                     '<circle cx="62" cy="26" r="5"/><circle cx="84" cy="26" r="5"/><circle cx="106" cy="26" r="5"/>' +
                     '<circle cx="62" cy="48" r="5"/><circle cx="84" cy="48" r="5"/><circle cx="106" cy="48" r="5"/>' +
                     '<circle cx="62" cy="70" r="5"/><circle cx="84" cy="70" r="5"/><circle cx="106" cy="70" r="5"/></g>';
      case 5: return '<g fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
                     '<path d="M62 26 l20 20 -20 20"/><path d="M88 26 l20 20 -20 20"/></g>';
      case 6: return '<g fill="none" stroke="' + c + '" stroke-width="8" stroke-linecap="round">' +
                     '<path d="M84 16 v58"/><path d="M55 45 h58"/></g>';
      default: return '<g fill="none" stroke="' + c + '" stroke-width="6.5" stroke-linecap="round">' +
                     '<path d="M52 30 q16 -14 32 0 t32 0"/>' +
                     '<path d="M52 50 q16 -14 32 0 t32 0"/>' +
                     '<path d="M52 70 q16 -14 32 0 t32 0"/></g>';
    }
  }

  /* Returns an <svg> element. Never returns null — this is the floor. */
  function generatedArt(door, doc) {
    /* Accent and motif are drawn from two independent hashes rather than two
       slices of one, and the seed is reversed for the second so the two are
       not correlated. Titles that share a monogram — "Vortex" and "Voxelcraft"
       both give VO — then still differ by colour and shape. With one hash and
       5x6 combinations that pair came out as literally the same card; the
       Arcade's generated cards hit the same wall (0866d61) and the fix there
       was the same: widen the space and fold in more of the entry. 8x8 = 64. */
    var seed = String(door.title || "") + "|" + String(door.badgeIcon || "") +
               "|" + String(door.zone || "");
    var accent = ACCENTS[hash32(seed) % ACCENTS.length];
    var m = hash32(seed.split("").reverse().join("") + "#motif") % MOTIFS;
    var ground = mix(accent, NAVY, 0.14);
    var mid = mix(accent, NAVY, 0.40);

    var svg =
      '<svg viewBox="0 0 120 96" role="img" aria-label="' +
        esc(door.title) + ' — generated card">' +
        '<rect width="120" height="96" rx="10" fill="' + ground + '"/>' +
        '<g opacity=".55">' + motif(m, mid) + '</g>' +
        '<rect x="0" y="0" width="4.5" height="96" rx="2.2" fill="' + accent + '"/>' +
        '<text x="13" y="76" font-family="Poppins,Segoe UI,sans-serif" font-size="32"' +
          ' font-weight="800" fill="' + INK + '">' + esc(monogram(door.title)) + '</text>' +
        '<path d="M96 82 l3.4 -8.4 l3.4 5.4 l3.4 -5.4 l3.4 8.4" fill="none" stroke="' + INK +
          '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>' +
      '</svg>';

    // The HTML parser puts <svg> into the SVG namespace for us; every value
    // interpolated above is either a literal from this file or escaped.
    var wrap = doc.createElement("div");
    wrap.innerHTML = svg;
    return wrap.firstChild;
  }

  /* A door must be an object with a non-empty title, desc, href and zone.
     Returns null and reports when it is not. */
  function validate(door, i, zones) {
    var label = "door #" + i + (door && door.title ? ' "' + door.title + '"' : "");
    if (!door || typeof door !== "object" || Array.isArray(door)) {
      bad(label + " is not an object"); return null;
    }
    var missing = ["zone", "title", "desc", "href"].filter(function (k) {
      return typeof door[k] !== "string" || door[k].trim() === "";
    });
    if (missing.length) {
      bad(label + " is missing or has empty: " + missing.join(", "), door); return null;
    }
    if (!zones[door.zone]) {
      bad(label + ' declares unknown zone "' + door.zone + '" (known zones: ' +
          Object.keys(zones).join(", ") + ")", door);
      return null;
    }
    return door;
  }

  function buildCard(door, doc) {
    var a = doc.createElement("a");
    a.className = "dx-prod";
    a.setAttribute("href", door.href);
    if (door.countKey) a.setAttribute("data-mbm-count", door.countKey);

    // A door can carry either a photographic image or a template of SVG art.
    // image wins when both are present, so artwork can be swapped in config
    // without deleting the SVG fallback. If neither resolves, the card gets
    // generated art — there is no path out of here that appends nothing.
    var art = null;
    if (door.image) {
      var im = doc.createElement("img");
      im.className = "dx-art";
      im.setAttribute("src", door.image);
      im.setAttribute("alt", door.imageAlt || "");
      im.setAttribute("loading", "lazy");
      im.setAttribute("decoding", "async");
      if (door.imageW) im.setAttribute("width", door.imageW);
      if (door.imageH) im.setAttribute("height", door.imageH);
      art = im;
    } else if (door.art) {
      var tpl = doc.getElementById("art-" + door.art);
      if (tpl && tpl.content) art = tpl.content.cloneNode(true);
      else note('door "' + door.title + '" references missing art template "art-' + door.art +
                '" — generated art used instead', door);
    } else {
      // Previously this branch did nothing and said nothing: the card came out
      // bare and no check anywhere noticed. It is worth a line in the console.
      note('door "' + door.title + '" carries neither image nor art — generated art used instead', door);
    }
    if (!art) { art = generatedArt(door, doc); generated++; }
    a.appendChild(art);

    var b = doc.createElement("b");
    b.textContent = door.title;
    a.appendChild(b);

    var p = doc.createElement("p");
    p.textContent = door.desc;
    a.appendChild(p);

    if (door.countKey) {
      var badge = doc.createElement("span");
      badge.className = "mbm-hits-badge";
      badge.appendChild(doc.createTextNode((door.badgeIcon || "👀") + " "));
      var hits = doc.createElement("span");
      hits.className = "mbm-hits";
      hits.setAttribute("data-mbm-count-for", door.countKey);
      badge.appendChild(hits);
      badge.appendChild(doc.createTextNode(" "));
      var lab = doc.createElement("span");
      lab.className = "mbm-hits-lab";
      lab.textContent = door.badgeLabel || "opened";
      badge.appendChild(lab);
      a.appendChild(badge);
    }
    return a;
  }

  function render(doors) {
    var zones = {}, i;
    var nodes = document.querySelectorAll("[data-zone]");
    for (i = 0; i < nodes.length; i++) zones[nodes[i].getAttribute("data-zone")] = nodes[i];

    if (!nodes.length) { bad("no [data-zone] containers on the page — nothing to render into"); return; }
    if (!doors || !doors.length) { bad("site.json has no doors[] to render"); return; }

    var placed = 0;
    for (i = 0; i < doors.length; i++) {
      var d = validate(doors[i], i, zones);
      if (!d) continue;
      zones[d.zone].appendChild(buildCard(d, document));
      placed++;
    }

    // let the counter layer pick up the cards we just created
    try {
      if (window.MBM && typeof window.MBM.rescan === "function") window.MBM.rescan();
    } catch (e) { /* counters are decorative */ }

    if (problems.length) {
      bad(problems.length + " door(s) were skipped; " + placed + " rendered");
    }

    /* House rule, 1 Aug 2026: every "zero bad" assertion is published next to
       its population, because a coverage gate that can be satisfied by removing
       the population is a false zero. `data-doors` alone would go green if
       doors[] were emptied; read with `data-doors-art` it cannot.

         doors      — cards placed
         doors-art  — of those, how many carry artwork  (must equal doors)
         doors-gen  — of those, how many took generated art rather than authored

       A check should assert "N cards, 0 bare", never "0 bare". */
    var withArt = 0;
    for (i = 0; i < nodes.length; i++) {
      var cards = nodes[i].querySelectorAll("a.dx-prod");
      for (var k = 0; k < cards.length; k++) {
        if (cards[k].querySelector("svg, img")) withArt++;
      }
    }
    var root = document.documentElement;
    root.setAttribute("data-doors", String(placed));
    root.setAttribute("data-doors-art", String(withArt));
    root.setAttribute("data-doors-gen", String(generated));
    if (withArt !== placed) {
      bad("bare cards: " + (placed - withArt) + " of " + placed + " rendered doors have no artwork");
    }
  }

  function boot() {
    var url = siteRoot() + "site.json";
    var done = false;
    var t = setTimeout(function () {
      if (!done) { done = true; bad("site.json did not load within 5s — no doors rendered"); }
    }, 5000);

    /* The url carries site.json's content hash (tools/stamp-data.py), so a
       stale copy cannot be addressed rather than merely being revalidated —
       and the stamped url is then freely cacheable, which the old
       cache:"no-cache" prevented. If the stamp block is missing, MBM_STAMP is
       absent and this falls back to forced revalidation. */
    var s = window.MBM_STAMP ? window.MBM_STAMP(url) : { url: url, opts: { cache: "no-cache" } };

    fetch(s.url, s.opts)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (done) return;
        done = true; clearTimeout(t);
        render(j && j.doors);
      })
      .catch(function (e) {
        if (done) return;
        done = true; clearTimeout(t);
        bad("could not load or parse site.json (" + (e && e.message) + ") — no doors rendered");
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
