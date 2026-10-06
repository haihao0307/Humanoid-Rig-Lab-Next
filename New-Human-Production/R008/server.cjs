const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const allowIntake=process.env.R008_INTAKE==='1',port=Number(process.env.R008_PORT||8877);
const publicFiles=new Set(['/face-reference.json','/HumanInverseMethod.mjs','/HumanInverseSystem.mjs','/LoadingProgress.js','/SubjectLoading.mjs','/SubjectLoadingWorker.mjs','/vendor/three.module.js','/vendor/three.core.js','/vendor/OrbitControls.js','/FacePartition.mjs','/FacePartitionWorkbench.mjs','/SurfaceSkeletonFit.mjs','/SurfaceSkeletonDisplay.mjs','/R008InverseCalibration.mjs','/MotorAnatomy.mjs','/AnatomyDisplay.mjs','/MotionAnatomyWorkbench.mjs','/HumanBodySystem.mjs','/HumanBodySpecies.mjs','/BodyComposition.mjs','/R008CompositionCalibration.mjs','/AnatomyAnalysis.mjs','/AnatomyMath.mjs','/AnatomyContract.mjs','/MuscleAtlas.mjs','/AnatomyWorkbench.mjs','/AdiposeLayer.mjs','/index.html','/ViewControls.mjs','/app.mjs','/SubjectRuntime.mjs','/surface-generator.mjs','/SurfaceQuality.mjs','/BodyTissue.mjs','/BodyParameters.mjs','/BodyBinding.mjs','/BodyWorkbench.mjs','/parameter-codec.mjs','/material-fields.mjs','/SkinAppearance.mjs','/SkinMaterial.mjs','/SkinWorkbench.mjs','/ScarState.mjs','/ScarSurface.mjs','/ScarWorkbench.mjs','/parameters.phf.gz','/vendor/earcut.js','/CharacterController.mjs','/GameAnimator.mjs','/JumpProfiles.mjs','/JumpMotionData.mjs','/NaturalRunData.mjs','/FacialExpression.mjs','/ProceduralEyes.mjs','/FacialBinding.mjs','/FacialWorkbench.mjs','/game-world.mjs','/game-scene.mjs']);
// Only relative modules reachable from the public runtime graph are exposed.
function collectRuntimeDependencies(){
 const queue=[...publicFiles],seen=new Set();
 while(queue.length){
  const url=queue.shift();if(seen.has(url)||!/[.](mjs|js)$/.test(url))continue;seen.add(url);
  const file=path.resolve(root,'.'+url);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))continue;
  const source=fs.readFileSync(file,'utf8'),imports=/\b(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
  for(const match of source.matchAll(imports)){
   const dependency=path.resolve(path.dirname(file),match[1]);if(!dependency.startsWith(root+path.sep)||!/[.](mjs|js)$/.test(dependency)||!fs.existsSync(dependency))continue;
   const relative='/'+path.relative(root,dependency).split(path.sep).join('/');publicFiles.add(relative);queue.push(relative);
  }
 }
}
collectRuntimeDependencies();
http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(req.method==='GET'&&p==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({subject:'new-human-r008',mode:allowIntake?'intake':'preview',pid:process.pid}));}
 // The user photograph is a local reference input, kept in ignored QA storage.
 // Expose this one fixed file; never expose arbitrary filesystem paths.
 if(req.method==='GET'&&p==='/face-reference-image'){
  const input=path.join(root,'qa','face-reference-r28','input.webp');
  if(!fs.existsSync(input)){res.writeHead(404);return res.end('Reference input unavailable');}
  res.writeHead(200,{'Content-Type':'image/webp','Content-Length':fs.statSync(input).size,'Cache-Control':'no-store'});return fs.createReadStream(input).pipe(res);
 }
 if(allowIntake&&req.method==='POST'&&p==='/capture') {let chunks=[];req.on('data',x=>chunks.push(x));req.on('end',()=>{(req.headers['x-capture-append']==='1'?fs.appendFileSync:fs.writeFileSync)(path.join(root,'qa','capture.json'),Buffer.concat(chunks));res.end('ok')});return;}
 if(p==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(!allowIntake&&!publicFiles.has(p==='/'?'/index.html':p))collectRuntimeDependencies();
 if(!allowIntake&&!publicFiles.has(p==='/'?'/index.html':p)){res.writeHead(404);return res.end('Not in runtime package');}
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
 const ext=path.extname(file).toLowerCase();res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.jpeg':'image/jpeg','.png':'image/png'})[ext]||'application/octet-stream');res.setHeader('Content-Length',fs.statSync(file).size);res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`R008 workbench http://127.0.0.1:${port}/ (pid ${process.pid})`));
