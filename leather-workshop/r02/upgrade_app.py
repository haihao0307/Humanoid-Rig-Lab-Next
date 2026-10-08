from pathlib import Path
r=Path(__file__).parent;s=r/'site';src=s/'app.js';a=src.read_text()
a=a.replace("import {LeatherKernel,PRESETS,DEFAULT,VERSION} from 'leather';", "import {LeatherKernel,PRESETS,DEFAULT,VERSION,FINISHES} from 'leather';\nimport {buildCraft} from './craft.js';\nimport {materialZIP,heightPNG16} from './export.js';")
a=a[:a.index('function makeSheet()')]+a[a.index('function rebuildGeometry()'):]
a=a.replace('let ready=false,renderer','let craftInfo={},legacyMode=false;let ready=false,renderer')
a=a.replace("else makeSheet();dirty=true;", "else{const built=buildCraft(params,shape,kernel.material,backMat,edgeMat,threadMat);scene.remove(root);root=built.group;scene.add(root);body=built.body;threads=built.threads;craftInfo=built.info;}dirty=true;")
a=a.replace("return new T.Vector3(x,y,z);", "y+=params.wrinkles*.00065*Math.sin(u*38.+v*9.)*Math.sin(v*Math.PI)*Math.sin(u*Math.PI);return new T.Vector3(x,y,z);")
a=a.replace("body.material=params.object==='sphere'?kernel.material:[kernel.material,backMat]", "body.material=kernel.material")
a=a.replace("roughness:.96", "roughness:.97")
a=a.replace("if(body)body.material=kernel.material;dirty=true;", "if(body)body.material=kernel.material;threadMat.color.set(params.threadColor);applyChannel();dirty=true;")
def replace_section(start,end,text):
 global a
 i=a.index(start);j=a.index(end,i);a=a[:i]+text+'\n'+a[j:]
