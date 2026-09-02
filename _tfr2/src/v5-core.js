(function(){
  "use strict";
  if(window.__MBM_TITAN_V5__)return;
  var API=window.__MBM_TITAN_V5__={version:"5.0.0",ready:false,layout:false};
  var heatShown=false,heatTimer=0,strip=null;
  function v4(){return window.__MBM_TITAN_V4__;}
  /* L3 — wrap the V4 vitals and goal in one strip (the phone CSS collapses it to 24px). */
  function buildStrip(){
    var vitals=document.querySelector(".mbm-v4-vitals"),goal=document.querySelector(".mbm-v4-goal");
    if(!vitals||!goal||strip)return !!strip;
    strip=document.createElement("div");strip.className="mbm-v4-vitalstrip";strip.setAttribute("aria-label","Pump, focus heat and surge meters with the current goal");
    vitals.parentNode.insertBefore(strip,vitals);strip.appendChild(vitals);strip.appendChild(goal);
    var heat=document.createElement("em");heat.className="mbm-v5-heat";heat.textContent="HEAT: DRIVE NEEDLE FASTER";goal.appendChild(heat);
    return true;
  }
  /* L4 — fifth dock button: DNA. */
  function buildDock(){
    var dock=document.querySelector(".mobile-dock");if(!dock||dock.querySelector(".mbm-v5-dock-dna"))return !!dock;
    var b=document.createElement("button");b.type="button";b.className="mbm-v5-dock-dna";b.setAttribute("aria-label","Divine DNA: ascension upgrade tree");
    b.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3c0 5 10 7 10 12s-10 7-10 6"/><path d="M17 3c0 5-10 7-10 12s10 7 10 6"/><path d="M8.5 7.5h7M8.5 16.5h7"/></svg><span>DNA</span>';
    b.addEventListener("click",function(){var a=v4();if(a&&a.openDNA)a.openDNA();});
    dock.appendChild(b);return true;
  }
  /* L6 — FOCUS heat copy + first-crossing toast. */
  function pollHeat(){
    var a=v4(),goal=document.querySelector(".mbm-v4-goal");if(!a||!a.getState||!goal)return;
    var focus=a.getState().focus||0,hot=focus>=60;goal.classList.toggle("mbm-v5-hot",hot);
    if(hot&&!heatShown){heatShown=true;var v3=window.__MBM_TITAN_V3__;if(v3&&v3.toast)v3.toast("FOCUS HEAT","NEEDLE SPEEDS UP · REST 2S TO COOL",true);}
  }
  function build(){
    var a=v4();if(!a||!a.ready)return false;
    if(!buildStrip())return false;buildDock();
    heatTimer=setInterval(pollHeat,300);API.layout=true;API.ready=true;return true;
  }
  var tries=0,timer=setInterval(function(){if(build()||++tries>200)clearInterval(timer);},60);
  API.heatShownForTest=function(){return heatShown;};API.pollHeat=pollHeat;
})();
