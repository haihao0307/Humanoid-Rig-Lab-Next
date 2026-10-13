from pathlib import Path
import json
R=Path(__file__).resolve().parent;B=R.parent/'r08'
if (R/'R09_APPLIED.json').exists():raise SystemExit(0)
def rep(s,a,b):
 assert a in s,'Missing build anchor: '+a[:90]
 return s.replace(a,b)
p=R/'shell.html';s=p.read_text().replace('R08','R09')
s=rep(s,'<button id="retry-load">重试选中帽子</button>','<button id="retry-load">重试选中帽子</button><button id="clear-cache" title="只释放临时缓存，保留当前帽子和配方">清理临时缓存</button>');p.write_text(s)
p=R/'build.py';s=p.read_text().replace('HAT-R08.0','HAT-R09.0').replace('hat-workshop/r08/details/','hat-workshop/r09/details/').replace("baseline='43550335278e94529d2b9007d020b63e39a369f3'","baseline='0c219f96ddc7de3e594d275f08027cf3b606059c'")
s=rep(s,"['shell.html','build.py']","['shell.html','build.py','runtime-loader.js']")
a=" data=base64.b64encode(gzip.compress(json.dumps(full,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()"
s=rep(s,a,""" rawApp=app.encode();packedApp=gzip.compress(rawApp,compresslevel=9,mtime=0)
 loader=(R/'runtime-loader.js').read_text().replace('__RUNTIME_GZIP__',base64.b64encode(packedApp).decode()).replace('__RUNTIME_HASH__',hash256(rawApp)).replace('__PACKED_BYTES__',str(len(packedApp))).replace('__RAW_BYTES__',str(len(rawApp)))
 assert gzip.decompress(packedApp)==rawApp
"""+a)
s=rep(s,"replace('/*APP*/',app.replace","replace('/*APP*/',loader.replace")
s=rep(s,"'publicBytes':len(page.encode()),","'publicBytes':len(page.encode()),'runtimeUncompressedBytes':len(rawApp),'runtimeGzipBytes':len(packedApp),'runtimeSHA256':hash256(rawApp),'runtimeRoundTripByteIdentical':True,'geometryCacheBudgetBytes':67108864,")
p.write_text(s)
p=R/'qa-browser.py';s=p.read_text().replace('HAT-R08.0','HAT-R09.0').replace('/hat-workshop/r08/index.html','/hat-workshop/r09/index.html');p.write_text(s)
a=json.loads((B/'SOURCE_AUTHORITY.json').read_text());a['schema']='kaopu.source-authority/9';a['canonicalRuntime']=sorted(set(a['canonicalRuntime']+['runtime-cache.mjs','runtime-loader.js']));a['testing']=['verify-worker.mjs','qa-browser.py','qa-r09.py','verify-runtime-cache.mjs'];a['initialTransport']='migrate-app.py and migrate-build.py run once against SHA-256 verified R08. R09_APPLIED.json prevents replay. Edit readable production files thereafter.';a.pop('r071Migration',None);a.pop('initialLinerDerivation',None);a['baseline']='0c219f96ddc7de3e594d275f08027cf3b606059c';(R/'SOURCE_AUTHORITY.json').write_text(json.dumps(a,indent=2))
(R/'R09_APPLIED.json').write_text(json.dumps({'baselineBuild':'0c219f96ddc7de3e594d275f08027cf3b606059c','baselineHead':'304a93738b029e18e944a7e737a25cb0e45cb2e3','runtimeMathChanged':False,'sourceAttributionsRetained':True,'oldDirectoriesModified':False,'userAccepted':False},indent=2))