replace_section('const specs=','function setPreset',r'''const specs=[['grain','粒面间距',.45,6,.01,'mm'],['depth','微凹凸高度',.02,.55,.005,'mm'],['roughness','基底粗糙度',.1,.98,.01,''],['coat','表层涂饰光泽',0,1,.01,''],['wear','色差与包浆',0,1,.01,''],['irregular','粒面不规则性',0,1,.01,''],['wrinkles','细皱褶',0,1,.01,''],['pores','微孔强度',0,1,.01,''],['damage','裂纹 / 擦痕',0,1,.01,'']];
const craftSpecs=[['thickness','皮革厚度',.6,3,.1,'mm'],['quiltMM','绗缝 / 编织间距',20,60,1,'mm'],['loft','绗缝起伏 / 编织拱高',0,8,.1,'mm'],['threadMM','线径',.15,.65,.01,'mm'],['pitchMM','针距',2,6,.1,'mm'],['holeMM','穿孔孔径',.8,3,.1,'mm'],['holePitch','穿孔间距',5,10,.5,'mm']];
function sync(){for(const [id,,, , ,unit] of [...specs,...craftSpecs]){if(!$(id))continue;$(id).value=params[id];$(id+'Value').textContent=Number(params[id]).toFixed(2)+' '+unit;}for(const id of ['color','seed','fold','object','light','exposure','resolution','finish','craft','stitch','threadColor','hole','channel'])if($(id))$(id).value=params[id];$('stitches').checked=params.stitches;$('piping').checked=params.piping;$('foldValue').textContent=Math.round(params.fold*100)+'%';$('exposureValue').textContent=params.exposure.toFixed(2);$('materialName').textContent=params.name;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===params.preset));}
let diagnosticMaterial=null;
function applyChannel(){if(!body)return;if(params.channel==='beauty'){body.material=kernel.material;return;}if(!diagnosticMaterial)diagnosticMaterial=new T.MeshBasicMaterial();diagnosticMaterial.map=kernel.maps[params.channel];diagnosticMaterial.color.set(0xffffff);diagnosticMaterial.toneMapped=false;diagnosticMaterial.needsUpdate=true;body.material=diagnosticMaterial;}
function geometryUpdate(){rebuildGeometry();threadMat.color.set(params.threadColor);applyChannel();dirty=true;}
''')
replace_section('function setCamera(', 'function baseline(',r'''function setCamera(view){spin=false;$('rotate').classList.remove('active');let sphere=params.object==='sphere',flat=params.object==='flat';if(view==='macro'){yaw=.40;pitch=flat?.93:.67;distance=innerWidth<801?.22:.145;target.set(.005,sphere?.155:flat?.009:.068,sphere?-.01:flat?0:-.016);}else if(view==='back'){yaw=2.55;pitch=.19;distance=innerWidth<801?.7:.46;target.set(0,.05,-.015);}else{yaw=.40;pitch=flat?1.0:.65;distance=innerWidth<801?.92:.57;target.set(0,sphere?.09:.038,flat?0:-.058);}dirty=true;}
''')
replace_section('function validateRecipe(', 'function ui()',r'''function validateRecipe(doc){if(!['kaopu/leather_material@1','kaopu/leather_material@2'].includes(doc.schema)||!doc.parameters)throw Error('不是支持的皮革材质谱');const o=doc.parameters;if(!PRESETS[o.preset])throw Error('未知预设');const p={...DEFAULT,...PRESETS[o.preset],...o,kind:PRESETS[o.preset].kind,tileMM:96};if(doc.schema.endsWith('@1'))for(const k of ['irregular','wrinkles','pores','damage','finish'])p[k]=PRESETS[o.preset][k];for(let k of ['color','threadColor'])if(!/^#[\da-f]{6}$/i.test(p[k]))throw Error('无效颜色');for(const [id,,min,max] of [...specs,...craftSpecs])if(!Number.isFinite(p[id])||p[id]<min||p[id]>max)throw Error('参数越界：'+id);
for(const [key,choices] of Object.entries({resolution:[1024,2048,4096],object:['roll','flat','sphere'],light:['studio','raking','warm'],craft:['plain','diamond','grid','channels','woven'],stitch:['single','double','cross','zigzag','none'],hole:['none','round','stripe','slot'],channel:['beauty','baseColor','normal','roughness','ao'],finish:Object.keys(FINISHES)}))if(!choices.includes(p[key]))throw Error('无效选项：'+key);
if(!Number.isFinite(p.fold)||p.fold<0||p.fold>1||!Number.isInteger(p.seed)||p.seed<0||p.seed>9999||!Number.isFinite(p.exposure)||p.exposure<.5||p.exposure>2)throw Error('观察参数无效');return p;}
function loadRecipe(doc){clearTimeout(bakeTimer);params=validateRecipe(doc);sync();kernel.bake(params);backMat.color.set(params.color).multiplyScalar(.65);edgeMat.color.set(params.color).multiplyScalar(.48);backMat.normalMap=kernel.maps.normal;backMat.needsUpdate=true;geometryUpdate();lights();setCamera('home');$('busy').hidden=true;dirty=true;}
''')
a=a.replace("for(const [id,name,min,max,step,unit] of specs)","for(const [id,name,min,max,step,unit] of [...specs,...craftSpecs])")
a=a.replace("$('sliders').append(d);", "$(craftSpecs.some(s=>s[0]===id)?'craftSliders':'sliders').append(d);")
a=a.replace("scheduleBake();};}\n $('color')", "if(craftSpecs.some(s=>s[0]===id))geometryUpdate();else scheduleBake();};}\n $('color')")
a=a.replace("rebuildGeometry();setCamera('home');", "geometryUpdate();setCamera('home');")
a=a.replace("rebuildGeometry();};$('stitches')", "geometryUpdate();};$('stitches')")
a=a.replace("if(threads)threads.visible=params.stitches;dirty=true;", "geometryUpdate();")
a=a.replace("kaopu-leather-r01", "kaopu-leather-r02").replace("KAOPU-leather-r01.json", "KAOPU-leather-r02.json")
a=a.replace("document.querySelector('details').addEventListener('toggle'", "document.querySelector('#referenceDetails').addEventListener('toggle'")
a=a.replace("sync();}\ntry", r'''for(const [key,f] of Object.entries(FINISHES)){let o=document.createElement('option');o.value=key;o.textContent=f.name;$('finish').append(o);}
 $('finish').onchange=()=>{params.finish=$('finish').value;Object.assign(params,{roughness:FINISHES[params.finish].roughness,coat:FINISHES[params.finish].coat});sync();scheduleBake();};
 for(const id of ['craft','stitch','hole'])$(id).onchange=()=>{params[id]=$(id).value;if(id==='craft'&&params.craft!=='plain'&&params.object==='sphere')params.object='flat';geometryUpdate();sync();};
 $('piping').onchange=()=>{params.piping=$('piping').checked;geometryUpdate();};$('threadColor').oninput=()=>{params.threadColor=$('threadColor').value;threadMat.color.set(params.threadColor);dirty=true;};
 $('channel').onchange=()=>{params.channel=$('channel').value;applyChannel();dirty=true;};
 $('exportKit').onclick=async()=>{try{$('exportKit').disabled=true;toast('正在打包实际生成的贴图…');clearTimeout(bakeTimer);kernel.bake(params);download(await materialZIP(kernel,params),'KAOPU-leather-R02-material.zip');toast('五通道贴图与配方已导出');}catch(e){toast('导出失败：'+e.message);}finally{$('exportKit').disabled=false;dirty=true;}};
 $('height16').onclick=async()=>{try{download(new Blob([await heightPNG16(kernel)],{type:'image/png'}),'leather-height-16bit.png');}catch(e){toast(e.message);}};
 $('reset').onclick=()=>loadRecipe({schema:'kaopu/leather_material@2',parameters:{...DEFAULT,resolution:innerWidth<801?1024:2048}});
 const combos={natural:{preset:'wax',object:'roll',craft:'plain',hole:'none',stitch:'double',piping:true},seat:{preset:'black',object:'flat',craft:'diamond',hole:'none',stitch:'single',piping:true,loft:4},vent:{preset:'black',object:'flat',craft:'channels',hole:'stripe',stitch:'double',piping:true,loft:2.4},braid:{preset:'tan',object:'roll',craft:'woven',hole:'none',piping:false,loft:2,thickness:.8,quiltMM:30},aged:{preset:'wax',object:'roll',craft:'plain',hole:'none',stitch:'single',piping:true,damage:.82,wear:.8,wrinkles:.75}};
 document.querySelectorAll('[data-combo]').forEach(b=>b.onclick=()=>{let q=combos[b.dataset.combo];params={...params,...PRESETS[q.preset],...q};loadRecipe({schema:'kaopu/leather_material@2',parameters:params});});
 sync();}
try''')
a=a.replace("rebuildGeometry();setCamera('home');ready=true", "geometryUpdate();setCamera('home');ready=true")
a=a.replace("kernel.recipe(),parameters:{...params}}),loadRecipe", "kernel.recipe(),parameters:{...params}}),craftInfo:()=>({...craftInfo}),loadRecipe")
a=a.replace("if(!(k in params))throw Error('unknown parameter');params[k]=v;sync();scheduleBake();", "if(!(k in params))throw Error('unknown parameter');let next={...params,[k]:v};params=validateRecipe({schema:'kaopu/leather_material@2',parameters:next});sync();if([...craftSpecs.map(s=>s[0]),'craft','stitch','hole','piping'].includes(k))geometryUpdate();else if(['object'].includes(k)){geometryUpdate();setCamera('home');}else scheduleBake();")
a=a.replace(" · 生成 #${kernel.generation}"," · ${craftInfo.holes||0} 真穿孔 · 生成 #${kernel.generation}")
src.write_text(a)
