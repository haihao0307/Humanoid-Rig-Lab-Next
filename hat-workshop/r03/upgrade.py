"""Derive R03 from immutable R02; do not rewrite either accepted historical folder."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
OLD=ROOT.parent/'r02'
s=(OLD/'app.js').read_text()
s="import {MOTHER_VERSION,FIT_SPECS,PARAM_DEFAULTS,subtypeDefaults,validateMother,regenerate,sectionProfile,sample,measurements,sourceFitProfile,deform,categoryPresets} from './mother.mjs';\nimport {installSurface,updateSurface} from './surface.mjs';\n"+s
s=s.replace("const DEFAULT={id:","const DEFAULT={...PARAM_DEFAULTS,id:",1).replace("view:'product',head:0","view:'wear',head:0",1)
s=s.replace("const storage='kaopu.hat-r02.recipe';","const storage='kaopu.hat-r03.recipe';")
s=s.replace("if(meta.geometry)return meta;","if(meta.mother||meta.p)return meta;")
s=s.replace("fitModel:'bounded-affine/static-calibration-r02',physicalFitValidated:false","fitModel:'triangle-sections/category-fit-r03',motherId:state.id,motherVersion:MOTHER_VERSION,proceduralRepresentation:'attributed control net + regenerated subdivision + semantic fields',measurements:asset?.fitResult?.measurement||null,fitDiagnostics:asset?.fitResult?.diagnostics||null,physicalFitValidated:false")
s=s.replace("(input.version==='HAT-R01.0'&&input.sourceCommit==='ed35e97be7de8b1842f679980b9bd48da911d2e3')","(input.version==='HAT-R01.0'&&input.sourceCommit==='ed35e97be7de8b1842f679980b9bd48da911d2e3')||(input.version==='HAT-R02.0'&&input.sourceCommit==='3997dec0a153840432cb445b57481707f29d73ea')")
s=s.replace("{...input.settings,repair:input.settings.repair??true}","{...subtypeDefaults(input.settings.id),...input.settings,repair:input.settings.repair??true}")
s=s.replace("return Object.fromEntries(Object.keys(DEFAULT)","validateMother(s);return Object.fromEntries(Object.keys(DEFAULT)")
a=s.index('function updateQuality()');b=s.index('async function unpack64',a)
s=s[:a]+'''function updateQuality(){if(!asset)return;const m=asset.mesh;$('quality-note').textContent=`${FIT_SPECS[state.id].label}。${m.controlCount}个来源控制点 → 程序细分生成${m.position.length/3}个显示顶点。保留署名与原贴图；不是从零纯解析模型，也不是纱线级物理。`;}
''' + s[b:]
a=s.index('async function loadAsset(');b=s.index('function changed()',a)
s=s[:a]+'''async function loadAsset(meta){
 meta=await readPackage(meta);if(!meta.mother)throw Error('缺少程序母体配方');const start=performance.now(),mesh=regenerate(meta.mother),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(mesh.position,3));geometry.setAttribute('normal',new T.BufferAttribute(mesh.normal,3));geometry.setAttribute('uv',new T.BufferAttribute(mesh.uv,2));geometry.setIndex(new T.BufferAttribute(mesh.index,1));geometry.computeBoundingBox();
 const maps={};const loaded=await Promise.allSettled(Object.entries(meta.textures).map(async([key,url])=>{const t=await new T.TextureLoader().loadAsync(url);t.colorSpace=key==='color'?T.SRGBColorSpace:T.NoColorSpace;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);maps[key]=t;}));const failed=loaded.find(r=>r.status==='rejected');if(failed){geometry.dispose();Object.values(maps).forEach(t=>t.dispose());throw failed.reason;}
 const material=new T.MeshPhysicalMaterial({map:maps.color,normalMap:maps.normal||null,normalScale:new T.Vector2(.8,.8),color:new T.Color().setRGB(...(meta.diffuseColor||[1,1,1])),roughness:.86,metalness:0,sheen:.65,sheenColor:new T.Color(.45,.42,.38),sheenRoughness:.85,specularIntensity:.18,side:T.DoubleSide,alphaTest:.25,envMapIntensity:.45});const uniforms=installSurface(T,material);return {geometry,material,maps,uniforms,meta,mesh,generationMS:performance.now()-start,fitSource:null,fitKey:null,fitResult:null};
}
''' + s[b:]
s=s.replace("hatVisible:hat.visible,headVisible:person?.visible||false","hatVisible:hat.visible,headVisible:person?.visible||false,motherVersion:MOTHER_VERSION,controlPoints:asset.mesh.controlCount,generatedVertices:asset.mesh.position.length/3,generationMS:asset.generationMS,fit:asset.fitResult?.diagnostics||null,measuredHead:asset.fitResult?.measurement||null")
a=s.index('function apply()');b=s.index('function frame(',a)
oldapply=s[a:b]
lighting=oldapply[oldapply.index(" if(s.light==='studio')"):oldapply.index(" floor.visible=cameraMode")]
s=s[:a]+'''const headProfiles=new Map(),measurementGroup=new T.Group(),clearanceMaterial=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide});stage.add(measurementGroup);
function clearMeasurement(){for(const child of [...measurementGroup.children]){child.geometry.dispose();child.material.dispose();measurementGroup.remove(child);}}
function measurementOverlay(profile,s){clearMeasurement();if(!profile||s.view!=='wear'||!s.showMeasurements||compare)return;const mm=measurements(profile,s.wearBandMM/1000),line=(pts,loop,color)=>{const g=new T.BufferGeometry().setFromPoints(pts.map(p=>new T.Vector3(...p))),mat=new T.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.8});const l=loop?new T.LineLoop(g,mat):new T.Line(g,mat);l.renderOrder=20;measurementGroup.add(l);};line(mm.ring.map(p=>[p[0],mm.bandY,p[1]]),true,0x247784);
 for(const angle of [0,Math.PI/2]){const pts=[];for(let side=0;side<2;side++)for(let j=0;j<64;j++){const f=side?1-j/63:j/63,y=mm.bandY+f*(profile.ymax-mm.bandY-.0002),a=angle+side*Math.PI,p=sample(profile,y,a);pts.push([p.center[0]+p.r*Math.cos(a),y,p.center[1]+p.r*Math.sin(a)]);}line(pts,false,angle?0xbb7848:0x668750);}}
function apply(){
 if(!hat)return;const isReference=compare||state.repair===false,s=isReference?{...DEFAULT,...subtypeDefaults(state.id),id:state.id,view:state.view,head:state.head,light:state.light}:state,meta=asset.meta,head=D.native.heads[s.head],profile=headProfiles.get(s.head);stage.rotation.y=0;
 const fitStamp=JSON.stringify([isReference,s.id,s.head,...Object.keys(PARAM_DEFAULTS).filter(k=>!['showMeasurements','showClearance','textureMode','grainStrength','weaveMM','customColor','useCustomColor'].includes(k)).map(k=>s[k])]);
 if(asset.fitKey!==fitStamp){
  if(isReference){asset.fitResult=null;asset.geometry.attributes.position.array=asset.mesh.position;asset.geometry.attributes.normal.array=asset.mesh.normal;}
  else{asset.fitSource??=sourceFitProfile(asset.mesh,meta);asset.fitResult=deform(asset.mesh,meta,s,profile,asset.fitSource);asset.geometry.attributes.position.array=asset.fitResult.position;asset.geometry.attributes.normal.array=asset.fitResult.normal;asset.geometry.setAttribute('color',new T.BufferAttribute(asset.fitResult.colors,3));}
  asset.geometry.attributes.position.needsUpdate=true;asset.geometry.attributes.normal.needsUpdate=true;asset.geometry.computeBoundingBox();asset.geometry.computeBoundingSphere();asset.fitKey=fitStamp;
 }
 hat.material=s.showClearance&&!isReference?clearanceMaterial:s.layer==='clay'?clay:s.layer==='normal'?normal:asset.material;asset.material.wireframe=s.layer==='wire';asset.material.roughness=s.roughness;asset.material.sheen=s.sheen;asset.material.normalScale.set(s.textureMode==='source'?s.detail*.8:0,s.textureMode==='source'?s.detail*.8:0);updateSurface(asset.uniforms,s,COLORS);
 hat.position.set(0,0,0);hat.rotation.set(0,0,0);hat.scale.set(1,1,1);
 if(isReference&&s.view==='wear'){const sx=head.headWidthM/.148,sz=head.headDepthM/.19221,sy=(sx+sz)/2;hat.scale.set(sx,sy,sz);if(meta.fitCorrection){const f=meta.fitCorrection[s.head];hat.scale.x*=f.scaleX;hat.scale.z*=f.scaleZ;}hat.position.set(...meta.origin).multiply(hat.scale).multiplyScalar(-1);if(meta.fitCorrection)hat.position.z+=meta.fitCorrection[s.head].forward||0;}
 else if(!isReference&&!s.autoFit){hat.scale.set(s.width,s.height,s.depth);hat.rotation.z=T.MathUtils.degToRad(s.tilt);hat.position.y=s.lift;}
 if(s.view==='product'){const b=asset.geometry.boundingBox,c=b.getCenter(new T.Vector3());hat.position.set(-c.x*hat.scale.x,-b.min.y*hat.scale.y+.017,-c.z*hat.scale.z);hat.rotation.set(0,0,0);plinth.visible=cameraMode!=='inside';floor.position.y=-.049;}else{plinth.visible=false;floor.position.y=-.46;}
 if(person)person.visible=s.view==='wear';
''' +lighting+''' floor.visible=cameraMode!=='inside';measurementOverlay(profile,state);syncUI();syncMotherUI();updateQuality();requestRender();const m=metrics();$('dimensions').textContent=`${m.widthMM.toFixed(0)} × ${m.heightMM.toFixed(0)} × ${m.depthMM.toFixed(0)} mm`;
}
''' + s[b:]
s=s.replace("state.head=index;person.visible=", "if(!headProfiles.has(index))headProfiles.set(index,sectionProfile(g.attributes.position.array,g.index.array,{ymin:-.07,ymax:g.boundingBox.max.y,rows:112,angles:144}));state.head=index;person.visible=")
s=s.replace("{...DEFAULT,...(recipesByHat.get(id)||{})", "{...DEFAULT,...subtypeDefaults(id),...(recipesByHat.get(id)||{})")
s=s.replace("if(candidate.view==='wear'&&(!person||candidate.head!==state.head))", "if(!person||candidate.head!==state.head)")
s=s.replace("保留来源资料；当前为Three.js材质适配。", "来源控制网驱动程序化母体；保真材质仍使用原贴图。")
s=s.replace('长按对照R01来源版本','长按对照已认可R02 · 默认自动量头配戴')
s=s.replace("$('head-info').textContent=state.view==='wear'?`原总台静态头形 · 水平截面椭圆估算 ${(D.native.heads[state.head].ellipseCircumferenceM*1000).toFixed(0)} mm；非实测头围`:'单帽观察 · 保留原形体与材质层次';", "$('head-info').textContent=state.view==='wear'?'原总台静态头形 · 原尺寸保持；下方显示当前三角网截面测量。':'单帽观察 · 当前头形的定制帽型；R02对照保留。';")
s=s.replace("state.dye=el.dataset.dye;changed();", "state.dye=el.dataset.dye;state.useCustomColor=false;changed();")
s=s.replace("select(state.id,{...DEFAULT,id:state.id", "select(state.id,{...DEFAULT,...subtypeDefaults(state.id),id:state.id")
s=s.replace("let start={...DEFAULT};", "initMotherUI();let start={...DEFAULT,...subtypeDefaults('cable')};")
s=s.replace("start={...DEFAULT,id:requested};", "start={...DEFAULT,...subtypeDefaults(requested),id:requested};")
s=s.replace("if((!person&&s.view==='wear')||s.head!==state.head)","if(!person||s.head!==state.head)")
s=s.replace("window.hatLab={version:", "window.hatLab={mother:()=>({schema:MOTHER_VERSION,recipe:asset.meta.mother,settings:{...state},measurement:asset.fitResult?.measurement||null,diagnostics:asset.fitResult?.diagnostics||null,derivedFrom:asset.meta.author,licence:asset.meta.licence}),presets:()=>categoryPresets(state.id),setPreset:id=>{const p=categoryPresets(state.id).find(p=>p.id===id);if(!p)throw Error('未知预设');state={...state,...p.values,width:1,height:1,depth:1,lift:0,tilt:0};apply();frame();persist();return recipe();},isComparing:()=>compare,measurement:()=>headProfiles.has(state.head)?measurements(headProfiles.get(state.head),state.wearBandMM/1000):null,baselinePositions:()=>Array.from(asset.mesh.position),version:")
insert='''
const motherNumeric=['wearBandMM','hairMM','clearanceMM','crownMM','brimFactor','brimCurve','bandFactor','crownFullness','backLeanMM','negativeEase','weaveMM','grainStrength'];
function syncMotherUI(){
 const spec=FIT_SPECS[state.id],knit=spec.mode==='stretch-cap';for(const k of motherNumeric){$(k).value=state[k];$(k+'-v').textContent=k==='negativeEase'?(state[k]*100).toFixed(0)+'%':k.endsWith('MM')||k==='weaveMM'?state[k].toFixed(1)+' mm':state[k].toFixed(2);}
 for(const k of ['autoFit','showMeasurements','showClearance','useCustomColor'])$(k).checked=state[k];$('textureMode').value=state.textureMode;$('customColor').value=state.customColor;$('negativeEase').disabled=!knit;$('crownMM').min=knit?0:-20;for(const k of ['brimFactor','brimCurve'])$(k).disabled=knit;
 for(const k of ['width','height','depth','lift','tilt'])$(k).disabled=state.autoFit;
 $('fit-family').textContent=spec.label;$('mother-presets').innerHTML=categoryPresets(state.id).map(p=>`<button data-mother-preset="${p.id}">${p.title}</button>`).join('');
 const m=headProfiles.has(state.head)?measurements(headProfiles.get(state.head),state.wearBandMM/1000):null,d=asset.fitResult?.diagnostics;
 $('head-readout').textContent=m?`佩戴圈软尺包络 ${m.headCircumferenceMM.toFixed(1)} mm；横宽 ${m.widthMM.toFixed(1)} / 前后深 ${m.depthMM.toFixed(1)} mm。前后冠弧 ${m.frontBackArcMM.toFixed(1)} / 左右冠弧 ${m.sideToSideArcMM.toFixed(1)} mm。`: '等待头形三角网测量';
 $('fit-readout').textContent=d&&m?`帽口参考原长 ${d.restCircumferenceMM.toFixed(1)} mm${knit?'，所需周向伸长 '+(d.requiredCircumferentialStretch*100).toFixed(1)+'%':''}。帽口采样中位间距 ${d.bandMedianMM===null?'未覆盖':d.bandMedianMM.toFixed(2)+' mm'}；${d.bandSampleBins}/96方向有帽口样本。`:'R02对照 / 手动形态：没有本轮接触合格结论。';
}
function initMotherUI(){for(const k of motherNumeric)$(k).oninput=()=>{try{const candidate={...state,[k]:Number($(k).value)};validateMother(candidate);state=candidate;apply();persist();}catch(e){message(e.message,true);}};
 for(const k of ['autoFit','showMeasurements','showClearance','useCustomColor'])$(k).onchange=()=>{state[k]=$(k).checked;apply();persist();};$('textureMode').onchange=()=>{state.textureMode=$('textureMode').value;apply();persist();};$('customColor').oninput=()=>{state.customColor=$('customColor').value;state.useCustomColor=true;apply();persist();};
 $('mother-presets').onclick=e=>{const b=e.target.closest('[data-mother-preset]');if(b){const p=categoryPresets(state.id).find(x=>x.id===b.dataset.motherPreset);state={...state,...p.values,width:1,height:1,depth:1,lift:0,tilt:0};apply();frame();persist();}};
 $('mother-export').onclick=()=>download('hat-mother-'+state.id+'.json',JSON.stringify({schema:MOTHER_VERSION,sourceCommit:D.sourceCommit,mother:asset.meta.mother,settings:{...state},measurements:asset.fitResult?.measurement||null,attribution:{author:asset.meta.author,licence:asset.meta.licence,reference:asset.meta.referenceURL},note:'Control net and generator recipe, not a baked fitted mesh; source textures remain external licensed inputs.'},null,2));
}
'''
s=s.replace('function fatal(e)',insert+'\nfunction fatal(e)')
(ROOT/'app.js').write_text(s)

def slider(id,label,lo,hi,step):return f'<label>{label}<output id="{id}-v"></output></label><input id="{id}" type="range" min="{lo}" max="{hi}" step="{step}">'
controls=''.join(slider(*a) for a in [('wearBandMM','佩戴圈高度候选（当前坐标）',4,25,1),('hairMM','毛发占位留量（未模拟头发）',0,12,.5),('clearanceMM','头皮接触留量',1,6,.5),('negativeEase','针织帽口负松量（原长）',0,.18,.01)])
shape=''.join(slider(*a) for a in [('crownMM','帽冠增减 / 针织顶端留量',0,40,1),('crownFullness','帽冠丰度',.85,1.2,.01),('brimFactor','帽檐伸出倍率',.7,1.35,.01),('brimCurve','帽檐上翘 / 下垂',-15,15,1),('bandFactor','翻边 / 帽带饱满度',.8,1.3,.01),('backLeanMM','上冠向后偏移',-15,25,1)])
measure_ui=f'''<section class="section"><h2>量头与分类配戴</h2><label>自动量头匹配<input type="checkbox" id="autoFit" checked></label><p id="fit-family" class="small"></p><p id="head-readout" class="fit-note"></p><p id="fit-readout" class="small"></p><div class="seg"><label>测量圈 / 冠弧<input type="checkbox" id="showMeasurements"></label><label>间距图<input type="checkbox" id="showClearance"></label></div><details><summary>测量与松量参数</summary>{controls}<p class="small">当前佩戴圈是已显示的工程采样锚点，不冒称自动识别眉骨或耳尖。负松量改变未拉伸原长，不让帽子缩入头皮。蓝青为较近，黄为较远；不是压力图。</p></details></section><section class="section"><h2>本品类母体预设</h2><div id="mother-presets" class="preset-stack"></div><details><summary>母体形态参数</summary>{shape}</details><button id="mother-export" style="width:100%;margin-top:12px">导出母体配方</button></section>'''
surface_ui='<label>表面生成方式</label><select id="textureMode"><option value="source">保真来源材质</option><option value="wool">程序毛呢</option><option value="twill">程序斜纹</option><option value="knit">程序针织浮雕</option></select><label>自定颜色<input type="checkbox" id="useCustomColor"><input id="customColor" type="color" value="#a97970"></label>'+slider('weaveMM','纹理组织尺度',.6,4,.1)+slider('grainStrength','程序纹理起伏',0,1,.05)+'<p class="small">程序表面使用距离过滤的着色器浮雕；不是实际纱线/绒毛几何。来源材质默认保留。</p>'
t=(OLD/'shell.html').read_text().replace('R02 · 接手修复候选','R03 · 量头与程序母体').replace('按住对照 R01','按住对照 R02').replace('R02视觉候选','R03量头与母体候选').replace('启用本轮修正','启用 R03 母体（关闭看 R02）')
t=t.replace('<h2>配色与表面</h2>','<h2>配色与表面</h2>'+surface_ui)
t=t.replace('<section class="section"><h2>配色与表面</h2>',measure_ui+'<section class="section"><h2>配色与表面</h2>')
t=t.replace('当前为静态头部样本与帽子仿射适配，不是碰撞、毛发压缩或动态穿戴求解。','当前量头采用真实三角网截面。按品类处理帽口与帽冠；静态外推保护不等于动态碰撞、毛发压缩或压力认证。')
t=t.replace('每张缩略图由同一份真实三维数据绘制。','目录保留已认可R02的单帽三维原型索引；主视窗运行R03程序母体。')
t=t.replace('本版保留可授权的原帽型、UV 和颜色 / 法线资料，再进行曲面细分、Three.js 材质适配、配方控制与原人物静态头部适配。','本版从署名来源控制网与UV在浏览器重新生成细分几何，再执行母体形态参数与真实头形截面适配。原贴图仍作为保真选项保留。')
t=t.replace('也未进行帽子—头皮—毛发碰撞。','不包含真实毛发、动态穿戴或连续碰撞认证。').replace('记录在R02的SESSION_LOG.md','记录在R03的SESSION_LOG.md').replace('/hat-workshop/r02"','/hat-workshop/r03"')
t=t.replace('</style>','.preset-stack{display:grid;gap:6px;margin:12px 0}.preset-stack button{text-align:left;font-size:12px}#head-readout,#fit-readout{margin-top:10px;line-height:1.7}.right{padding-bottom:40px}input:disabled{opacity:.4}@media(max-width:650px){.right{display:block}.right .section{margin-bottom:22px;padding-bottom:18px}.fit-note{font-size:11px}}</style>')
assert 'id="autoFit"' in t and 'id="mother-export"' in t and 'id="textureMode"' in t
(ROOT/'shell.html').write_text(t)
print('R03 app and shell generated; R01/R02 unchanged',len(s),len(t))
