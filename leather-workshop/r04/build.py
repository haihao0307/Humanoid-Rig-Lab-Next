from pathlib import Path
import re,json,hashlib,base64,subprocess
r=Path(__file__).resolve().parent;old=r.parent/'r02';legacy=r.parent/'r03';H=lambda b:hashlib.sha256(b).hexdigest()
m=json.loads((old/'BUILD_MANIFEST.json').read_text());lm=json.loads((legacy/'BUILD_MANIFEST.json').read_text())
assert H((legacy/'preview.html').read_bytes())==lm['htmlSHA256']
assert H((legacy/'site/physics.mjs').read_bytes())==lm['sourceHashes']['physics.mjs']
for n in ['three.module.js','leather.js']:assert H((old/'site'/n).read_bytes())==m['sourceHashes'][n]
def src(p):
 t=p.read_text();t=re.sub(r'^import.*?;\s*','',t,flags=re.M);return re.sub(r'\bexport (?=(?:async )?(?:const|class|function))','',t)
physics=src(legacy/'site/physics.mjs');dyn=src(r/'site/dynamics.mjs');clamp=src(r/'site/clamp.mjs')
wc='(()=>{const {PROFILES,LeatherMaterial,makeSpecimen,MembraneSolver}=(()=>{'+physics+';return {PROFILES,LeatherMaterial,makeSpecimen,MembraneSolver};})();\nconst {LeatherDynamics}=(()=>{'+dyn+';return {LeatherDynamics};})();\nconst {ClampedLeather}=(()=>{'+clamp+';return {ClampedLeather};})();\n'+src(r/'site/worker.js')+'})();'
(r/'worker-check.js').write_text(wc);subprocess.run(['node','--check',str(r/'worker-check.js')],check=True)
t=(old/'site/three.module.js').read_text();e=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',t);assert e
pairs=[re.split(r'\s+as\s+',s.strip()) for s in e[1].split(',')];ex=','.join(p[-1]+':'+p[0] for p in pairs)
three='const T=(()=>{'+t[:e.start()]+';return {'+ex+'};})();'
js='(()=>{'+three+'\n'+'const {LeatherKernel,PRESETS,DEFAULT}=(()=>{'+src(old/'site/leather.js')+';return {LeatherKernel,PRESETS,DEFAULT};})();'+'\nconst PROFILES='+json.dumps({'AL':{'name':'AL 人工革','thickness':1.06},'NL':{'name':'NL 天然革','thickness':1.39},'PNL':{'name':'PNL 涂层天然革','thickness':1.16}},ensure_ascii=False)+';\nconst WORKER_CODE='+json.dumps(wc)+';\n'+src(r/'site/runtime.js')+'\n})();'
js=re.sub(r'</script',r'<\\/script',js,flags=re.I)
(r/'bundle-check.js').write_text(js);subprocess.run(['node','--check',str(r/'bundle-check.js')],check=True)
html=(r/'site/template.html').read_text().replace('<!--LEGACY-->','<div id="legacyData" hidden>'+base64.b64encode((legacy/'preview.html').read_bytes()).decode()+'</div>').replace('<!--APP-->','<!--\n'+(old/'THIRD_PARTY.txt').read_text().replace('--','—')+'\n--><script>'+js+'</script>')
assert len(re.findall(r'<script[ >]',html))==1
(r/'preview.html').write_text(html)
manifest={'version':'R04.0','sourceBase':'79a267266b69b4b11682339921da2f671e5bbb02','r03AnchorHTMLSHA256':lm['htmlSHA256'],'r02MaterialSHA256':m['sourceHashes']['leather.js'],'sourceHashes':{p.name:H(p.read_bytes()) for p in (r/'site').iterdir() if p.is_file()},'htmlBytes':len(html.encode()),'htmlSHA256':H(html.encode()),'dynamics':'SI units; implicit variational nonlinear membrane+bending+two-way sphere-triangle contact','clamp':'quasistatic, both end edges held; original R03 material','notImplemented':['self collision','fracture','permanent creases','measured dynamic calibration','friction'], 'experimentalCalibration':False}
(r/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(manifest['htmlBytes'],manifest['htmlSHA256'])
