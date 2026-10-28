'use strict';
// Loopback-only candidate viewer; no desktop input or workspace listing.
const http=require('http'),fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'../../..','delivery');
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const u=new URL(req.url,'http://127.0.0.1:8915'),p=decodeURIComponent(u.pathname);if(p==='/favicon.ico'){res.writeHead(204);return res.end();}let file;
 if(p==='/workbench')file=path.join(root,'人物身体_R36_年龄性别候选.html');
 else if(['/身体_R36_连续年龄性别候选.html','/身体_R35_可调皮肤.html','/身体_R32_连续动作.html'].includes(p))file=path.join(root,p.slice(1));
 else if(/^\/assets\/(body-skin-r22|body-skin-r24|body-atlas-r23|body-atlas-r24|body-exact-r25|body-boundary-r26|body-program-r23|body-program-r27|body-fields-r27|body-functions-r28|body-rounded-r28|body-normals-r29|body-head-boundary-r29|body-functions-r29|body-rounded-r29|body-dynamic-p1|body-dynamic-r36)\/[a-zA-Z0-9_-]+\.gz$/.test(p))file=path.join(root,p.slice(1));
 else{res.writeHead(404);return res.end();}
 if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.writeHead(200,{'Content-Type':p.startsWith('/assets/')?'application/octet-stream':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':fs.statSync(file).size});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}).listen(8915,'127.0.0.1',()=>console.log('R36 candidate viewer 8915'));
