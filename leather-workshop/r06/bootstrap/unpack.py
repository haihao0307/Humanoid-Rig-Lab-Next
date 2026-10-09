from pathlib import Path
import base64,hashlib,json,zlib
r=Path(__file__).resolve().parent
h=lambda x:hashlib.sha256(x.encode()).hexdigest()
a=(r/'part-0.b64').read_text().strip().replace('Lx+elIcIcHXMuo','Lx+elIcHXMuo')
b=(r/'part-1.b64').read_text().strip()
blocks=[a,b]
print('PART',0,len(a),h(a));print('PART',1,len(b),h(b))
for i in range(20000,47488,2000):
 s=(r/f'tail-{i}.b64').read_text().strip()
 if i==44000:
  s=s.split('97a9+',1)[0]+'97a9+'+'8rtf/LPXP/23r3/8b+qZilNlxfJ8bQ7hO77/4MHuU5rBymxFmCVVE+nA8Ypi7ps7YaJN3XPtwA5Mx0ALkRm7mFoeGZGReamTRr4Tx7qeBa4V20nueo7reDq6crI8C5xEd2WPZQdrogJFP74e+Gaa5Iaf2pFveXbuWVkS+24aWYbtxG4a25ln6Hbi52lqpbqtO27keWbkZlZmZ0v9lMcJReOmE+lBajiBlya26Ti+maV+bNux7uSxhdEabpzlcRTg2Y8zO02c3Hf9zHJN0470dKnxleMPopfY0zMrzQIAxbHMJNYzG/0leZB4Zq5HqaN7kePngWtHXmrkVpYlbhQlge2kieE58bpeqvMSoovEjHMn03U7Nz0HYLc9J7N1K3Uyy4jj1NNj08Jr03Rs2/Iz0zKDILCCOEp9M4i9bF0X1REL0YWX2q4JeJhRjHZtw3F1tO3lHpY+MaPASLLIALb7iZ+kvo8ly3Tf8WLPAEIkabSuC3nkseojjTInddMssT205dhWkLiGnaMbIFKUGLnuZpGPZTHc3NUdtO56loOiSexhcYJ1fbSixuWCWLpt55nvJL4Ps8Q1Az8H8viEr4GeeLqdmQkQNcYa61YcAflM3bMSywtAMEsLYq0hDj+2oiDL0yT1TAv/geqD1PVMO9OT3M+S'
 print('TAIL',i,len(s),h(s));blocks.append(s)
s=''.join(blocks);raw=zlib.decompress(base64.b64decode(s,validate=True))
actual=hashlib.sha256(raw).hexdigest()
assert actual=='2359bf05222e1a1dc54acf0783b00e74890c977af9e3074ec9d424c92b58b875',actual
root=r.parents[1]
for name,text in json.loads(raw).items():
 p=Path(name)
 assert not p.is_absolute() and '..' not in p.parts
 assert name.startswith('r06/') or name=='anchors/LEATHER_R051_ATELIER_ANCHOR.json',name
 dest=root/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(text)
print('VERIFIED SOURCE PAYLOAD',actual)
