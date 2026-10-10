from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent
s=(p/'template.html').read_text().replace('/*CORE*/',(p/'core.js').read_text()).replace('/*NATURAL*/',(p/'natural-yarn.js').read_text()).replace('/*APP*/',(p/'app.js').read_text())
(p/'index.html').write_text(s)
m={'version':'R04.0','baseCommit':'04c345ea1e7113f9023d96966057b6aace0a6c50','entry':'denim-workshop/r04/index.html','sha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode()),'runtime':'WebGL2 standalone; geometry-first inherited','nearMidTextures':False,'solidSideWall':False,'projection':'perspective','features':['two-ended-sagged-bridges','one-ended-broken-tails','partial-yarn-bridges','correlated-edge-clumps-and-strays','organic-yarn-and-softer-cotton-light'],'physicalSimulation':False,'filmGradeValidated':False,'phoneHardwareTest':False}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(m,indent=2));print(json.dumps(m))
