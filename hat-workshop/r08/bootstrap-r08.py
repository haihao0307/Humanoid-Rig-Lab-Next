"""One-time readable source migration. Never replay over an existing app.js."""
from pathlib import Path
import json,shutil,hashlib
R=Path(__file__).resolve().parent;B=R.parent/'r07'
if (R/'app.js').exists():raise SystemExit(0)
auth=json.loads((B/'SOURCE_AUTHORITY.json').read_text())
for n in set(auth['canonicalRuntime']+['SOURCES.json','THREE_LICENSE.txt','PRESETS.json']):
 p=R/n
 if not p.exists():p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(B/n,p)
s=(B/'app.js').read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='ed48574503d80d63ea2e3e765be787ec1caba515cfc413de063dc9eb8f08481a'
s="import {compute,workerStats,guard,aborted,waitWithSignal} from './worker-client.mjs';\nimport {fetchDetail} from './detail-loader.mjs';\n"+s
s=s.replace("import {CONSTRUCTION,sourceFitProfile,deform} from './fit.mjs';",'').replace('import {MOTHER_VERSION,','import {CONSTRUCTION,MOTHER_VERSION,')
s=s.replace("const storage='kaopu.hat-r07.recipe'","const storage='kaopu.hat-r08.recipe'")
s=s.replace('const catalogueFailures=[],recipesByHat=new Map();','const catalogueFailures=[],recipesByHat=new Map();let activeSelection=null,detailJob=null,lastRequested=null;const selectionEvents=[];')
def block(start,end,new):
 global s
 a=s.index(start);b=s.index(end,a);s=s[:a]+new+s[b:]
