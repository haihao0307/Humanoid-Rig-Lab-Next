"""Only owned-r11 and its isolated branch can be written. Never overwrite an accepted old page."""
from pathlib import Path
import os,subprocess,argparse,json,hashlib,urllib.request,time,shutil
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
BRANCH='feature/hat-owned-r11-visual-rebuild-20261013';BASE='2a21c583f982bb0d75d23bf642be8bafd450dcdc'
P=argparse.ArgumentParser();P.add_argument('stage',choices=['prepare','finish']);P.add_argument('--source');P.add_argument('--build');A=P.parse_args()
assert os.environ.get('GITHUB_REF_NAME')==BRANCH,'Unexpected write target'
def run(*args,timeout=180):subprocess.run(list(args),cwd=ROOT,check=True,timeout=timeout)
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def read(name):return json.loads((R/name).read_text())
def write(name,data):(R/name).write_text(json.dumps(data,ensure_ascii=False,indent=2))
def commit(message):
 run('git','add','hat-workshop/owned-r11')
 files=git('diff','--cached','--name-only').splitlines();assert all(f.startswith('hat-workshop/owned-r11/') for f in files),files
 if files:run('git','commit','-m',message+' [skip ci]');run('git','push','origin','HEAD:'+BRANCH)
 return git('rev-parse','HEAD')
def address(sha):
 raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/hat-workshop/owned-r11/index.html'
 return raw,'https://htmlpreview.github.io/?'+raw+'#hat=field'
run('git','config','user.name','github-actions[bot]');run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
if A.stage=='prepare':
 run('python',str(R/'refine.py'))
 shutil.rmtree(R/'qa',ignore_errors=True);(R/'DELIVERY.json').unlink(missing_ok=True)
 source=commit('feat(hat-r11): freeze scoped visual construction and material revision')
 for name in ['catalog','shape','field','material','studio','viewer']:run('node','--check',str(R/'src'/(name+'.js')))
 run('node',str(R/'test-core.cjs'),timeout=240)
 run('python',str(R/'build.py'),'--source',source)
 built=commit('build(hat-r11): freeze independently generated preview before public acceptance')
 raw,url=address(built)
 with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('source='+source+'\nbuild='+built+'\nurl='+url+'\n')
 print(json.dumps({'source':source,'build':built,'url':url,'verified':False,'filmReady':False}),flush=True)
else:
 assert A.source and A.build and git('rev-parse','HEAD')==A.build,'Frozen candidate changed; refuse stale evidence'
 core=read('qa/core.json');local=read('qa/browser/report.json');public=read('qa/public/report.json');manifest=read('BUILD_MANIFEST.json')
 assert all(x.get('passed') for x in [core,local,public])
 assert all(x['version']=='HAT-R11.0' for x in [core,local,public,manifest])
 assert local['source']==public['source']==manifest['sourceSha']==A.source
 raw,url=address(A.build);assert public['url']==url
 for i in range(6):
  try:
   data=urllib.request.urlopen(raw,timeout=60).read();assert hashlib.sha256(data).hexdigest()==manifest['htmlSHA256'];break
  except Exception:
   if i==5:raise
   time.sleep(3)
 run('git','fetch','--depth=1','origin',BASE)
 changed=git('diff','--name-only',BASE,'HEAD').splitlines()
 assert all(p.startswith('hat-workshop/owned-r11/') or p=='.github/workflows/hat-owned-r11.yml' for p in changed),changed
 photos=['desktop','field-final-three','field-macro','field-neutral','field-neutral-macro','field-fit-oval','field-top','field-inside']
 for name in photos:
  path=R/'qa/public'/(name+'.png');assert path.is_file() and path.stat().st_size>10000
  run('git','add','-f','hat-workshop/owned-r11/qa/public/'+name+'.png')
 receipt={'version':'HAT-R11.0','sourceSha':A.source,'buildSha':A.build,'publicURL':url,'htmlSHA256':manifest['htmlSHA256'],'publicVerified':True,'browserVerified':True,'userAccepted':False,'filmReady':False,'priorR102VisualStatus':'rejected by user; engineering tests did not establish visual suitability','focus':'field cap structural rebuild; all eleven share new materials and studio','entryBytes':manifest['entryBytes'],'checks':{'core':len(core['checks']),'localBrowser':len(local['checks']),'publicBrowser':len(public['checks'])},'publicBootToReadyMS':public['bootToReadyMS'],'publicBootToFullCatalogueMS':public['bootToFullCatalogueMS'],'localPerformance':local['performance'],'publicPerformance':public['performance'],'publicDiagnostics':public['diagnostics'],'evidencePhotos':photos,'externalHatAssetsRequired':False,'oldVersionsModified':False,'thirdPartyEngine':'Three.js 0.179.1 MIT, not first-party','limitations':['Focused field-cap construction redesign; other silhouettes still require individual visual refinement','Sewn rest shape and sampled static fit, not cloth dynamics or full collision proof','Neutral fitting block is not a final film actor','Ground contact mask is a projected approximation, not path tracing','Vent recesses are not through-holes','390x844 viewport is not a physical phone','Engineering rewrite is not legal clearance or film-quality approval'],'scope':changed}
 write('DELIVERY.json',receipt)
 final=commit('test(hat-r11): record actual public output and performance without film-quality signoff')
 print(json.dumps({'evidenceCommit':final,'delivery':receipt},ensure_ascii=False),flush=True)
