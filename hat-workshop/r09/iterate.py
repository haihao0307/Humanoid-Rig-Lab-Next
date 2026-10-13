"""Only r09 is written. Source, build, public evidence are separate commits."""
from pathlib import Path
import json,gzip,base64,hashlib,subprocess,time,statistics,urllib.request
from bs4 import BeautifulSoup
R=Path(__file__).resolve().parent;ROOT=R.parent.parent;B=R.parent/'r08'
BRANCH='fix/hat-r09-cache-startup-20261013'
hash256=lambda b:hashlib.sha256(b).hexdigest()
def run(*cmd):subprocess.run(list(cmd),cwd=ROOT,check=True)
def git(*cmd):return subprocess.check_output(['git',*cmd],cwd=ROOT,text=True).strip()
def commit(message):
 run('git','add','hat-workshop/r09')
 if (R/'details').exists():run('git','add','-f','hat-workshop/r09/details')
 if git('diff','--cached','--name-only'):
  run('git','commit','-m',message+' [skip ci]');run('git','push','origin','HEAD:'+BRANCH)
run('git','config','user.name','github-actions[bot]');run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
run('python',str(R/'migrate-app.py'));run('python',str(R/'migrate-build.py'))
run('node','--check',str(R/'app.js'));run('python',str(R/'build.py'),'--assets-only')
commit('feat(hat-r09): establish readable runtime, bounded caches and lossless startup')
source=git('rev-parse','HEAD')
run('python',str(R/'build.py'),'--source',source)
Q=R/'qa';Q.mkdir(exist_ok=True)
full=json.loads(gzip.decompress(base64.b64decode(BeautifulSoup((R.parent/'r04/standalone.html').read_text(),'html.parser').find(id='payload').text)))
(Q/'payload-fixture.json').write_text(json.dumps(full))
try:run('node',str(R/'verify-worker.mjs'))
finally:(Q/'payload-fixture.json').unlink(missing_ok=True)
run('node',str(R/'verify-runtime-cache.mjs'))
run('python','-u',str(R/'qa-browser.py'),'--source',source)
run('python','-u',str(R/'qa-r09.py'))
commit('build(hat-r09): freeze browser-tested compressed public candidate')
built=git('rev-parse','HEAD')
url=f'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{built}/hat-workshop/r09/index.html#hat=trilby'
raw=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{built}/hat-workshop/r09/index.html'
manifest=json.loads((R/'BUILD_MANIFEST.json').read_text())
for attempt in range(8):
 try:
  data=urllib.request.urlopen(raw,timeout=60).read();assert hash256(data)==manifest['htmlSHA256'];break
 except Exception:
  if attempt==7:raise
  time.sleep(3)
run('python','-u',str(R/'qa-browser.py'),'--public-url',url,'--source',source)
run('python','-u',str(R/'qa-r09.py'),'--public-url',url)
local=json.loads((Q/'browser/report.json').read_text());public=json.loads((Q/'public/report.json').read_text())
it=json.loads((Q/'iteration/report.json').read_text());pit=json.loads((Q/'public-iteration/report.json').read_text());worker=json.loads((Q/'worker-equivalence.json').read_text());unit=json.loads((Q/'cache-unit.json').read_text())
assert all(x['passed'] for x in [local,public,it,pit,worker,unit])
old=json.loads((B/'BUILD_MANIFEST.json').read_text())
def cycle_stats(v):
 rows=it['runs'][v]['clicks'];warm=[r['wallMS'] for r in rows if r['cycle']>0];first=[r['wallMS'] for r in rows if r['cycle']==0]
 return {'firstCycleMedianWallMS':statistics.median(first),'returnCyclesMedianWallMS':statistics.median(warm),'returnCyclesMaxWallMS':max(warm),'workerStartsPerCycle':[c['workerStarts'] for c in it['runs'][v]['cycles']],'clickCount':len(rows),'bootWallMS':it['runs'][v]['bootWallMS']}
summary={'version':'HAT-R09.0','sourceSha':source,'buildSha':built,'url':url,'baselineBuild':'0c219f96ddc7de3e594d275f08027cf3b606059c','environment':it['environment'],'scope':'same-environment 4 x 11 real clicks per version; shape and original color readiness, separate complete-normal tests','beforeHTMLBytes':old['publicBytes'],'afterHTMLBytes':manifest['publicBytes'],'byteReductionPercent':100*(1-manifest['publicBytes']/old['publicBytes']),'htmlSizeNotNetworkSpeedGuarantee':True,'R08':cycle_stats('r08'),'R09':cycle_stats('r09'),'publicCycles':[{k:v for k,v in c.items() if k!='performance'} for c in pit['runs']['r09']['cycles']],'publicColdWallMS':pit['runs']['r09']['bootWallMS'],'userAccepted':False}
(Q/'ITERATION_SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
delivery={'version':'HAT-R09.0','sourceSha':source,'buildSha':built,'publicURL':url,'htmlSHA256':manifest['htmlSHA256'],'publicVerified':True,'localBrowserVerified':True,'geometryPairsUnchanged':len(worker['records']),'localChecks':len(local['checks']),'publicChecks':len(public['checks']),'iterationChecks':len(it['checks']),'publicIterationChecks':len(pit['checks']),'unitChecks':len(unit['checks']),'normalBytesUnchanged':old['sourcePreservation']==manifest['sourcePreservation'],'oldVersionsModified':False,'noMerge':True,'userAccepted':False,'mobileScope':'viewport only, not physical phone','runtimeDerivedCacheNotBakedAsset':True,'scope':'loading/cache only; no hair compression or dynamic donning'}
assert delivery['normalBytesUnchanged'];(R/'DELIVERY.json').write_text(json.dumps(delivery,ensure_ascii=False,indent=2))
run('git','fetch','--depth=1','origin','304a93738b029e18e944a7e737a25cb0e45cb2e3')
changed=git('diff','--name-only','304a93738b029e18e944a7e737a25cb0e45cb2e3','HEAD').splitlines()
assert all(n.startswith('hat-workshop/r09/') or n=='.github/workflows/hat-r09-iterate.yml' for n in changed),changed
(Q/'SCOPE.json').write_text(json.dumps({'parent':'304a93738b029e18e944a7e737a25cb0e45cb2e3','changedFiles':changed,'onlyR09AndOwnWorkflow':True},indent=2))
print('PUBLIC_CANDIDATE '+url,flush=True);print(json.dumps(summary,ensure_ascii=False),flush=True)
