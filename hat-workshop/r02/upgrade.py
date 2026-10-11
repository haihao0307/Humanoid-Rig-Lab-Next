"""Derive inspectable R02 sources from frozen R01; old production files stay untouched."""
from pathlib import Path
root=Path(__file__).resolve().parent
p=root.parent/'r01'
s=(p/'app.js').read_text()
s=s.replace("layer:'material'}", "layer:'material',repair:true}",1)
s=s.replace("const storage='kaopu.hat-r01.recipe';", "const storage='kaopu.hat-r02.recipe';")
s=s.replace("let saveWarning='';", "let saveWarning='';let headToken=0,firstFrameMS=null;const catalogueFailures=[],recipesByHat=new Map();")
pos=s.index('async function unpack64')
s=s[:pos]+'''const dataCache=new Map();
async function readPackage(meta){
 if(meta.geometry)return meta;
 if(!meta.packageURL)throw Error('此帽型缺少资源入口');
 if(dataCache.has(meta.id))return dataCache.get(meta.id);
 const pending=(async()=>{const r=await fetch(meta.packageURL);if(!r.ok)throw Error('资源加载失败 '+r.status+'：'+meta.id);const bytes=await r.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==meta.packageSHA256)throw Error('资源版本校验失败：'+meta.id);const data=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());return{...meta,...data};})();
 dataCache.set(meta.id,pending);
 try{const value=await pending;while(dataCache.size>2){const oldest=dataCache.keys().next().value;if(oldest===meta.id)break;dataCache.delete(oldest);}return value;}catch(e){dataCache.delete(meta.id);throw e;}
}
async function readHead(index){const h=D.native.heads[index];if(h.p)return h;return readPackage({...h,id:'head-'+h.id});}
function selectionError(e){message(e.message+'；旧对象仍保留，可重试。',true);$('loading').hidden=Boolean(asset);}
function currentFeedback(){return{schema:'kaopu.workbench.feedback/1',version:D.version,sourceCommit:D.sourceCommit,baseline:D.baseline,recipe:recipe(),camera:{position:camera.position.toArray(),target:controls.target.toArray()},observation:$('feedback-text')?.value||'',scope:$('feedback-scope')?.value||'visual',userAccepted:false,recordedAt:new Date().toISOString()};}
function updateQuality(){if(!$('quality-note')||!asset)return;const notes={cable:'翻边UV平滑修正版；保留来源织纹，仍不是纱线级几何。',visor:'额部贴合修正版；仅静态头部，尚无动态碰撞认证。'};$('quality-note').textContent=notes[state.id]||'来源帽型与材质适配候选；本轮未宣称影视级或物理就绪。';}
''' + s[pos:]
s=s.replace("function render(){if(!asset)return;renderer.render(scene,camera);", "function render(){if(!asset)return;renderer.render(scene,camera);if(firstFrameMS===null)firstFrameMS=performance.now();")
s=s.replace("if(rotating){stage.rotation.y+=.006;requestRender();}", "if(rotating&&!document.hidden){stage.rotation.y+=.006;requestRender();}")
s=s.replace("function disposeAsset(a){if(!a)return;", "function disposeAsset(a){if(!a)return;a.disposed=true;")
s=s.replace("async function loadAsset(meta){const geometry=await decodeGeometry(meta.geometry),maps={};await Promise.all", "async function loadAsset(meta){meta=await readPackage(meta);const geometry=await decodeGeometry(meta.geometry),maps={};if(meta.originalUV)geometry.userData.originalUV=await unpack64(meta.originalUV,Float32Array);geometry.userData.repairedUV=geometry.attributes.uv?.array;const loaded=await Promise.allSettled")
s=s.replace("maps[key]=t;}));const material=", "maps[key]=t;}));const failed=loaded.find(r=>r.status==='rejected');if(failed){geometry.dispose();Object.values(maps).forEach(t=>t.dispose());throw failed.reason;}const material=")
s=s.replace("nativeHeadId:D.native.heads[state.head].id,fitModel:'bounded-affine/1'", "nativeHeadId:D.native.heads[state.head].id,baseline:D.baseline,fitModel:'bounded-affine/static-calibration-r02'")
s=s.replace("input.version!==D.version||input.sourceCommit!==D.sourceCommit", "!((input.version===D.version&&input.sourceCommit===D.sourceCommit)||(input.version==='HAT-R01.0'&&input.sourceCommit==='ed35e97be7de8b1842f679980b9bd48da911d2e3'))")
s=s.replace("const s=input.settings;", "const s=input.settings?{...input.settings,repair:input.settings.repair??true}:null;")
s=s.replace("if(!Number.isInteger(s.head)", "if(typeof s.repair!=='boolean'||!Number.isInteger(s.head)")
s=s.replace("return structuredClone(s);", "return Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,s[k]]));")
s=s.replace("person.visible=false", "if(person)person.visible=false")
s=s.replace("person.visible=true", "if(person)person.visible=true")
s=s.replace("hat.position.y+=s.lift;", "hat.position.y+=s.lift;if(s.repair!==false&&!compare&&meta.fitCorrection){const f=meta.fitCorrection[state.head];if(f){hat.scale.x*=f.scaleX;hat.scale.z*=f.scaleZ;hat.position.copy(origin.clone().multiply(hat.scale).applyEuler(hat.rotation).multiplyScalar(-1));hat.position.y+=s.lift+(f.lift||0);hat.position.z+=f.forward||0;}}")
s=s.replace("const meta=asset.meta,head=D.native.heads[state.head];", "const meta=asset.meta,head=D.native.heads[state.head];const uv=asset.geometry.userData;if(uv.originalUV){asset.geometry.attributes.uv.array=(compare||s.repair===false)?uv.originalUV:uv.repairedUV;asset.geometry.attributes.uv.needsUpdate=true;}")
s=s.replace("floor.visible=cameraMode!=='inside';syncUI();", "floor.visible=cameraMode!=='inside';updateQuality();syncUI();")
a=s.index('async function headGeometry()');b=s.index('function syncUI()',a)
s=s[:a]+'''async function headGeometry(index=state.head){const t=++headToken,h=await readHead(index),g=await decodeGeometry(h);if(t!==headToken){g.dispose();return false;}if(person){const old=person.geometry;person.geometry=g;old.dispose();}else{person=new T.Mesh(g,new T.MeshStandardMaterial({color:0xc8bdae,roughness:.72}));person.castShadow=true;person.receiveShadow=true;person.name='Original common-person evaluated static head';stage.add(person);}state.head=index;person.visible=state.view==='wear';return true;}
async function select(id,settings=null){
 const meta=D.hats.find(x=>x.id===id);if(!meta)throw Error('未知帽型；保留当前对象');
 const t=++token;busy=true;compare=false;$('compare').classList.remove('holding');
 if(asset)recipesByHat.set(state.id,{...state});
 const candidate=settings||{...DEFAULT,...(recipesByHat.get(id)||{}),id,view:state.view,head:state.head,light:state.light};
 message('正在载入 '+meta.title+'…');let a=null;
 try{
  a=await loadAsset(meta);if(t!==token){disposeAsset(a);return null;}
  if(candidate.view==='wear'&&(!person||candidate.head!==state.head)){await headGeometry(candidate.head);if(t!==token){disposeAsset(a);return null;}}
  const old=asset,oldHat=hat;asset=a;state=candidate;hat=new T.Mesh(a.geometry,a.material);hat.name=id;hat.castShadow=true;hat.receiveShadow=true;stage.add(hat);if(oldHat)stage.remove(oldHat);disposeAsset(old);
  apply();frame();ready=true;$('loading').hidden=true;$('title').textContent=meta.title;$('eyebrow').textContent=`${meta.category} / ${id.toUpperCase()}`;
  $('source-note').textContent=`原帽型 / 贴图：${meta.author} · ${meta.licence}。保留来源资料；当前为Three.js材质适配。`;
  $('teacher-image').src=meta.teacherThumbnail;$('teacher-link').href=meta.referenceURL;updateQuality();
  document.querySelectorAll('.hat-card').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));
  const url=new URL(location.href);if(url.search.startsWith('?https://')){url.hash='hat='+id;}else{url.searchParams.set('hat',id);}try{history.replaceState(null,'',url);}catch{}
  persist();message(saveWarning||'拖动旋转 · 滚轮拉近 · 长按对照R01来源版本');return metrics();
 }catch(e){if(a&&a!==asset&&!a.disposed)disposeAsset(a);if(t===token)selectionError(e);throw e;}finally{if(t===token)busy=false;}
}
''' + s[b:]
s=s.replace("function syncUI(){$('detail')", "function syncUI(){if($('repair'))$('repair').checked=state.repair!==false;$('detail')")
s=s.replace("async function thumbnails(){", "async function thumbnails(){if(D.hats.every(h=>h.renderedThumbnail)){for(const h of D.hats){const img=document.querySelector(`.hat-card[data-id=\"${h.id}\"] img`);img.src=h.renderedThumbnail;img.dataset.rendered='true';}thumbsReady=D.hats.length;$('count').textContent=thumbsReady+' 款真实三维';return;}")
s=s.replace("catch(e){message('缩略图生成失败：'+meta.title,true);throw e;}", "catch(e){renderer.setRenderTarget(null);catalogueFailures.push({id:meta.id,message:e.message});const card=document.querySelector(`.hat-card[data-id=\"${meta.id}\"]`);card.title='缩略图未生成；仍可点击重试主视图';continue;}")
s=s.replace("D=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());", "D=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());$('payload').remove();")
s=s.replace("if(b)select(b.dataset.id).catch(fatal)", "if(b)select(b.dataset.id).catch(selectionError)")
s=s.replace("$('head-select').onchange=async()=>{state.head=Number($('head-select').value);await headGeometry();apply();frame();persist();};", "$('head-select').onchange=async()=>{try{const i=Number($('head-select').value);if(await headGeometry(i)){apply();frame();persist();}}catch(e){selectionError(e);}};")
s=s.replace("$(view).onclick=()=>{state.view=view;apply();frame();persist();}", "$(view).onclick=async()=>{try{if(view==='wear'&&!person)await headGeometry();state.view=view;apply();frame();persist();}catch(e){selectionError(e);}}")
s=s.replace("$('reset').onclick=()=>select(state.id).catch(fatal)", "$('reset').onclick=()=>{recipesByHat.delete(state.id);select(state.id,{...DEFAULT,id:state.id,view:state.view,head:state.head,light:state.light}).catch(selectionError);}")
s=s.replace("$('compare').onpointerup=stopCompare;", "$('compare').onpointerup=stopCompare;$('compare').onlostpointercapture=stopCompare;$('compare').onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();compare=true;apply();}};$('compare').onkeyup=stopCompare;")
s=s.replace("const requested=new URL(location.href).searchParams.get('hat');", "$('repair').onchange=()=>{state.repair=$('repair').checked;apply();persist();};$('feedback-export').onclick=()=>download('hat-feedback-'+state.id+'.json',JSON.stringify(currentFeedback(),null,2));$('feedback-save').onclick=()=>{try{localStorage.setItem('kaopu.hat.feedback.draft',JSON.stringify(currentFeedback()));$('feedback-status').textContent='记录已保存在此浏览器；没有自动发送。';}catch(e){$('feedback-status').textContent='本地保存失败，请导出记录。';}};try{const f=JSON.parse(localStorage.getItem('kaopu.hat.feedback.draft'));if(f?.observation)$('feedback-text').value=f.observation;}catch{};document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRender();});const pageURL=new URL(location.href);const requested=pageURL.searchParams.get('hat')||new URLSearchParams(pageURL.hash.slice(1)).get('hat');")
s=s.replace("await select(start.id,start);await thumbnails();", "await select(start.id,start);")
s=s.replace("ready:()=>ready&&!busy,", "ready:()=>ready&&!busy,firstFrameMS:()=>firstFrameMS,issues:()=>catalogueFailures,feedback:currentFeedback,thumbnailMap:()=>Object.fromEntries([...document.querySelectorAll('.hat-card')].map(b=>[b.dataset.id,b.querySelector('img').src])),")
s=s.replace("set:values=>{state=validate({...recipe(),settings:{...state,...values}});apply();return metrics();}", "set:async values=>{const s=validate({...recipe(),settings:{...state,...values}});if(s.id!==state.id)return select(s.id,s);if((!person&&s.view==='wear')||s.head!==state.head)await headGeometry(s.head);state=s;apply();return metrics();}")
s=s.replace("headPositions:()=>Array.from(person.geometry.attributes.position.array)", "headPositions:()=>person?Array.from(person.geometry.attributes.position.array):[]")
s=s.replace(" $('loading').hidden=true;requestRender();\n}", " $('loading').hidden=true;requestRender();thumbnails().catch(selectionError);\n}")
(root/'app.js').write_text(s)
t=(p/'shell.html').read_text().replace('R01 · 来源复刻与参数试戴','R02 · 接手修复候选').replace('首版视觉候选','R02视觉候选').replace('12 款 · 正在生成三维缩略图','11 款 · 正在载入目录')
t=t.replace('按住看初始版本','按住对照 R01').replace('恢复本款初始版本','恢复本款默认值')
t=t.replace('<details><summary>来源参考与当前差异','<details open><summary>来源参考与当前差异')
t=t.replace('<script id="payload" type="application/octet-stream">','<div id="payload" hidden>').replace('<!--PAYLOAD--></script>','<!--PAYLOAD--></div>')
t=t.replace('<footer>','<section class="section"><label><span>启用本轮修正</span><input id="repair" type="checkbox" checked></label><p id="quality-note" class="small"></p><details><summary>记录本款修改意见</summary><select id="feedback-scope"><option value="visual">形态 / 材质</option><option value="fit">试戴 / 穿插</option><option value="interaction">操作 / 加载</option><option value="framework">框架规则</option></select><textarea id="feedback-text" placeholder="描述问题部位和希望保留或修改的内容" rows="4" style="width:100%;font:inherit"></textarea><div class="seg"><button id="feedback-save">本机保存</button><button id="feedback-export">导出记录</button></div><p id="feedback-status" class="small">自动带入帽型、版本、配方与当前镜头；不会自动上传。</p></details></section><footer>')
t=t.replace('feature/hat-atelier-r01-20261010/hat-workshop/r01','fix/hat-r02-takeover-20261011/hat-workshop/r02')
t=t.replace('详细沟通和建设过程记录在同目录 SESSION_LOG.md。','本轮修复和真实反馈记录在R02的SESSION_LOG.md；运行、视觉、物理分别验收。')
t=t.replace('</style>','@media(max-width:650px){.stage-top p{max-width:90%;}.right{grid-template-columns:1fr 1fr;}.right .section{min-width:0;}}textarea{border:1px solid var(--line);border-radius:4px;background:#fafaf5;padding:8px;resize:vertical}#quality-note{padding-top:10px}</style>')
(root/'shell.html').write_text(t)
print('R02 production sources materialized:',len(s.encode()),len(t.encode()))
