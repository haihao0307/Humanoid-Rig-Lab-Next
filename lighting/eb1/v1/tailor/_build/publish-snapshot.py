import pathlib,json,os,sys,subprocess,shutil,hashlib,gzip,struct,time
runtime=pathlib.Path(sys.argv[1]).resolve();project=pathlib.Path(sys.argv[2]).resolve()
branch='fix/tailor-mp04-playback-finish-20261013';prefix='kaopu-tailor-workbench/material-products/r04-4-1'
request=os.environ['GITHUB_SHA'];digest=lambda b:hashlib.sha256(b).hexdigest()
def git(*args,cwd=project,check=True):
 p=subprocess.run(['git',*args],cwd=cwd,check=check,text=True,capture_output=True)
 if check and p.stderr and p.returncode:print(p.stderr)
 return p.stdout.strip() if check else p
before=json.loads((runtime/'PHYSICAL_PARENT_HASHES.json').read_text())
for name,expected in before.items():assert digest((runtime/name).read_bytes())==expected,'Physical source changed: '+name
clips=json.loads((runtime/'clips/index.json').read_text());assert len(clips['clips'])==9
summaries=[]
for item in clips['clips']:
 data=(runtime/'clips'/item['file']).read_bytes();assert digest(data)==item['sha256']
 raw=gzip.decompress(data);magic,n=struct.unpack_from('<II',raw);assert magic==0x3430504d
 h=json.loads(raw[8:8+n]);assert h['proof']['passed'] and h['frameCount']==181 and h['recipe']==item['recipe']
 for check in h['proof']['checks']:
  assert check['bodyMinimumSampleMM']>=-.1
  assert check['pairMinimumSampleMM']>=check['pairTargetMM']-.1
 summaries.append({'look':item['look'],'motion':item['motion'],'frameCount':h['frameCount'],'maxEdgeStretch':h['proof']['maxEdgeStretch'],'minSampledBodyMM':h['proof']['minSampledBodyMM'],'minSampledPairMM':h['proof']['minSampledPairMM'],'sampledFrames':h['proof']['sampledFrames'],'bakeWallTimeMS':h['proof']['wallTimeMS'],'bytes':len(data),'sha256':item['sha256']})
(runtime/'PHYSICS_REUSE.json').write_text(json.dumps({'samePhysicsFiles':True,'parentRun':38350576867,'parentCommit':'44ee0e6286161893678df41e74bd4181e0dc8d99','hashes':before,'motionProtocol':'MP04.2','runtimeVersion':'MP04.4.1','scope':'presentation clock and transport only; all physical states, original person, material metrics and geometry preserved','materialCalibrated':False,'continuousCollision':False,'fullSelfCollision':False,'clips':summaries},ensure_ascii=False,indent=2))
(runtime/'CANDIDATE_SOURCE_COMMIT.txt').write_text(request+'\n')
(runtime/'SOURCE_SNAPSHOT.json').write_text(json.dumps({'version':'MP04.4.1','buildRequest':request,'frozenParentRuntime':'44ee0e6286161893678df41e74bd4181e0dc8d99','runtimeArtifactsNoLongerRequiredForRecovery':True,'userAccepted':False,'physicalDeviceTested':False},indent=2))
# The old migration is retained for provenance but cannot overwrite this snapshot.
p=runtime/'_build/bootstrap.py';s=p.read_text();guard="\nif (r/'SOURCE_SNAPSHOT.json').exists():\n print('Frozen complete source: migration intentionally skipped');sys.exit(0)\n"
s=s.replace('r=Path(__file__).resolve().parents[1]\n','r=Path(__file__).resolve().parents[1]\n'+guard,1);p.write_text(s)
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
git('fetch','origin',branch,'--depth=1');assert git('rev-parse','origin/'+branch)==request,'Source branch advanced; refuse overwrite'
git('sparse-checkout','add',prefix)
shutil.copytree(runtime,project/prefix,dirs_exist_ok=True)
git('add','-f','--',prefix);git('commit','-m','build(mp04.4.1): persist complete frozen runtime, native assets and solved actions [skip ci]')
source=git('rev-parse','HEAD');git('push','origin','HEAD:refs/heads/'+branch)
files={str(p.relative_to(runtime)):{'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())} for p in sorted(runtime.rglob('*')) if p.is_file() and p.name!='BUILD_MANIFEST.json'}
manifest={'version':'MP04.4.1','sourceCommit':source,'buildRequest':request,'files':files,'userAccepted':False,'physicalDeviceTested':False,'bakedMotionProtocol':'MP04.2','oldVersionsChanged':False}
(runtime/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
folder='kaopu-tailor-workbench/material-products/mp04-r4-1-'+source[:12]
work=project.parent/'public-worktree'
public=None
for attempt in range(5):
 git('fetch','--filter=blob:none','--depth=1','origin','gh-pages');base=git('rev-parse','origin/gh-pages')
 if not work.exists():
  git('worktree','add','--no-checkout','--detach',str(work),base)
  git('sparse-checkout','set','--cone',folder,cwd=work)
 git('checkout','--detach',base,cwd=work)
 dest=work/folder
 if dest.exists():
  assert (dest/'BUILD_MANIFEST.json').read_bytes()==(runtime/'BUILD_MANIFEST.json').read_bytes(),'Immutable path collision'
  public=base;break
 shutil.copytree(runtime,dest)
 git('add','-f','--',folder,cwd=work);git('commit','-m','deploy(mp04.4.1): stage immutable native material and motion snapshot',cwd=work)
 result=git('push','origin','HEAD:refs/heads/gh-pages',cwd=work,check=False)
 if result.returncode==0:public=git('rev-parse','HEAD',cwd=work);break
 print('Pages branch advanced; retrying on fresh public parent without force-push');time.sleep(2)
assert public,'Pages snapshot could not fast-forward'
url='https://haihao0307.github.io/guilin-dem-pipeline/'+folder+'/'
state={'sourceCommit':source,'publicCommit':public,'folder':folder,'fixedURL':url,'version':'MP04.4.1','request':request,'publicBrowserVerified':False,'oldVersionsChanged':False}
pathlib.Path('/tmp/MP04_PUBLIC_STAGE.json').write_text(json.dumps(state,indent=2))
with open(os.environ['GITHUB_OUTPUT'],'a') as f:
 f.write('url='+url+'\nsource='+source+'\npublic='+public+'\nfolder='+folder+'\n')
print(json.dumps(state,ensure_ascii=False,indent=2))
