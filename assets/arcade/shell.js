(function(root){'use strict';
  const hooks=root.MBMArcadeHooks;if(!hooks)return;
  const element=(tag,attrs={},text)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
  const shell=element('section',{id:'as1-shell','aria-label':'Arcade controls'}),bar=element('nav',{id:'as1-bar','aria-label':'Game controls'}),panel=element('section',{id:'as1-panel',role:'dialog','aria-labelledby':'as1-panel-title'});
  panel.hidden=true;const title=element('h2',{id:'as1-panel-title'}),body=element('div'),status=element('p',{id:'as1-status','aria-live':'polite'}),done=element('button',{type:'button'},'Done');panel.append(title,body,status,done);shell.append(bar,panel);document.body.prepend(shell);
  const held=element('div',{id:'as1-held'},'Paused'),warm=element('div',{id:'as1-warm','aria-hidden':'true'});held.hidden=true;warm.hidden=true;hooks.area.append(held);document.body.append(warm);
  const icons={exit:'↪',pause:'Ⅱ',sound:'♪',more:'•••',battery:'▱',comfort:'☼',save:'◇'};
  function label(e,key,text){e.replaceChildren(element('span',{'class':'as1-icon','aria-hidden':'true'},icons[key]),element('span',{'class':'as1-label'},text));}
  const controls={};function control(key,text,fn){const b=element('button',{id:'as1-'+key,type:'button','class':'as1-control'});label(b,key,text);b.onclick=fn;controls[key]=b;bar.append(b);return b;}
  const exit=document.getElementById('mbmexit-back');if(!exit)throw Error('Canonical exit is missing');exit.classList.add('as1-control');exit.setAttribute('aria-label','Exit to the Arcade');label(exit,'exit','Exit');bar.append(exit);
  let panelName=null,previousFocus=null,appWasInert=false,battery=false,soft=false,sound=true;
  const rows=[];if(hooks.setBattery)rows.push('battery');if(hooks.setSoftSound||hooks.setWarm)rows.push('comfort');if(hooks.serialize&&hooks.deserialize)rows.push('save');
  function sync(){const paused=hooks.state().paused;sound=hooks.soundOn?.()!==false;held.hidden=!paused;controls.pause?.setAttribute('aria-pressed',String(paused));if(controls.pause)controls.pause.disabled=!!panelName;controls.sound?.setAttribute('aria-pressed',String(sound));controls.battery?.setAttribute('aria-pressed',String(battery));controls.more?.setAttribute('aria-expanded',String(!!panelName));}
  if(hooks.pause)control('pause','Pause',()=>{hooks.pause(!hooks.state().paused);sync();});
  if(hooks.setSound)control('sound','Sound',()=>{sound=!sound;hooks.setSound(sound);sync();});
  function row(key,text,fn){const b=element('button',{type:'button'});b.append(element('span',{'class':'as1-icon','aria-hidden':'true'},icons[key]),element('span',{},text));b.onclick=fn;body.append(b);return b;}
  function toggle(text,value,fn){const b=element('button',{type:'button','aria-label':text,'aria-pressed':String(value)},text);b.onclick=()=>{const on=b.getAttribute('aria-pressed')!=='true';fn(on);b.setAttribute('aria-pressed',String(on));};body.append(b);return b;}
  function setBattery(on){battery=on;hooks.setBattery(on);sync();}
  function close(){if(!panelName)return;panelName=null;panel.hidden=true;hooks.area.inert=appWasInert;hooks.panel(false);sync();previousFocus?.focus({preventScroll:true});}
  function open(name){if(!panelName){previousFocus=document.activeElement;appWasInert=hooks.area.inert;hooks.panel(true);hooks.area.inert=true;}panelName=name;panel.hidden=false;body.replaceChildren();status.textContent='';title.textContent={more:'More',comfort:'Comfort',save:'Save code',battery:'Battery'}[name];
    if(name==='more'){for(const key of rows){const b=row(key,{battery:'Battery',comfort:'Comfort',save:'Save code'}[key],()=>{if(key==='battery'){setBattery(!battery);b.setAttribute('aria-pressed',String(battery));}else open(key);});if(key==='battery')b.setAttribute('aria-pressed',String(battery));}}
    if(name==='comfort'){if(hooks.setWarm)toggle('Warm screen',!warm.hidden,on=>{warm.hidden=!on;hooks.setWarm(on);});if(hooks.setSoftSound)toggle('Soften sound',soft,on=>{soft=on;hooks.setSoftSound(on);});body.append(element('p',{},'Some people find this easier to look at.'));}
    if(name==='save')savePanel();
    if(name!=='more'&&!shell.classList.contains('as1-wide')){const back=element('button',{type:'button'},'Back');back.onclick=()=>open('more');body.append(back);}
    sync();(body.querySelector('button,textarea')||done).focus({preventScroll:true});
  }
  if(rows.length)control('more','More',()=>panelName?close():open('more'));
  for(const key of rows)control(key,{battery:'Battery',comfort:'Comfort',save:'Save code'}[key],()=>key==='battery'?setBattery(!battery):open(key));
  done.onclick=close;
  shell.addEventListener('keydown',e=>{if(e.key==='Escape'&&panelName){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'&&panelName){const focusable=[exit,...panel.querySelectorAll('button:not(:disabled),textarea,a[href]')].filter(e=>!e.hidden&&e.getClientRects().length);const i=focusable.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();focusable.at(-1).focus();}else if(!e.shiftKey&&i===focusable.length-1){e.preventDefault();exit.focus();}}});
  function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=element('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function savePanel(){
    const input=element('textarea',{id:'as1-code','aria-label':'Paste a save code',spellcheck:'false'});body.append(input);
    const restore=row('save','Restore code',async()=>{const original=input.value;try{const decoded=root.MBMCartridge.decode(original);await hooks.deserialize(decoded);status.textContent='Progress restored.';}catch(e){status.textContent=e.message||'This code could not be read.';input.value=original;}});
    const capture=row('save','Get save code',async()=>{try{const code=await root.MBMCartridge.encode(hooks.serialize()),thresholds=hooks.thresholds();if(code.length>thresholds.clipboard){input.value='';download(code,'rally-save.txt');status.textContent='Save file downloaded.';}else{input.value=code;if(code.length<=thresholds.paper)status.textContent='Keep this code to bring your progress back.';else try{await navigator.clipboard.writeText(code);status.textContent='Save code copied.';}catch(_){input.select();status.textContent='Code selected. Use your device’s Copy command.';}}}catch(e){status.textContent=e.message;}});
    row('save','Copy',async()=>{if(!input.value)return;try{await navigator.clipboard.writeText(input.value);status.textContent='Copied.';}catch(_){input.select();status.textContent='Code selected. Use your device’s Copy command.';}});
    if(hooks.ghostLink)row('save','Copy ghost link',async()=>{try{const url=await hooks.ghostLink();input.value=url;try{await navigator.clipboard.writeText(url);status.textContent='Ghost link copied.';}catch(_){input.select();status.textContent='Link selected. Use your device’s Copy command.';}}catch(e){status.textContent=e.message;}});
  }
  let breakpoint=null;
  function layout(){
    // Measure the actual six labels with this estate font, then add the bar's
    // actual gaps and padding. The breakpoint is content-derived, not guessed.
    shell.classList.add('as1-wide');if(controls.more)controls.more.hidden=true;for(const k of rows)controls[k].hidden=false;
    const ss=getComputedStyle(shell);bar.style.width='max-content';
    breakpoint=Math.ceil(bar.getBoundingClientRect().width+parseFloat(ss.paddingLeft)+parseFloat(ss.paddingRight));bar.style.width='';
    const wide=innerWidth>=breakpoint;shell.classList.toggle('as1-wide',wide);for(const k of rows)controls[k].hidden=!wide;if(controls.more)controls.more.hidden=wide;
    document.documentElement.style.setProperty('--as1-band',shell.getBoundingClientRect().height+'px');hooks.resize?.();
  }
  document.documentElement.classList.add('as1-mounted');layout();document.fonts?.ready.then(layout);addEventListener('resize',layout,{passive:true});
  const prefs=hooks.preferences?.()||{};soft=!!prefs.soft;warm.hidden=!prefs.warm;sound=hooks.soundOn?.()!==false;sync();
  root.MBMArcade=Object.freeze({open,close,sync,layout,get breakpoint(){return breakpoint;},get panelName(){return panelName;},get battery(){return battery;}});
})(globalThis);
