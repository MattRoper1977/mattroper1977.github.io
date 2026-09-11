/* AS1 CI-only spectrum measurement through the pilot's actual audio graph.
 * The input is a controlled multisine, not recorded gameplay or recorded speech.
 * Before and after taps observe the same compressor output simultaneously.
 */
'use strict';

async function measure(page){
  const button=page.getByRole('button',{name:'Soften sound',exact:true});
  if(!await button.count()||!await button.isVisible())return{status:'UNMEASURED',reason:'The opted-in Soften sound control is not visible.'};
  const original=await button.getAttribute('aria-pressed');
  if(original!=='true'&&original!=='false')return{status:'UNMEASURED',reason:'The Soften sound control does not expose its state.'};
  let result;
  try{
    // Both transitions are actual clicks; context creation/resume stays in the
    // game's trusted gesture path. No synthetic audio-init call is used here.
    if(original==='true')await button.click();
    await button.click();
    result=await page.evaluate(async()=>{
      const graph=window.MBMArcadeHooks?.audioGraph?.();
      if(!graph?.ctx||!graph.master||!graph.filter||!graph.output)return{status:'UNMEASURED',reason:'The actual context, master, post-compressor output and low-pass filter were not all exposed.'};
      const {ctx,master,filter,output}=graph;
      if(ctx.state!=='running')return{status:'UNMEASURED',reason:'The audio context remained '+ctx.state+' after the trusted control gesture.'};
      if(filter.type!=='lowpass')return{status:'FAIL',reason:'The actual comfort filter is not low-pass.'};
      const frequencies=[125,500,1000,3500,7000,12000];
      if(ctx.sampleRate/2<=12000)return{status:'UNMEASURED',reason:'The context sample rate does not support the 12 kHz probe.'};
      const fftSize=16384,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const before=ctx.createAnalyser(),after=ctx.createAnalyser(),silence=ctx.createGain(),probe=ctx.createGain();
      before.fftSize=after.fftSize=fftSize;before.smoothingTimeConstant=after.smoothingTimeConstant=0;
      before.minDecibels=after.minDecibels=-150;before.maxDecibels=after.maxDecibels=0;
      silence.gain.value=0;probe.gain.value=.1;
      const oscillators=frequencies.map(hz=>{const node=ctx.createOscillator();node.type='sine';node.frequency.value=hz;return node});
      const savedFrequency=filter.frequency.value;
      try{
        output.connect(before);filter.connect(after);before.connect(silence);after.connect(silence);silence.connect(ctx.destination);
        probe.connect(master);for(const node of oscillators){node.connect(probe);node.start()}
        const snapshot=async(corner)=>{
          filter.frequency.setValueAtTime(corner,ctx.currentTime);
          // Clear the prior FFT window after changing the actual filter. These
          // waits are audio settling time, not a replacement for a state check.
          await wait(Math.ceil(fftSize/ctx.sampleRate*1000)+200);
          const a=new Float32Array(before.frequencyBinCount),b=new Float32Array(after.frequencyBinCount),powers=frequencies.map(()=>({before:0,after:0}));
          const at=ctx.currentTime,batches=8;
          for(let n=0;n<batches;n++){
            before.getFloatFrequencyData(a);after.getFloatFrequencyData(b);
            for(let j=0;j<frequencies.length;j++){
              const bin=Math.round(frequencies[j]*fftSize/ctx.sampleRate);
              // Sum the same five bins on each side. This retains spectral
              // leakage equally when a probe is between FFT bin centres.
              for(let i=Math.max(1,bin-2);i<=Math.min(a.length-1,bin+2);i++){
                powers[j].before+=Math.pow(10,a[i]/10);powers[j].after+=Math.pow(10,b[i]/10);
              }
            }
            await wait(60);
          }
          return{cornerHz:corner,contextState:ctx.state,elapsedAudioSeconds:ctx.currentTime-at,batches,rows:frequencies.map((hz,j)=>{const inputDb=10*Math.log10(powers[j].before/batches),outputDb=10*Math.log10(powers[j].after/batches);return{hz,inputDb,outputDb,attenuationDb:outputDb-inputDb}})};
        };
        const observed=s=>s.contextState==='running'&&s.elapsedAudioSeconds>.2&&s.rows.length===6&&s.rows.every(r=>Number.isFinite(r.inputDb)&&Number.isFinite(r.outputDb)&&Number.isFinite(r.attenuationDb)&&r.inputDb>-80);
        const satisfies=s=>observed(s)&&s.rows.filter(r=>r.hz<=1000).every(r=>r.attenuationDb>=-1.5&&r.attenuationDb<=3)&&s.rows.find(r=>r.hz===7000).attenuationDb<=-8&&s.rows.find(r=>r.hz===12000).attenuationDb<=-14;
        const normal=await snapshot(3500),mutated=await snapshot(100),restored=await snapshot(3500);
        const valid=[normal,mutated,restored].every(observed),red=valid&&!satisfies(mutated),green=satisfies(normal)&&satisfies(restored);
        return{
          status:!valid?'MEASUREMENT INVALID':red&&green?'PASS':'FAIL',
          method:'Six controlled sine tones at 0.1 gain enter the actual pilot master. Simultaneous analyser taps measure the actual post-compressor signal before and after the active comfort filter.',
          sampleRate:ctx.sampleRate,fftSize,smoothing:0,frequencies,normal,mutated,restored,
          control:{mutation:'Actual filter corner changed to 100 Hz, then restored to 3,500 Hz.',red,green},
          criteria:'125, 500 and 1,000 Hz remain within -1.5 to +3 dB; 7,000 Hz is attenuated by at least 8 dB and 12,000 Hz by at least 14 dB; every input tone must be present above -80 dB.',
          scope:'Controlled output-spectrum transfer measurement on the actual game graph. It does not measure speech synthesis, whose browser output is outside this graph.'
        };
      }finally{
        filter.frequency.setValueAtTime(savedFrequency,ctx.currentTime);
        for(const node of oscillators){try{node.stop()}catch(_){}node.disconnect()}
        probe.disconnect();try{output.disconnect(before)}catch(_){}try{filter.disconnect(after)}catch(_){}
        before.disconnect();after.disconnect();silence.disconnect();
      }
    });
  }catch(error){result={status:'UNMEASURED',reason:error.message||String(error)}}
  finally{
    try{if(await button.getAttribute('aria-pressed')!==original)await button.click()}
    catch(error){result={...(result||{}),status:'FAIL',restoreError:error.message||String(error)}}
  }
  if(result?.normal){
    const lines=['state,corner_hz,frequency_hz,input_db,output_db,attenuation_db'];
    for(const state of ['normal','mutated','restored'])for(const row of result[state].rows)lines.push([state,result[state].cornerHz,row.hz,row.inputDb,row.outputDb,row.attenuationDb].join(','));
    result.csv=lines.join('\n')+'\n';
  }
  return result;
}
module.exports={measure};
