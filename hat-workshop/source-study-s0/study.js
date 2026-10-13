/* All-eleven source study. This module inspects existing attributed reference assets.
   It is not a claim that reference geometry/materials are independently reconstructed. */
(()=>{
'use strict';
const AUDIT=globalThis.HAT_STUDY_AUDIT,$=id=>document.getElementById(id);
const labels={complete:'完整参考效果',shape:'只看几何形体',color:'只看颜色贴图',relief:'白底＋来源法线',noNormal:'原色＋关闭法线',wire:'显示网格线',controls:'原控制网'};
let api,T,layer='complete',space='source',active=null,temporary=null,cage=null,selection=0,busy=false,lastState='',errorList=[];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cleanup(){
 if(active&&!active.asset.disposed)active.hat.material=active.asset.material;
 if(cage){cage.parent?.remove(cage);cage.geometry.dispose();cage.material.dispose();cage=null;}
 if(temporary){temporary.dispose();temporary=null;}
}
function snapshot(){
 const p=api.debugParts();return{version:'HAT-STUDY-S0',sourceSha:AUDIT.sourceSha,hat:p.asset.meta.id,layer,space,detail:p.asset.detailState,normalPresent:Boolean(p.asset.maps.normal),geometryHash:api.geometryHash(),camera:api.cameraPose(),attribution:{author:p.asset.meta.author,licence:p.asset.meta.licence},reconstructionComplete:false,errors:[...errorList]};
}
function refreshInfo(){
 if(!active)return;const a=active.asset,r=AUDIT.hats.find(r=>r.id===a.meta.id);
 $('study-record').innerHTML=`<h2>${escape(r.title)}</h2><p>${escape(r.author)} · ${escape(r.licenceAsRecorded)}</p><p>控制点 ${r.controls.toLocaleString()} · 原多边形 ${r.polygons.toLocaleString()}<br>细分 ${r.subdivision} 级 · UV 岛 ${r.uvIslands}<br>网格连通块 ${r.connectedComponents}（不等于裁片数）</p><p>颜色 ${r.color.width}×${r.color.height}<br>法线 ${r.normal?r.normal.width+'×'+r.normal.height:'此导入包未提供独立图'}<br>UV 平滑：${r.smoothUV?'启用':'未启用'}</p>`;
 $('study-normal-state').textContent=r.normal?(a.maps.normal?'原高清法线已就绪':'原高清法线尚未就绪，不将当前画面当作完整参考'):'本款导入包没有独立法线图，细节来源需结合几何与颜色拆查。';
 $('study-layer').querySelector('[value="relief"]').disabled=!a.maps.normal;
 $('study-layer').querySelector('[value="controls"]').disabled=space!=='source';
 $('study-source-note').textContent='当前显示已导入的署名参考资产，不是新的自有帽型。原生成器和素材均未被本拆解工具改写。';
 const old=$('quality-note');if(old)old.textContent='来源资产拆解，未进行自有形态替换。';
}
function atlas(){
 if(!active)return;const mode=$('study-map').value,a=active.asset,map=mode==='normal'?a.maps.normal:a.maps.color,canvas=$('study-atlas'),ctx=canvas.getContext('2d');
 canvas.width=canvas.height=512;ctx.fillStyle='#d9d9d5';ctx.fillRect(0,0,512,512);
 if(map?.image)ctx.drawImage(map.image,0,0,512,512);
 if($('study-uv').checked){ctx.strokeStyle=mode==='normal'?'rgba(255,255,255,.50)':'rgba(32,197,224,.65)';ctx.lineWidth=.6;ctx.beginPath();for(const f of a.meta.mother.cornerUV){f.forEach((uv,j)=>{const x=uv[0]*512,y=(1-uv[1])*512;if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.closePath();}ctx.stroke();}
 $('study-atlas-note').textContent=(mode==='normal'&&!map?'本款法线图未提供或尚未加载。':'原贴图只在这里缩略显示；三维仍使用原分辨率。')+' UV 线来自来源控制网，不将 UV 岛自动认作缝合裁片。';
}
function showLayer(value){
 if(!Object.hasOwn(labels,value))throw Error('未知拆解层');cleanup();active=api.debugParts();layer=value;
 const a=active.asset,h=active.hat;
 if(value==='relief'&&!a.maps.normal){layer='complete';}
 if(value==='controls'&&space!=='source'){layer='complete';}
 if(layer!=='complete'){
  if(layer==='color')temporary=new T.MeshBasicMaterial({map:a.maps.color,color:a.material.color.clone(),side:a.material.side,alphaTest:a.material.alphaTest});
  else{temporary=a.material.clone();temporary.wireframe=layer==='wire';
   if(['shape','relief','controls'].includes(layer)){temporary.map=null;temporary.color.set('#b7b5ac');}
   if(['shape','noNormal','controls'].includes(layer))temporary.normalMap=null;
   if(layer==='controls')temporary.visible=false;
  }
  h.material=temporary;
 }
 if(layer==='controls'){
  const m=a.meta.mother,edges=new Set(),points=[];
  for(const f of m.faces)for(let j=0;j<f.length;j++){const a=f[j],b=f[(j+1)%f.length],k=a<b?a+':'+b:b+':'+a;if(!edges.has(k)){edges.add(k);points.push(...m.controls[a],...m.controls[b]);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));cage=new T.LineSegments(g,new T.LineBasicMaterial({color:'#293c40'}));cage.name='reference-control-edges';h.add(cage);
 }
 $('study-layer').value=layer;refreshInfo();atlas();api.render();return snapshot();
}
async function choose(id){
 const mine=++selection;busy=true;cleanup();
 try{
  if(!AUDIT.hats.some(h=>h.id===id))throw Error('未知参考帽');
  await api.select(id);if(mine!==selection)return;
  await api.set({repair:space==='fitted',view:'product',layer:'material',textureMode:'source',useCustomColor:false,dye:'original',roughness:.86,detail:1,sheen:.65});
  if(mine!==selection)return;active=api.debugParts();api.frame('three');showLayer(layer);
 }catch(e){if(e.name!=='AbortError'){errorList.push(e.message);$('study-normal-state').textContent=e.message;}}
 finally{if(mine===selection)busy=false;}
}
async function setSpace(value){
 if(!['source','fitted'].includes(value))throw Error('未知对照空间');space=value;cleanup();
 await api.set({repair:space==='fitted'});active=api.debugParts();api.frame('three');showLayer(layer);return snapshot();
}
function mount(){
 api=window.hatLab;T=globalThis.__hatEngine.THREE;
 const panel=document.createElement('section');panel.id='study-panel';panel.innerHTML=`<p class="study-kicker">SOURCE STUDY / ALL 11</p><h1>原版逐层拆解</h1><p class="study-warning">参考恢复 ≠ 自有复现完成。十一款全部在范围内。</p><label>几何基准<select id="study-space"><option value="source">来源轮廓（关闭后加量配）</option><option value="fitted">既有 R09 量配（对照）</option></select></label><label>观察层<select id="study-layer">${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><p id="study-normal-state" role="status"></p><div class="study-buttons"><button id="study-front">正面</button><button id="study-side">侧面</button><button id="study-back">背面</button><button id="study-top">顶部</button><button id="study-inside">内侧</button><button id="study-detail">近景</button></div><div id="study-record"></div><details open><summary>原贴图与 UV</summary><select id="study-map"><option value="color">颜色图</option><option value="normal">法线图</option></select><label class="study-check"><input id="study-uv" type="checkbox" checked>叠加来源 UV</label><canvas id="study-atlas" aria-label="来源贴图与控制网UV"></canvas><p id="study-atlas-note"></p></details><p id="study-source-note"></p><details><summary>复现前的固定规则</summary><p>先从原版锁定轮廓、结构、贴图细节分工与材质响应，再逐层替换；不再从品类名称猜造型。相机、比例和灯光一致时比较，不合格不进入造型改款。</p><p>网格与最终贴图不能自动还原作者未提供的高模、裁剪过程或物理参数；不确定的制作步骤必须单独标注。</p></details>`;
 document.querySelector('.right').prepend(panel);
 document.title='KAOPU · 十一款原版拆解 · S0';
 document.querySelector('.catalogue-note').textContent='原来的十一款全部保留。当前是来源拆解区，不是重新设计的帽子。';
 $('build-id').textContent='STUDY S0 · '+AUDIT.sourceSha.slice(0,8)+' / REF R09';
 $('study-layer').onchange=e=>showLayer(e.target.value);$('study-space').onchange=e=>setSpace(e.target.value).catch(e=>errorList.push(e.message));
 $('study-map').onchange=atlas;$('study-uv').onchange=atlas;
 for(const pose of ['front','side','back','top','inside','detail'])$('study-'+pose).onclick=()=>api.frame(pose);
 $('catalogue').addEventListener('click',e=>{const button=e.target.closest('.hat-card');if(button){e.stopImmediatePropagation();void choose(button.dataset.id);}},true);
 window.hatStudy={ready:()=>Boolean(active)&&api.ready()&&!busy,select:choose,layer:showLayer,space:setSpace,snapshot,audit:()=>AUDIT,render:()=>api.render()};
 void choose(api.metrics().hat);
 setInterval(()=>{if(!active||busy||!api.ready())return;const now=api.debugParts();const stamp=now.asset.meta.id+':'+now.asset.detailState+':'+Boolean(now.asset.maps.normal);if(stamp!==lastState){lastState=stamp;showLayer(layer);}},350);
}
const start=performance.now();const poll=setInterval(()=>{if(window.hatLab?.ready()){clearInterval(poll);mount();}else if(performance.now()-start>120000){clearInterval(poll);console.error('Source study did not obtain a ready reference renderer');}},100);
})();
