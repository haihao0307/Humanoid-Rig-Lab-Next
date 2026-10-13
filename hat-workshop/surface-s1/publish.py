from pathlib import Path
import os,json,subprocess,argparse,hashlib,urllib.request,time
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
BRANCH='feature/hat-procedural-surface-s1-20261013'
P=argparse.ArgumentParser();P.add_argument('stage',choices=['build','receipt']);P.add_argument('--source',required=True);P.add_argument('--build');A=P.parse_args()
assert os.environ.get('GITHUB_REF_NAME')==BRANCH,'Wrong branch; stop'
def run(*a):subprocess.run(list(a),cwd=ROOT,check=True)
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT,text=True).strip()
def read(p):return json.loads((R/p).read_text())
def url(b):return 'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+b+'/hat-workshop/surface-s1/index.html#hat=cable'
def commit(message,paths):
 assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==git('rev-parse','HEAD'),'Concurrent update; no force/rebase'
 run('git','add',*[str(R/p) for p in paths]);staged=git('diff','--cached','--name-only').splitlines();assert staged and all(p.startswith('hat-workshop/surface-s1/') for p in staged)
 run('git','commit','-m',message+' [skip ci]');run('git','push','origin','HEAD:'+BRANCH);return git('rev-parse','HEAD')
run('git','config','user.name','github-actions[bot]');run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
if A.stage=='build':
 assert git('rev-parse','HEAD')==A.source
 local=read('qa/local/report.json');m=read('BUILD_MANIFEST.json');assert local['passed'] and len(local['hats'])==11 and local['source']==m['sourceSha']==A.source
 built=commit('build(hat-surface): publish verified procedural surface candidate',['index.html','BUILD_MANIFEST.json','vendor','qa/local/report.json'])
 with open(os.environ['GITHUB_OUTPUT'],'a')as f:f.write('build='+built+'\nurl='+url(built)+'\n')
 print(json.dumps({'source':A.source,'build':built,'url':url(built),'publicVerified':False}),flush=True)
else:
 assert A.build and git('rev-parse','HEAD')==A.build
 local=read('qa/local/report.json');public=read('qa/public/report.json');m=read('BUILD_MANIFEST.json')
 assert local['passed'] and public['passed'] and len(local['hats'])==len(public['hats'])==11
 assert local['source']==public['source']==m['sourceSha']==A.source and public['url']==url(A.build)
 raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+A.build+'/hat-workshop/surface-s1/index.html'
 for i in range(4):
  try:
   data=urllib.request.urlopen(raw,timeout=90).read();assert hashlib.sha256(data).hexdigest()==m['htmlSHA256'];break
  except Exception:
   if i==3:raise
   time.sleep(3)
 receipt={'version':'HAT-SURFACE-S1','sourceSha':A.source,'buildSha':A.build,'publicURL':url(A.build),'htmlSHA256':m['htmlSHA256'],'publicVerified':True,'localChecks':len(local['checks']),'publicChecks':len(public['checks']),'hats':11,'all11OriginalControlUVColorPayloadUnchanged':True,'surfaceTexturesSampled':0,'geometryDisplacedBySurface':False,'shapeBoundField':True,'EB1':m['eb1Commit'],'userAccepted':False,'filmReady':False,'equivalentToSource':False,'limits':['Original geometry/UV and reference image assets remain attributed; this is a surface-system rewrite only','Relief is shading-only: no true yarn silhouette, self-shadow or mechanics','Per-component material-region mapping and reference-equivalent visual quality remain under review','Original HD normal files only load when reference mode is explicitly selected','SwiftShader browser tests are not user GPU frame-rate certification','Mobile test is viewport only']}
 (R/'DELIVERY.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
 evidence=commit('test(hat-surface): preserve all11 public geometry and shader evidence',['qa/public/report.json','DELIVERY.json'])
 print(json.dumps({'evidence':evidence,'delivery':receipt},ensure_ascii=False),flush=True)
