/* AS1 codec library. No storage, DOM, boot action, or save authority. */
(function(root){
  'use strict';
  const MAX_BYTES=2*1024*1024,MAX_PACKED_BYTES=MAX_BYTES+65536;
  const fail=()=>{throw Error('This code could not be read. Check it and try again.');};
  function checksum(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
  function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function unbase64(s){if(typeof s!=='string'||s.length>Math.ceil((MAX_PACKED_BYTES+6)*4/3)||!/^[A-Za-z0-9_-]+$/.test(s)||s.length%4===1)fail();let b;try{b=atob(s.replace(/-/g,'+').replace(/_/g,'/'));}catch(_){fail();}const bytes=Uint8Array.from(b,c=>c.charCodeAt(0));if(base64(bytes)!==s)fail();return bytes;}
  async function compress(bytes){
    if(bytes.length>MAX_BYTES)throw Error('This save needs the existing file transfer.');
    if(typeof root.CompressionStream==='function')try{return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new root.CompressionStream('deflate-raw'))).arrayBuffer());}catch(_){}
    if(!root.pako||typeof root.pako.deflateRaw!=='function')fail();
    return root.pako.deflateRaw(bytes);
  }
  function inflate(bytes){
    if(bytes.length>MAX_PACKED_BYTES||!root.pako||typeof root.pako.Inflate!=='function')fail();
    const parts=[];let size=0;const stream=new root.pako.Inflate({raw:true,chunkSize:16384});
    stream.onData=part=>{size+=part.length;if(size>MAX_BYTES)fail();parts.push(part);};
    stream.push(bytes,true);if(stream.err||!stream.ended||stream.strm.avail_in!==0)fail();
    const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
  }
  async function envelope(bytes,kind){const compressed=await compress(bytes),out=new Uint8Array(compressed.length+6);out[0]=1;out[1]=kind;new DataView(out.buffer).setUint32(2,checksum(compressed));out.set(compressed,6);return base64(out);}
  function open(s,kind){const b=unbase64(s);if(b.length<7||b[0]!==1||b[1]!==kind||new DataView(b.buffer).getUint32(2)!==checksum(b.subarray(6)))fail();return inflate(b.subarray(6));}
  // Base64 itself is case-sensitive. This reversible presentation alphabet
  // escapes uppercase and punctuation before case folding is permitted.
  function present(s){return s.replace(/[A-Z0_-]/g,c=>c==='0'?'00':c==='-'?'01':c==='_'?'02':'0'+c.toLowerCase()).toUpperCase().match(/.{1,5}/g).join('-');}
  function normalise(s){return String(s).replace(/[\p{Dash}\u2043\u00ad]/gu,'-').replace(/[\p{White_Space}\s\u200b\ufeff]/gu,'').toLowerCase();}
  function unpresent(s){if(typeof s!=='string'||s.length>MAX_PACKED_BYTES*4)fail();s=normalise(s).replace(/-/g,'');if(!s||!/^[a-z0-9]+$/.test(s))fail();let out='';for(let i=0;i<s.length;i++){if(s[i]!=='0'){out+=s[i];continue;}const c=s[++i];if(c==='0')out+='0';else if(c==='1')out+='-';else if(c==='2')out+='_';else if(c&&/[a-z]/.test(c))out+=c.toUpperCase();else fail();}return out;}
  const api={checksum,compress,inflate,base64,unbase64,envelope,open,normalise,
    async encode(value){const json=JSON.stringify(value);if(json===undefined)fail();return present(await envelope(new TextEncoder().encode(json),1));},
    decode(code){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(open(unpresent(code),1)));}catch(_){fail();}}
  };
  root.MBMCartridge=Object.freeze(api);
})(globalThis);
