/* AS1 geometry-only telemetry: supplied quantise/pack/deflate/base64 pipeline.
 * #ghost= is the single accepted form. Bounds come from the game's map.
 * Rally is three-dimensional: height is packed too; no text fields are packed.
 */
(function(root){'use strict';
  const axes=['x','y','z'],TAU=Math.PI*2;
  function boundsOK(b){for(const a of axes)if(!Number.isFinite(b['min'+a])||!Number.isFinite(b['max'+a])||b['max'+a]<=b['min'+a])throw Error('Track bounds unavailable');}
  async function encode(samples,bounds){boundsOK(bounds);if(!samples.length||samples.length>900)throw Error('Record up to 90 seconds first.');const out=new Uint8Array(2+samples.length*7),v=new DataView(out.buffer);v.setUint16(0,samples.length);let n=2;
    for(const s of samples){if(Object.keys(s).some(k=>!['x','y','z','angle'].includes(k)))throw Error('Geometry only');for(const a of axes){const lo=bounds['min'+a],hi=bounds['max'+a];if(!Number.isFinite(s[a])||s[a]<lo||s[a]>hi)throw Error('Run left the track bounds');v.setUint16(n,Math.round((s[a]-lo)/(hi-lo)*65535));n+=2;}if(!Number.isFinite(s.angle))throw Error('Heading unavailable');v.setUint8(n++,Math.round((((s.angle%TAU)+TAU)%TAU)/TAU*255));}
    return root.MBMCartridge.envelope(out,2);
  }
  function decode(hash,bounds){boundsOK(bounds);const b=root.MBMCartridge.open(hash,2),v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(b.length<2)throw Error('Ghost is incomplete');const count=v.getUint16(0);if(!count||count>900||b.length!==2+count*7)throw Error('Ghost is incomplete');const samples=[];let n=2;
    for(let i=0;i<count;i++){const s={};for(const a of axes){s[a]=bounds['min'+a]+v.getUint16(n)/65535*(bounds['max'+a]-bounds['min'+a]);n+=2;}s.angle=v.getUint8(n++)/255*TAU;samples.push(s);}return samples;
  }
  root.MBMGhost=Object.freeze({encode,decode,sampleRate:10});
})(globalThis);
