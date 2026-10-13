from pathlib import Path
import shutil,json,hashlib
P=Path(__file__).resolve().parent
R02=P.parent/'r02';R01=P.parent/'r01';T=P.parent.parent
files=['geometry-core.mjs','leather-field.mjs','looks.mjs','panel-grain.mjs','outfits-r043.mjs','sewn-normals-r0433.mjs','source-contract.mjs','materials.json','SOURCE_LOCK.json','node-loader.mjs','THIRD_PARTY_NOTICES.md']
proof=[]
def copy(source,target):
 target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():shutil.copyfile(source,target)
 assert source.read_bytes()==target.read_bytes(),str(target)+' inherited file diverged'
 proof.append({'source':str(source),'target':str(target.relative_to(P)),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
for name in files:copy(R02/name,P/name)
for f in sorted((R02/'native').glob('*.gz')):copy(f,P/'native'/f.name)
for f in sorted((R01/'thumbs').glob('*.png')):copy(f,P/'thumbs'/f.name)
assert len(list((P/'thumbs').glob('*.png')))==12
copy(R01/'style.css',P/'base-style.css')
for name in ['body-sdf-grid.json','common-body.sdfd.gz']:copy(T/'presets/r04/assets'/name,P/'assets'/name)
(P/'INHERITANCE.json').write_text(json.dumps({'sourceAnchor':'71900b71a449d4c0eae98589306dbf1e8f0a44f7','originalRuntimeUnchanged':True,'files':proof},ensure_ascii=False,indent=2))
