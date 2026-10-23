'use strict';
const fs=require('fs');
let worker=fs.readFileSync('src/BodyImplicitWorkerR15.js','utf8');
const begin=worker.indexOf('async function decode('),end=worker.indexOf('\nfunction hashGrid',begin);
if(begin<0||end<0)throw Error('Decoder insertion point changed');
const decoder=`let storageReport;
async function decode(encoded){const started=performance.now(),compressed=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),size=new DataView(raw).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(raw,4,size))),start=4+size,cache=new Map();let allocatedBytes=0;const arrays=header.arrays.map(a=>{const key=a.type+':'+a.offset+':'+a.length;if(cache.has(key))return cache.get(key);const T=globalThis[a.type],bytes=new Uint8Array(raw,start+a.offset,a.length*T.BYTES_PER_ELEMENT),view=new T(bytes.slice().buffer);cache.set(key,view);allocatedBytes+=view.byteLength;return view;});function unpack(x){if(x&&x.$array!==undefined)return arrays[x.$array];if(x&&x.$map)return new Map(x.$map.map(([k,v])=>[k,unpack(v)]));if(x&&x.$set)return new Set(x.$set);if(Array.isArray(x))return x.map(unpack);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,unpack(v)]));return x;}storageReport={compressedBytes:compressed.length,rawBytes:raw.byteLength,logicalArrays:arrays.length,uniqueArrays:cache.size,allocatedCoefficientBytes:allocatedBytes,decodeMS:performance.now()-started,bitExactStorage:true};return unpack(header.tree);}`;
worker=worker.slice(0,begin)+decoder+worker.slice(end);
worker=worker.replace("version:'BODY-IMPLICIT-R15'","version:'BODY-IMPLICIT-R17'").replace('bodySamples:program.bodyCount,triangleFaces:0,sourceDerived:true','bodySamples:program.bodyCount,triangleFaces:0,sourceDerived:true,storage:storageReport');
fs.writeFileSync('src/BodyImplicitWorkerR17.js',worker);
let app=fs.readFileSync('src/BodyImplicitAppR02.js','utf8');
app=app.replace('const checks={messages:0,characterFaces:0};','const checks={messages:0,characterFaces:0};let control,iterations=[],pendingIteration=null;');
const functions=`
function syncCompact(){document.querySelectorAll('[data-body-variable]').forEach(e=>{const key=e.dataset.bodyVariable,c=catalog.find(c=>c.key==='anny.phenotypes:'+key);if(c){e.min=c.bounds[0];e.max=c.bounds[1];e.value=get(c.path);}e.disabled=busy;});const button=document.querySelector('#apply-body-variables');if(button)button.disabled=busy;}
function setupControl(){control=createBodyControlR17({catalog,getState:()=>state,isBusy:()=>busy,commit:p=>{pendingIteration={schema:'body-iteration/1',sequence:iterations.length+1,label:p.label,requestedUTC:new Date().toISOString(),basePackageSHA256:window.__BODY_PACKAGE_SHA256__,fromRig:state.owners.rig,toRig:p.state.owners.rig,changes:p.changes,previousState:structuredClone(state)};state=p.state;rebuild();}});window.bodyControlR17=control;}
function recordIteration(){if(!pendingIteration)return;const{previousState,...entry}=pendingIteration;entry.completedUTC=new Date().toISOString();entry.status='computed';entry.functionVersion=lastField.stats.version;iterations.push(entry);pendingIteration=null;}
function rollbackIteration(){if(pendingIteration){state=pendingIteration.previousState;pendingIteration=null;}}
`;
app=app.replace('function syncAppearance()',functions+'\nfunction syncAppearance()');
app=app.replace('function sync(){','function sync(){syncCompact();');
app=app.replace('function filter(){', "function activeControl(c){if(c.group==='anny.pose'||c.group==='anny.translations')return state?.owners.rig==='anny';if(c.group==='mhr.pose'||c.group==='mhr.correctives')return state?.owners.rig==='mhr';return true;}\nfunction filter(){");
app=app.replace('catalog.filter(isBody).filter(c=>', 'catalog.filter(isBody).filter(activeControl).filter(c=>');
app=app.replace("o.textContent=c.label+' · '+c.group.split('.').at(-1);", "o.textContent=({'anny.phenotypes:african':'基础混合 A','anny.phenotypes:asian':'基础混合 B','anny.phenotypes:caucasian':'基础混合 C'}[c.key]||c.label)+' · '+c.group.split('.').at(-1);");
app=app.replace('function rebuild(){busy=true;', 'function rebuild(){lastError=null;delete window.__BODY_IMPLICIT_R02_ERROR__;busy=true;');
app=app.replace("setPath(c.path,c.group==='mhr.correctives'?!!value:value);rebuild();", "control.apply({set:{[c.key]:c.group==='mhr.correctives'?!!value:value},label:'单项身体调整'});");
app=app.replace("state.owners.rig=rig.value;rebuild();", "control.apply({rig:rig.value==='mhr'?'B':'A',label:'切换身体驱动'});");
app=app.replace("state.anny.phenotypes[key]=+value;}rebuild();", "control.apply({set:{['shape.'+key]:+value},label:'体型快速对照'});return;}rebuild();");
app=app.replace("setPath(c.path,value);rebuild();},setOwner(value)", "return control.apply({set:{[key]:value},label:'兼容接口身体调整'});},setOwner(value)");
app=app.replace("state.owners.rig=value;rebuild();},restore(a)", "return control.apply({rig:value==='mhr'?'B':'A',label:'切换身体驱动'});},restore(a)");
app=app.replace('baselineArchive=msg.baselineArchive;renderer.lighting','baselineArchive=msg.baselineArchive;iterations=structuredClone(baselineArchive.person.bodyFunctionSystem?.iterations||[]);setupControl();renderer.lighting');
app=app.replace('state=msg.state;renderer.field(msg);','state=msg.state;renderer.field(msg);recordIteration();');
app=app.replace("busy=false;sync();status.textContent='当前为无网格身体试验；头部留给独立板块。';", "busy=false;filter();document.querySelector('#body-operation-status').textContent='身体已更新。';status.textContent='当前为无网格身体试验；头部留给独立板块。';");
app=app.replace("}else if(msg.type==='error'){lastError=msg.error;busy=false;", "}else if(msg.type==='error'){lastError=msg.error;rollbackIteration();busy=false;");
app=app.replace('worker.onerror=e=>{lastError=e.message;', 'worker.onerror=e=>{rollbackIteration();lastError=e.message;');
// Existing individual API and archive routes stay available. New primary controls
// use the one operation entry, so a multi-value edit generates one surface solve.
app=app.replace("search.addEventListener('input',filter);",`document.querySelector('#apply-body-variables')?.addEventListener('click',()=>{const set={};document.querySelectorAll('[data-body-variable]').forEach(e=>{set['shape.'+({gender:'sex',cupsize:'chestVolume',firmness:'chestFirmness'}[e.dataset.bodyVariable]||e.dataset.bodyVariable)]=Number(e.value);});try{const result=control.apply({set,label:'身体统一调整'});document.querySelector('#body-operation-status').textContent=result.changed?'已合并调整，正在更新身体。':'数值没有变化，无需重新计算。';}catch(error){document.querySelector('#body-operation-status').textContent=error.message;}});\nsearch.addEventListener('input',filter);`);
app=app.replace('appearance:renderer.report().appearance};return a;', 'appearance:renderer.report().appearance,iterations:structuredClone(iterations),controlSchema:"body-control/1",basePackageSHA256:window.__BODY_PACKAGE_SHA256__};return a;');
app=app.replace('baselineArchive=a;if(a.person.restoredLighting', 'baselineArchive=a;iterations=structuredClone(a.person.bodyFunctionSystem?.iterations||[]);if(a.person.restoredLighting');
app=app.replace('baselineArchive=structuredClone(a);rebuild();', 'baselineArchive=structuredClone(a);iterations=structuredClone(a.person.bodyFunctionSystem?.iterations||[]);rebuild();');
app=app.replace("schema:'body-implicit-r02/1'", "schema:'body-implicit-r17/1'");
app=app.replace('Number(e.value);','e.valueAsNumber;');
fs.writeFileSync('src/BodyImplicitAppR17.js',app);
console.log('Prepared R17 decoder and body operation UI; original R15 sources untouched');
