import os,json,time,urllib.request,hashlib
base='https://haihao0307.github.io/Humanoid-Rig-Lab-Next/'
expected=os.environ['EXPECTED_SHA'];deadline=time.monotonic()+600
while True:
 try:
  with urllib.request.urlopen(base+'character02/BUILD_MANIFEST.json?commit='+expected,timeout=30)as r:manifest=json.load(r)
  if manifest.get('sourceCommit')==expected:break
 except Exception as error:print('Waiting for current Pages version:',str(error),flush=True)
 if time.monotonic()>deadline:raise RuntimeError('Public CDN did not expose the expected commit within deployment observation window')
 time.sleep(15)
with urllib.request.urlopen(base+'character02/?commit='+expected,timeout=90)as r:data=r.read()
assert hashlib.sha256(data).hexdigest()==manifest['htmlSha256'],'Published standalone content mismatch'
with urllib.request.urlopen(base+'?character02='+expected,timeout=30)as r:old=r.read()
assert hashlib.sha1(b'blob '+str(len(old)).encode()+b'\0'+old).hexdigest()=='b16db0e09bb3f30df891cae9696020995b501dce','Existing homepage changed'
print(json.dumps({'verified':True,'sourceCommit':expected,'character02':base+'character02/','oldHomepageUnchanged':True}))
