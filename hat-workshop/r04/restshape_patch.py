from pathlib import Path
r=Path(__file__).resolve().parent
p=r/'fit/field.mjs';s=p.read_text()
if "from './beanie.mjs'" not in s:
 s="import {fitBeanie} from './beanie.mjs';\nimport {fitKnit} from './knit.mjs';\n"+s
 s=s.replace("export function deform(mesh,meta,s,headProfile,src){", "export function deform(mesh,meta,s,headProfile,src){\n if(meta.id==='cable'&&s.autoFit&&headProfile)return fitBeanie(mesh,meta,s,headProfile);\n if(meta.id==='sherpa'&&s.autoFit&&headProfile)return fitKnit(mesh,meta,s,headProfile);")
 s=s.replace('cable:{bandY:12,pitch:-6','cable:{bandY:12,pitch:0').replace('chef:{bandY:22','chef:{bandY:25')
 s=s.replace("if(meta.id==='visor'){ring=", "if(meta.id==='flatcap'){sourceBand=datum.frame.c+datum.ring.y;ring=Array.from({length:128},(_,i)=>datum.ring.radius(i*TAU/128));}\n else if(meta.id==='visor'){ring=")
 p.write_text(s)
p=r/'mother.mjs';s=p.read_text().replace('function subdivision(vertices,faces,cornerUV){','export function subdivision(vertices,faces,cornerUV){');p.write_text(s)
p=r/'app.js';s=p.read_text().replace("asset.fitResult.normal,s.materialMM/1000)","asset.fitResult.normal,s.materialMM/1000,asset.meta)")
s=s.replace("$('materialMM').disabled=!CONSTRUCTION[state.id].mode.startsWith('knit');","$('materialMM').disabled=!CONSTRUCTION[state.id].mode.startsWith('knit');$('bandFactor').disabled=true;")
s=s.replace("实际内外层 ","帽身标称层厚 ")
p.write_text(s)
p=r/'shell.mjs';s=p.read_text().replace('normal,thickness){','normal,thickness,meta){')
s=s.replace("const a=mesh.index[j],b=mesh.index[j+1],c=mesh.index[j+2];indices.push", "const a=mesh.index[j],b=mesh.index[j+1],c=mesh.index[j+2];if(meta?.id==='sherpa'){const y=(mesh.position[a*3+1]+mesh.position[b*3+1]+mesh.position[c*3+1])/3-meta.origin[1];if(y<-.145||y>.113)continue;}indices.push")
s=s.replace("innerTriangles:mesh.index.length/3", "innerTriangles:(indices.length-rimEdges*6)/3")
s=s.replace("physicalMaterialCalibrated:false", "compoundScope:meta?.id==='sherpa'?'cap and ear-flap textile only; existing narrow cords and crown ornament not thickened':'complete knitted cap and source fold',physicalMaterialCalibrated:false")
p.write_text(s)
p=r/'shell.html';s=p.read_text().replace('针织单层实体厚度','针织帽身标称层厚').replace('分类戴位前倾角','戴位前倾角').replace('翻边 / 帽带饱满','翻边 / 帽带（待校准）');
s=s.replace('厚度不等于头皮间隙；','标称值是当前几何设计值，不是实测针织厚度。厚度不等于头皮间隙；')
p.write_text(s)
print('Rest-shape fitting applied by category; unsupported band fullness is explicitly disabled.')
