from pathlib import Path
from bs4 import BeautifulSoup
r=Path(__file__).resolve().parent;old=r.parent/'r03'
s=(old/'mother.mjs').read_text();s="import {CONSTRUCTION} from './fit/field.mjs';\n"+s
s=s.replace("showClearance:false};","showClearance:false,materialMM:3.6,wearPitchDeg:0,cutaway:false};")
s=s.replace("return {...PARAM_DEFAULTS,clearanceMM:s.clearance*1000,negativeEase:s.negativeEase};","const c=CONSTRUCTION[id];return {...PARAM_DEFAULTS,wearBandMM:c.bandY,wearPitchDeg:c.pitch,materialMM:c.material,clearanceMM:1,negativeEase:s.negativeEase};")
s=s.replace("[['wearBandMM',4,25]", "[['materialMM',.5,6],['wearPitchDeg',-8,10],['wearBandMM',0,38]")
s=s.replace("'autoFit','useCustomColor','showMeasurements','showClearance'", "'autoFit','useCustomColor','showMeasurements','showClearance','cutaway'")
s=s.replace("贴头标准款","厚实贴合款").replace("短冠针织款","原织纹短冠").replace("留量松冠款","厚实松冠款")
(r/'mother.mjs').write_text(s)
s=(old/'app.js').read_text();s="import {CONSTRUCTION} from './fit/field.mjs';\nimport {buildInnerShell} from './shell.mjs';\n"+s
s=s.replace("kaopu.hat-r03.recipe","kaopu.hat-r04.recipe").replace("triangle-sections/category-fit-r03","layered-material/category-placement-r04")
s=s.replace("function disposeAsset(a){if(!a)return;","function disposeAsset(a){if(!a)return;if(a.innerMesh){a.innerMesh.geometry.dispose();a.innerMesh.material.dispose();a.innerMesh=null;}")
s=s.replace("renderer.shadowMap.enabled=true;","renderer.shadowMap.enabled=true;renderer.localClippingEnabled=true;")
s=s.replace("const headProfiles=new Map(),", "const cutPlane=new T.Plane(new T.Vector3(-1,0,0),0);\nconst headProfiles=new Map(),")
s=s.replace("'showMeasurements','showClearance','textureMode'","'cutaway','showMeasurements','showClearance','textureMode'")
s=s.replace("asset.fitKey=fitStamp;", "asset.fitKey=fitStamp;\n  if(asset.innerMesh){hat.remove(asset.innerMesh);asset.innerMesh.geometry.dispose();asset.innerMesh.material.dispose();asset.innerMesh=null;}\n  if(!isReference&&CONSTRUCTION[state.id].mode.startsWith('knit')){const layer=buildInnerShell(T,asset.mesh,asset.fitResult.position,asset.fitResult.normal,s.materialMM/1000);const imat=new T.MeshStandardMaterial({map:asset.maps.color,color:asset.material.color.clone().multiplyScalar(.82),roughness:.94,side:T.DoubleSide});asset.innerMesh=new T.Mesh(layer.geometry,imat);asset.innerMesh.name='R04 real inner textile and closed material edge';asset.innerMesh.castShadow=true;asset.innerMesh.receiveShadow=true;hat.add(asset.innerMesh);asset.fitResult.diagnostics.shell=layer.report;}\n")
s=s.replace("hat.material=s.showClearance", "for(const mat of [asset.material,clay,normal,clearanceMaterial,person?.material,asset.innerMesh?.material].filter(Boolean)){mat.clippingPlanes=s.cutaway&&!isReference?[cutPlane]:[];mat.clipShadows=true;}\n hat.material=s.showClearance")
s=s.replace("headVisible:person?.visible||false,", "headVisible:person?.visible||false,shell:asset.fitResult?.diagnostics?.shell||null,")
s=s.replace("const motherNumeric=['wearBandMM'", "const motherNumeric=['materialMM','wearPitchDeg','wearBandMM'")
s=s.replace("['autoFit','showMeasurements','showClearance','useCustomColor']", "['cutaway','autoFit','showMeasurements','showClearance','useCustomColor']")
s=s.replace("$('fit-family').textContent=spec.label;", "$('fit-family').textContent=CONSTRUCTION[state.id].label;$('materialMM').disabled=!CONSTRUCTION[state.id].mode.startsWith('knit');")
a=s.index(" $('fit-readout').textContent=");b=s.index('\n}',a)
s=s[:a]+" $('fit-readout').textContent=d?`${CONSTRUCTION[state.id].label}。${d.shell?'实际内外层 '+d.shell.materialThicknessMM.toFixed(1)+' mm；'+d.shell.rimEdges+' 条边已封口。':'原有实体/分片关系随整帽变换保留。'}承托区与造型区不是压力图；不做逐点贴皮推挤。`: 'R02外观基线对照；不是本轮厚度验收。';"+s[b:]
s=s.replace("${FIT_SPECS[state.id].label}。", "${CONSTRUCTION[state.id].label}。")
s=s.replace("window.hatLab={mother:", "window.hatLab={debugGeometry:()=>({position:Array.from(asset.geometry.attributes.position.array),normal:Array.from(asset.geometry.attributes.normal.array),index:Array.from(asset.geometry.index.array),groups:Array.from(asset.mesh.groups),inner:asset.innerMesh?Array.from(asset.innerMesh.geometry.attributes.position.array):null}),cameraPose:()=>({position:camera.position.toArray(),target:controls.target.toArray()}),setCamera:p=>{camera.position.fromArray(p.position);controls.target.fromArray(p.target);controls.update();requestRender();},mother:")
(r/'app.js').write_text(s)
(r/'surface.mjs').write_text((old/'surface.mjs').read_text())
t=(old/'shell.html').read_text().replace('R03.1','R04.0').replace('R03','R04').replace('/r03','/r04').replace('量头贴合与程序母体','分层厚度与分类戴位').replace('径向间距图','承托 / 造型分区').replace('间距图','结构分区').replace('显示采样间距','显示结构分区')
soup=BeautifulSoup(t,'html.parser');wb=soup.find(id='wearBandMM');wb['min']='0';wb['max']='38'
new='''<label><span>针织单层实体厚度 <output id="materialMM-v"></output></span><input id="materialMM" type="range" min="0.5" max="6" step="0.1" value="3.6"></label><label><span>分类戴位前倾角 <output id="wearPitchDeg-v"></output></span><input id="wearPitchDeg" type="range" min="-8" max="10" step="0.5" value="0"></label><label><span>剖开观察内外层</span><input id="cutaway" type="checkbox"></label><p class="small">厚度不等于头皮间隙；礼帽冠腔、针织翻折层分别保留。结构色仅标明承托与自由造型区域，不代表压力。</p>'''
wb.parent.insert_before(BeautifulSoup(new,'html.parser'));st=soup.find(id='showClearance')
if st:
 par=st.find_parent('label')
 for ch in list(par.children):
  if isinstance(ch,str):ch.replace_with('承托区 / 自由造型区')
text=str(soup).replace('蓝青为较近，黄为较远；不是压力图。','蓝青为承托区，棕黄为自由造型区；不是压力或距离图。')
(r/'shell.html').write_text(text)
print('R04 generated production sources, R02/R03 unchanged',len(s))
