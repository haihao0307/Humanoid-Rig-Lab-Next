from pathlib import Path
r=Path(__file__).resolve().parent;p=r/'app.js';s=p.read_text()
if "from './section.mjs'" not in s:
 s="import {materialSection} from './section.mjs';\n"+s
 s=s.replace('function disposeAsset(a){if(!a)return;', 'function disposeAsset(a){if(!a)return;if(a.sectionMesh){a.sectionMesh.geometry.dispose();a.sectionMesh.material.dispose();a.sectionMesh=null;}')
 s=s.replace('if(asset.innerMesh){hat.remove(asset.innerMesh);', 'if(asset.sectionMesh){hat.remove(asset.sectionMesh);asset.sectionMesh.geometry.dispose();asset.sectionMesh.material.dispose();asset.sectionMesh=null;}\n  if(asset.innerMesh){hat.remove(asset.innerMesh);')
 s=s.replace('asset.fitResult.diagnostics.shell=layer.report;', 'asset.fitResult.diagnostics.shell=layer.report;asset.sectionMesh=materialSection(T,asset.mesh,asset.fitResult.position,layer.geometry.attributes.position.array,asset.meta);hat.add(asset.sectionMesh);')
 s=s.replace('clearanceMaterial,person?.material,asset.innerMesh?.material','clearanceMaterial,asset.innerMesh?.material')
 s=s.replace('hat.material=s.showClearance', "if(asset.sectionMesh)asset.sectionMesh.visible=!!s.cutaway&&!isReference;\n hat.material=s.showClearance")
 p.write_text(s)
p=r/'shell.html';s=p.read_text().replace('剖开观察内外层','剖开帽体（保留头模）');p.write_text(s)
