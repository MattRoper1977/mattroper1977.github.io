// Education origin: maps three build roots onto one origin.
//   /               -> education-site
//   /Lessons/...    -> education-lessons
//   /Matt-s-Apps-/. -> education-apps
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(process.argv[2]),port=Number(process.argv[3]||4612);
const roots=[['/Matt-s-Apps-/','education-apps'],['/Lessons/','education-lessons'],['/','education-site']].map(([m,d])=>[m,path.join(base,d)]);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.wasm':'application/wasm'};
http.createServer((req,res)=>{
  let pathname; try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const [mount,root]=roots.find(([m])=>pathname===m.slice(0,-1)||pathname.startsWith(m));
  let rel=pathname===mount.slice(0,-1)?'':pathname.slice(mount.length);
  let p=path.resolve(root,'.'+('/'+rel));
  if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403).end();return;}
  if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');
  if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':fs.statSync(p).size});
  fs.createReadStream(p).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('education origin ready on',port));
