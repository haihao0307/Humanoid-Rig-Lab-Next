from pathlib import Path
import hashlib,json
p=Path(__file__).parent
s=(p/'template.html').read_text().replace('/*CORE*/',(p/'core.js').read_text()).replace('/*APP*/',(p/'app.js').read_text())
(p/'index.html').write_text(s)
m={"version":"R03.1","entry":"denim-workshop/r03/index.html","baseCommit":"370c0cfa4098d3027042e5c788f96371095f2518","frozenR02Commit":"e847f671808dc93c4590a0d71dfe859a327b1b1e","sha256":hashlib.sha256(s.encode()).hexdigest(),"bytes":len(s.encode()),"runtime":"WebGL2; no external runtime resources; geometry-first","projection":"perspective 36 degrees vertical FOV","weaveDrafts":4,"finishCandidates":12,"damageCandidates":5,"rendering":{"solidSideWall":False,"geometricMorph":["4 samples/cell, 8 sides","2 samples/cell, 8 sides","2 samples/cell, 4 sides"],"farOnlyCondition":"warp pitch <0.58px AND cloth bounding estimate <180px AND intact","farCapture":"same-source color and normals, lazy generation; no near/mid capture shading","supersamplePixelBudget":2400000,"idleRendering":"stops","performanceHardwareFPS":"unverified"},"claims":{"filmGrade":False,"allIndustrialDenims":False,"dynamicTearing":False,"physicalWashCalibration":False,"realPhoneTest":False,"fullCottonFiberModel":False,"globalSelfCollisionProof":False}}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('BUILD',json.dumps(m,ensure_ascii=False))
