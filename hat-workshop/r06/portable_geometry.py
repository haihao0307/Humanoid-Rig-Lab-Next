"""Compare computed coordinates, not source identity, across JS engines.
The interrupted first case differed in 1/43203 floats by 9.313225746e-10 m.
Source packages, input heads and repeated same-browser results stay byte-exact.
A 2e-8 m bound (0.00002 mm) applies only to derived cross-engine coordinates;
vertex order/count and finite values remain mandatory. No geometry is rounded.
"""
import hashlib,struct,math
from pathlib import Path
MAX_ERROR_M=2e-8

def compare_coordinates(actual,reference):
 raw=Path(reference).read_bytes()
 if len(raw)%4:return {'passed':False,'reason':'invalid reference buffer'}
 n=len(raw)//4
 if len(actual)!=n:return {'passed':False,'reason':'vertex component count differs','actual':len(actual),'expected':n}
 if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in actual):return {'passed':False,'reason':'non-finite coordinate'}
 expected=struct.unpack('<'+'f'*n,raw);encoded=struct.pack('<'+'f'*n,*actual)
 delta=[abs(x-y) for x,y in zip(actual,expected)]
 largest=max(delta,default=0);changed=sum(x!=y for x,y in zip(actual,expected))
 return {'passed':largest<=MAX_ERROR_M,'exactBytes':encoded==raw,'components':n,'differentComponents':changed,'maxErrorM':largest,'rmsErrorM':math.sqrt(sum(d*d for d in delta)/max(1,n)),'maximumAllowedM':MAX_ERROR_M,'referenceSHA256':hashlib.sha256(raw).hexdigest(),'browserSHA256':hashlib.sha256(encoded).hexdigest()}

def self_test():
 import tempfile
 with tempfile.TemporaryDirectory() as d:
  p=Path(d)/'v.bin';p.write_bytes(struct.pack('<fff',.01,.02,.03));v=list(struct.unpack('<fff',p.read_bytes()))
  assert compare_coordinates(v,p)['passed']
  near=v.copy();near[0]+=1e-9;assert compare_coordinates(near,p)['passed']
  bad=v.copy();bad[0]+=.0001;assert not compare_coordinates(bad,p)['passed']
  assert not compare_coordinates(v[::-1],p)['passed']
  assert not compare_coordinates(v[:-1],p)['passed']
  assert not compare_coordinates([float('nan'),*v[1:]],p)['passed']
 return True
