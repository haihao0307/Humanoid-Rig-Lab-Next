import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'../..'),hash=b=>createHash('sha256').update(b).digest('hex');
const source=process.env.GITHUB_SHA||process.env.SOURCE_COMMIT||'local-r13',read=p=>fs.readFileSync(path.join(root,p),'utf8');
const baseline=read('../r10/public-lite.html');
function retain(id){const match=baseline.match(new RegExp('<div hidden id="'+id+'">([A-Za-z0-9+/=]+)</div>'));if(!match)throw Error('Missing retained R10 payload '+id);return '<div hidden id="'+id+'">'+match[1]+'</div>';}
const result=await build({absWorkingDir:root,entryPoints:['src/main.mjs'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,metafile:true,alias:{'three/addons':path.join(root,'node_modules/three/examples/jsm'),three:path.join(root,'node_modules/three')},define:{__BUILD_ID__:JSON.stringify(source)},legalComments:'eof'});
const js=result.outputFiles[0].text;new vm.Script(js);
let html=read('index.html').replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+read('style.css')+'</style>').replace('<script type="module" src="src/main.mjs"></script>',()=>retain('shoe-data')+retain('scan-data')+'<script>'+js.replaceAll('</script','<\\/script')+'</script>');
new vm.Script(html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')));
fs.writeFileSync(path.join(root,'public-lite.html'),html);
const sources=Object.keys(result.metafile.inputs).filter(p=>!p.includes('node_modules')).map(p=>path.resolve(root,p));
for(const p of['index.html','style.css','tools/build.mjs','package.json','package-lock.json'])sources.push(path.join(root,p));
const manifest={version:'R13.0',sourceCommit:source,baseCommit:'fd6c7ca5a338f85ae6c6152b2b23ccf126687c5d',styles:['penny','chelsea','monk','canvas'],legacy:{preserved:true,path:'shoe-workshop/r10/public-lite.html',bytes:Buffer.byteLength(baseline),sha256:hash(baseline),payloads:['shoe-data','scan-data'],humanEmbedExcluded:true,fullOriginalWorkbenchLinked:true},runtime:{bytes:Buffer.byteLength(html),sha256:hash(html)},sources:[...new Set(sources)].map(p=>({path:path.relative(repo,p),sha256:hash(fs.readFileSync(p))})),acceptance:{browser:false,public:false,visual:false,manufacturing:false,physicalSolver:false,wearerFit:false},coreDependencies:'all bundled; optional manufacturer reference photos require network'};
fs.writeFileSync(path.join(root,'BUILD_MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');console.log('BUILT R13',manifest.runtime);
