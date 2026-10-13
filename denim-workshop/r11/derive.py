"""Once-only scoped R10 -> R11 derivation. The named archive is never writable.
Canonical sources/build are published only after tests. No inferred relicensing.
"""
from pathlib import Path
import hashlib,json,re,shutil
P=Path(__file__).resolve().parent;S=P.parent/'r10'
assert not (P/'app.js').exists(),'Edit canonical R11 files after initial derivation'
m=json.loads((S/'BUILD_MANIFEST.json').read_text())
assert hashlib.sha256((S/'index.html').read_bytes()).hexdigest()=='a6d9dbac361aaf9017c42095e1d8ab63f1d9bc3d55c8e47c9c85af7ebb469c87'
for f,h in m['sourceHashes'].items():
 assert hashlib.sha256((S/f).read_bytes()).hexdigest()==h,f
for f in list(m['sourceHashes'])+['template.html','build.py','test-budget.cjs','test-layers.cjs','test-stability.cjs','test-cotton.cjs','test-dynamics.cjs']:
 shutil.copy2(S/f,P/f)
a=P/'app.js';s=a.read_text()
start=s.index('float hash2(vec2 x)');end=s.index('float finishField',start)
assert s[start:end].count('\n')==2,'Unknown helper block'
s=s[:start]+'${KAOPUDenimNoise.glsl}\n'+s[end:]
s=re.sub(r'\bn2\(', 'denimNoise2(',s)
s=s.replace('R10.0','R11.0')
s=s.replace("['R09.0','R09.1','R11.0']","['R11.0']")
s=s.replace("seed:'fixed-r08'","seed:'fixed-r08',noiseKernel:KAOPUDenimNoise.version")
s=s.replace("r.seed!=='fixed-r08'","r.seed!=='fixed-r08'||r.noiseKernel!==KAOPUDenimNoise.version")
s=s.replace("throw Error('配方版本或单位不受支持')","throw Error('本版噪声内核已更换；请使用 R11 配方。旧配方应在牛仔布成果一档打开，不静默改变花纹。')")
s=s.replace("version:'R11.0',graph:","version:'R11.0',noiseKernel:KAOPUDenimNoise.version,graph:")
s=s.replace('KAOPU_Denim_R09_Profile.json','KAOPU_Denim_R11_Profile.json')
s=s.replace('float hash(float x){','// MurmurHash3 public-domain fmix tail with project XOR seed; intentionally unchanged.\nfloat hash(float x){')
a.write_text(s)
a=P/'cotton-surface.js';a.write_text(re.sub(r'\bn2\(','denimNoise2(',a.read_text()))
a=P/'natural-yarn.js';a.write_text(a.read_text().replace('const H=x=>','// Austin Appleby public-domain fmix32 tail; project seed/normalization. See HELPER_PROVENANCE.md.\nconst H=x=>'))
a=P/'core.js';s=a.read_text()
old='const seed=Math.sin(id*17.3+kind*34.7)*43758.54,fract=seed-Math.floor(seed);'
new='''// Compatibility-only cutter; the current renderer uses Natural.plan instead.
 // Replace untraced sine jitter with a documented MurmurHash3-tail adapter.
 let bits=Math.imul((id^Math.imul(kind,350))^0x9e3779b9,0x85ebca6b);bits^=bits>>>13;bits=Math.imul(bits,0xc2b2ae35);
 const fract=((bits^(bits>>>16))>>>0)/4294967296;'''
assert old in s;s=s.replace(old,new);a.write_text(s)
a=P/'sampling.js';a.write_text(a.read_text().replace('const finalShader=', '// Narkowicz ACESFilm fit, author offers CC0/MIT; this adapter records CC0.\nconst finalShader='))
a=P/'template.html';s=a.read_text().replace('R10.0','R11.0').replace('/*APP*/','/*NOISE*/\n/*APP*/')
s=s.replace('</head>','<!-- KAOPU R11 helper provenance revision. Original R10 archive is unchanged. -->\n</head>')
a.write_text(s)
a=P/'build.py';s=a.read_text().replace("('APP','app.js')","('NOISE','noise-kernel.js'),('APP','app.js')").replace('R10.0','R11.0').replace('r10/index.html','r11/index.html').replace('de49103b14bc4884b3f9ba1e5a2a3a8b5fa66eae','3daabc3436ecf6e5297d56869712449ca145ab5e')
s=s.replace("data=result.encode();", "result=result.replace('</body>','<!--\\n'+(P/'LICENSE').read_text()+'\\n'+(P/'THIRD_PARTY_NOTICES.md').read_text()+'\\n--></body>');data=result.encode();")
a.write_text(s)
root=P.parents[1];lic=root/'LICENSE'
assert lic.exists(),'Root license must be supplied; do not invent a new license'
shutil.copy2(lic,P/'LICENSE')
print('R11 helper-only source derived from the locked R10 archive')
