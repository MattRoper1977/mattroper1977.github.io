/* Made by Matt splash v2 — single file, no dependencies, self-styling.
   Usage: MadeByMattSplash.start({title:"BOSS BATTLE", kicker:"A Made by Matt Simulation",
          duration:3200, onComplete:function(){}});                                      */
(function (g) {
  var CSS = ".mbm-splash{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;" +
    "background:radial-gradient(circle at 50% 38%,#222B55,#161D3D 68%);color:#E8E2D4;" +
    "font-family:Poppins,'Segoe UI',system-ui,sans-serif;transition:opacity .55s ease,visibility .55s}" +
    ".mbm-splash.is-leaving{opacity:0;visibility:hidden}" +
    ".mbm-stage{text-align:center;padding:24px;max-width:860px}" +
    ".mbm-mark{width:min(34vmin,200px);height:auto;filter:drop-shadow(0 18px 32px #0008)}" +
    ".mbm-mark .mpath{stroke-dasharray:1;stroke-dashoffset:1;animation:mbmDraw 1s cubic-bezier(.6,0,.3,1) .2s forwards}" +
    ".mbm-mark .mstar{transform-origin:50px 30px;transform:scale(0);opacity:0;" +
    "animation:mbmPop .45s cubic-bezier(.34,1.56,.64,1) 1.1s forwards}" +
    ".mbm-kicker,.mbm-title,.mbm-tagline{opacity:0;transform:translateY(12px);animation:mbmRise .6s ease forwards}" +
    ".mbm-kicker{animation-delay:1.3s;margin-top:20px;color:#F2A24A;font-size:.78rem;" +
    "letter-spacing:.32em;text-transform:uppercase}" +
    ".mbm-title{animation-delay:1.45s;margin:.35rem 0 .2rem;font-size:clamp(2rem,7vw,5rem);" +
    "line-height:.95;letter-spacing:.04em;text-transform:uppercase;font-weight:700}" +
    ".mbm-tagline{animation-delay:1.65s;color:#B9E6CD;letter-spacing:.18em;text-transform:uppercase;font-weight:700}" +
    ".mbm-skip{position:absolute;right:22px;bottom:20px;border:1px solid #b9e6cd70;border-radius:99px;" +
    "background:#0a1026aa;color:#E8E2D4;padding:.65rem 1rem;cursor:pointer;font:inherit}" +
    ".mbm-skip:focus-visible{outline:3px solid #F2A24A;outline-offset:3px}" +
    "@keyframes mbmDraw{to{stroke-dashoffset:0}}@keyframes mbmPop{to{transform:scale(1);opacity:1}}" +
    "@keyframes mbmRise{to{opacity:1;transform:translateY(0)}}" +
    "@media(prefers-reduced-motion:reduce){.mbm-splash{transition:none}" +
    ".mbm-mark .mpath{animation:none;stroke-dashoffset:0}.mbm-mark .mstar{animation:none;transform:scale(1);opacity:1}" +
    ".mbm-kicker,.mbm-title,.mbm-tagline{animation:none;opacity:1;transform:none}}";
  var MARK = '<svg class="mbm-mark" viewBox="0 0 100 100" role="img" aria-label="Made by Matt">' +
    '<circle cx="50" cy="50" r="47" fill="none" stroke="#B9E6CD" stroke-width="3.4"/>' +
    '<path class="mpath" pathLength="1" d="M28 71 L28 37 L50 59 L72 37 L72 71" fill="none" ' +
    'stroke="#E8E2D4" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path class="mstar" d="M50 22.5 L51.48 28.52 L57.5 30 L51.48 31.48 L50 37.5 ' +
    'L48.52 31.48 L42.5 30 L48.52 28.52 Z" fill="#F2A24A"/></svg>';

  function start(o) {
    o = Object.assign({ title: "", kicker: "A Made by Matt Experience",
      duration: 3200, onComplete: null }, o || {});
    if (!document.getElementById("mbm-splash-css")) {
      var st = document.createElement("style");
      st.id = "mbm-splash-css"; st.textContent = CSS;
      document.head.appendChild(st);
    }
    var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var prevFocus = document.activeElement;
    var el = document.createElement("section");
    el.className = "mbm-splash";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Made by Matt introduction");
    el.innerHTML = '<div class="mbm-stage">' + MARK +
      '<p class="mbm-kicker"></p><h1 class="mbm-title"></h1>' +
      '<p class="mbm-tagline">Learn \u2022 Build \u2022 Explore</p></div>' +
      '<button class="mbm-skip" type="button">Skip intro</button>';
    el.querySelector(".mbm-kicker").textContent = o.kicker;
    el.querySelector(".mbm-title").textContent = o.title;
    document.body.appendChild(el);
    var done = false, timer;
    function close() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.classList.add("is-leaving");
      setTimeout(function () {
        el.remove();
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        if (typeof o.onComplete === "function") o.onComplete();
      }, reduced ? 0 : 600);
    }
    el.querySelector(".mbm-skip").addEventListener("click", close);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); close(); }
    });
    el.tabIndex = -1;
    el.focus();
    timer = setTimeout(close, reduced ? Math.min(o.duration, 1200) : o.duration);
    return { close: close, element: el };
  }
  g.MadeByMattSplash = { start: start };
})(window);
