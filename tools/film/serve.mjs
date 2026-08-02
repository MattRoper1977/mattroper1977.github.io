import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = process.argv[2], port = +process.argv[3];
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2'};
http.createServer((q,s)=>{
  let u=decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/'))u+='index.html';
  const f=path.join(root,u);
  if(!f.startsWith(root)){s.writeHead(403);return s.end();}
  fs.readFile(f,(e,d)=>{ if(e){s.writeHead(404,{'content-type':'text/plain'});return s.end('404');}
    s.writeHead(200,{'content-type':T[path.extname(f).toLowerCase()]||'application/octet-stream'}); s.end(d); });
}).listen(port,'127.0.0.1',()=>console.log('up '+port));
