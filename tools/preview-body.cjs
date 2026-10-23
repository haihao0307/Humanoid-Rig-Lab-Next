'use strict';
// Loopback-only viewer for the current working HTML. No workspace directory
// listing or filesystem write endpoint is exposed.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=8914;
http.createServer((req,res)=>{if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}if(req.url!=='/'&&!req.url.startsWith('/?')){res.writeHead(404);res.end();return;}try{const build=JSON.parse(fs.readFileSync(path.join(root,'BUILD-R20.json'),'utf8').replace(/^\uFEFF/,'')),file=path.resolve(root,build.file);if(!file.startsWith(root+path.sep))throw Error('Artifact outside project');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':fs.statSync(file).size});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);}catch(e){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end('工作页正在更新，请稍后刷新。');}}).listen(port,'127.0.0.1',()=>console.log('Body working viewer http://127.0.0.1:'+port));
