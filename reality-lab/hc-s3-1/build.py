from pathlib import Path
import json, hashlib, subprocess, urllib.request, base64, re, os
ROOT=Path(__file__).resolve().parent
WORK=ROOT/'_generated';WORK.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
def gitblob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def get(url,expected):
    b=urllib.request.urlopen(url,timeout=120).read()
    assert gitblob(b)==expected,('immutable source blob mismatch',url)
    return b
repo='haihao0307/Humanoid-Rig-Lab-Next'
wrapper_commit='22cdb3f4c3bfd101bd86f0ffa246d255b561d915'
base_commit='a5af1e0140c935703dec7c4d4da4f5549449b657'
wrapper_path='denim-workshop/r17-scale/preview-v3.html'
base_path='denim-workshop/r17-scale/index.html'
wrapper_url=f'https://raw.githubusercontent.com/{repo}/{wrapper_commit}/{wrapper_path}'
base_url=f'https://raw.githubusercontent.com/{repo}/{base_commit}/{base_path}'
wrapper=get(wrapper_url,'001781e66815bf9b613f699a1d487da8d6a765a6')
base=get(base_url,'1117b62477ac6a5fcaa5d74b13b97cf84ff3fea9')
script=re.search(r'<script>([\s\S]*)</script>',wrapper.decode()).group(1)
# Replay exactly the published wrapper transformation; no WebGL or document scripts
# execute in this VM. Its only fetch must match the frozen base URL.
(WORK/'replay-input.json').write_text(json.dumps({'script':script,'html':base.decode(),'url':base_url}))
node="""const fs=require('node:fs'),vm=require('node:vm');const x=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));let output=null;const sandbox={fetch:async u=>{if(u!==x.url)throw Error('unexpected source');return{ok:true,text:async()=>x.html};},document:{open(){},write(h){output=h;},close(){},body:{}},console:{error(e){throw e;}}};Promise.resolve(vm.runInNewContext(x.script,sandbox,{timeout:5000})).then(()=>{if(!output||!output.includes('DENIM-R17.2-GARMENT-SCALE'))throw Error('assembly failed');fs.writeFileSync(process.argv[2],output);}).catch(e=>{console.error(e);process.exitCode=1;});"""
subprocess.run(['node','-e',node,str(WORK/'replay-input.json'),str(WORK/'native-before.html')],check=True)
original=(WORK/'native-before.html').read_text()
source={'repository':repo,'commit':wrapper_commit,'path':wrapper_path,'sha256':sha(wrapper),'basePage':{'commit':base_commit,'path':base_path,'sha256':sha(base)},'assembledOriginalSHA256':sha(original.encode())}
reader=(ROOT/'native-exporter.js').read_text()
insertion='/*RF31_NATIVE_EXPORT_BEGIN*/\nwindow.__RF31_SOURCE__='+json.dumps(source)+';\n'+reader+'\n/*RF31_NATIVE_EXPORT_END*/\n'
anchor='window.DENIM_R17='
assert original.count(anchor)==1
native=original.replace(anchor,insertion+anchor)
assert native.replace(insertion,'')==original
(WORK/'native-after.html').write_text(native)
for name,html in [('before',original),('after',native)]:
    scripts=re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',html)
    for i,s in enumerate(scripts):
        f=WORK/f'{name}-{i}.js';f.write_text(s);subprocess.run(['node','--check',str(f)],check=True)
source_commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
protocol=ROOT.parent/'hc-s2-1/protocol.js';dictionary=ROOT.parent/'hc-s2-1/measurement-dictionary.json';history=ROOT.parent/'hc-s3/material-snapshots.json'
assert gitblob(protocol.read_bytes())=='74e1f859fa2001456286e6a4081ef639124699d2'
files=['TASK_ANCHOR.json','native-exporter.js','bridge.js','app.js','index.template.html','build.py','tests/protocol.cjs','tests/browser.py','README.md']
manifest={'version':'REALITY-HC-S3.1-A','sourceCommit':source_commit,'sharedProtocolVersion':'0.2.0','sourceFiles':{n:sha((ROOT/n).read_bytes()) for n in files},'dependencies':{'protocolSHA256':sha(protocol.read_bytes()),'dictionarySHA256':sha(dictionary.read_bytes()),'S3SnapshotSHA256':sha(history.read_bytes())},'native':{'source':source,'originalHTMLSHA256':sha(original.encode()),'augmentedHTMLSHA256':sha(native.encode()),'insertionSHA256':sha(insertion.encode()),'additiveRemovalRestoresOriginal':True},'coverage':{'liveNative':['denim'],'historical':['denim','knit','leather','silk','cotton','acrylic','linen'],'productionExporterInstalled':False},'privateCredentialsIncluded':False,'originalShadersChanged':False,'originalGeometryChanged':False,'originalPhysicsChanged':False,'publicBrowserVerified':False,'physicalCertification':False}
(WORK/'manifest-input.json').write_text(json.dumps(manifest))
js='const RF31_BUILD='+json.dumps(manifest,ensure_ascii=False)+';\nconst RF31_DICTIONARY='+dictionary.read_text()+';\nconst RF31_HISTORY='+history.read_text()+';\nconst RF31_NATIVE_B64='+json.dumps(base64.b64encode(native.encode()).decode())+';\n'+protocol.read_text()+'\n'+(ROOT/'bridge.js').read_text()+'\n'+(ROOT/'app.js').read_text()
assert '</script' not in js.lower()
(WORK/'assembled.js').write_text(js);subprocess.run(['node','--check',str(WORK/'assembled.js')],check=True)
html=(ROOT/'index.template.html').read_text();assert html.count('<!-- RF31_SCRIPTS -->')==1
html=html.replace('<!-- RF31_SCRIPTS -->','<script>\n'+js+'\n</script>')
(ROOT/'preview.html').write_text(html)
manifest['html']={'bytes':len(html.encode()),'sha256':sha(html.encode())}
(ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
q=ROOT/'qa/local';q.mkdir(parents=True,exist_ok=True)
(q/'ASSEMBLY_REPORT.json').write_text(json.dumps({'passed':True,'source':source,'originalSHA256':sha(original.encode()),'augmentedSHA256':sha(native.encode()),'removalIsExact':True,'sourceFilesModified':False,'nativeCoreNetworkDependencies':[]},indent=2))
print(json.dumps({'sourceCommit':source_commit,'html':manifest['html'],'source':source,'additiveOnly':True},indent=2))
