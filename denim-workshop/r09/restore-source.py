"""One-time source transfer, not a runtime asset or a mesh blob.
Reconstructs exact, editable JS/HTML/Python modules from a frozen parent.
Canonical files, once present, must be edited directly and built with build.py.
Never mutates R08 or an unrelated workbench.
"""
from pathlib import Path
import base64,hashlib,json,zlib
P=Path(__file__).resolve().parent;OLD=P.parent/'r08'
def sha(data):return hashlib.sha256(data).hexdigest()
assert not (P/'app.js').exists(),'Canonical source exists; use build.py, do not rerun restoration'
assert sha((OLD/'index.html').read_bytes())=='6f9000811b7c3b3a4be2f31e21cea5cb42ccb4632478727d20b7fc49e8862acf'
parts=['transfer-0.txt']+[f'source-{k}{c}.txt' for k in (1,2) for c in 'abcde']+['transfer-3.txt']
expected={'source-1a.txt':'f10336ab575ba077a29ab88a04c9fdfc4d3116bb5ed18b9577b479113fab0de7','source-1b.txt':'589f66008f9720613d596af8b17bb4f1eec5b4b68a895fa3c60e1c2fec268314','source-1c.txt':'5364ac36d776a4af22ce81c2fbfd9cb87abaf028f3fbd89e515fc6787272d0da','source-1d.txt':'4f7b3bc9c94cc33003cdbde8cfe226d64829e214ce40da69fd8cf5cdd23b23a1','source-1e.txt':'7a8f18fcd888960e9c2bc6da557339945009610d3ff3b6416cef6c663a0111e8','source-2a.txt':'b8a66f655ff081ed084ab26ba169572adef83ec2e7bcc0a74f83d80726a5a311','source-2b.txt':'ee169b36291f27adcfba1b6643333afd341d55a79ee5b5422a781b86babed66e','source-2c.txt':'068af345a3e86d6883ba1a193e86207acdbb3ea3d38c0250ce05c5abe0c781f1','source-2d.txt':'8152650aaa8492dbc0a33b8a9d9ea621996804d3c70115bb6fa23917dee8c49f','source-2e.txt':'cce5f0870a33b2521f69288f8dfd53626af76f623a556763d161ddc27db63499'}
for name,wanted in expected.items():assert sha((P/name).read_bytes())==wanted,('Corrupt source segment',name)
packed=''.join((P/name).read_text().strip() for name in parts)
payload=zlib.decompress(base64.b64decode(packed,validate=True))
assert sha(payload)=='dc5b128cf277f7c690e39b6547d884760e63731d884c40b6af95dfa82f482300'
records=json.loads(payload);allowed={'app.js','sampling.js','template.html','build.py','runtime-budget.js','stitches.js','dynamics.js','test-budget.cjs'}
assert set(records)==allowed
staged={}
for name,record in records.items():
 if 'parent' in record:
  data=(OLD/name).read_bytes();assert sha(data)==record['parent'],('Parent changed',name)
  text=data.decode();previous=len(text)
  for start,end,replacement in reversed(record['ops']):
   assert 0<=start<=end<=previous
   text=text[:start]+replacement+text[end:];previous=start
 else:text=record['text']
 data=text.encode();assert sha(data)==record['target'],('Target mismatch',name)
 staged[name]=data
copies={'core.js':'f47bc9f6c25a3da20e99c9e4dc2e0201af5499ed4832a2ea2ad916120b103fb7','cotton-surface.js':'4880621ddb3d658e3697801b01e2e32680b91f4f532ac5f0d69627d0018dc65f','natural-yarn.js':'11c470a9538e8c815dfebb4849ec2c94327eb7204709d33853cc4f483e2760aa','fiber-optics.js':'8aa99b3ab475c4a0e1b6127ed61357ee416250ed9abfada250f0d10cde090701','structure.js':'6b9c08bb4b47f68e3a458714af5ee5a6d9b38c78ad3312e8e8c2776ad59b5507','test-stability.cjs':'de16acad7855cd0622c52129d7b73882f3d395600498c7cc282de0c8236ce4db','test-cotton.cjs':'b29825ac961abaec310c8f71f0e6381e4b42ef680eb430372045ccddb1b888ba','test-layers.cjs':'fbbca793570ed613fc7ae85ddc528cc6aca0cc2f21af76f097acd7b5ae566800'}
for name,wanted in copies.items():
 data=(OLD/name).read_bytes();assert sha(data)==wanted,('Protected module changed',name);staged[name]=data
for name,data in staged.items():assert not (P/name).exists(),('Refuse overwrite',name)
for name,data in staged.items():(P/name).write_bytes(data)
print('Restored',len(staged),'canonical modules with verified source hashes; R08 unchanged')
