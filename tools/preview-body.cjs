'use strict';
// Loopback-only viewer for the current working HTML. No workspace directory
// listing or filesystem write endpoint is exposed.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=8914;
http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 try{const url=new URL(req.url,'http://127.0.0.1:'+port),pathname=decodeURIComponent(url.pathname);let manifest;
  if(pathname==='/')manifest=url.searchParams.get('view')==='workbench'?'BUILD-R21.json':url.searchParams.get('view')==='r20'?'BUILD-R20.json':'BUILD.json';
  else if(pathname==='/source'||pathname==='/身体_R21_原母体函数对照.html')manifest='BUILD-SOURCE-R21.json';
  else if(pathname==='/workbench'||pathname==='/人物身体_R21_原数据复刻检查.html')manifest='BUILD-R21.json';
  else{res.writeHead(404);res.end();return;}
  const build=JSON.parse(fs.readFileSync(path.join(root,manifest),'utf8').replace(/^\uFEFF/,'')),file=path.resolve(root,build.file);if(!file.startsWith(root+path.sep))throw Error('Artifact outside project');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':fs.statSync(file).size});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end('工作页正在更新，请稍后刷新。');}
}).listen(port,'127.0.0.1',()=>console.log('Body working viewer http://127.0.0.1:'+port));
