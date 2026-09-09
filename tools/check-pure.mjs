// File-content audit only. Application source is parsed, never evaluated.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {assemble} from './build-pure.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
const assert=(value,message)=>{if(!value)throw Error(message);};
// Reuse Node 24's bundled parser, avoiding a vendored dependency tree.
const parserSource=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
assert(parserSource,'This file auditor requires Node.js 24 with its bundled parser');
const parserModule={exports:{}};vm.runInNewContext(parserSource,{exports:parserModule.exports,module:parserModule});
const {parse}=parserModule.exports;
const output=assemble(),manifest=JSON.parse(read('source/assembly.json'));
assert(output.index===read('index.html'),'Entrypoint differs from source assembly');
const bound=new Set(),refs=[];let largestArray=0;
function binding(n){if(!n)return;if(n.type==='Identifier')bound.add(n.name);else if(n.type==='RestElement')binding(n.argument);else if(n.type==='AssignmentPattern')binding(n.left);else if(n.type==='ArrayPattern')n.elements.forEach(binding);else if(n.type==='ObjectPattern')n.properties.forEach(p=>binding(p.type==='RestElement'?p.argument:p.value));}
function walk(n,parent=null,key=''){
 if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(v=>walk(v,parent,key));return;}
 if(n.type==='VariableDeclarator')binding(n.id);
 if(/Function/.test(n.type)||n.type==='ArrowFunctionExpression'){binding(n.id);n.params.forEach(binding);}
 if(n.type==='ClassDeclaration'||n.type==='ClassExpression')binding(n.id);if(n.type==='CatchClause')binding(n.param);
 if(n.type==='Identifier'){
  const property=parent&&(parent.type==='MemberExpression'&&key==='property'&&!parent.computed||(parent.type==='Property'||parent.type==='MethodDefinition'||parent.type==='PropertyDefinition')&&key==='key'&&!parent.computed||/^(Labeled|Break|Continue)Statement$/.test(parent.type)&&key==='label');
  if(!property)refs.push([n.name,n.loc.start.line]);
 }
 if(n.type==='ArrayExpression'){largestArray=Math.max(largestArray,n.elements.length);assert(n.elements.length<=128,'Large literal array requires review at line '+n.loc.start.line);}
 if(n.type==='Literal'&&typeof n.value==='string')assert(!/[A-Za-z0-9+/=]{512,}/.test(n.value),'Encoded asset-like literal in runtime');
 for(const [k,v]of Object.entries(n))if(!['type','loc','start','end'].includes(k))walk(v,n,k);
}
walk(parse(output.runtime,{ecmaVersion:'latest',sourceType:'module',locations:true}));
const globals=new Set(('window document console performance globalThis Math Number String Object Array Set Map WeakMap WeakSet RegExp Boolean BigInt Symbol Date JSON Error TypeError RangeError Promise Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int32Array ArrayBuffer DataView URL URLSearchParams Blob Response FileReader TextDecoder TextEncoder CustomEvent Event Image DOMParser Option Intl navigator localStorage sessionStorage location alert confirm prompt requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout setInterval clearInterval addEventListener removeEventListener dispatchEvent fetch atob btoa isFinite isNaN parseFloat parseInt decodeURIComponent encodeURIComponent undefined Infinity NaN WebGL2RenderingContext DecompressionStream AbortController getComputedStyle devicePixelRatio ResizeObserver structuredClone crypto').split(' '));
const unresolved=[...new Map(refs.filter(([n])=>!bound.has(n)&&!globals.has(n)).map(([n,l])=>[n,l]))];
assert(!unresolved.length,'Names with no declaration: '+JSON.stringify(unresolved));
let scripts=0;
for(const [name,html]of Object.entries({body:output.body,brain:output.brain,index:output.index,audio:read('audio-check.html')}))for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 assert(!/src\s*=/.test(m[1]),'Unexpected external script in '+name);if(/application\/json/.test(m[1]))continue;
 parse(m[2],{ecmaVersion:'latest',sourceType:/type\s*=\s*["']module/.test(m[1])?'module':'script'});scripts++;
}
const forbidden=/APPROVED_UPPER_BODY_DATA|WHOLE_BODY_GROUPS|JARVIS_WHOLE_BODY_PACKED|loadWholeBodyCore|loadWholeBodyFemaleSurface|integrateApprovedUpperBodyGeometry/;
assert(!forbidden.test(output.runtime),'Legacy model dependency remains');
assert(/this\.skin = this\.makeSurface\(\)/.test(output.runtime),'Skin does not use its procedural constructor');
assert(/return g;/.test(read('body/ConnectedSurface.js')),'Missing generated-surface return');
assert(/lab\.dna=installHumanDNA\(lab\)/.test(output.runtime),'DNA export is not installed');
const contract=JSON.parse(read('body/HumanDNAContract.json'));
assert(contract.acceptance.runtimeVerified===false&&contract.acceptance.visualAcceptance===false&&contract.acceptance.productionReady===false,'File-only acceptance boundary changed');
assert(new Set(contract.uncertainty.map(v=>v.state)).size===4,'Unknown-state distinctions are missing');
for(const lock of contract.sourceLocks)assert(/\/blob\/[a-f0-9]{40}\//.test(lock.url)&&/^[a-f0-9]{40}$/.test(lock.gitBlobSHA),'Unpinned knowledge source');
for(const recipe of contract.structureRecipes)assert(statSync(join(root,recipe.source)).isFile(),'Missing recipe source '+recipe.source);
const files=[];
function scan(dir){for(const item of readdirSync(dir,{withFileTypes:true})){
 if(item.name==='.git')continue;const path=join(dir,item.name),rel=relative(root,path).replaceAll('\\','/');
 assert(!item.isSymbolicLink(),'Symlink is outside this source-only package contract');
 if(item.isDirectory()){assert(rel!=='anatomy'&&!['backups','build','node_modules','source-archives','body-v1160-authoring','__pycache__'].includes(item.name),'Unneeded artifact directory '+rel);scan(path);continue;}
 const data=readFileSync(path);assert(!data.includes(0),'Binary file '+rel);
 assert(!/\.(glb|gltf|obj|fbx|stl|ply|usd|usdz|blend|png|jpe?g|webp|gif|tga|ktx2?|hdr|exr|bin|npy|npz|wav|mp[34]|zip)$/i.test(rel),'Model/media/archive file '+rel);
 if(extname(rel)==='.json')JSON.parse(data.toString());
 files.push({path:rel,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}}
scan(root);
for(const path of [...manifest.modules,...Object.values(manifest.htmlModules).flat()])assert(files.some(f=>f.path===path),'Missing assembly dependency '+path);
console.log(JSON.stringify({schema:'jarvis/pure_file_audit@1',files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),runtimeBytes:Buffer.byteLength(output.runtime),entrypointBytes:Buffer.byteLength(output.index),htmlScriptsParsed:scripts,largestLiteralArray:largestArray,unresolvedIdentifiers:unresolved.length,legacyModelDependencies:0,modelFiles:0,imageFiles:0,sourceAssemblyMatches:true,applicationExecuted:false,visualAcceptance:false,indexSHA256:createHash('sha256').update(output.index).digest('hex')},null,2));
