'use strict';
// CI-only controls: capture and transport the real save; never import a fixture.
module.exports=async function sizingControls(page,valid,check){
  const box=page.locator('#as1-code'),copy=page.getByRole('button',{name:'Copy',exact:true});
  const sizing=await box.evaluate(e=>{const s=getComputedStyle(e),c=document.createElement('canvas').getContext('2d');c.font=s.font;const width=e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),height=e.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom),group=c.measureText('AAAAA-').width,lineHeight=parseFloat(s.lineHeight),groups=Math.floor(width/group),rows=Math.floor(height/lineHeight);return{availableWidth:width,availableHeight:height,groupWidth:group,lineHeight,groupsPerLine:groups,rows,paper:groups*6*rows-1}});
  const paper=Array(sizing.groupsPerLine*sizing.rows).fill('AAAAA').join('-');
  const fit=()=>box.evaluate(e=>({height:e.clientHeight,scrollHeight:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth}));
  await box.fill(paper);const original=await fit();await box.fill(paper+'\n'+Array(sizing.groupsPerLine).fill('AAAAA').join('-'));const planted=await fit();await box.fill(paper);const restored=await fit();
  const fits=x=>x.scrollHeight<=x.height&&x.scrollWidth<=x.width;
  const paperControl={original,planted,restored,red:!fits(planted),green:fits(original)&&fits(restored)};
  check('paper threshold from actual visible textarea rows',{...sizing,...paperControl},x=>x.rows>0&&x.paper>0&&x.red&&x.green,{...sizing,...paperControl,red:false});
  const same=async code=>page.evaluate(({code,valid})=>JSON.stringify(window.MBMCartridge.decode(code))===JSON.stringify(window.MBMCartridge.decode(valid)),{code,valid});
  const limit=Math.max(16000,valid.length),candidate=valid+' '.repeat(limit-valid.length);let clipboard;
  try{
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);await box.fill(candidate);const at=Date.now();await copy.click();
    const text=await page.evaluate(()=>navigator.clipboard.readText());clipboard={length:text.length,exact:text===candidate,decoded:await same(text),elapsedMs:Date.now()-at};
    check('clipboard transport at proposed policy ceiling',clipboard,x=>x.length===limit&&x.exact&&x.decoded,{...clipboard,exact:false});
  }catch(e){clipboard={unmeasured:e.message};}
  await page.evaluate(()=>{window.__as1ClipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('AS1 clipboard disabled control'))}})});
  let fallback,file,medium,small,configured;
  try{
    await box.fill(candidate);await copy.click();fallback=await box.evaluate(e=>({length:e.value.length,selected:e.selectionEnd-e.selectionStart,text:e.value}));fallback.exact=fallback.text===candidate;fallback.decoded=await same(fallback.text);delete fallback.text;
    check('API-disabled fallback at proposed policy ceiling',fallback,x=>x.length===limit&&x.selected===limit&&x.exact&&x.decoded,{...fallback,selected:0});
    const saved=await page.evaluate(()=>({...window.MBMAS1Sizing}));
    try{
      await page.evaluate(()=>Object.assign(window.MBMAS1Sizing,{measured:true,paper:1,clipboard:1}));
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Get save code',exact:true}).click();const download=await downloadPromise,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const text=Buffer.concat(chunks).toString('utf8');
      file={name:download.suggestedFilename(),length:text.length,boxEmpty:(await box.inputValue())==='',...await page.evaluate(({text,valid})=>{const a=window.MBMCartridge.decode(text).localStorage,b=window.MBMCartridge.decode(valid).localStorage,difference=[...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(key=>a[key]!==b[key]).map(key=>({key,before:b[key],after:a[key]}));return{localStorageMatches:difference.length===0,difference};},{text,valid})};
      check('larger size class downloads a real restorable file',file,x=>x.length>1&&x.boxEmpty&&x.localStorageMatches,{...file,localStorageMatches:false});
      await page.evaluate(limit=>Object.assign(window.MBMAS1Sizing,{measured:true,paper:1,clipboard:limit}),limit);await page.getByRole('button',{name:'Get save code',exact:true}).click();await page.waitForFunction(()=>document.getElementById('as1-status').textContent.includes('selected'));
      medium=await box.evaluate(e=>({length:e.value.length,selected:e.selectionEnd-e.selectionStart}));medium.status=await page.locator('#as1-status').textContent();
      check('medium size class offers working selection fallback',medium,x=>x.length>1&&x.length<=limit&&x.selected===x.length&&x.status.includes('selected'),{...medium,selected:0});
      await page.evaluate(limit=>Object.assign(window.MBMAS1Sizing,{paper:limit,clipboard:limit}),limit);await page.getByRole('button',{name:'Get save code',exact:true}).click();await page.waitForFunction(()=>document.getElementById('as1-status').textContent.includes('Keep this code'));
      small={length:(await box.inputValue()).length,status:await page.locator('#as1-status').textContent()};check('paper class chooses its on-screen instruction',small,x=>x.length>0&&x.status.includes('Keep this code'),{...small,status:''});
    }finally{await page.evaluate(saved=>{for(const k of Object.keys(window.MBMAS1Sizing))delete window.MBMAS1Sizing[k];Object.assign(window.MBMAS1Sizing,saved)},saved)}
    configured=await page.evaluate(()=>({...window.MBMAS1Sizing}));
  }finally{await page.evaluate(()=>{if(window.__as1ClipboardDescriptor)Object.defineProperty(navigator,'clipboard',window.__as1ClipboardDescriptor);else delete navigator.clipboard;delete window.__as1ClipboardDescriptor})}
  await box.fill(valid);
  return{...sizing,paperControl,clipboard:limit,fileAbove:limit,clipboardProof:clipboard,fallback,file,medium,small,configured,qrCap:2000,basis:'Paper is measured from actual visible rows, red-proved by one extra line. Clipboard is a policy ceiling with actual byte-preserving clipboard and selected-text tests, using the real valid code padded only with accepted whitespace. It is not a browser maximum or a human transcription study. Class-branch controls temporarily change only the sizing fixture and restore it; they never import synthetic game state.'};
};
