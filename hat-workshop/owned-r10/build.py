"""Build only the independent domain sources and the pinned official engine."""
from pathlib import Path
import json,hashlib,subprocess,argparse
R=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--source',required=True);a=p.parse_args()
files=['src/catalog.js','src/shape.js','src/material.js','src/viewer.js']
package=json.loads((R/'node_modules/three/package.json').read_text())
assert package['version']=='0.179.1','Unexpected engine version'
assert (R/'package-lock.json').exists(),'A resolved lockfile is required'
worker=(R/files[0]).read_text()+'\n'+(R/files[1]).read_text()+'''\nself.onmessage=e=>{try{const data=HAT10.generate(e.data.spec,e.data.lod);const list=[];for(const p of data.pieces)for(const k of ['position','normal','uv','index'])list.push(p[k].buffer);postMessage(data,list);}catch(error){postMessage({error:String(error.message||error)});}};'''
engine_source="import * as T from 'three'; globalThis.OwnHatThree=T;"
engine_bytes=subprocess.check_output(['node_modules/.bin/esbuild','--bundle','--minify','--format=iife','--legal-comments=inline','--sourcefile=engine-entry.js'],input=engine_source.encode(),cwd=R)
license_text=(R/'node_modules/three/LICENSE').read_text()
(R/'THIRD_PARTY_NOTICES.txt').write_text(license_text)
engine='/*'+license_text+'*/\n'+engine_bytes.decode()
app='\n'.join((R/f).read_text() for f in files)
page=(R/'shell.html').read_text().replace('/*WORKER*/',worker.replace('</script','<\\/script')).replace('/*BUILD*/','globalThis.HAT10_BUILD='+json.dumps({'source':a.source,'version':'HAT-R10.2'})+';').replace('/*ENGINE*/',engine.replace('</script','<\\/script')).replace('/*APP*/',app.replace('</script','<\\/script'))
(R/'index.html').write_text(page)
manifest={'version':'HAT-R10.2','sourceSha':a.source,'entryBytes':len(page.encode()),'htmlSHA256':hashlib.sha256(page.encode()).hexdigest(),'files':{f:hashlib.sha256((R/f).read_bytes()).hexdigest() for f in files+['shell.html','build.py','package-lock.json']},'engineEntrySource':engine_source,'domainRuntimeRewritten':True,'oldHatAssetsReferenced':False,'externalHatTextures':False,'externalHatMeshes':False,'firstPartyMannequin':True,'categoryCount':11,'engine':'Three.js 0.179.1 MIT; third-party, not claimed as owned','localTestEngine':False,'publicVerified':False,'userAccepted':False}
(R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest,indent=2))
