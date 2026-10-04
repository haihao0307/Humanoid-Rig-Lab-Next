import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,relative,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(process.argv[2]||resolve(root,'../../build/character02/index.html'));
const modules={},assets={},moduleId=p=>'human/'+p;
const assetPath=p=>p.replace(/^\.\//,'');
function addModule(path){
 if(modules[path])return;let text=readFileSync(resolve(root,path),'utf8');modules[path]=true;
 text=text.replace(/\b(from\s*|import\s*)['"]([^'"]+)['"]/g,(whole,prefix,spec)=>{
  let target;if(spec==='three')target='vendor/three.module.js';else if(spec==='three/addons/controls/OrbitControls.js')target='vendor/OrbitControls.js';else if(spec.startsWith('.'))target=posix.normalize(posix.join(posix.dirname(path),spec));else throw Error('Unbundled import '+spec+' in '+path);
  if(target.startsWith('../'))throw Error('Runtime module escaped R008 package');addModule(target);return prefix+JSON.stringify(moduleId(target));
 });
 text=text.replace(/new URL\(['"]([^'"]+)['"],\s*import\.meta\.url\)/g,(_,spec)=>{const target=posix.normalize(posix.join(posix.dirname(path),spec));if(target.startsWith('../'))throw Error('Asset escaped package');assets[target]={bytes:readFileSync(resolve(root,target)).toString('base64'),mime:target.endsWith('.json')?'application/json':'application/octet-stream'};return 'globalThis.__HUMAN_FILES['+JSON.stringify(target)+']';});
 modules[path]=gzipSync(Buffer.from(text),{level:9}).toString('base64');
}
addModule('app.mjs');
const metadata=JSON.parse(readFileSync(resolve(root,'anatomy-data/bone-fields.json'),'utf8'));
const build={version:'character02-anatomical-r27',sourceCommit:process.env.GITHUB_SHA||null,sourceBase:'05ef74ff00fdae143d1227fcd9d0279c2741e68a',createdAt:new Date().toISOString(),sourceParameterSha256:createHash('sha256').update(readFileSync(resolve(root,'parameters.phf.gz'))).digest('hex'),atlasCoefficientSha256:metadata.coefficientSha256,atlasSurfaces:metadata.bones.length,modules:Object.keys(modules).length,assets:Object.keys(assets).length,externalRuntimeDependencies:0};
const notices=Object.fromEntries(['vendor/THREE-LICENSE.txt','vendor/EARCUT-LICENSE.txt','anatomy-data/SOURCE-LICENSE.md'].map(p=>[p,readFileSync(resolve(root,p),'utf8')]));
const bundle=JSON.stringify({build,modules,assets,notices}).replaceAll('</script','<\\/script');
const bootstrap=`<script type="application/json" id="humanStandalonePackage">${bundle}</script><script>
(async()=>{try{const source=document.getElementById('humanStandalonePackage'),pack=JSON.parse(source.textContent);source.remove();globalThis.__HUMAN_BUILD=pack.build;globalThis.__HUMAN_FILES={};const bytes=s=>{const a=atob(s),b=new Uint8Array(a.length);for(let i=0;i<a.length;i++)b[i]=a.charCodeAt(i);return b;};for(const [path,asset]of Object.entries(pack.assets))globalThis.__HUMAN_FILES[path]=URL.createObjectURL(new Blob([bytes(asset.bytes)],{type:asset.mime}));const imports={};for(const [path,encoded]of Object.entries(pack.modules)){const decoded=await new Response(new Blob([bytes(encoded)]).stream().pipeThrough(new DecompressionStream('gzip'))).text();imports['human/'+path]=URL.createObjectURL(new Blob([decoded],{type:'text/javascript'}));}const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);const main=document.createElement('script');main.type='module';main.textContent="import 'human/app.mjs'";document.body.append(main);}catch(error){document.getElementById('status').textContent='启动失败：'+error.message;window.failure=error.message;console.error(error);}})();
</script>`;
let html=readFileSync(resolve(root,'index.html'),'utf8').replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.mjs"></script>',bootstrap);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');html=html.replace('</aside>','<details><summary>来源与许可</summary><pre style="white-space:pre-wrap;font-size:10px">'+escape(Object.values(notices).join('\n\n'))+'</pre></details></aside>');
if(/src=["'](?:https?:|\.\/app)/.test(html))throw Error('Unexpected external core script');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,html);writeFileSync(resolve(dirname(output),'BUILD_MANIFEST.json'),JSON.stringify({...build,htmlBytes:Buffer.byteLength(html),htmlSha256:createHash('sha256').update(html).digest('hex')},null,2)+'\n');console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),...build}));
