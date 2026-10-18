import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'../..'),hash=b=>createHash('sha256').update(b).digest('hex');
const source=process.env.GITHUB_SHA||process.env.SOURCE_COMMIT||'local-r14',read=p=>fs.readFileSync(path.join(root,p),'utf8');
const baseline=read('../r10/public-lite.html');
function retain(id){const match=baseline.match(new RegExp('<div hidden id="'+id+'">([A-Za-z0-9+/=]+)</div>'));if(!match)throw Error('Missing retained R10 payload '+id);return '<div hidden id="'+id+'">'+match[1]+'</div>';}
const result=await build({absWorkingDir:root,entryPoints:['src/main.mjs'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,alias:{'three/addons':path.join(root,'node_modules/three/examples/jsm'),three:path.join(root,'node_modules/three')},define:{__BUILD_ID__:JSON.stringify(source)},legalComments:'eof'});
const js=result.outputFiles[0].text;new vm.Script(js);
let html=read('index.html').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+read('style.css')+'</style>').replace('<script type="module" src="src/main.mjs"></script>',()=>retain('shoe-data')+retain('scan-data')+'<script>'+js.replaceAll('</script','<\\/script')+'</script>');
new vm.Script(html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')));
const sources=Object.keys(result.metafile.inputs).filter(p=>!p.includes('node_modules')).map(p=>path.resolve(root,p));
if(!sources.includes(path.join(root,'src/deformation.mjs')))throw Error('The R14 deformation source must be bundled and bound in the manifest');
for(const p of['index.html','style.css','tools/build.mjs','package.json','package-lock.json'])sources.push(path.join(root,p));
const manifest={version:'R14.0',sourceCommit:source,baseCommit:'0f105165964795b4895c3a5d8d2440deac1add91',planCommit:'ec7d80c9f99dc978735245d463306075f5a287d5',acceptedBaseline:{sourceCommit:'8b05ebd8b0755216743792034e3cbb58b8d9ff54',buildCommit:'c979ae664e53cdc2f09bd33511be5be61415efce',path:'shoe-workshop/r13/public-lite.html',runtime:{bytes:13746414,sha256:'7db6ec885c0d7d972b2fb0574039448d2115b98c6e8e428f297c7f989410535b'}},styles:['penny','chelsea','monk','canvas'],legacy:{preserved:true,path:'shoe-workshop/r10/public-lite.html',bytes:Buffer.byteLength(baseline),sha256:hash(baseline),payloads:['shoe-data','scan-data'],humanEmbedExcluded:true,fullOriginalWorkbenchLinked:true},runtime:{bytes:Buffer.byteLength(html),sha256:hash(html)},sources:[...new Set(sources)].map(p=>({path:path.relative(repo,p),sha256:hash(fs.readFileSync(p))})),acceptance:{construction:false,browser:false,public:false,visual:false,manufacturing:false,physicalSolver:false,wearerFit:false},coreDependencies:'all bundled; optional manufacturer reference photos require network'};
fs.writeFileSync(path.join(root,'public-lite.html'),html);fs.writeFileSync(path.join(root,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');console.log('BUILT R14',manifest.runtime);
