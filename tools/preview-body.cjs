'use strict';
// Loopback-only viewer for the retained releases and active research pages.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=8914;
const routes={
 '/source':'BUILD.json','/workbench':'BUILD-R41.json','/previous':'BUILD-R40.json',
 '/joint-functions':'BUILD-POSE-R32.json','/support-study':'BUILD-SUPPORT-P1.json','/torso-study':'BUILD-TORSO-P1.json',
 '/人物身体_R41_动作与接地.html':'BUILD-R41.json','/身体_R41_动作与接地.html':'BUILD-STUDY-R41.json',
 '/人物身体_R40_皮肤与性能.html':'BUILD-R40.json','/身体_R40_固定皮肤.html':'BUILD-SOURCE-R40.json','/身体_R40_皮肤与性能.html':'BUILD-STUDY-R40.json',
 '/身体_R29_连续关节原轮廓候选.html':'BUILD-POSE-R29.json','/身体_R32_连续动作.html':'BUILD-POSE-R32.json',
 '/身体_P1_参考支撑隔离研究.html':'BUILD-SUPPORT-P1.json','/身体_P1_连续躯干隔离研究.html':'BUILD-TORSO-P1.json'
};
http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 try{
  const url=new URL(req.url,'http://127.0.0.1:'+port),pathname=decodeURIComponent(url.pathname);
  if(/^\/assets\/(body-skin-r22|body-skin-r24|body-atlas-r23|body-atlas-r24|body-exact-r25|body-boundary-r26|body-program-r23|body-program-r27|body-fields-r27|body-normals-r29|body-head-boundary-r29|body-functions-r29|body-rounded-r29|body-dynamic-p1|body-dynamic-r36)\/[A-Za-z0-9_-]+\.gz$/.test(pathname)){
   const folder=pathname.split('/')[2],assetRoot=path.resolve(root,'delivery/assets',folder),asset=path.resolve(assetRoot,path.basename(pathname));
   if(!asset.startsWith(assetRoot+path.sep)||!fs.existsSync(asset)){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'private, max-age=31536000, immutable','Content-Length':fs.statSync(asset).size});if(req.method==='HEAD')res.end();else fs.createReadStream(asset).pipe(res);return;
  }
  let manifest=routes[pathname];
  if(pathname==='/')manifest=url.searchParams.get('view')==='workbench'?'BUILD-R41.json':'BUILD.json';
  // Historical links embedded in the retained research pages resolve to the current product.
  if(!manifest&&/^\/(人物身体|身体)_R(?:[0-2]?[0-9]|3[0-9])_.*\.html$/.test(pathname)){
   res.writeHead(302,{Location:pathname.startsWith('/人物身体')?'/workbench':'/source','Cache-Control':'no-store'});res.end();return;
  }
  if(!manifest){res.writeHead(404);res.end();return;}
  const build=JSON.parse(fs.readFileSync(path.join(root,manifest),'utf8').replace(/^\uFEFF/,'')),file=path.resolve(root,build.file);
  if(!file.startsWith(root+path.sep))throw Error('Artifact outside project');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':fs.statSync(file).size});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end('工作页正在更新，请稍后刷新。');}
}).listen(port,'127.0.0.1',()=>console.log('Body working viewer http://127.0.0.1:'+port));
