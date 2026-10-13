from pathlib import Path
import shutil,json,subprocess,hashlib,sys
r=Path(__file__).resolve().parents[1]

if (r/'SOURCE_SNAPSHOT.json').exists():
 print('Frozen complete source: migration intentionally skipped');sys.exit(0)

if (r/'SOURCE_SNAPSHOT.json').exists():
 print('Frozen complete source: migration intentionally skipped');sys.exit(0)

if (r/'SOURCE_SNAPSHOT.json').exists():
 print('Frozen complete source: migration intentionally skipped');sys.exit(0)

if (r/'SOURCE_SNAPSHOT.json').exists():
 print('Frozen complete source: migration intentionally skipped');sys.exit(0)
repo=r.parents[2]
workspace=repo.parent
base=r.parent/'r03'
subprocess.run([sys.executable,str(base/'bootstrap.py')],check=True)
regenerated={'app.mjs','solid-textiles.mjs','material-shaders.mjs','surface-binding.mjs','index.html','style.css','looks.mjs','materials.json'}
for src in base.rglob('*'):
 if not src.is_file() or any(x in src.parts for x in ['local-release-evidence','public-release-evidence']):continue
 rel=src.relative_to(base)
 if src.name in ['READY.json','RELEASE.json','qa-browser.cjs','test-physics.mjs','README.md'] or src.name.endswith('REPORT.json'):continue
 dst=r/rel
 if not dst.exists() or str(rel) in regenerated:
  dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
core=workspace/'frozen-person/kaopu-tailor-workbench/presets/r0434-8c8245dd87e5/person-core/kaopu-unified-human-workbench'
(r/'vendor').mkdir(exist_ok=True);(r/'person').mkdir(exist_ok=True)
shutil.copyfile(core/'vendor/three.module.js',r/'vendor/three.module.js')
shutil.copyfile(core/'full/ui/vendor/OrbitControls.js',r/'vendor/OrbitControls.js')
s=(core/'full/ui/Viewer.mjs').read_text().replace("'./skin/CommonSkinLayer.mjs?v=presets-r01-20261008'","'./CommonSkinLayer.mjs'").replace("'../source/registration-vendor/three.module.js'","'three'").replace("'./vendor/OrbitControls.js'","'../vendor/OrbitControls.js'")
(r/'person/Viewer.mjs').write_text(s)
s=(core/'full/ui/skin/CommonSkinLayer.mjs').read_text().replace("'../../source/registration-vendor/three.module.js'","'three'").replace('this.fields=buildSkinRegions(viewer.model);','this.fields=viewer.model.precomputedSkinRegions||buildSkinRegions(viewer.model);')
(r/'person/CommonSkinLayer.mjs').write_text(s)
shutil.copyfile(core/'full/ui/skin/SkinRegions.mjs',r/'person/SkinRegions.mjs')
rows=[]
for destination,donor,relative,commit in [
 ('leather-r13.mjs','donor-leather','leather-workshop/r13/src/materials/leather.mjs','65951309b46262784e72bb617ba1ca6cb5ca217f'),
 ('leather-seam-r13.mjs','donor-leather','leather-workshop/r13/src/sewing/seam-paths.js','65951309b46262784e72bb617ba1ca6cb5ca217f'),
 ('cotton-surface.js','donor-denim','denim-workshop/r11/cotton-surface.js','086414b317f313bf9465ea957753ae7e84453f6f'),
 ('noise-kernel.js','donor-denim','denim-workshop/r11/noise-kernel.js','086414b317f313bf9465ea957753ae7e84453f6f')]:
 src=workspace/donor/relative;data=src.read_bytes();dst=r/'native'/destination
 dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data)
 if destination=='leather-seam-r13.mjs':dst.write_text(dst.read_text()+'\nexport {buildSeam, continuousRoutes, auditSeam, roundRoute};\n')
 rows.append({'file':'native/'+destination,'repository':'haihao0307/Humanoid-Rig-Lab-Next','sourceCommit':commit,'sourcePath':relative,'sourceSHA256':hashlib.sha256(data).hexdigest(),'adapterSHA256':hashlib.sha256(dst.read_bytes()).hexdigest()})
(r/'DONOR_LOCK.json').write_text(json.dumps({'baseCommit':'fbbef8bc7df2172f492dd60875432f4ffeff2429','denim':'R11 runtime; not a label-only update','leather':'R13 native package, field functions retain earlier R02 lineage; R14 S2 is a performance audit lane','knitCommit':'20b466073bb458408a078260a018460c81f627b9','knit':'R11 curve/arc/envelope only, not a claim of whole native fuzzy swatch renderer integration','files':rows},ensure_ascii=False,indent=2))
for name in ['materials.py','solid.py','ui.py','refinement.py','visual-fixes.py']:
 subprocess.run([sys.executable,str(r/'_build'/name)],check=True)
(r/'clips').mkdir(exist_ok=True)
if not (r/'clips/index.json').exists():(r/'clips/index.json').write_text('{"clips":[]}')
manifest=json.loads((r/'assets/PERSON_MANIFEST.json').read_text())
assert hashlib.sha256((r/'assets/native-person.json.gz').read_bytes()).hexdigest()==manifest['fileSHA256']
assert manifest['vertexCount']==25417
print('MP04.2 source assembled; original person hash verified; not yet browser accepted')
