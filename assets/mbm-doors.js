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
  var problems = [];
  function bad(msg, door) {
    problems.push(msg);
    try {
      console.error(TAG + " " + msg + (door ? " — " + JSON.stringify(door) : ""));
    } catch (e) { /* console is not load-bearing */ }
  }

  function siteRoot() {
    return location.pathname.indexOf("/") === 0 ? "/" : "";
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

    if (door.art) {
      var tpl = doc.getElementById("art-" + door.art);
      if (tpl && tpl.content) a.appendChild(tpl.content.cloneNode(true));
      else bad('door "' + door.title + '" references missing art template "art-' + door.art + '"', door);
    }

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
    document.documentElement.setAttribute("data-doors", String(placed));
  }

  function boot() {
    var url = siteRoot() + "site.json";
    var done = false;
    var t = setTimeout(function () {
      if (!done) { done = true; bad("site.json did not load within 5s — no doors rendered"); }
    }, 5000);

    fetch(url, { cache: "no-cache" })
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
