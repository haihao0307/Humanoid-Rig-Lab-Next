/* Deterministic build: frozen R1 functions + asserted R1.1 migration + MIT
 * Three.js r169. No generated vertices or character texture images are saved. */
const fs=require('node:fs'),path=require('node:path');const root=__dirname;
const baseline=fs.readFileSync(path.join(root,'atelier.js'),'utf8'),migration=fs.readFileSync(path.join(root,'bootstrap-r11.js'),'utf8');
const start=migration.indexOf(' function replace('),end=migration.indexOf(' const url=URL.createObjectURL');if(start<0||end<start)throw Error('Migration boundaries not found');
const state={__atelierPatches:[]};const compile=new Function('source','window',migration.slice(start,end)+'\nreturn source;');let app=compile(baseline,state);
const from='function updateCamera(){dirty=true;camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*distance,target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(target)}';
const to='function updateCamera(){dirty=true;const dd=distance*((currentView===\'portrait\'||currentView===\'profile\')?Math.max(1,.64/camera.aspect):1);camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*dd,target.y+Math.sin(pitch)*dd,target.z+Math.cos(yaw)*Math.cos(pitch)*dd);camera.lookAt(target)}';
if(app.split(from).length!==2)throw Error('Camera source drift');app=app.replace(from,to);state.__atelierPatches.push('responsive-full-head-fit');
fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/atelier-compiled.js',app);
const pkg=path.resolve('node_modules/three'),min=path.join(pkg,'build/three.module.min.js');let engine=fs.readFileSync(fs.existsSync(min)?min:path.join(pkg,'build/three.module.js'),'utf8');
const match=engine.match(/export\s*\{([^}]+)\}\s*;?\s*$/);if(!match)throw Error('Unexpected Three.js module export format');
const names=match[1].split(',').map(s=>s.trim().split(/\s+as\s+/)).map(a=>a.length===2?a[1]+':'+a[0]:a[0]).join(',');engine=engine.slice(0,match.index)+'\nreturn {'+names+'};';
const importLine="const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js');";if(app.split(importLine).length!==2)throw Error('Engine import source drift');app=app.replace(importLine,()=> 'const THREE=(()=>{\n'+engine+'\n})();');
app='/* Three.js MIT license:\n'+fs.readFileSync(path.join(pkg,'LICENSE'),'utf8')+'\n*/\nwindow.__atelierPatches='+JSON.stringify(state.__atelierPatches)+';\n'+app;new Function('(async()=>{'+app+'\n})');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');const script=/<script type="module">[\s\S]*?<\/script>/;if(!script.test(html))throw Error('Page script not found');html=html.replace(script,()=>'<script type="module">\n'+app.replace(/<\/script/gi,'<\\/script')+'\n</script>').replace('<title>','<link rel="icon" href="data:,"><title>');
fs.writeFileSync(path.join(root,'standalone.html'),html);fs.writeFileSync('evidence/build.json',JSON.stringify({schema:'skin-atelier/build@1',version:'r1.1-candidate',bytes:Buffer.byteLength(html),patches:state.__atelierPatches,externalScripts:0,externalCharacterAssets:0,visualAcceptance:false},null,2));console.log('Built standalone.html',Buffer.byteLength(html),'bytes; patches',state.__atelierPatches.length);
