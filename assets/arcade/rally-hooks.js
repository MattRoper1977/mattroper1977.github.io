/* Generated inside Rally's existing closure. Physics authority stays unchanged. */
let as1UserPaused=false,as1PanelPaused=false,as1Battery=false,as1Dirty=true;
let as1LastPaint=0,as1RenderCount=0,as1PhysicsCount=0,as1Samples=[],as1SampleClock=0;
const as1PreferenceKey='mbm_rallyvector_as1_comfort';
let as1Preferences={warm:false,soft:false};
try{const p=JSON.parse(localStorage.getItem(as1PreferenceKey)||'null');if(p&&typeof p==='object')as1Preferences={warm:p.warm===true,soft:p.soft===true};}catch(_){}
function as1SavePreferences(){try{localStorage.setItem(as1PreferenceKey,JSON.stringify(as1Preferences));}catch(_){}as1Dirty=true;}
let as1Filter=null;
let as1GestureContext=null;
function as1UnlockAudio(event){if(!event.isTrusted||as1GestureContext)return;const C=window.AudioContext||window.webkitAudioContext;if(C)try{as1GestureContext=new C();}catch(_){} }
document.addEventListener('pointerdown',as1UnlockAudio,{capture:true,passive:true});
document.addEventListener('keydown',as1UnlockAudio,true);
function as1AudioFilter(){if(!audio.ready||!audio.ctx||!audio.master)return;if(!as1Filter){as1Filter=audio.ctx.createBiquadFilter();as1Filter.type='lowpass';as1Filter.Q.value=Math.SQRT1_2;}const output=v6Compressor||audio.master;output.disconnect();if(as1Preferences.soft){as1Filter.frequency.value=3500;output.connect(as1Filter);as1Filter.disconnect();as1Filter.connect(audio.ctx.destination);}else{as1Filter.disconnect();output.connect(audio.ctx.destination);}}
// The existing init retains its compressor test and is still called by gestures.
document.addEventListener('pointerdown',()=>{if(audio.ready)as1AudioFilter();},{passive:true});
document.addEventListener('keydown',()=>{if(audio.ready)as1AudioFilter();});
function as1ApplyHold(){
  game.paused=as1UserPaused||as1PanelPaused;document.documentElement.dataset.as1Held=String(game.paused);game.acc=0;game.lastFrame=performance.now();
  v6ClearIntent();if(V6Modal.dialog===dom.pause)V6Modal.release({restore:false});dom.pause.classList.add('hidden');
  v6SetEngineActive(!game.paused&&game.mode==='running');if(game.paused){v6SuspendAudio();try{speechSynthesis.pause();}catch(_){}}
  else if(audio.ready&&navigator.userActivation?.isActive){v6ResumeAudio();as1AudioFilter();try{speechSynthesis.resume();}catch(_){}}
  v6SyncDrivingState();as1Dirty=true;window.MBMArcade?.sync();
}
setPaused=function(on){as1UserPaused=!!on;as1ApplyHold();};
function as1RenderDue(now){
  if((game.mode!=='running'||game.paused)&&!v6Director.active&&!v6Ascent.active&&!as1Dirty)return false;
  if(!as1Dirty&&as1Battery&&now-as1LastPaint<1000/30)return false;
  as1LastPaint=now;as1Dirty=false;as1RenderCount++;return true;
}
for(const event of ['input','change','click','pointerdown','keydown'])document.addEventListener(event,()=>{as1Dirty=true;},{passive:true});
window.addEventListener('resize',()=>{as1Dirty=true;},{passive:true});
function as1Bounds(){
  const t=world.track,m=t.def.roadWidth,ys=t.samples.map(s=>s.p.y);
  return{minx:t.minX-m,maxx:t.maxX+m,miny:Math.min(...ys)-m,maxy:Math.max(...ys)+m,minz:t.minZ-m,maxz:t.maxZ+m};
}
const as1FixedStep=fixedStep;
fixedStep=function(dt){if(game.paused)return;const before=game.stageTime;const out=as1FixedStep(dt);if(game.stageTime>before){as1PhysicsCount++;as1SampleClock+=dt;if(as1SampleClock>=.1-1e-8){as1SampleClock-=.1;const p=game.car.pos;as1Samples.push({x:p.x,y:p.y,z:p.z,angle:game.car.heading});if(as1Samples.length>900)as1Samples.shift();}}return out;};
const as1StartStage=startStage;
startStage=function(){as1UserPaused=as1PanelPaused=false;as1Samples=[];as1SampleClock=0;as1Dirty=true;return as1StartStage();};
const as1DebugStart=window.RallyVector3D.debugStart;
window.RallyVector3D.debugStart=function(id='alpine'){as1UserPaused=as1PanelPaused=false;as1Samples=[];as1SampleClock=0;as1Dirty=true;const out=as1DebugStart(id);window.MBMArcade?.sync();return out;};
let as1IncomingGhost=null;
async function as1LoadGhost(){
  if(!location.hash.startsWith('#ghost='))return;
  try{const samples=window.MBMGhost.decode(location.hash.slice(7),as1Bounds());as1IncomingGhost=samples;as1InstallGhost();}
  catch(_){as1IncomingGhost=null;game.ghostData=null;if(game.ghostVisual)game.ghostVisual.dispose();game.ghostVisual=null;showMessage('Ghost could not load. You can still race.',2600);}
}
function as1InstallGhost(){if(!as1IncomingGhost)return;if(game.ghostVisual)game.ghostVisual.dispose();game.ghostData=as1IncomingGhost.map((s,i)=>[(i+1)/10,s.x,s.y,s.z,s.angle]);game.ghostVisual=new CarVisual({ghost:true});updateGhostPlayback();as1Dirty=true;}
const as1BuildWorld=buildWorld;
buildWorld=function(options){const out=as1BuildWorld(options);as1InstallGhost();return out;};
const as1ModalGuard=V6Modal.guard.bind(V6Modal);
V6Modal.guard=function(node){if(node?.id==='as1-shell')return;return as1ModalGuard(node);};
const as1ModalLock=V6Modal.lock.bind(V6Modal);
V6Modal.lock=function(...args){const out=as1ModalLock(...args),shell=document.getElementById('as1-shell');if(shell){shell.inert=false;shell.removeAttribute('aria-hidden');}return out;};
// A shared ghost uses a declared stage; unknown query values do not alter it.
const as1Stage=new URLSearchParams(location.search).get('stage');
if(TRACKS.some(t=>t.id===as1Stage))save.settings.track=as1Stage;
window.MBMArcadeHooks={
  area:dom.app,
  state:()=>({paused:game.paused,userPaused:as1UserPaused,panelPaused:as1PanelPaused,mode:game.mode,pose:game.car?{...game.car.pos,heading:game.car.heading}:null,renderCount:as1RenderCount,physicsCount:as1PhysicsCount,ghostSamples:as1Samples.length}),
  pause:on=>{as1UserPaused=!!on;as1ApplyHold();},
  panel:on=>{as1PanelPaused=!!on;as1ApplyHold();},
  setBattery:on=>{as1Battery=!!on;as1Dirty=true;},
  setSound:on=>{save.settings.sound=!!on;audio.init();audio.setMuted(!on);as1AudioFilter();if(!on)try{speechSynthesis.cancel();}catch(_){}v6SyncSoundUI();},
  soundOn:()=>save.settings.sound,
  setWarm:on=>{as1Preferences.warm=!!on;as1SavePreferences();},
  setSoftSound:on=>{as1Preferences.soft=!!on;audio.init();as1AudioFilter();as1SavePreferences();},
  preferences:()=>({...as1Preferences,calm:osReduce||v4.settings.calm||!save.settings.motion}),
  resize:()=>{as1Dirty=true;if(renderer)renderer.resize(game.quality==='high'?2:game.quality==='low'?1:1.5);v6SyncRouteCanvas();},
  audioGraph:()=>({ctx:audio.ctx,master:audio.master,filter:as1Filter}),
  serialize(){
    const data=window.MBMGameSaves.capture(localStorage,window.MBMAS1Rules);
    // Read the live authorities, including progress awaiting the game's normal save timer.
    data.localStorage[STORE_KEY]=JSON.stringify(save);data.localStorage[V4_STORE_KEY]=JSON.stringify(v4);data.localStorage[V6_PROFILE_KEY]=JSON.stringify(v6Profile);return data;
  },
  deserialize(data){
    const adapter=window.MBMGameSaves,rules=window.MBMAS1Rules;
    adapter.validate(data,rules);
    for(const value of Object.values(data.localStorage)){let p;try{p=JSON.parse(value);}catch(_){throw Error('A saved entry is not readable.');}if(!p||typeof p!=='object')throw Error('A saved entry is not supported.');}
    const legacy=JSON.parse(data.localStorage[STORE_KEY]||'null'),profile=JSON.parse(data.localStorage[V6_PROFILE_KEY]||'null'),four=JSON.parse(data.localStorage[V4_STORE_KEY]||'null');
    if(!legacy?.settings||!legacy.progress||!legacy.records||!four?.garage||!Number.isFinite(four.credits)||profile?.schema!==6||profile.gameId!==V6_GAME_ID)throw Error('This code does not contain a complete Rally save.');
    const plan=adapter.planImport(localStorage,data,rules,true);
    const before={save,v4,v6Profile};
    try{adapter.apply(localStorage,plan.writes);save=loadSave();v4=v4Load();v6Profile=v6LoadProfile();v6LastProfileWrite=v6ReadRaw(V6_PROFILE_KEY);renderMenu();v6RenderAtlas();}
    catch(e){adapter.restore(localStorage,plan.writes);save=before.save;v4=before.v4;v6Profile=before.v6Profile;throw e;}
    as1Dirty=true;return true;
  },
  thresholds(){if(!window.MBMAS1Sizing?.measured)throw Error('Save display sizing is still being checked.');return window.MBMAS1Sizing;},
  ghostBounds:as1Bounds,ghostSamples:()=>as1Samples.map(s=>({...s})),
  ghostRendered:()=>game.ghostVisual?{...game.ghostVisual.root,heading:game.ghostVisual.heading}:null,
  ghostAt(t){game.stageTime=t;updateGhostPlayback();renderFrame();return this.ghostRendered();},
  async ghostLink(){if(as1Samples.length<2)throw Error('Drive a run first.');const hash=await window.MBMGhost.encode(as1Samples,as1Bounds()),url=new URL(location.href);url.searchParams.set('stage',game.trackDef.id);url.hash='ghost='+hash;return url.href;},
  loadGhost:as1LoadGhost,
  testStart:()=>window.RallyVector3D.debugStart('alpine'),
  testStep:frames=>window.RallyVector3D.debugStep(frames)
};
