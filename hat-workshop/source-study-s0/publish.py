from pathlib import Path
import argparse,json,os,subprocess,hashlib,urllib.request,shutil
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
BRANCH='study/hat-source-decomposition-all11-20261013';BASE='82cc74f3009c7b669bbf55ea9eb8b242738876c1'
P=argparse.ArgumentParser();P.add_argument('stage',choices=['build','receipt']);P.add_argument('--source');P.add_argument('--build');A=P.parse_args()
assert os.environ.get('GITHUB_REF_NAME')==BRANCH

def run(*a):subprocess.run(list(a),cwd=ROOT,check=True)
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT,text=True).strip()
def read(p):return json.loads((R/p).read_text())
def commit(message):
    run('git','add','hat-workshop/source-study-s0')
    staged=git('diff','--cached','--name-only').splitlines();assert all(p.startswith('hat-workshop/source-study-s0/') for p in staged)
    if staged:run('git','commit','-m',message+' [skip ci]');run('git','push','origin','HEAD:'+BRANCH)
    return git('rev-parse','HEAD')
def url(b):return 'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+b+'/hat-workshop/source-study-s0/index.html#hat=cable'
run('git','config','user.name','github-actions[bot]');run('git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
if A.stage=='build':
    source=git('rev-parse','HEAD');assert git('ls-remote','origin','refs/heads/'+BRANCH).split()[0]==source,'Branch changed; no stale push'
    shutil.rmtree(R/'qa',ignore_errors=True);(R/'DELIVERY.json').unlink(missing_ok=True)
    run('node','--check',str(R/'study.js'))
    run('python',str(R/'build.py'),'--reference',str(R.parent/'r09'),'--source',source)
    built=commit('build(hat-study): freeze all-eleven source-layer inspection candidate')
    with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('source='+source+'\nbuild='+built+'\nurl='+url(built)+'\n')
    print(json.dumps({'source':source,'build':built,'url':url(built),'publicVerified':False}))
else:
    assert A.source and A.build and git('rev-parse','HEAD')==A.build,'Branch moved; reconcile before evidence'
    local=read('qa/local/report.json');public=read('qa/public/report.json');m=read('BUILD_MANIFEST.json');audit=read('AUDIT.json')
    assert local['passed'] and public['passed'] and len(local['hats'])==len(public['hats'])==11
    assert local['source']==public['source']==m['sourceSha']==audit['sourceSha']==A.source and public['url']==url(A.build)
    raw='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+A.build+'/hat-workshop/source-study-s0/index.html'
    assert hashlib.sha256(urllib.request.urlopen(raw,timeout=90).read()).hexdigest()==m['htmlSHA256']
    run('git','fetch','--depth=1','origin',BASE);scope=git('diff','--name-only',BASE,'HEAD').splitlines()
    assert all(p.startswith('hat-workshop/source-study-s0/') or p=='.github/workflows/hat-source-study-s0.yml' for p in scope)
    for p in ['qa/public/desktop.png','qa/public/cable-complete.png','qa/public/cable-shape.png','qa/public/chef-shape.png']:
        assert (R/p).is_file();run('git','add','-f','hat-workshop/source-study-s0/'+p)
    receipt={'version':'HAT-STUDY-S0','sourceSha':A.source,'buildSha':A.build,'publicURL':url(A.build),'htmlSHA256':m['htmlSHA256'],'publicVerified':True,'referenceIdentityVerifiedForAll11':True,'geometryAndCameraUnchangedBetweenLayers':True,'normalMaps':audit['observations']['normalMapCount'],'allControlAndTextureHashesVerified':True,'localChecks':len(local['checks']),'publicChecks':len(public['checks']),'reconstructionComplete':False,'filmReady':False,'userAccepted':False,'scope':scope,'limits':['Reference restoration and study, not self-owned reconstruction','Original author production files may be unavailable; no production-history claims','Source maps still require original HD transfer','Topology components and UV islands are not automatically sewing patterns','Viewport test is not phone hardware']}
    (R/'DELIVERY.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2));evidence=commit('test(hat-study): retain all-eleven pixel comparisons and source audit')
    print(json.dumps({'evidence':evidence,'delivery':receipt},ensure_ascii=False))
