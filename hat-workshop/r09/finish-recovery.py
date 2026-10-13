"""Bounded, immutable R09 recovery stages. Only this branch and r09 may be written."""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,os,statistics,subprocess,time,urllib.request
from bs4 import BeautifulSoup
R=Path(__file__).resolve().parent;ROOT=R.parent.parent;Q=R/'qa'
BRANCH='fix/hat-r09-render-recovery-20261013'
BASE='1ab657745c2b0961284d716603ffeeebd5479e36'
P=argparse.ArgumentParser();P.add_argument('stage',choices=['prepare','geometry','finish']);P.add_argument('--source');P.add_argument('--build');A=P.parse_args()
def run(*args,timeout=180):return subprocess.run(list(args),cwd=ROOT,check=True,timeout=timeout)
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def commit(message):
 run('git','add','hat-workshop/r09');run('git','add','-f','hat-workshop/r09/details')
 if git('diff','--cached','--name-only'):
  run('git','commit','-m',message+' [skip ci]');run('git','push','origin','HEAD:'+BRANCH)
 return git('rev-parse','HEAD')
def load(path):return json.loads(path.read_text())
def write(path,data):path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2))
def url(built):return 'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+built+'/hat-workshop/r09/index.html#hat=trilby'
if A.stage in ['prepare','finish']:
 assert os.environ.get('GITHUB_REF_NAME')==BRANCH,'Never write a different branch'
 run('git','config','user.name','github-actions[bot]');run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
if A.stage=='prepare':
 run('python',str(R/'recover-r09.py'));run('python',str(R/'patch-render.py'))
 run('node','--check',str(R/'app.js'));run('python',str(R/'build.py'),'--assets-only')
 # Results from the interrupted candidate cannot count as new evidence.
 for name in ['browser','public','iteration','public-iteration','render','public-render']:
  import shutil
  shutil.rmtree(Q/name,ignore_errors=True)
 for name in ['DELIVERY.json']:(R/name).unlink(missing_ok=True)
 for name in ['ITERATION_SUMMARY.json','SCOPE.json','cache-unit.json','worker-equivalence.json']:(Q/name).unlink(missing_ok=True)
 source=commit('fix(hat-r09): commit reviewed render scheduling and unchanged original materials')
 run('python',str(R/'build.py'),'--source',source)
 built=commit('build(hat-r09): freeze immutable recovery candidate before independent checks')
 with open(os.environ['GITHUB_OUTPUT'],'a') as output:
  output.write('source='+source+'\nbuild='+built+'\nurl='+url(built)+'\n')
 print(json.dumps({'source':source,'build':built,'url':url(built),'verified':False}),flush=True)
elif A.stage=='geometry':
 Q.mkdir(parents=True,exist_ok=True)
 data=BeautifulSoup((R.parent/'r04/standalone.html').read_text(),'html.parser').find(id='payload').text
 write(Q/'payload-fixture.json',json.loads(gzip.decompress(base64.b64decode(data))))
 try:run('node',str(R/'verify-worker.mjs'))
 finally:(Q/'payload-fixture.json').unlink(missing_ok=True)
 run('node',str(R/'verify-runtime-cache.mjs'))
else:
 assert A.source and A.build
 assert git('rev-parse','HEAD')==A.build,'Branch moved since frozen candidate; refuse stale evidence write'
 reports={name:load(Q/name/'report.json') for name in ['browser','public','iteration','public-iteration','render','public-render']}
 worker=load(Q/'worker-equivalence.json');unit=load(Q/'cache-unit.json')
 assert all(r.get('passed') for r in [*reports.values(),worker,unit]),'Every report must pass'
 manifest=load(R/'BUILD_MANIFEST.json');old=load(R.parent/'r08/BUILD_MANIFEST.json')
 assert manifest['sourceSha']==A.source
 raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+A.build+'/hat-workshop/r09/index.html'
 data=urllib.request.urlopen(raw,timeout=90).read()
 assert hashlib.sha256(data).hexdigest()==manifest['htmlSHA256']
 assert old['sourcePreservation']==manifest['sourcePreservation'],'Original control and material bytes must remain identical'
 def stats(v):
  r=reports['iteration']['runs'][v];first=[x['wallMS'] for x in r['clicks'] if x['cycle']==0];warm=[x['wallMS'] for x in r['clicks'] if x['cycle']>0]
  return {'bootWallMS':r['bootWallMS'],'firstCycleMedianWallMS':statistics.median(first),'returnCyclesMedianWallMS':statistics.median(warm),'returnCyclesMaxWallMS':max(warm),'workerStartsPerCycle':[x['workerStarts'] for x in r['cycles']],'clickCount':len(r['clicks'])}
 summary={'version':'HAT-R09.0 recovery','sourceSha':A.source,'buildSha':A.build,'url':url(A.build),'environment':reports['iteration']['environment'],'beforeHTMLBytes':old['publicBytes'],'afterHTMLBytes':manifest['publicBytes'],'R08':stats('r08'),'R09':stats('r09'),'publicCycles':[{k:v for k,v in c.items() if k!='performance'} for c in reports['public-iteration']['runs']['r09']['cycles']],'publicColdWallMS':reports['public-iteration']['runs']['r09']['bootWallMS'],'timingScope':'automation wall clock from real click through application readiness, not physical display or user hardware','normalBytesAndResolutionUnchanged':True,'userAccepted':False}
 write(Q/'ITERATION_SUMMARY.json',summary)
 run('git','fetch','--depth=1','origin',BASE)
 changed=git('diff','--name-only',BASE,'HEAD').splitlines()
 assert all(p.startswith('hat-workshop/r09/') or p=='.github/workflows/hat-r09-recovery.yml' for p in changed),changed
 write(Q/'SCOPE.json',{'parent':BASE,'changedFiles':changed,'onlyR09AndOwnWorkflow':True})
 delivery={'version':'HAT-R09.0 recovery','sourceSha':A.source,'buildSha':A.build,'publicURL':url(A.build),'htmlSHA256':manifest['htmlSHA256'],'publicVerified':True,'localBrowserVerified':True,'geometryPairsUnchanged':len(worker['records']),'checks':{name:len(r['checks']) for name,r in reports.items()},'unitChecks':len(unit['checks']),'normalBytesUnchanged':True,'oldVersionsModified':False,'noMerge':True,'userAccepted':False,'mobileScope':'390x844 viewport only; not physical phone','runtimeChanges':['coalesced queued and immediate rendering','unchanged-shadow reuse with scene/turntable invalidation','500ms stable selection before full HD upload','explicit CPU-preparation timing label'],'limitations':['full original HD bytes still require first transfer','network and device dependent','source-control mesh subdivision and fit; not from-zero analytic hats','no hair compression or dynamic donning']}
 write(R/'DELIVERY.json',delivery)
 recovery=load(R/'RECOVERY.json');recovery.update(status='fixed-public-candidate-verified',buildSha=A.build,sourceSha=A.source);write(R/'RECOVERY.json',recovery)
 final=commit('test(hat-r09): publish all independent evidence and fixed public delivery receipt')
 print(json.dumps({'evidenceCommit':final,'delivery':delivery,'summary':summary},ensure_ascii=False),flush=True)
