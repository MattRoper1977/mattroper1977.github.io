/* AS1 codec library. No storage, DOM, boot action, or save authority. */
(function(root){
  'use strict';
  const MAX_BYTES=2*1024*1024;
  const fail=()=>{throw Error('This code could not be read. Check it and try again.');};
  function checksum(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function unbase64(s){if(!/^[A-Za-z0-9_-]+$/.test(s)||s.length%4===1)fail();let b;try{b=atob(s.replace(/-/g,'+').replace(/_/g,'/'));}catch(_){fail();}return Uint8Array.from(b,c=>c.charCodeAt(0));}
  async function compress(bytes){
    if(bytes.length>MAX_BYTES)throw Error('This save needs the existing file transfer.');
    if(typeof root.CompressionStream==='function')try{return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new root.CompressionStream('deflate-raw'))).arrayBuffer());}catch(_){}
    return root.pako.deflateRaw(bytes);
  }
  function inflate(bytes){
    const parts=[];let size=0;const stream=new root.pako.Inflate({raw:true,chunkSize:16384});
    stream.onData=part=>{size+=part.length;if(size>MAX_BYTES)fail();parts.push(part);};
    stream.push(bytes,true);if(stream.err||!stream.ended)fail();
    const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
  }
  async function envelope(bytes,kind){const compressed=await compress(bytes),out=new Uint8Array(compressed.length+6);out[0]=1;out[1]=kind;new DataView(out.buffer).setUint32(2,checksum(compressed));out.set(compressed,6);return base64(out);}
  function open(s,kind){const b=unbase64(s);if(b.length<7||b[0]!==1||b[1]!==kind||new DataView(b.buffer).getUint32(2)!==checksum(b.subarray(6)))fail();return inflate(b.subarray(6));}
  // Base64 itself is case-sensitive. This reversible presentation alphabet
  // escapes uppercase and punctuation before case folding is permitted.
  function present(s){return s.replace(/[A-Z0_-]/g,c=>c==='0'?'00':c==='-'?'01':c==='_'?'02':'0'+c.toLowerCase()).toUpperCase().match(/.{1,5}/g).join('-');}
  function normalise(s){return String(s).replace(/[\p{Dash_Punctuation}\u2212\u2043\u00ad]/gu,'-').replace(/[\s\u00a0\u200b\ufeff]/gu,'').toLowerCase();}
  function unpresent(s){s=normalise(s).replace(/-/g,'');if(!s||s.length>MAX_BYTES*4||!/^[a-z0-9]+$/.test(s))fail();let out='';for(let i=0;i<s.length;i++){if(s[i]!=='0'){out+=s[i];continue;}const c=s[++i];if(c==='0')out+='0';else if(c==='1')out+='-';else if(c==='2')out+='_';else if(c&&/[a-z]/.test(c))out+=c.toUpperCase();else fail();}return out;}
  const api={checksum,compress,inflate,base64,unbase64,envelope,open,normalise,
    async encode(value){return present(await envelope(new TextEncoder().encode(JSON.stringify(value)),1));},
    decode(code){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(open(unpresent(code),1)));}catch(_){fail();}}
  };
  root.MBMCartridge=Object.freeze(api);
})(globalThis);