block('function solveAsset(','const dataCache=',(R/'loading-runtime.inc.js').read_text())
block('async function loadAsset(','function changed()',(R/'asset-runtime.inc.js').read_text())
block('async function headGeometry(','function syncUI()',(R/'selection-runtime.inc.js').read_text())
block('async function readPackage(','function currentFeedback',"""async function readPackage(meta){
 if(meta.mother||meta.p||meta.rawPositions)return meta;
 throw Error('页面缺少内置配方；请重新打开固定版本，不会无限等待外部资源');
}
async function readHead(index){const h=D.native.heads[index];if(!h)throw Error('未知头形');return readPackage(h);}
function selectionError(e){if(e?.name==='AbortError')return;if(activeSelection)return;message(e.message+'；旧对象仍保留，可重试或直接换帽。',true);$('loading').hidden=Boolean(asset);}
""")
block('function estimateAsset(','function retainAsset(',"""function estimateAsset(a){
 const buffers=new Set();const add=v=>{if(ArrayBuffer.isView(v)){buffers.add(v.buffer);return;}if(v&&typeof v==='object'&&!Array.isArray(v))for(const x of Object.values(v))add(x);};
 add(a.mesh);for(const fit of a.fitResults?.values()||[])add(fit);
 for(const object of [a.object,a.sweatMesh,a.innerMesh,a.sectionMesh]){for(const attr of Object.values(object?.geometry?.attributes||{}))add(attr.array);add(object?.geometry?.index?.array);}
 let bytes=[...buffers].reduce((sum,b)=>sum+b.byteLength,0)*2;
 for(const t of Object.values(a.maps)){const im=t.image;bytes+=(im?.width||0)*(im?.height||0)*4*(1+4/3);}
 return bytes;
}
""")
s=s.replace('else{asset.fitSource??=sourceFitProfile(asset.mesh,meta);asset.fitResult=solveAsset(asset,s,profile);','else{asset.fitResult=solveAsset(asset,s,profile);')
s=s.replace("$('head-select').onchange=async()=>{try{const i=Number($('head-select').value);if(await headGeometry(i)){apply();frame();persist();}}catch(e){selectionError(e);}};", "$('head-select').onchange=()=>select(state.id,{...state,head:Number($('head-select').value)}).catch(selectionError);")
s=s.replace('if(!person||s.head!==state.head)await headGeometry(s.head);state=s;apply();return metrics();','if(!person||s.head!==state.head)return select(s.id,s);state=s;apply();return metrics();')
s=s.replace('initMotherUI();let start=',"$('cancel-load').onclick=cancelSelection;$('retry-load').onclick=()=>{if(lastRequested)select(lastRequested.id,lastRequested.settings).catch(selectionError);};$('retry-detail').onclick=()=>{if(asset)queueDetail(asset);};\n initMotherUI();let start=")
s=s.replace('window.hatLab={performance:cacheReport,','window.hatLab={cancel:cancelSelection,retryDetail:()=>queueDetail(asset),performance:cacheReport,')
s=s.replace('function disposeAsset(a){if(!a)return;','function disposeAsset(a){if(!a||a.disposed)return;')
s=s.replace("||(input.version==='HAT-R01.0'", "||(input.version==='HAT-R07.1'&&input.sourceCommit==='2b76a1b77a4a11e3f6c936c29ebff9b5cbe99013')||(input.version==='HAT-R01.0'")
s=s.replace('await select(start.id,start);\n installHeadTools();','try{await select(start.id,start);}catch(e){selectionError(e);}\n installHeadTools();')
block('async function thumbnails(){','async function boot()',"""async function thumbnails(){
 for(const h of D.hats){const img=document.querySelector(`.hat-card[data-id="${h.id}"] img`);if(!h.renderedThumbnail){catalogueFailures.push({id:h.id,message:'缺少原目录缩略图'});continue;}img.src=h.renderedThumbnail;img.dataset.rendered='true';thumbsReady++;}
 $('count').textContent=thumbsReady+' 款真实三维';
}
""")
(R/'app.js').write_text(s)
s=(B/'shell.html').read_text();s=s.replace('<div hidden="" id="payload">','<script id="hat-worker-source" type="application/x-worker">/*WORKER*/</script><div hidden="" id="payload">');assert '/*WORKER*/' in s
pos=s.index('id="status"');end=s.index('</',pos);end=s.index('>',end)+1
s=s[:end]+'''<div class="load-tools"><span id="load-stage" hidden></span><button id="cancel-load" hidden>取消等待</button><button id="retry-load">重试选中帽子</button></div><div class="detail-tools"><span id="detail-status">原色随页面内置；高清表面独立加载</span><button id="retry-detail">重试高清表面</button></div>'''+s[end:]
s=s.replace('</style>','.hat-card[data-pending]{outline:2px solid #93651c;outline-offset:-2px}.hat-card[data-pending] strong::after{content:" · 准备中"}.load-tools,.detail-tools{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;font-size:12px;padding:3px 8px}.load-tools button,.detail-tools button{padding:4px 8px;font-size:12px}.load-tools:has(#cancel-load[hidden]) #retry-load{opacity:.7}</style>').replace('R07 固定方法候选','R08 异步加载版').replace('R07 固定分类量配','R08 原帽形与异步加载')
(R/'shell.html').write_text(s)
auth['canonicalRuntime']=sorted(set(auth['canonicalRuntime']+['worker.mjs','worker-client.mjs','detail-loader.mjs']))
auth['initialTransport']='bootstrap-r08.py and *.inc.js were used once to establish app.js; never replay over readable production source.'
auth['baseline']='43550335278e94529d2b9007d020b63e39a369f3';auth['schema']='kaopu.source-authority/8'
(R/'SOURCE_AUTHORITY.json').write_text(json.dumps(auth,indent=2))
(R/'TAKEOVER.json').write_text(json.dumps({'baselineBuild':auth['baseline'],'parentEvidence':'693e8e41e4f3e2760b836662f9765edfa6c40061','scope':'loading and scheduling only','oldDirectoriesModified':False,'generatedFittedMeshesUsedAsInput':False,'userAccepted':False},indent=2))
