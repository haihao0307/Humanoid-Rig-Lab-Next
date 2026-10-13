"""R10.2 source/build/evidence stages; writes only the isolated iteration branch."""
from pathlib import Path
import os,subprocess,json,hashlib,time,urllib.request,argparse,shutil
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
BRANCH='feature/hat-owned-r102-20261013';BASE='10fd9d75cecace08e0d7cd46fe77de7d553a71b2'
P=argparse.ArgumentParser();P.add_argument('stage',choices=['prepare','finish']);P.add_argument('--source');P.add_argument('--build');A=P.parse_args()
assert os.environ.get('GITHUB_REF_NAME')==BRANCH,'Unexpected branch'
def run(*cmd,timeout=180):subprocess.run(list(cmd),cwd=ROOT,check=True,timeout=timeout)
def git(*cmd):return subprocess.check_output(['git',*cmd],cwd=ROOT,text=True).strip()
def read(name):return json.loads((R/name).read_text())
def commit(message):
 run('git','add','hat-workshop/owned-r10');staged=git('diff','--cached','--name-only').splitlines()
 assert all(p.startswith('hat-workshop/owned-r10/') for p in staged),staged
 if staged:run('git','commit','-m',message+' [skip ci]');run('git','push','origin','HEAD:'+BRANCH)
 return git('rev-parse','HEAD')
def address(sha):
 raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/hat-workshop/owned-r10/index.html'
 return raw,'https://htmlpreview.github.io/?'+raw+'#hat=pinch'
run('git','config','user.name','github-actions[bot]');run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
if A.stage=='prepare':
 run('python',str(R/'iterate-r102.py'))
 shutil.rmtree(R/'qa',ignore_errors=True);(R/'DELIVERY.json').unlink(missing_ok=True)
 p=R/'README.md';text=p.read_text().replace('HAT-R10.1','HAT-R10.2').replace('## 本轮修正','## 继承的 R10.1 修正')
 if '## R10.2 新增修正' not in text:text+='\n\n## R10.2 新增修正\n\n凹冠深度按头顶净空约束；材质改写整数格点噪声并限制边缘法线尖峰；十一款缩略图改走与主画布相同的显示变换与灯光配置。只保留一个渲染器，并在缩略图绘制后恢复主画布尺寸。新增 test-r102.cjs 与 qa-r102.py；源码、构建、公网验收分开记录。新版固定地址以 DELIVERY.json 为准，旧固定提交网页不改变。\n'
 p.write_text(text)
 (R/'THIRD_PARTY_NOTICES.txt').write_bytes((R/'node_modules/three/LICENSE').read_bytes())
 source=commit('feat(hat-r10.2): freeze readable crown, surface and display-pipeline iteration')
 for name in ['catalog','shape','material','viewer']:run('node','--check',str(R/'src'/(name+'.js')))
 for name in ['test-core.cjs','test-r101.cjs','test-r102.cjs']:run('node',str(R/name))
 run('python',str(R/'build.py'),'--source',source)
 built=commit('build(hat-r10.2): freeze independent candidate for real browser verification')
 raw,url=address(built)
 with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('source='+source+'\nbuild='+built+'\nurl='+url+'\n')
 print(json.dumps({'source':source,'build':built,'url':url,'publicVerified':False}),flush=True)
else:
 assert A.source and A.build and git('rev-parse','HEAD')==A.build,'Candidate branch changed; refuse stale receipt'
 manifest=read('BUILD_MANIFEST.json')
 reports={name:read('qa/'+name+'/report.json') for name in ['browser','public','browser-r102','public-r102']}
 units={name:read('qa/'+name+'.json') for name in ['core','r101','r102']}
 assert all(r.get('passed') for r in [*reports.values(),*units.values()])
 assert all(r['source']==A.source for r in reports.values()) and manifest['sourceSha']==A.source
 assert all(r['version']=='HAT-R10.2' for r in [manifest,*units.values()])
 raw,url=address(A.build);assert reports['public']['url']==url and reports['public-r102']['url']==url
 for i in range(6):
  try:
   data=urllib.request.urlopen(raw,timeout=60).read();assert hashlib.sha256(data).hexdigest()==manifest['htmlSHA256'];break
  except Exception:
   if i==5:raise
   time.sleep(3)
 run('git','fetch','--depth=1','origin',BASE)
 changed=git('diff','--name-only',BASE,'HEAD').splitlines()
 assert all(x.startswith('hat-workshop/owned-r10/') or x=='.github/workflows/hat-owned-r102.yml' for x in changed),changed
 images=['qa/public/desktop.png','qa/public/braid-three.png','qa/public/pleat-three.png','qa/public-r102/pinch-top.png','qa/public-r102/desktop.png']
 for image in images:assert (R/image).is_file();run('git','add','-f','hat-workshop/owned-r10/'+image)
 receipt={'version':'HAT-R10.2','sourceSha':A.source,'buildSha':A.build,'parentReceipt':BASE,'publicURL':url,'htmlSHA256':manifest['htmlSHA256'],'publicVerified':True,'browserVerified':True,'userAccepted':False,'entryBytes':manifest['entryBytes'],'checks':{**{n:len(r['checks']) for n,r in units.items()},**{n:len(r['checks']) for n,r in reports.items()}},'localPerformance':reports['browser']['performance'],'publicPerformance':reports['public']['performance'],'publicBootToReadyMS':reports['public']['bootToReadyMS'],'evidenceScreenshots':images,'runtimeChanges':['bounded true crown recess','independent integer procedural noise','three-axis microfilter and bounded normal perturbation','display-sRGB tone-mapped thumbnails with same studio configuration'],'oldR09Modified':False,'oldFixedR101URLChanged':False,'thirdPartyEngine':'Three.js 0.179.1 MIT; not first-party','externalHatAssetsRequired':False,'mobileScope':'390x844 viewport only; no physical phone','limits':['three procedural test heads, not the original scanned head','static fit, not full collision/dynamics or cloth simulation','crease roof sample tests do not establish whole-surface no-intersection','not formal personnel-isolated clean-room or legal clearance'],'scope':changed}
 (R/'DELIVERY.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
 final=commit('test(hat-r10.2): retain all fresh reports and verified public delivery receipt')
 print(json.dumps({'evidence':final,'delivery':receipt},ensure_ascii=False),flush=True)
