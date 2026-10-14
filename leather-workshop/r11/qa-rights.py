"""Static scope, recursive archive, and mutation gates. Not a legal opinion."""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,re,tempfile,subprocess
from html import unescape
from build import build,digest,payload,OLD_HASH,OLD_SINE,BASELINE_SHA256,ROOT
p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path,required=True);args=p.parse_args()
a=args.baseline.read_text();target=ROOT/'candidate.html';manifest=build(args.baseline,target);b=target.read_text()
checks=[]
def check(name,value,data=None):
 checks.append({'name':name,'pass':bool(value),'detail':data})
 if not value:raise AssertionError(name)
check('frozen input bytes unchanged',digest(args.baseline.read_bytes())==BASELINE_SHA256)
for name in ('PRODUCT_WORKER_CODE','WORKER_CODE'):
 check(name+' byte identity',payload(a,name)==payload(b,name))
# This exact code span includes Three.js, Poly2Tri, physical data constructors,
# yarn, closed shells, pattern triangulation, product generation and skin update.
def geometry(text):
 start=text.index('const T=(()=>{');end=text.index('const PRODUCT_WORKER_CODE=',start)
 return text[start:end]
check('entire geometry/engine prefix byte identity',geometry(a)==geometry(b),digest(geometry(b).encode()))
scan=lambda text:re.search(r'<div id="scanData" hidden>(.*?)</div>',text,re.S)[1]
check('all embedded scan-map bytes unchanged',scan(a)==scan(b))
all_docs={'outer':b}
for name in ('LEGACY_CRAFT_GZIP','BASELINE_GZIP'):
 all_docs[name]=gzip.decompress(base64.b64decode(payload(b,name))).decode()
for name,text in all_docs.items():
 check(name+' excludes old seed helpers',OLD_HASH not in text and OLD_SINE not in text)
 check(name+' includes new field',text.count('uint kaopuSeedWord(')==(2 if name=='LEGACY_CRAFT_GZIP' else 1))
 check(name+' excludes remote reference image',not re.search(r'<img[^>]+(?:src|data-src)=["\']https?://',text))
 for component in manifest['componentBoundary']['components']:
  notice=(ROOT/component['notice']).read_text()
  check(name+' carries '+component['id']+' full notice',notice in unescape(text))
 script=re.search(r'<script>(.*)</script>',text,re.S)[1]
 with tempfile.TemporaryDirectory() as tmp:
  f=Path(tmp)/'syntax.js';f.write_text(script);r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
  check(name+' JavaScript syntax',r.returncode==0,r.stderr or None)
check('no undeclared Adobe loader in compatibility page',"$('reference').dataset.src" not in all_docs['LEGACY_CRAFT_GZIP'])
check('new identity does not masquerade as R10 source',manifest['sourceCommit']!=manifest['inheritedSourceCommit'])
check('no automatic commercial or visual promotion',not manifest['promotionAllowed'] and not manifest['commercialLegalClearance'])
check('existing grants not revoked','No prior grant is revoked' in (ROOT/'OWNERSHIP_SCOPE.txt').read_text())
with tempfile.TemporaryDirectory() as tmp:
 bad=Path(tmp)/'tampered.html';bad.write_text(a+'\n');out=Path(tmp)/'should-not-exist.html'
 try:build(bad,out);rejected=False
 except ValueError:rejected=True
 check('modified baseline fails closed without output',rejected and not out.exists())
report={'version':manifest['version'],'scope':'targeted static engineering gates; no runtime or legal certification','checks':checks,'pass':all(x['pass'] for x in checks),'htmlSHA256':manifest['htmlSHA256'],'unresolved':['browser file navigation blocked by administrator','public deployment workflow write blocked by platform','new random pattern not visually accepted','third-party engine code still remains permissively licensed']}
(ROOT/'qa').mkdir(exist_ok=True);(ROOT/'qa/rights.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pass':report['pass'],'checks':len(checks),'htmlSHA256':report['htmlSHA256']},indent=2))
