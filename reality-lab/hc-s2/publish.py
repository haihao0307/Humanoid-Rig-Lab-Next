"""Append only the new authored S2 viewer and encrypted observation, never private source."""
from pathlib import Path
import json,hashlib,urllib.request,urllib.parse,zipfile,io,subprocess,os,re
ROOT=Path(__file__).resolve().parent
r=json.loads((ROOT/'PUBLISH_REQUEST.json').read_text())
assert r['sourceRepository']=='haihao0307/Human-Clothing-Workbench' and r['nativeBrowserPassed'] is True
assert re.fullmatch('[0-9a-f]{40}',r['sourceCommit']) and re.fullmatch('[0-9a-f]{64}',r['artifactSHA256'])
u=urllib.parse.urlsplit(r['artifactURL']);assert u.scheme=='https' and u.hostname.endswith('.oaiusercontent.com')
raw=urllib.request.urlopen(r['artifactURL'],timeout=90).read()
assert hashlib.sha256(raw).hexdigest()==r['artifactSHA256'],'Sealed web artifact changed'
with zipfile.ZipFile(io.BytesIO(raw)) as z:
    entries=[x for x in z.infolist() if not x.is_dir()]
    assert len(entries)==2 and {x.filename for x in entries}=={'preview.html','BUILD_PUBLIC.json'}
    assert all(x.file_size<2000000 for x in entries)
    files={x.filename:z.read(x) for x in entries}
m=json.loads(files['BUILD_PUBLIC.json']);assert m['sourceCommit']==r['sourceCommit'] and m['version']=='REALITY-HC-S2'
assert len(files['preview.html'])==m['htmlBytes'] and hashlib.sha256(files['preview.html']).hexdigest()==m['htmlSHA256']
for k in ['privateSourceCodePublished','privateHumanMeasurementsPublished','plaintextPatternPublished','keyPublished','originalSourceModified','productionReady']:assert m[k] is False,k
html=files['preview.html'].decode();assert '#key=' not in html and 'PRIVATE_ACCESS.json' not in html
assert 'const SEALED=' in html and 'const BUILD=' in html
rel='reality-lab/hc-s2/releases/s2-'+r['sourceCommit'][:12]
dest=Path(rel);assert not dest.exists(),'Frozen version already exists; no overwrite'
dest.mkdir(parents=True)
for name,b in files.items():(dest/name).write_bytes(b)
receipt={'version':'REALITY-HC-S2','sourceCommit':r['sourceCommit'],'sourceRepository':r['sourceRepository'],'sourceRun':r['sourceRun'],'artifactSHA256':r['artifactSHA256'],'path':rel+'/preview.html','htmlSHA256':m['htmlSHA256'],'htmlBytes':m['htmlBytes'],'status':'PUBLISHED_AWAITING_PRIVATE_PUBLIC_BROWSER','publicBrowserVerified':False,'accessKeyIncluded':False,'oldS1Preserved':True,'originalNativeFilesChanged':False,'publishedFiles':sorted(files)}
(ROOT/'PUBLISH_STAGE.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
def git(*a):return subprocess.check_output(['git',*a],text=True).strip()
base='09d927fd467b5e855388b37cc27f2a8114391e57'
git('fetch','--filter=blob:none','--depth=1','origin',base)
changed=git('diff','--name-only',base,'HEAD').splitlines()
assert all(p.startswith('reality-lab/hc-s2/') or p=='.github/workflows/reality-hc-s2-public.yml' for p in changed)
git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
git('add','-f',rel,'reality-lab/hc-s2/PUBLISH_STAGE.json');git('commit','-m','publish(reality-s2): freeze sealed interactive pattern inspection web')
public=git('rev-parse','HEAD');git('push','origin','HEAD:refs/heads/feature/reality-contract-hc-s2-20261018')
url='https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+public+'/'+rel+'/preview.html'
print(json.dumps({'publicCommit':public,'url':url,'sourceCommit':r['sourceCommit'],'htmlSHA256':m['htmlSHA256']},indent=2))
Path('/tmp/REALITY_S2_PUBLIC_STAGE.json').write_text(json.dumps({**receipt,'publicCommit':public,'url':url},indent=2))
