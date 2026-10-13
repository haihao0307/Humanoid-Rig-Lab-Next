"""Scoped immutable source/build/evidence chain. No old workbench is written."""
from pathlib import Path
import os,subprocess,json,hashlib,time,urllib.request,argparse,shutil
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
BRANCH='feature/hat-owned-r10-20261013';BASE='fbc80722683b73bc63bf2d55d2891f118037d800'
p=argparse.ArgumentParser();p.add_argument('stage',choices=['prepare','finish']);p.add_argument('--source');p.add_argument('--build');A=p.parse_args()
assert os.environ.get('GITHUB_REF_NAME')==BRANCH,'Unexpected write branch'
def run(*args,timeout=180):subprocess.run(list(args),cwd=ROOT,check=True,timeout=timeout)
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def commit(message):
 run('git','add','hat-workshop/owned-r10')
 staged=git('diff','--cached','--name-only').splitlines()
 assert all(x.startswith('hat-workshop/owned-r10/') for x in staged),staged
 if staged:
  run('git','commit','-m',message+' [skip ci]');run('git','push','origin','HEAD:'+BRANCH)
 return git('rev-parse','HEAD')
def read(name):return json.loads((R/name).read_text())
def address(built):
 raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+built+'/hat-workshop/owned-r10/index.html'
 return raw,'https://htmlpreview.github.io/?'+raw+'#hat=pinch'
run('git','config','user.name','github-actions[bot]');run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
if A.stage=='prepare':
 # Old/failed evidence must not silently count for this source.
 shutil.rmtree(R/'qa',ignore_errors=True)
 (R/'DELIVERY.json').unlink(missing_ok=True)
 (R/'THIRD_PARTY_NOTICES.txt').write_bytes((R/'node_modules/three/LICENSE').read_bytes())
 source=commit('feat(hat-r10.1): freeze readable source and locked official dependencies')
 for name in ['catalog','shape','material','viewer']:run('node','--check',str(R/'src'/(name+'.js')))
 run('node',str(R/'test-core.cjs'));run('node',str(R/'test-r101.cjs'))
 run('python',str(R/'build.py'),'--source',source)
 built=commit('build(hat-r10.1): freeze independent candidate for browser acceptance')
 raw,url=address(built)
 with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('source='+source+'\nbuild='+built+'\nurl='+url+'\n')
 print(json.dumps({'source':source,'build':built,'candidateURL':url,'publicVerified':False}),flush=True)
else:
 assert A.source and A.build
 assert git('rev-parse','HEAD')==A.build,'Branch changed since candidate; reconcile before receipt'
 manifest=read('BUILD_MANIFEST.json');local=read('qa/browser/report.json');public=read('qa/public/report.json');core=read('qa/core.json');extra=read('qa/r101.json')
 assert all(v.get('passed') for v in [local,public,core,extra])
 assert all(v['source']==A.source for v in [local,public]) and manifest['sourceSha']==A.source
 assert all(v['version']=='HAT-R10.1' for v in [manifest,core,extra])
 raw,url=address(A.build)
 assert public['url']==url
 for i in range(6):
  try:
   data=urllib.request.urlopen(raw,timeout=60).read();assert hashlib.sha256(data).hexdigest()==manifest['htmlSHA256'];break
  except Exception:
   if i==5:raise
   time.sleep(3)
 run('git','fetch','--depth=1','origin',BASE)
 changed=git('diff','--name-only',BASE,'HEAD').splitlines()
 assert all(x.startswith('hat-workshop/owned-r10/') or x=='.github/workflows/hat-owned-r10.yml' for x in changed),changed
 receipt={'version':'HAT-R10.1','sourceSha':A.source,'buildSha':A.build,'publicURL':url,'htmlSHA256':manifest['htmlSHA256'],'publicVerified':True,'browserVerified':True,'firstPartyDomainRewrite':True,'copiedHatAssetCount':0,'thirdPartyEngine':'Three.js 0.179.1 MIT (not claimed first-party)','oldVersionsModified':False,'userAccepted':False,'checks':{'core':len(core['checks']),'r101':len(extra['checks']),'localBrowser':len(local['checks']),'publicBrowser':len(public['checks'])},'entryBytes':manifest['entryBytes'],'localPerformance':local['performance'],'publicPerformance':public['performance'],'publicBootToReadyMS':public['bootToReadyMS'],'mobileScope':'390x844 viewport only; not physical phone','limits':['new procedural test heads, not original scanned head verification','static fit, no dynamic donning or cloth physics','thick knit shells and geometric cables, not yarn-level physics','not legal clearance or formally isolated clean-room certification'],'scope':changed}
 (R/'DELIVERY.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
 final=commit('test(hat-r10.1): retain independent public evidence and delivery receipt')
 print(json.dumps({'evidence':final,'delivery':receipt},ensure_ascii=False),flush=True)
