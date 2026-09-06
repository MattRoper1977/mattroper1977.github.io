(function(){
  "use strict";
  /* TFR2 P5 A1 — procedural music: Web Audio only, 92 bpm, three intensity layers on combo/focus.
     No AudioContext exists until the first user gesture; honours core "Game sound" and the FX SOUND mute. */
  var G=window.__MBM_TITAN_V5__;if(!G||G.music)return;
  var BPM=92,BEAT=60/BPM,STEP=BEAT/4,LOOKAHEAD=.14,TICK=50;
  var ctx=null,master=null,comp=null,layerGain=[null,null,null],noiseBuf=null,gesture=false,playing=false,timer=0,nextTime=0,step=0,voices=0,lastCombo=0,lastLiftAt=0,enabled=false,stateCache=0;
  var ROOT=55,BASS=[0,0,3,5,0,0,7,5],ARP=[0,3,7,10,12,10,7,3],PAD=[[0,3,7],[3,7,10],[5,8,12],[0,3,7]];
  function v3(){return window.__MBM_TITAN_V3__;}
  function enabledNow(){var s=v3()&&v3().getState?v3().getState():null;return !!(s&&s.music);}
  function soundAllowed(){try{var core=JSON.parse(localStorage.getItem("mbm_titanforge_save_v1")||"{}");if(core&&core.sound===false)return false;}catch(e){}var a=window.__MBM_TITAN_AAA__,snap=a&&a.getSnapshot?a.getSnapshot():null;if(snap&&snap.audio&&snap.audio.muted)return false;return true;}
  function reduced(){return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)||!!document.querySelector(".game-shell.reduced-motion");}
  function ensureCtx(){if(ctx)return ctx;if(!gesture)return null;var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;try{ctx=new AC();comp=ctx.createDynamicsCompressor();comp.threshold.value=-18;comp.ratio.value=8;master=ctx.createGain();master.gain.value=0;for(var i=0;i<3;i++){layerGain[i]=ctx.createGain();layerGain[i].gain.value=i===0?1:0;layerGain[i].connect(comp);}comp.connect(master);master.connect(ctx.destination);var len=Math.floor(ctx.sampleRate*.4);noiseBuf=ctx.createBuffer(1,len,ctx.sampleRate);var d=noiseBuf.getChannelData(0);for(var j=0;j<len;j++)d[j]=Math.random()*2-1;return ctx;}catch(e){ctx=null;return null;}}
  function voice(node,stopAt){voices++;node.addEventListener("ended",function(){voices=Math.max(0,voices-1);},{once:true});try{node.stop(stopAt);}catch(e){voices=Math.max(0,voices-1);}}
  function osc(type,freq,t0,t1,gain,dest,detune){var o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t0);if(detune)o.detune.value=detune;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(gain,t0+.012);g.gain.exponentialRampToValueAtTime(.0008,t1);o.connect(g);g.connect(dest);o.start(t0);voice(o,t1+.02);return o;}
  function kick(t){var o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+.16);g.gain.setValueAtTime(.55,t);g.gain.exponentialRampToValueAtTime(.001,t+.24);o.connect(g);g.connect(layerGain[0]);o.start(t);voice(o,t+.26);}
  function hat(t,gain){var n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noiseBuf;f.type="highpass";f.frequency.value=6500;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);n.connect(f);f.connect(g);g.connect(layerGain[0]);n.start(t);voice(n,t+.06);}
  function note(semi,oct){return ROOT*Math.pow(2,oct+semi/12);}
  function schedule(){if(!ctx||!playing)return;var horizon=ctx.currentTime+LOOKAHEAD;while(nextTime<horizon){var s=step%16,bar=Math.floor(step/16)%4,t=nextTime;
      if(s===0||s===8)kick(t);if(s%2===0)hat(t,s%4===0?.05:.028);
      if(s===0||s===6||s===12)osc("triangle",note(BASS[(bar*2+(s>=8?1:0))%8],0),t,t+STEP*1.8,.32,layerGain[0]);
      if(s%2===1||s%4===0)osc("square",note(ARP[(s+bar*2)%8],2),t,t+STEP*.9,.07,layerGain[1]);
      if(s===0){var chord=PAD[bar];for(var i=0;i<chord.length;i++){osc("sawtooth",note(chord[i],1),t,t+BEAT*3.8,.05,layerGain[2],-7);osc("sawtooth",note(chord[i],1),t,t+BEAT*3.8,.05,layerGain[2],7);}}
      if(s===8||s===14)osc("triangle",note(ARP[(bar*3+s)%8],3),t,t+STEP*2.5,.06,layerGain[2]);
      nextTime+=STEP;step++;}}
  function intensity(){var focus=0,v4=window.__MBM_TITAN_V4__;if(v4&&v4.getState)focus=v4.getState().focus||0;var win=window.__MBM_TITAN_COMBO_WINDOW__||2500,combo=(Date.now()-lastLiftAt)<win?lastCombo:0;return {combo:combo,focus:focus,l1:combo>=3?1:0,l2:(focus>=60||combo>=6)?1:0};}
  function tick(){if(!ctx||!playing)return;if(!enabledNow()||!soundAllowed()){stop();return;}var it=intensity(),t=ctx.currentTime;layerGain[1].gain.setTargetAtTime(it.l1*.9,t,.35);layerGain[2].gain.setTargetAtTime(it.l2*.9,t,.5);schedule();}
  function start(){if(playing||!gesture||!enabledNow()||!soundAllowed())return false;if(!ensureCtx())return false;if(ctx.state==="suspended")ctx.resume().catch(function(){});playing=true;nextTime=ctx.currentTime+.05;step=0;master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(reduced()?.12:.16,ctx.currentTime,.4);timer=setInterval(tick,TICK);tick();return true;}
  function stop(){if(!playing)return;playing=false;clearInterval(timer);timer=0;if(ctx&&master){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.25);}}
  function setEnabled(on){var api=v3();if(api&&api.setFlag)api.setFlag("music",!!on);enabled=!!on;if(on)start();else stop();paint();}
  function onGesture(){if(gesture)return;gesture=true;if(enabledNow()&&soundAllowed())start();}
  window.addEventListener("pointerdown",onGesture,{capture:true,passive:true});window.addEventListener("keydown",onGesture,{capture:true,passive:true});window.addEventListener("touchstart",onGesture,{capture:true,passive:true});
  window.addEventListener("mbm:titan-lift",function(e){var d=e.detail||{};lastCombo=Number(d.combo)||0;lastLiftAt=Date.now();if(!playing&&gesture)start();});
  document.addEventListener("visibilitychange",function(){if(document.hidden)stop();else if(gesture)start();});
  var refs={};
  function paint(){var on=enabledNow();if(refs.btn){refs.btn.textContent=on?"MUSIC ON":"MUSIC OFF";refs.btn.setAttribute("aria-pressed",String(on));}if(refs.settingBtn){refs.settingBtn.setAttribute("aria-pressed",String(on));refs.settingBtn.textContent=on?"ON":"OFF";}}
  function buildButton(){var sys=document.querySelector(".mbm-system-buttons");if(!sys||sys.querySelector(".mbm-v5-music-btn"))return !!sys;var b=document.createElement("button");b.type="button";b.className="mbm-v5-music-btn";b.setAttribute("aria-label","Procedural music: starts after your first tap, follows combo and focus. Game beeps: Settings > Game sound");b.addEventListener("click",function(){setEnabled(!enabledNow());});sys.appendChild(b);refs.btn=b;paint();return true;}
  var tries=0,t=setInterval(function(){if(buildButton()||++tries>240)clearInterval(t);},80);
  setInterval(function(){if(playing&&(!enabledNow()||!soundAllowed()))stop();else if(!playing&&gesture&&enabledNow()&&soundAllowed()&&!document.hidden)start();},900);
  G.music={setEnabled:setEnabled,isEnabled:enabledNow,bindSetting:function(btn){refs.settingBtn=btn;paint();},state:function(){return {enabled:enabledNow(),gesture:gesture,playing:playing,hasContext:!!ctx,contextState:ctx?ctx.state:null,voices:voices,layerGains:layerGain.map(function(g){return g?+g.gain.value.toFixed(2):0;}),master:master?+master.gain.value.toFixed(3):0,bpm:BPM,intensity:intensity()};}};
})();
