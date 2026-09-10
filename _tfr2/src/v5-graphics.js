(function(){
  "use strict";
  var G=window.__MBM_TITAN_V5__;if(!G||G.graphics)return;
  var fx=G.fxCounters={parallaxKicks:0,camPushes:0,squashes:0,cinematics:0,rankCards:0,crowdOn:0,zoneChanges:0,idleDrifts:0};
  var ZONES={"FORGE BEACH":"beach","NEON FOUNDRY":"foundry","SKY CITADEL":"citadel"};
  var refs={},built=false,lastStage=-1,strengthSeen=0,lastRank="",rankTimer=0,idleTimer=0,settleTimer=0,camTimer=0,zoneKey="";
  function reduced(){return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)||!!document.querySelector(".game-shell.reduced-motion");}
  function core(){try{return JSON.parse(localStorage.getItem("mbm_titanforge_save_v1")||"{}")||{};}catch(e){return {};}}
  function rankOf(s){return s>=5e4?"TITAN":s>=2e4?"COLOSSUS":s>=5e3?"FORGEBORN":s>=500?"CONTENDER":"ROOKIE";}
  function haptic(pattern){var v4=window.__MBM_TITAN_V4__,st=v4&&v4.getState?v4.getState():{};if(reduced()||document.hidden||st.feedback==="calm"||!navigator.vibrate)return;try{navigator.vibrate(pattern);}catch(e){}}
  function el(tag,cls,html){var n=document.createElement(tag);n.className=cls;if(html!==undefined)n.innerHTML=html;n.setAttribute("aria-hidden","true");return n;}

  /* G1 — parallax stage: the painted background stays on .arena (offset via --mbm-px/--mbm-py);
     only two small bands are extra layers. */
  function buildBg(){
    var bg=el("div","mbm-v5-bg");["mbm-v5-mid","mbm-v5-glow"].forEach(function(c){var i=document.createElement("i");i.className=c;bg.appendChild(i);});
    refs.arena.insertBefore(bg,refs.arena.firstChild);refs.arena.classList.add("mbm-v5-parallax");refs.bg=bg;scheduleIdle();
  }
  function scheduleIdle(){clearTimeout(idleTimer);if(!refs.bg)return;refs.bg.classList.remove("mbm-v5-idle");if(reduced())return;idleTimer=setTimeout(function(){if(reduced())return;refs.bg.classList.add("mbm-v5-idle");fx.idleDrifts++;},2600);}
  function kick(power){
    if(!refs.bg||reduced())return;fx.parallaxKicks++;var bg=refs.bg,arena=refs.arena;clearTimeout(settleTimer);
    bg.classList.remove("mbm-v5-idle","mbm-v5-settle");bg.classList.add("mbm-v5-hit");bg.style.setProperty("--mbm-px",(-7*power).toFixed(1)+"px");bg.style.setProperty("--mbm-py",(5*power).toFixed(1)+"px");
    var kickCls=power>=.9?"mbm-v5-kick-hard":"mbm-v5-kick-soft";arena.classList.remove("mbm-v5-kick-hard","mbm-v5-kick-soft");void arena.offsetWidth;arena.classList.add(kickCls);
    settleTimer=setTimeout(function(){bg.classList.add("mbm-v5-settle");bg.classList.remove("mbm-v5-hit");bg.style.setProperty("--mbm-px","0px");bg.style.setProperty("--mbm-py","0px");scheduleIdle();},95);
  }
  /* G4 — squash-and-stretch + camera push */
  function squash(){if(!refs.avatar||reduced())return;fx.squashes++;refs.avatar.classList.remove("mbm-v5-squash");void refs.avatar.offsetWidth;refs.avatar.classList.add("mbm-v5-squash");setTimeout(function(){refs.avatar.classList.remove("mbm-v5-squash");},260);}
  function camPush(){if(!refs.arena||reduced())return;fx.camPushes++;clearTimeout(camTimer);refs.arena.classList.remove("mbm-v5-cam-on");void refs.arena.offsetWidth;refs.arena.classList.add("mbm-v5-cam-on");camTimer=setTimeout(function(){refs.arena.classList.remove("mbm-v5-cam-on");},400);}
  /* G2 — zone lighting */
  function syncZone(){
    var span=refs.arena.querySelector(".zone-banner span"),name=span?span.textContent.trim().toUpperCase():"",key=ZONES[name]||"beach";
    if(key===zoneKey)return;zoneKey=key;fx.zoneChanges++;refs.arena.setAttribute("data-mbm-zone",key);refs.fighter.setAttribute("data-mbm-zone",key);
  }
  function buildRim(){
    var rim=el("div","mbm-v5-rim");refs.avatar.appendChild(rim);refs.rim=rim;
    function mask(){var src=refs.image&&refs.image.currentSrc||refs.image.src;if(src)rim.style.setProperty("--mbm-rim-mask",'url("'+src+'")');rim.classList.add("mbm-v5-on");}
    mask();if(window.MutationObserver)new MutationObserver(mask).observe(refs.image,{attributes:true,attributeFilter:["src"]});
  }
  /* G5 — form-change cinematic */
  function cinematic(oldSrc,name){
    fx.cinematics++;var avatar=refs.avatar,start=performance.now();
    if(reduced()){run(refs.image.src);return;}
    (function waitSwap(){var src=refs.image.src;if(src===oldSrc&&performance.now()-start<700){setTimeout(waitSwap,30);return;}run(src);})();
    function run(newSrc){
      var cine=el("div","mbm-v5-cine"),plate=el("div","mbm-v5-plate",'<small>BODY EVOLUTION</small>'+name+' FORM');
      if(reduced()){cine.appendChild(plate);avatar.appendChild(cine);setTimeout(function(){cine.remove();},1200);return;}
      var flash=el("i","mbm-v5-flash"),o=document.createElement("img"),n=document.createElement("img");o.className="mbm-v5-old";n.className="mbm-v5-new";o.src=oldSrc;n.src=newSrc;o.alt="";n.alt="";
      cine.appendChild(flash);cine.appendChild(o);cine.appendChild(n);cine.appendChild(plate);avatar.appendChild(cine);
      haptic([70,30,90]);setTimeout(function(){cine.remove();},900);
    }
  }
  function formCheck(rep){var E=window.__MBM_TITAN_EVOLUTION_TEST__;if(!E)return;var stage=E.stageFor(rep);if(lastStage>=0&&stage>lastStage)cinematic(refs.image.src,E.forms[stage]);lastStage=stage;}
  /* G7 — rank-up card */
  function rankCheck(gain){
    var saved=Number(core().strength)||0;strengthSeen=Math.max(saved,strengthSeen)+Math.max(0,Number(gain)||0);
    var rank=rankOf(strengthSeen),order=["ROOKIE","CONTENDER","FORGEBORN","COLOSSUS","TITAN"];
    if(lastRank&&order.indexOf(rank)>order.indexOf(lastRank))showRank(rank);lastRank=rank;
  }
  function showRank(rank){if(!refs.rank)return;fx.rankCards++;refs.rank.querySelector("strong").textContent=rank;refs.rank.classList.remove("mbm-v5-show");void refs.rank.offsetWidth;refs.rank.classList.add("mbm-v5-show");clearTimeout(rankTimer);rankTimer=setTimeout(function(){refs.rank.classList.remove("mbm-v5-show");},1400);haptic(40);}
  /* G6 — trial atmosphere */
  function trialWatch(){
    var arena=refs.arena,live=false,timerObs=null;
    function sync(){var hud=arena.querySelector(".trial-hud"),now=!!hud;if(now!==live){live=now;arena.classList.toggle("mbm-v5-trial",live);if(live)fx.crowdOn++;if(!live){arena.classList.remove("mbm-v5-trial-red");if(timerObs){timerObs.disconnect();timerObs=null;}}}
      if(live){var b=hud.querySelector(".trial-head b"),secs=b?parseFloat(b.textContent):NaN;arena.classList.toggle("mbm-v5-trial-red",Number.isFinite(secs)&&secs<=3);if(!timerObs&&window.MutationObserver){timerObs=new MutationObserver(sync);timerObs.observe(hud,{subtree:true,childList:true,characterData:true});}}}
    if(window.MutationObserver)new MutationObserver(sync).observe(arena,{childList:true});sync();refs.trialSync=sync;
  }
  function onLift(e){var d=e.detail||{},grade=String(d.grade||"SOLID").toUpperCase(),power=grade==="PERFECT"?1:grade==="GREAT"?.66:.4;kick(power);squash();if(grade==="PERFECT")camPush();rankCheck(d.strength);formCheck(Number(d.rep)||0);}
  function build(){
    if(built)return true;refs.arena=document.querySelector(".arena");refs.fighter=document.querySelector(".fighter-stage");refs.avatar=refs.fighter&&refs.fighter.querySelector(".avatar-placeholder");refs.image=refs.avatar&&refs.avatar.querySelector("img");
    if(!refs.arena||!refs.fighter||!refs.avatar||!refs.image||!G.ready||!window.__MBM_TITAN_EVOLUTION_TEST__)return false;
    buildBg();buildRim();syncZone();
    refs.crowd=el("div","mbm-v5-crowd");refs.arena.appendChild(refs.crowd);refs.redtint=el("div","mbm-v5-redtint");refs.arena.appendChild(refs.redtint);
    refs.rank=el("div","mbm-v5-rank","<small>RANK UP</small><strong></strong>");refs.arena.appendChild(refs.rank);
    var c=core();lastStage=window.__MBM_TITAN_EVOLUTION_TEST__.stageFor(Number(c.reps)||0);strengthSeen=Number(c.strength)||0;lastRank=rankOf(strengthSeen);
    trialWatch();window.addEventListener("mbm:titan-lift",onLift);window.addEventListener("mbm:titan-ascend",function(){strengthSeen=0;lastRank="ROOKIE";setTimeout(function(){strengthSeen=Number(core().strength)||0;lastRank=rankOf(strengthSeen);},300);});
    var banner=refs.arena.querySelector(".zone-banner");if(banner&&window.MutationObserver)new MutationObserver(syncZone).observe(banner,{subtree:true,childList:true,characterData:true});setInterval(syncZone,900);
    built=true;G.graphics=true;return true;
  }
  var tries=0,timer=setInterval(function(){if(build()||++tries>220)clearInterval(timer);},60);
  G.simulateFormChangeForTest=function(name){if(built)cinematic(refs.image.src,name||"FORGED");};G.simulateRankForTest=function(r){if(built)showRank(r||"CONTENDER");};G.zoneKey=function(){return zoneKey;};G.trialSyncForTest=function(){if(refs.trialSync)refs.trialSync();};
})();
