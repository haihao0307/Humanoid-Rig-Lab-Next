"""Fresh CPU/source verification. No browser, network, workflow or release operation."""
from __future__ import annotations
import argparse,ast,base64,gzip,hashlib,importlib.util,json,os,re,shutil,subprocess,sys,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
checks=[]
def sha(b):return hashlib.sha256(b).hexdigest()
def check(name,passed,data=None):
    checks.append({'name':name,'pass':bool(passed),'data':data})
    if not passed:raise AssertionError(name)
def load(p,name):
    spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def constant(doc,name):
    hits=list(re.finditer(r'\bconst\s+'+re.escape(name)+r'\s*=',doc))
    if len(hits)!=1:raise ValueError('Ambiguous payload '+name)
    return json.JSONDecoder().raw_decode(doc[hits[0].end():])[0]
def command(args,env=None,timeout=300):
    p=subprocess.run(args,env=env,capture_output=True,text=True,timeout=timeout)
    if p.returncode:raise RuntimeError(p.stdout[-1500:]+p.stderr[-1500:])
    return p.stdout

def prepare_reference(target):
    migrate=load(ROOT/'materialize.py','frozen_migration')
    migrate.materialize(ROOT.parents[1],target)
    shutil.copy2(ROOT/'qa/reference/build-s1a.py',target/'build.py')
    shutil.copy2(ROOT/'qa/reference/assembly-s1a.json',target/'assembly.json')
    module=load(target/'build.py','frozen_reference')
    report=module.build()
    check('Independent frozen reference reproduces entire R10 HTML',report['htmlSHA256']=='7da84eec41b6db9fe69c62ea17a3194283522004df92f47f0cd707d11b642622')
    return module

