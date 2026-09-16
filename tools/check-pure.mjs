// File-content audit only. Application source is parsed, never evaluated.
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {assemble} from './build-pure.mjs';
import {checkActionSources} from './check-actions.mjs';
import {checkNPCRoutineSources} from './check-npc-routines.mjs';
import {checkReconstructionSources} from './check-reconstruction.mjs';
import {checkR2RigMotionSources} from './check-r2-rig-motion.mjs';
import {checkMotionLabIntegration} from './check-motion-lab-integration.mjs';
import {checkCharacterSystemSources} from './check-character-system.mjs';
import {checkStartupSources} from './check-startup.mjs';
import {checkHairSystemSources} from './check-hair-system.mjs';
import {checkSkinAppearanceSources} from './check-skin-appearance.mjs';
import {checkAnatomyRuleSources} from './check-anatomy-rules.mjs';
import {checkFaceControlSources} from './check-face-controls.mjs';
import {checkEyeAnatomySources} from './check-eye-anatomy.mjs';
import {checkFaceAnatomySources} from './check-face-anatomy.mjs';
import {checkCharacterShapeSources} from './check-character-shape.mjs';
import {checkNPCPopulationSources} from './check-npc-population.mjs';
import {checkPhysicsSources} from './check-physics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
const assert=(value,message)=>{if(!value)throw Error(message);};
// Inspect launcher bytes and branches; never execute the batch file or server.
const launcherBytes=readFileSync(join(root,'启动人物项目.cmd'));
assert(launcherBytes.every(b=>b<128),'Windows launcher must be ASCII without a BOM');
const launcher=launcherBytes.toString('ascii');
assert(launcher.endsWith('\r\n')&&!/[\r\n]/.test(launcher.replaceAll('\r\n','')),'Windows launcher must use CRLF on every line');
assert(launcher.startsWith('@echo off\r\nsetlocal EnableExtensions DisableDelayedExpansion\r\n'),'Launcher must enable extensions and preserve literal path characters');
assert(launcher.includes('set "PYTHONINSPECT="\r\n'),'Launcher must disable inherited interactive inspection mode');
assert(read('.gitattributes').includes('*.cmd text eol=crlf'),'Git checkout must preserve Windows launcher line endings');
const labels=[...launcher.matchAll(/^:([a-z_]+)\r?$/gm)].map(m=>m[1]);
assert(new Set(labels).size===labels.length&&[...launcher.matchAll(/goto :([a-z_]+)/g)].every(m=>labels.includes(m[1])),'Launcher has duplicate or missing branch labels');
const pythonLines=launcher.split('\r\n').filter(line=>/^(?:py -3|python|"%JARVIS_PYTHON%") /.test(line));
const probe='-c "import sys; sys.exit(sys.version_info < (3, 9))" <nul >nul 2>nul';
const launch='-X utf8 "%~dp0server\\start_server.py" --open --page index.html';
assert(pythonLines.length===7&&pythonLines.every(line=>line.endsWith(probe)||line.endsWith(launch)),'Every Python invocation must be a bounded version probe or explicit server launch');
assert(pythonLines.filter(line=>line.endsWith(launch)).length===3,'All interpreter branches must launch the same server and page');
assert(launcher.indexOf('if not exist "%~dp0server\\start_server.py"')<launcher.indexOf('py -3 -c')&&launcher.indexOf('if not exist "%~dp0index.html"')<launcher.indexOf('py -3 -c'),'Launcher checks project files before probing Python');
assert(launcher.split(launch+'\r\nset "JARVIS_EXIT_CODE=%errorlevel%"').length===4&&launcher.includes('endlocal & exit /b %JARVIS_EXIT_CODE%'),'Each launch branch preserves the server exit code');
const launcherFileContracts={checks:10,encoding:'ascii',lineEndings:'CRLF',pythonVersionProbes:4,serverLaunchBranches:3,launcherExecuted:false,serverExecuted:false};
// Reuse Node 24's bundled parser, avoiding a vendored dependency tree.
const parserSource=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
assert(parserSource,'This file auditor requires Node.js 24 with its bundled parser');
const parserModule={exports:{}};vm.runInNewContext(parserSource,{exports:parserModule.exports,module:parserModule});
const {parse}=parserModule.exports;
const output=assemble(),manifest=JSON.parse(read('source/assembly.json'));
assert(output.index===read('index.html'),'Entrypoint differs from source assembly');
const bound=new Set(),refs=[];let largestArray=0;
function binding(n){if(!n)return;if(n.type==='Identifier')bound.add(n.name);else if(n.type==='RestElement')binding(n.argument);else if(n.type==='AssignmentPattern')binding(n.left);else if(n.type==='ArrayPattern')n.elements.forEach(binding);else if(n.type==='ObjectPattern')n.properties.forEach(p=>binding(p.type==='RestElement'?p.argument:p.value));}
function walk(n,parent=null,key='',hasArguments=false){
 if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(v=>walk(v,parent,key,hasArguments));return;}
 // Ordinary functions and methods have their own arguments object. Arrows
 // inherit the surrounding function's object; module-level arrows do not.
 if(n.type==='FunctionDeclaration'||n.type==='FunctionExpression')hasArguments=true;
 if(n.type==='VariableDeclarator')binding(n.id);
 if(/Function/.test(n.type)||n.type==='ArrowFunctionExpression'){binding(n.id);n.params.forEach(binding);}
 if(/^(FunctionDeclaration|FunctionExpression)$/.test(n.type))bound.add('arguments');
 if(n.type==='ClassDeclaration'||n.type==='ClassExpression')binding(n.id);if(n.type==='CatchClause')binding(n.param);
 if(n.type==='Identifier'){
  const property=parent&&(parent.type==='MemberExpression'&&key==='property'&&!parent.computed||(parent.type==='Property'||parent.type==='MethodDefinition'||parent.type==='PropertyDefinition')&&key==='key'&&!parent.computed||/^(Labeled|Break|Continue)Statement$/.test(parent.type)&&key==='label');
  if(!property&&!(n.name==='arguments'&&hasArguments))refs.push([n.name,n.loc.start.line]);
 }
 if(n.type==='ArrayExpression'){largestArray=Math.max(largestArray,n.elements.length);assert(n.elements.length<=128,'Large literal array requires review at line '+n.loc.start.line);}
 if(n.type==='Literal'&&typeof n.value==='string')assert(!/[A-Za-z0-9+/=]{512,}/.test(n.value),'Encoded asset-like literal in runtime');
 for(const [k,v]of Object.entries(n))if(!['type','loc','start','end'].includes(k))walk(v,n,k,hasArguments);
}
walk(parse(output.runtime,{ecmaVersion:'latest',sourceType:'module',locations:true}));
const globals=new Set(('window document console performance globalThis Math Number String Object Array Set Map WeakMap WeakSet RegExp Boolean BigInt Symbol Date JSON Error TypeError RangeError Promise Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array ArrayBuffer DataView URL URLSearchParams Blob Response FileReader TextDecoder TextEncoder CustomEvent Event Image DOMParser Option Intl navigator localStorage sessionStorage location alert confirm prompt requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout setInterval clearInterval addEventListener removeEventListener dispatchEvent fetch atob btoa isFinite isNaN parseFloat parseInt decodeURIComponent encodeURIComponent undefined Infinity NaN WebGL2RenderingContext DecompressionStream AbortController getComputedStyle devicePixelRatio ResizeObserver structuredClone crypto').split(' '));
const unresolved=[...new Map(refs.filter(([n])=>!bound.has(n)&&!globals.has(n)).map(([n,l])=>[n,l]))];
assert(!unresolved.length,'Names with no declaration: '+JSON.stringify(unresolved));
const actionFileContracts=checkActionSources({parse,read,runtime:output.runtime,assert});
const npcRoutineFileContracts=checkNPCRoutineSources({parse,read,runtime:output.runtime,body:output.body,index:output.index,assert});
const reconstructionFileContracts=checkReconstructionSources({root,parse,read,runtime:output.runtime,assert});
const r2RigMotionFileContracts=checkR2RigMotionSources({read,runtime:output.runtime,assert});
const motionLabIntegrationContracts=checkMotionLabIntegration({root,parse,read,runtime:output.runtime,globals,assert});
const characterSystemFileContracts=checkCharacterSystemSources({parse,read,assert});
const startupFileContracts=checkStartupSources({read,assert});
const hairSystemFileContracts=checkHairSystemSources({read,parse,runtime:output.runtime,assert});
const skinAppearanceFileContracts=checkSkinAppearanceSources({parse,read,assert});
const anatomyRuleFileContracts=checkAnatomyRuleSources({parse,read,runtime:output.runtime,assert});
const faceControlFileContracts=checkFaceControlSources({read,assert});
const eyeAnatomyFileContracts=checkEyeAnatomySources({read,assert});
const faceAnatomyFileContracts=checkFaceAnatomySources({read,assert});
const characterShapeFileContracts=checkCharacterShapeSources({parse,read,assert});
const npcPopulationFileContracts=checkNPCPopulationSources({parse,read,assert});
const physicsFileContracts=checkPhysicsSources({parse,read,assert,root,runtime:output.runtime});
const parameterFiles=new Set(reconstructionFileContracts.parameterPaths);
let scripts=0;
for(const [name,html]of Object.entries({body:output.body,brain:output.brain,index:output.index,audio:read('audio-check.html')}))for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 assert(!/src\s*=/.test(m[1]),'Unexpected external script in '+name);if(/application\/json/.test(m[1]))continue;
 parse(m[2],{ecmaVersion:'latest',sourceType:/type\s*=\s*["']module/.test(m[1])?'module':'script'});scripts++;
}
const forbidden=/APPROVED_UPPER_BODY_DATA|WHOLE_BODY_GROUPS|JARVIS_WHOLE_BODY_PACKED|loadWholeBodyCore|loadWholeBodyFemaleSurface|integrateApprovedUpperBodyGeometry/;
assert(!forbidden.test(output.runtime),'Legacy model dependency remains');
const shader=read('body/TissueShaders.js'),renderer=read('source/runtime.template.js');
assert(!/updateWholeBodySurface|uploadWholeBodySurface|proceduralSkinOffset/.test(output.runtime),'Removed CPU deformation remains');
const channels=[[5,1,'materialKind']],widths={float:1,vec2:2,vec3:3,vec4:4};
for(const [location,size,name]of channels){const declaration=new RegExp('layout\\(location='+location+'\\)in (float|vec[234]) '+name+';').exec(shader);assert(declaration&&widths[declaration[1]]===size,'Shader attribute mismatch: '+name);}
assert(/tissueAttributes\(items,nv\)[^\n]+this\.attr\(5,values,1,this\.buffers\)/.test(renderer),'World renderer attribute layout');
assert(!/skinInset|musclePalette|jointPalette/.test(shader),'Legacy tissue shader channels remain');
assert(/lab\.dna=installHumanDNA\(lab\)/.test(output.runtime),'DNA export is not installed');
const contract=JSON.parse(read('body/HumanDNAContract.json'));
assert(contract.acceptance.runtimeVerified===false&&contract.acceptance.visualAcceptance===false&&contract.acceptance.productionReady===false,'File-only acceptance boundary changed');
assert(new Set(contract.uncertainty.map(v=>v.state)).size===4,'Unknown-state distinctions are missing');
for(const lock of contract.sourceLocks)assert(/\/blob\/[a-f0-9]{40}\//.test(lock.url)&&/^[a-f0-9]{40}$/.test(lock.gitBlobSHA),'Unpinned knowledge source');
for(const recipe of contract.structureRecipes)assert(statSync(join(root,recipe.source)).isFile(),'Missing recipe source '+recipe.source);
const files=[];
function scan(dir){for(const item of readdirSync(dir,{withFileTypes:true})){
 if(['.git','FILE_AUDIT.json','SHA256SUMS.txt'].includes(item.name)||item.isDirectory()&&item.name==='__pycache__')continue;const path=join(dir,item.name),rel=relative(root,path).replaceAll('\\','/');
 assert(!item.isSymbolicLink(),'Symlink is outside this source-only package contract');
 if(item.isDirectory()){assert(rel!=='anatomy'&&!['backups','build','node_modules','source-archives','body-v1160-authoring','__pycache__'].includes(item.name),'Unneeded artifact directory '+rel);scan(path);continue;}
 const data=readFileSync(path);assert(parameterFiles.has(rel)||!data.includes(0),'Unapproved binary file '+rel);
 assert(!rel.endsWith('.gz')||parameterFiles.has(rel),'Unapproved coefficient container '+rel);
 assert(!/\.(glb|gltf|obj|fbx|stl|ply|usd|usdz|blend|png|jpe?g|webp|gif|tga|ktx2?|hdr|exr|bin|npy|npz|wav|mp[34]|zip)$/i.test(rel),'Model/media/archive file '+rel);
 if(extname(rel)==='.json')JSON.parse(data.toString());
 files.push({path:rel,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}}
scan(root);
for(const path of [...manifest.modules,...Object.values(manifest.htmlModules).flat()])assert(files.some(f=>f.path===path),'Missing assembly dependency '+path);
console.log(JSON.stringify({schema:'jarvis/pure_file_audit@1',files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),runtimeBytes:Buffer.byteLength(output.runtime),entrypointBytes:Buffer.byteLength(output.index),htmlScriptsParsed:scripts,largestLiteralArray:largestArray,unresolvedIdentifiers:unresolved.length,legacyModelDependencies:0,modelFiles:0,imageFiles:0,sourceAssemblyMatches:true,launcherFileContracts,actionFileContracts,npcRoutineFileContracts,reconstructionFileContracts,r2RigMotionFileContracts,motionLabIntegrationContracts,characterSystemFileContracts,startupFileContracts,hairSystemFileContracts,skinAppearanceFileContracts,faceControlFileContracts,eyeAnatomyFileContracts,faceAnatomyFileContracts,characterShapeFileContracts,npcPopulationFileContracts,anatomyRuleFileContracts,physicsFileContracts,applicationExecuted:false,visualAcceptance:false,indexSHA256:createHash('sha256').update(output.index).digest('hex')},null,2));
