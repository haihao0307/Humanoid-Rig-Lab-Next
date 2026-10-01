"""Lossless packing of generator coefficients, not source mesh arrays."""
from pathlib import Path
import json,gzip,struct
ROOT=Path(__file__).parent
d=json.loads(gzip.decompress((ROOT/'qa/coefficients.json.gz').read_bytes()));arrays=[];chunks=[];pool={}
def varint(values):
 out=bytearray()
 for value in values:
  z=(int(value)<<1)^(int(value)>>31)
  while z>127:out.append((z&127)|128);z>>=7
  out.append(z)
 return bytes(out)
def pack(values,stride=1):
 if not values:return values
 key=tuple(values)
 if key in pool:return {'$array':pool[key]}
 best=None
 for order in (0,1):
  predicted=values if order==0 else [v-(values[i-stride] if i>=stride else 0) for i,v in enumerate(values)]
  raw=varint(predicted);score=len(gzip.compress(raw,9,mtime=0))
  if best is None or score<best[0]:best=(score,raw,order)
 index=len(arrays);pool[key]=index;arrays.append({'count':len(values),'bytes':len(best[1]),'order':best[2],'stride':stride});chunks.append(best[1]);return {'$array':index}
for c in d['charts']:
 for k in ('height','weights','appearance','normals'):
  if k not in c:continue
  f=c[k]
  for layer in f['layers']:layer['ids']=pack(layer['ids']);layer['c']=pack(layer['c'],f['channels'])
 for trim in c['trim']:trim['uv']=pack(trim['uv'],2);trim['seams']=pack(trim['seams'])
for clip in d['animations']:
 for track in clip['tracks']:
  dim=4 if track['type']=='quaternion' else 3
  track['times']=pack([round(t*1e7) for t in track['times']]);track['values']=pack([round(v*1e7) for v in track['values']],dim);track['unit']=1e-7
metadata=json.dumps({'arrays':arrays,'data':d},separators=(',',':')).encode();raw=b'PHFP0001'+struct.pack('<II',len(metadata),len(arrays))+metadata+b''.join(chunks);payload=gzip.compress(raw,9,mtime=0);temp=ROOT/'qa/parameters.next.phf.gz';temp.write_bytes(payload);temp.replace(ROOT/'parameters.phf.gz')
r=json.load(open(ROOT/'fit-report.json'));r['unpackedJsonGzipBytes']=(ROOT/'qa/coefficients.json.gz').stat().st_size;r['parametersBytes']=len(payload);r['packedDecodedBytes']=len(raw);r['reductionPercent']=round((1-len(payload)/r['referenceZipBytes'])*100,2);r['codec']='shared coefficient arrays + signed delta varint + gzip, lossless';json.dump(r,open(ROOT/'fit-report.json','w'),indent=2);print(json.dumps({'bytes':len(payload),'raw':len(raw),'coefficientArrays':len(arrays)}))
