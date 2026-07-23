/* Made by Matt — Live-Teach HUD v1
   One floating dock for the whole estate: timer, name picker, noise meter, calm reset.
   Self-contained, no dependencies, everything stays on this device. */
(function () {
  "use strict";
  if (window.__mbmHud) return; window.__mbmHud = true;
  try {

  var NS = "mbmhud";
  var PATH = location.pathname;
  var IS_GAME = /\/Games\//.test(PATH);
  var IS_APP = /\/Matt-s-Apps-\/.+\.html/.test(PATH);
  var IS_REG = /^\/(uas|asdan)\/app\.html$/.test(PATH);
  var IS_LESSON = /\/Lessons\//.test(PATH) && !IS_GAME;
  var BACK = IS_GAME ? { h: "/games/", l: "\u2190 Arcade" }
    : IS_APP ? { h: "/Matt-s-Apps-/", l: "\u2190 Studios" }
    : IS_REG ? { h: "/tools/", l: "\u2190 Tools" }
    : IS_LESSON ? { h: "/Lessons/", l: "\u2190 Lessons" } : null;
  var LS_NAMES = "mbm_hud_names", LS_USED = "mbm_hud_used";
  function lsGet(k, fb) { try { var v = localStorage.getItem(k); return v === null ? fb : v; } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- styles ---------- */
  var css = ""
  + "#" + NS + "-pill{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:2147483000;background:rgba(22,29,61,.72);color:#B9E6CD;border:1.5px solid rgba(185,230,205,.45);border-radius:999px;padding:6px 16px;font:700 12px/1 Poppins,'Segoe UI',system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:.75}"
  + "#" + NS + "-pill:hover,#" + NS + "-pill:focus-visible{opacity:1;outline:none;border-color:#B9E6CD}"
  + "#" + NS + "-back{position:fixed;left:10px;bottom:10px;z-index:2147483000;background:rgba(22,29,61,.72);color:#B9E6CD;border:1.5px solid rgba(185,230,205,.45);border-radius:999px;padding:6px 13px;font:700 12px/1 Poppins,'Segoe UI',system-ui,sans-serif;letter-spacing:.06em;text-decoration:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:.72}"
  + "#" + NS + "-back:hover,#" + NS + "-back:focus-visible{opacity:1;outline:none;border-color:#B9E6CD}"
  + "#" + NS + "-back.game{left:calc(8px + env(safe-area-inset-left,0px));top:calc(8px + env(safe-area-inset-top,0px));bottom:auto;width:34px;height:34px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:16px;opacity:.55}"
  + "#" + NS + "-dock{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:2147483001;width:min(680px,calc(100vw - 20px));background:rgba(246,241,228,.92);border:2px solid #161D3D;border-radius:18px;box-shadow:0 14px 40px rgba(15,21,48,.45);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:12px 14px;display:none;font-family:Poppins,'Segoe UI',system-ui,sans-serif;color:#1B2140}"
  + "#" + NS + "-dock.open{display:block}"
  + "." + NS + "-row{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}"
  + "." + NS + "-mod{flex:1;min-width:150px;background:#FFFDF6;border:1.5px solid #E0D6C0;border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;gap:6px}"
  + "." + NS + "-mod b{font-size:10px;letter-spacing:.14em;color:#4A5170}"
  + "." + NS + "-btns{display:flex;gap:6px;flex-wrap:wrap}"
  + "." + NS + "-btn{font:800 12px/1 Poppins,'Segoe UI',sans-serif;letter-spacing:.04em;background:#FFFDF6;color:#161D3D;border:1.5px solid #161D3D;border-radius:999px;padding:7px 12px;cursor:pointer}"
  + "." + NS + "-btn:hover{background:#161D3D;color:#FFF6E8}"
  + "." + NS + "-btn.amber{background:#F2A24A;border-color:#C97F2E;color:#161D3D}"
  + "." + NS + "-btn.amber:hover{filter:brightness(1.06);background:#F2A24A;color:#161D3D}"
  + "." + NS + "-btn.mint{background:#B9E6CD;border-color:#2F6B4D;color:#143324}"
  + "." + NS + "-btn:focus-visible{outline:3px solid #F2A24A;outline-offset:2px}"
  + "#" + NS + "-name{font:800 17px/1.2 Poppins,'Segoe UI',sans-serif;color:#161D3D;min-height:22px}"
  + "#" + NS + "-names{width:100%;box-sizing:border-box;font:12px/1.4 Poppins,'Segoe UI',sans-serif;border:1.5px solid #C9C0AB;border-radius:8px;padding:6px;resize:vertical;min-height:34px;max-height:90px;background:#fff}"
  + "#" + NS + "-meter{display:flex;align-items:flex-end;gap:2px;height:34px}"
  + "#" + NS + "-meter i{flex:1;background:#2F8F6B;border-radius:2px 2px 0 0;min-height:2px;transition:height .12s ease}"
  + "#" + NS + "-meter.loud i{background:#C25B4E}"
  + "." + NS + "-note{font-size:10px;color:#4A5170;line-height:1.35}"
  + "#" + NS + "-dock button:focus-visible,#" + NS + "-pill:focus-visible,#" + NS + "-back:focus-visible,#" + NS + "-close:focus-visible{outline:3px solid #F2A24A;outline-offset:2px}" + 
  "#" + NS + "-close{position:absolute;top:4px;right:6px;background:none;border:0;font:800 13px Poppins,sans-serif;color:#4A5170;cursor:pointer;padding:4px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;touch-action:manipulation}"
  + "#" + NS + "-timerbox{position:fixed;top:14px;right:14px;z-index:2147483002;background:rgba(22,29,61,.94);color:#FFF6E8;border:2px solid #F2A24A;border-radius:16px;padding:10px 18px;text-align:center;display:none;font-family:Poppins,'Segoe UI',sans-serif}"
  + "#" + NS + "-timerbox.on{display:block}"
  + "#" + NS + "-timerbox.done{border-color:#B9E6CD;animation:" + NS + "-pulse 2s ease-in-out infinite}"
  + "#" + NS + "-time{font:800 34px/1 Poppins,sans-serif;letter-spacing:.04em}"
  + "#" + NS + "-timerbox ." + NS + "-btns{justify-content:center;margin-top:6px}"
  + "@keyframes " + NS + "-pulse{0%,100%{box-shadow:0 0 0 0 rgba(185,230,205,.5)}50%{box-shadow:0 0 0 10px rgba(185,230,205,0)}}"
  + "#" + NS + "-calm{position:fixed;inset:0;z-index:2147483003;background:radial-gradient(ellipse at 50% 42%,#232C55,#0F1530 75%);display:none;flex-direction:column;align-items:center;justify-content:center;gap:26px;font-family:Poppins,'Segoe UI',sans-serif}"
  + "#" + NS + "-calm.on{display:flex}"
  + "#" + NS + "-ring{width:min(38vmin,240px);height:min(38vmin,240px);border-radius:50%;border:3px solid #B9E6CD;background:radial-gradient(circle,#B9E6CD22,transparent 70%);animation:" + NS + "-breathe 8s ease-in-out infinite}"
  + "#" + NS + "-calmtext{color:#C9D1E2;font:600 clamp(16px,3vmin,24px)/1.4 Poppins,sans-serif;letter-spacing:.06em;text-align:center}"
  + "#" + NS + "-calmexit{margin-top:8px;background:none;border:1.5px solid rgba(185,230,205,.5);color:#B9E6CD;border-radius:999px;padding:9px 20px;font:700 13px Poppins,sans-serif;cursor:pointer;opacity:.8}"
  + "#" + NS + "-calmexit:hover{opacity:1;border-color:#B9E6CD}"
  + "@keyframes " + NS + "-breathe{0%,100%{transform:scale(.72)}45%,55%{transform:scale(1)}}"
  + "@media (prefers-reduced-motion:reduce){#" + NS + "-ring{animation:none;transform:scale(.86)}#" + NS + "-timerbox.done{animation:none}}"
  + "@media print{#" + NS + "-back,#" + NS + "-pill,#" + NS + "-dock,#" + NS + "-timerbox,#" + NS + "-calm{display:none!important}}";
  var st = document.createElement("style"); st.id = NS + "-style"; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------- markup ---------- */
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  var pill = el("button", { id: NS + "-pill", type: "button", "aria-expanded": "false", "aria-label": "Open the Live-Teach HUD" }, "\u26A1 TEACH");
  var dock = el("div", { id: NS + "-dock", role: "dialog", "aria-label": "Live-Teach HUD" });
  dock.innerHTML =
    '<button id="' + NS + '-close" type="button" aria-label="Close the HUD">\u2715</button>'
    + '<div class="' + NS + '-row">'
    + '<div class="' + NS + '-mod"><b>QUICK TIMER</b><div class="' + NS + '-btns">'
    + '<button class="' + NS + '-btn" type="button" data-min="1">1 min</button>'
    + '<button class="' + NS + '-btn" type="button" data-min="5">5 min</button>'
    + '<button class="' + NS + '-btn" type="button" data-min="10">10 min</button></div>'
    + '<span class="' + NS + '-note">Overlays the top corner \u2014 no sound, just a gentle pulse at zero.</span></div>'
    + '<div class="' + NS + '-mod"><b>NAME PICKER</b><div id="' + NS + '-name" aria-live="polite" aria-atomic="true">\u2014</div><div class="' + NS + '-btns">'
    + '<button class="' + NS + '-btn amber" type="button" id="' + NS + '-pick">Pick a name</button>'
    + '<button class="' + NS + '-btn" type="button" id="' + NS + '-edit">Edit list</button></div>'
    + '<textarea id="' + NS + '-names" style="display:none" placeholder="One name per line \u2014 saved on this device only" aria-label="Class name list"></textarea></div>'
    + '<div class="' + NS + '-mod"><b>NOISE METER</b><div id="' + NS + '-meter" aria-hidden="true"></div><div class="' + NS + '-btns">'
    + '<button class="' + NS + '-btn" type="button" id="' + NS + '-mic">Start meter</button></div>'
    + '<span class="' + NS + '-note" id="' + NS + '-micnote">Uses the mic on this device only \u2014 nothing is recorded or uploaded.</span></div>'
    + '<div class="' + NS + '-mod" style="justify-content:center"><b>RESET THE ROOM</b>'
    + '<button class="' + NS + '-btn mint" type="button" id="' + NS + '-calmbtn" style="font-size:13px;padding:12px 14px">\uD83C\uDF3F CALM RESET \u2192</button>'
    + '<span class="' + NS + '-note">Replaces the screen with a slow breathing guide. Tap to return.</span></div>'
    + '</div>';
  var timerbox = el("div", { id: NS + "-timerbox", role: "timer", "aria-live": "off" });
  timerbox.innerHTML = '<div id="' + NS + '-time">0:00</div><div class="' + NS + '-btns">'
    + '<button class="' + NS + '-btn" type="button" id="' + NS + '-tpause">Pause</button>'
    + '<button class="' + NS + '-btn" type="button" id="' + NS + '-tstop">Clear</button></div>';
  var calm = el("div", { id: NS + "-calm", role: "dialog", "aria-label": "Calm reset breathing guide" });
  calm.innerHTML = '<div id="' + NS + '-ring"></div><div id="' + NS + '-calmtext">Breathe in\u2026</div>'
    + '<button id="' + NS + '-calmexit" type="button">Return to the lesson</button>';

  var backEl = null;
  if (BACK) {
    backEl = el("a", { id: NS + "-back", href: BACK.h, "aria-label": "Back: " + BACK.l.replace("\u2190 ", "") });
    if (IS_GAME) { backEl.className = "game"; backEl.textContent = "\u2190"; backEl.title = BACK.l.replace("\u2190 ", "Back to the "); }
    else backEl.textContent = BACK.l;
  }
  function mount() {
    if (backEl) document.body.appendChild(backEl);
    if (!IS_LESSON) return;
    document.body.appendChild(pill); document.body.appendChild(dock);
    document.body.appendChild(timerbox); document.body.appendChild(calm);
  }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  var $ = function (id) { return document.getElementById(NS + "-" + id); };

  /* ---------- dock open/close ---------- */
  pill.addEventListener("click", function () {
    var open = dock.classList.toggle("open");
    pill.setAttribute("aria-expanded", open ? "true" : "false");
    pill.style.display = open ? "none" : "";
    dock.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) { dockOpener = document.activeElement; try { $("close").focus(); } catch (x) {} }
  });
  dock.addEventListener("click", function (e) {
    if (e.target && e.target.id === NS + "-close") {
      dock.classList.remove("open"); pill.style.display = ""; pill.setAttribute("aria-expanded", "false"); pill.focus();
     try { (dockOpener && dockOpener.focus ? dockOpener : pill).focus(); } catch (x) {} dockOpener = null;}
  });

  /* ---------- timer ---------- */
  var tLeft = 0, tRun = null;
  function tShow() {
    var m = Math.floor(tLeft / 60), s = tLeft % 60;
    $("time").textContent = m + ":" + (s < 10 ? "0" : "") + s;
  }
  function tTick() {
    if (tLeft > 0) { tLeft--; tShow(); if (tLeft === 0) { timerbox.classList.add("done"); clearInterval(tRun); tRun = null; $("tpause").textContent = "Pause"; } }
  }
  dock.addEventListener("click", function (e) {
    var b = e.target && e.target.getAttribute && e.target.getAttribute("data-min");
    if (!b) return;
    tLeft = parseInt(b, 10) * 60; timerbox.classList.add("on"); timerbox.classList.remove("done"); tShow();
    if (tRun) clearInterval(tRun);
    tRun = setInterval(tTick, 1000); $("tpause").textContent = "Pause";
  });
  timerbox.addEventListener("click", function (e) {
    if (!e.target) return;
    if (e.target.id === NS + "-tpause") {
      if (tRun) { clearInterval(tRun); tRun = null; e.target.textContent = "Resume"; }
      else if (tLeft > 0) { tRun = setInterval(tTick, 1000); e.target.textContent = "Pause"; }
    }
    if (e.target.id === NS + "-tstop") {
      if (tRun) clearInterval(tRun); tRun = null; tLeft = 0;
      timerbox.classList.remove("on", "done");
    }
  });

  /* ---------- name picker ---------- */
  function nameList() {
    return lsGet(LS_NAMES, "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  $("edit") && 0; // placeholder guard removed below by direct wiring
  dock.addEventListener("click", function (e) {
    if (!e.target) return;
    if (e.target.id === NS + "-edit") {
      var ta = $("names");
      if (ta.style.display === "none") { ta.style.display = ""; ta.value = lsGet(LS_NAMES, ""); ta.focus(); e.target.textContent = "Save list"; }
      else { lsSet(LS_NAMES, ta.value); lsSet(LS_USED, "[]"); ta.style.display = "none"; e.target.textContent = "Edit list"; $("name").textContent = "\u2014"; }
    }
    if (e.target.id === NS + "-pick") {
      var names = nameList();
      if (!names.length) { $("name").textContent = "Add names first \u2192"; return; }
      var used = [];
      try { used = JSON.parse(lsGet(LS_USED, "[]")) || []; } catch (err) { used = []; }
      var pool = names.filter(function (n) { return used.indexOf(n) < 0; });
      if (!pool.length) { used = []; pool = names.slice(); }
      var n = pool[Math.floor(Math.random() * pool.length)];
      used.push(n); lsSet(LS_USED, JSON.stringify(used));
      $("name").textContent = n;
    }
  });

  /* ---------- noise meter ---------- */
  var micOn = false, audioCtx = null, rafId = null, micStream = null, micReq = 0;
  (function bars() { var m = $("meter"); if (!m) { setTimeout(bars, 50); return; } for (var i = 0; i < 16; i++) m.appendChild(document.createElement("i")); })();
  function releaseMic() {
    try { if (micStream && micStream.getTracks) micStream.getTracks().forEach(function (t) { try { t.stop(); } catch (x) {} }); } catch (x) {}
    micStream = null;
  }
  try { window.addEventListener("pagehide", function () {
    micOn = false; micReq++; if (rafId) cancelAnimationFrame(rafId);
    if (audioCtx && audioCtx.close) { try { audioCtx.close(); } catch (x) {} }
    releaseMic();
  }); } catch (x) {}
  dock.addEventListener("click", function (e) {
    if (!e.target || e.target.id !== NS + "-mic") return;
    if (micOn) {
      micOn = false; e.target.textContent = "Start meter";
      if (rafId) cancelAnimationFrame(rafId);
      if (audioCtx && audioCtx.close) audioCtx.close(); audioCtx = null;
      micReq++;
      releaseMic();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $("micnote").textContent = "No microphone available on this device/browser."; return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    try {
      if (!audioCtx || audioCtx.state === "closed") audioCtx = new AC();
      if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
    } catch (x) { $("micnote").textContent = "Audio is not available in this browser."; return; }
    var myReq = ++micReq;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (myReq !== micReq) {
        try { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (x) {} }); } catch (x) {}
        return;
      }
      micStream = stream;
      micOn = true; e.target.textContent = "Stop meter";
      /* audioCtx was created synchronously in the gesture above */
      var src = audioCtx.createMediaStreamSource(stream);
      var an = audioCtx.createAnalyser(); an.fftSize = 64;
      src.connect(an);
      var data = new Uint8Array(an.frequencyBinCount);
      var bars = $("meter").children;
      (function loop() {
        if (!micOn) { for (var i = 0; i < bars.length; i++) bars[i].style.height = "2px"; return; }
        an.getByteFrequencyData(data);
        var avg = 0;
        for (var i = 0; i < bars.length; i++) {
          var v = data[i] / 255; avg += v;
          bars[i].style.height = Math.max(2, Math.round(v * 34)) + "px";
        }
        $("meter").classList.toggle("loud", (avg / bars.length) > 0.55);
        rafId = requestAnimationFrame(loop);
      })();
    }).catch(function () {
      $("micnote").textContent = "Mic permission was blocked \u2014 the meter needs it to listen (nothing is recorded).";
    });
  });

  /* ---------- calm reset ---------- */
  var calmTimer = null, calmPhase = 0;
  var PHASES = ["Breathe in\u2026", "Hold\u2026", "Breathe out slowly\u2026", "Rest\u2026"];
  function calmLoop() { calmPhase = (calmPhase + 1) % PHASES.length; $("calmtext").textContent = PHASES[calmPhase]; }
  dock.addEventListener("click", function (e) {
    if (!e.target || e.target.id !== NS + "-calmbtn") return;
    calm.classList.add("on"); dock.classList.remove("open");
    calmPhase = 0; $("calmtext").textContent = PHASES[0];
    calmTimer = setInterval(calmLoop, 4000);
    lastFocus = document.activeElement;
    try { calm.setAttribute("aria-modal", "true"); var ex = $("calmexit"); if (ex && ex.focus) ex.focus(); } catch (x) {}
  });
  var lastFocus = null, dockOpener = null;
  function closeCalm() {
    if (!calm.classList.contains("on")) return false;
    calm.classList.remove("on");
    if (calmTimer) clearInterval(calmTimer);
    pill.style.display = ""; pill.setAttribute("aria-expanded", "false");
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (x) {}
    lastFocus = null;
    return true;
  }
  calm.addEventListener("click", function () { closeCalm(); });
  /* Escape closes whatever HUD layer is open, innermost first */
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (closeCalm()) { ev.stopPropagation(); return; }
    /* the dock is a panel, not a full-screen modal: close it but let the
       lesson handle Escape too, so its own dialogs still close */
    if (dock.classList.contains("open")) {
      dock.classList.remove("open");
      pill.style.display = ""; pill.setAttribute("aria-expanded", "false");
      try { pill.focus(); } catch (x) {}
    }
  }, true);

  } catch (e) { /* the HUD must never break a lesson */ }
})();