def run(reference=None):
    start=time.time();builder=load(ROOT/'build.py','canonical_builder')
    lock=builder.verify_sources()
    for name,q in lock['files'].items():check('Canonical input: '+name,sha((ROOT/name).read_bytes())==q['sha256'])
    tree=ast.parse((ROOT/'build.py').read_text())
    check('Regular builder never executes historical source or imports runpy',not any(isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id in ('exec','eval') for n in ast.walk(tree)) and 'runpy' not in (ROOT/'build.py').read_text())
    build=builder.build();text=(ROOT/'out/candidate-r12-s1b.html').read_text();app=re.search(r'<script>([\s\S]*)</script>',text)[1]
    manifest=json.loads((ROOT/'assembly.json').read_text());candidate=builder.Linker(manifest)
    with tempfile.TemporaryDirectory(prefix='leather-s1b-verify-') as tmp:
        tmp=Path(tmp)
        if reference:
            ref=Path(reference).resolve();base=load(ref/'build.py','provided_reference')
            baseline=base.build();check('Provided reference is exact R10',baseline['htmlSHA256']==manifest['baselineHTMLSHA256'])
        else:ref=tmp/'reference';base=prepare_reference(ref)
        ref_manifest=json.loads((ref/'assembly.json').read_text());old=base.Linker(ref_manifest)
        changed={'panels','closed-shell','pattern-physics','assembly-contract','yarn-host'}
        for key in manifest['modules']:
            if key not in changed:check('Unchanged emitted module: '+key,candidate.module(key)==old.module(key))
        check('Retired overwritten adapter is absent from active assembly','surface-integrity' not in manifest['modules'] and '"surface-integrity"' not in json.dumps(manifest['main']))
        active=[ROOT/manifest['modules'][key]['file'] for key in changed]
        check('No active PanelAssembly prototype replacement or captured original method',all(not re.search(r'PanelAssembly\.prototype',p.read_text()) for p in active))
        a=(ROOT/'src/geometry/panels.js').read_text();b=(ref/'src/geometry/panels.js').read_text()
        check('Complete skin shader and frame update unchanged',a[a.index('const SKIN_HEADER='):].rstrip()==b[b.index('const SKIN_HEADER='):].rstrip())
        baseline_text=(ref/'out/reproduced-r10.html').read_text()
        for name in ['PRODUCT_WORKER_CODE','WORKER_CODE','LEGACY_CRAFT_GZIP','BASELINE_GZIP']:
            check('Immutable payload: '+name,constant(text,name)==constant(baseline_text,name))
        for key in ['scanData']:
            pattern=r'<div id="'+key+r'" hidden>(.*?)</div>'
            check('Immutable embedded '+key,re.search(pattern,text,re.S)[1]==re.search(pattern,baseline_text,re.S)[1])
        documents={'outer':app,'product':constant(text,'PRODUCT_WORKER_CODE'),'specimen':constant(text,'WORKER_CODE')}
        for key in ['LEGACY_CRAFT_GZIP','BASELINE_GZIP']:
            html=gzip.decompress(base64.b64decode(constant(text,key))).decode();documents[key]=re.search(r'<script>([\s\S]*)</script>',html)[1]
        for name,body in documents.items():
            p=tmp/(name+'.js');p.write_text(body);command(['node','--check',str(p)],timeout=30);check('Syntax: '+name,True)
        isolated=tmp/'isolated';shutil.copytree(ROOT,isolated,ignore=shutil.ignore_patterns('out','qa','__pycache__','node-lib.cjs','_canonical_paths.json'))
        ib=load(isolated/'build.py','isolated_canonical');check('Checkout builds without historical directories or migration',ib.build()['htmlSHA256']==build['htmlSHA256'])
        p=isolated/'src/app/runtime.js';raw=p.read_bytes();p.write_bytes(raw.replace(b"const VERSION='R10.0'",b"const VERSION='ADVERSARIAL'",1))
        rejected=False
        try:ib.build()
        except ValueError:rejected=True
        check('Changed source cannot silently pass or fallback',rejected)
        p.unlink();rejected=False
        try:ib.build()
        except (ValueError,FileNotFoundError):rejected=True
        check('Missing source cannot fallback',rejected)
        rejected=False
        try:ib.local('../escape')
        except ValueError:rejected=True
        check('Declared input cannot escape package',rejected)
        p.write_bytes(raw);part=isolated/'native/kernel-00.b64';part.write_text('invalid');rejected=False
        try:ib.build()
        except ValueError:rejected=True
        check('Corrupt pinned native payload cannot fallback',rejected)
        env={**os.environ,'BASE_LIB':str(ref/'node-lib.cjs')}
        for name,report_path,expected in [('qa-numeric.cjs','qa/numeric.json',18),('qa-interfaces.cjs','qa/s1b/interfaces.json',3),('qa-geometry-equivalence.cjs','qa/s1b/equivalence.json',25)]:
            (ROOT/report_path).unlink(missing_ok=True);command(['node',str(ROOT/name)],env=env,timeout=1800)
            result=json.loads((ROOT/report_path).read_text());count=result.get('cases',result.get('checks'))
            if isinstance(count,list):count=len(count)
            check('Fresh execution: '+name,result['pass'] and count==expected,{'cases':count})
    return {'schema':'kaopu/leather-s1b-verification@1','phase':'S1B1','pass':all(q['pass'] for q in checks),'checkCount':len(checks),'checks':checks,'numericalCases':18,'interfaceAssertions':3,'geometryCases':25,'full52StepTrajectories':6,'build':build,'elapsedSeconds':time.time()-start,'python':sys.version.split()[0],'node':subprocess.check_output(['node','--version'],text=True).strip(),'newBrowserChecks':0,'newPublicDeployment':False,'fullS1Complete':False,'runtimePromotionAllowed':False,'sourceCommit':os.environ.get('S1B_SOURCE_COMMIT','UNCOMMITTED_CANDIDATE')}
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--reference',type=Path);args=ap.parse_args();out=ROOT/'qa/s1b/SUMMARY.json';out.parent.mkdir(parents=True,exist_ok=True)
    try:result=run(args.reference)
    except Exception as e:
        out.write_text(json.dumps({'pass':False,'checks':checks,'error':str(e),'newBrowserChecks':0},indent=2)+'\n');raise
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['phase','pass','checkCount','numericalCases','geometryCases','newBrowserChecks']}))
