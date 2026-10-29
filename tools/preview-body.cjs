'use strict';
// Loopback-only viewer for the current working HTML. No workspace directory
// listing or filesystem write endpoint is exposed.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),port=8914;
http.createServer((req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 try{const url=new URL(req.url,'http://127.0.0.1:'+port),pathname=decodeURIComponent(url.pathname);let manifest;
  if(/^\/assets\/(body-skin-r22|body-skin-r24|body-atlas-r23|body-atlas-r24|body-exact-r25|body-boundary-r26|body-program-r23|body-program-r27|body-fields-r27|body-functions-r28|body-rounded-r28|body-normals-r29|body-head-boundary-r29|body-functions-r29|body-rounded-r29|body-dynamic-p1|body-dynamic-r36)\/[A-Za-z0-9_-]+\.gz$/.test(pathname)){const folder=pathname.split('/')[2],assetRoot=path.resolve(root,'delivery/assets',folder),asset=path.resolve(assetRoot,path.basename(pathname));if(!asset.startsWith(assetRoot+path.sep)||!fs.existsSync(asset)){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'private, max-age=31536000, immutable','Content-Length':fs.statSync(asset).size});if(req.method==='HEAD')res.end();else fs.createReadStream(asset).pipe(res);return;}
  const selected=JSON.parse(fs.readFileSync(path.join(root,'BUILD.json'),'utf8').replace(/^\uFEFF/,'')),companion=selected.companionBuild||'BUILD-R21.json';
  if(pathname==='/')manifest=url.searchParams.get('view')==='workbench'?companion:url.searchParams.get('view')==='r20'?'BUILD-R20.json':url.searchParams.get('view')==='r21'?'BUILD-SOURCE-R21.json':'BUILD.json';
  else if(pathname==='/source')manifest='BUILD.json';
  else if(pathname==='/workbench')manifest=companion;
  else if(pathname==='/joint-functions')manifest=selected.researchBuild||'BUILD-POSE-R28.json';
  else if(pathname==='/support-study'||pathname==='/身体_P1_参考支撑隔离研究.html')manifest='BUILD-SUPPORT-P1.json';
  else if(pathname==='/torso-study'||pathname==='/身体_P1_连续躯干隔离研究.html')manifest='BUILD-TORSO-P1.json';
  else if(pathname==='/人物身体_R40_皮肤与性能.html')manifest='BUILD-R40.json';
  else if(pathname==='/身体_R40_固定皮肤.html')manifest='BUILD-SOURCE-R40.json';
  else if(pathname==='/身体_R40_皮肤与性能.html')manifest='BUILD-STUDY-R40.json';
  else if(pathname==='/人物身体_R39_动作与连续变形.html')manifest='BUILD-R39.json';
  else if(pathname==='/身体_R39_动作与连续变形.html')manifest='BUILD-STUDY-R39.json';
  else if(pathname==='/人物身体_R38_动作编辑.html')manifest='BUILD-R38.json';
  else if(pathname==='/身体_R38_动作编辑.html')manifest='BUILD-STUDY-R38.json';
  else if(pathname==='/人物身体_R37_连续动作.html')manifest='BUILD-R37.json';
  else if(pathname==='/身体_R37_连续动作.html')manifest='BUILD-STUDY-R37.json';
  else if(pathname==='/人物身体_R36_连续体型与骨架.html')manifest='BUILD-R36.json';
  else if(pathname==='/身体_R36_连续体型与骨架.html')manifest='BUILD-STUDY-R36.json';
  else if(pathname==='/人物身体_R35_可调皮肤.html')manifest='BUILD-R35.json';
  else if(pathname==='/身体_R35_可调皮肤.html')manifest='BUILD-SOURCE-R35.json';
  else if(pathname==='/身体_R35_连续皮肤.html')manifest='BUILD-STUDY-R35.json';
  else if(pathname==='/人物身体_R34_动作肤色预览.html')manifest='BUILD-R34.json';
  else if(pathname==='/身体_R33_实时轮廓.html')manifest='BUILD-SOURCE-R33.json';
  else if(pathname==='/人物身体_R33_实时轮廓.html')manifest='BUILD-R33.json';
  else if(pathname==='/身体_R32_平滑轮廓.html')manifest='BUILD-SOURCE-R32.json';
  else if(pathname==='/身体_R32_连续体型.html')manifest='BUILD-STUDY-R32.json';
  else if(pathname==='/身体_R32_连续动作.html')manifest='BUILD-POSE-R32.json';
  else if(pathname==='/人物身体_R32_平滑轮廓.html')manifest='BUILD-R32.json';
  else if(pathname==='/身体_R31_原形体与连续体型.html')manifest='BUILD-SOURCE-R31.json';
  else if(pathname==='/人物身体_R31_连续体型与颈口.html')manifest='BUILD-R31.json';
  else if(pathname==='/身体_R30_原形体与校准.html')manifest='BUILD-SOURCE-R30.json';
  else if(pathname==='/人物身体_R30_可回退体量校准.html')manifest='BUILD-R30.json';
  else if(pathname==='/身体_R29_连续关节原轮廓候选.html')manifest='BUILD-POSE-R29.json';
  else if(pathname==='/身体_R28_连续关节原轮廓候选.html')manifest='BUILD-POSE-R28.json';
  else if(pathname==='/身体_R29_原形体与参数衔接.html')manifest='BUILD-SOURCE-R29.json';
  else if(pathname==='/人物身体_R29_连续关节与原形体.html')manifest='BUILD-R29.json';
  else if(pathname==='/身体_R28_原形体与参数衔接.html')manifest='BUILD-SOURCE-R28.json';
  else if(pathname==='/人物身体_R28_连续关节与原形体.html')manifest='BUILD-R28.json';
  else if(pathname==='/身体_R27_原形体与参数衔接.html')manifest='BUILD-SOURCE-R27.json';
  else if(pathname==='/人物身体_R27_连续计算与原形体.html')manifest='BUILD-R27.json';
  else if(pathname==='/身体_R26_原形体与参数衔接.html')manifest='BUILD-SOURCE-R26.json';
  else if(pathname==='/人物身体_R26_原形体与参数工作页.html')manifest='BUILD-R26.json';
  else if(pathname==='/身体_R25_精确原表面边界.html')manifest='BUILD-SOURCE-R25.json';
  else if(pathname==='/人物身体_R25_原貌与连续参数.html')manifest='BUILD-R25.json';
  else if(pathname==='/身体_R24_原貌与原函数皮纹.html')manifest='BUILD-SOURCE-R24.json';
  else if(pathname==='/人物身体_R24_完整参数与人物衔接.html')manifest='BUILD-R24.json';
  else if(pathname==='/身体_R23_原貌与按需细节.html')manifest='BUILD-SOURCE-R23.json';
  else if(pathname==='/人物身体_R23_完整参数与人物衔接.html')manifest='BUILD-R23.json';
  else if(pathname==='/身体_R22_原貌与原灯光对照.html')manifest='BUILD-SOURCE-R22.json';
  else if(pathname==='/人物身体_R22_原颈部流程与连续参数.html')manifest='BUILD-R22.json';
  else if(pathname==='/身体_R21_原母体函数对照.html')manifest='BUILD-SOURCE-R21.json';
  else if(pathname==='/人物身体_R21_原数据复刻检查.html')manifest='BUILD-R21.json';
  else{res.writeHead(404);res.end();return;}
  const build=JSON.parse(fs.readFileSync(path.join(root,manifest),'utf8').replace(/^\uFEFF/,'')),file=path.resolve(root,build.file);if(!file.startsWith(root+path.sep))throw Error('Artifact outside project');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':fs.statSync(file).size});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});res.end('工作页正在更新，请稍后刷新。');}
}).listen(port,'127.0.0.1',()=>console.log('Body working viewer http://127.0.0.1:'+port));
