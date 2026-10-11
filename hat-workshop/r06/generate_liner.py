"""One-time, source-only reconstruction of the R05 liner correspondence.
The seed selects source groups/triangles, not fitted target coordinates. All
barycentric values are recomputed by rays through the immutable source mesh.
"""
from pathlib import Path
import base64,gzip,hashlib,json,struct,subprocess,tempfile
import numpy as np
R=Path(__file__).resolve().parent

def generate():
 seed=json.loads((R/'flatcap-ray-seed.json').read_text())
 compressed=base64.b64decode(seed['mapping'])
 assert hashlib.sha256(compressed).hexdigest()==seed['compressedSHA256']
 raw=gzip.decompress(compressed);count=struct.unpack('<I',raw[:4])[0]
 assert len(raw)==4+count*12 and count==4204
 groups=np.cumsum(np.frombuffer(raw,'<u2',count,4).astype('int64'))
 tri=np.frombuffer(raw,'<u2',count,4+count*2).astype('int64')
 weights=np.frombuffer(raw,'<f8',count,4+count*4)
 js="""import fs from 'node:fs';import zlib from 'node:zlib';import {regenerate} from './core.mjs';
 const x=JSON.parse(zlib.gunzipSync(fs.readFileSync('../r03/assets/flatcap.bin')));const m=regenerate(x.mother);
 console.log(JSON.stringify({sourceHash:x.mother.attribution.sourceOBJ_SHA256,origin:x.origin,position:Array.from(m.position),groups:Array.from(m.groups),index:Array.from(m.index)}));"""
 m=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=R))
 assert m['sourceHash']==seed['sourceOBJ_SHA256']
 p=np.array(m['position'],dtype=float).reshape(-1,3);ix=np.array(m['index']).reshape(-1,3)
 identity={}
 for i,g in enumerate(m['groups']):identity.setdefault(g,i)
 ids=np.array([identity[int(g)] for g in groups]);faces=ix[tri];O=np.array(m['origin'])+np.array(seed['originOffsetM']);directions=p[ids]-O
 a=p[faces[:,0]];e1=p[faces[:,1]]-a;e2=p[faces[:,2]]-a;T=O-a;H=np.cross(directions,e2);det=np.einsum('ij,ij->i',e1,H)
 assert np.all(abs(det)>1e-14)
 u=np.einsum('ij,ij->i',T,H)/det;Q=np.cross(T,e1);v=np.einsum('ij,ij->i',directions,Q)/det;t=np.einsum('ij,ij->i',e2,Q)/det
 assert np.all((u>=-1e-9)&(v>=-1e-9)&(u+v<=1+1e-9)&(t>1.001))
 pairs=[[int(g),int(f[0]),int(f[1]),int(f[2]),float(uu),float(vv),float(w)] for g,f,uu,vv,w in zip(groups,faces,u,v,weights)]
 text='/* Source-only ray reconstruction from declared groups/triangles. No target head or fitted vertices enter this construction map. */\nexport const LINER_PAIRS='+json.dumps(pairs,separators=(',',':'))+';\n'
 out=R/'flatcap-lining-map.mjs';out.write_text(text)
 print('Source-only liner groups',count,'SHA256',hashlib.sha256(out.read_bytes()).hexdigest())
if __name__=='__main__':generate()
