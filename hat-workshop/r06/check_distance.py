"""Sample all vertices and face centroids against real oriented head triangles.
No full continuous-collision, self-intersection, pressure or fabrication claim."""
from pathlib import Path
import json,numpy as np,gzip,base64,hashlib,time
from distance_check import TriangleDistance,summary
R=Path(__file__).resolve().parent;A=R.parent/'r03/assets';G=R/'qa/geometry-dump';Q=R/'qa/numeric';records=[];start=time.time()
ids=['cable','fishing','flatcap','visor','sherpa','trilby','bowler','top','patrol','cloche','chef']
for hid in ['native-default','long_narrow','short_broad']:
 h=json.loads(gzip.decompress((A/('head-'+hid+'.bin')).read_bytes()));dec=lambda s,t:np.frombuffer(gzip.decompress(base64.b64decode(s)),dtype=t);hp=dec(h['p'],'<f4').reshape(-1,3);ix=dec(h['i'],'<u4').reshape(-1,3);T=hp[ix];D=TriangleDistance(T[T[:,:,1].max(1)>-.16]);hh=hashlib.sha256(hp.tobytes()).hexdigest()
 for id in ids:
  stem=hid+'--'+id+'--';p=np.fromfile(G/(stem+'position.bin'),'<f4').reshape(-1,3);n=np.fromfile(G/(stem+'normal.bin'),'<f4').reshape(-1,3);f=np.fromfile(G/(stem+'index.bin'),'<u4').reshape(-1,3);thick={'cable':.0036,'sherpa':.0028}.get(id,0);inner=p-n*thick;pts=np.r_[inner,inner[f].mean(1)];pts=pts[pts[:,1]>-.08];d=D.query(pts);v=summary(d);v.update(hat=id,head=hid,headHash=hh,part='actual inner material' if thick else 'source-derived hat',generatedGeometryHash=hashlib.sha256(p.tobytes()).hexdigest(),passed=bool(np.all(d>=-.0001)),scope='all used vertices and all face centroids above -80mm; closest oriented source-head triangles');records.append(v);print('DIST',id,hid,v['minimumSignedMM'],v['passed'],flush=True)
  if (G/(stem+'band-position.bin')).exists():
   b=np.fromfile(G/(stem+'band-position.bin'),'<f4').reshape(-1,3);bi=np.fromfile(G/(stem+'band-index.bin'),'<u4').reshape(-1,3);dd=D.query(np.r_[b,b[bi].mean(1)]);v=summary(dd);v.update(hat=id,head=hid,part='generated finite inner band',passed=bool(np.all(dd>=-.0001)));records.append(v);print('BAND',id,hid,v['minimumSignedMM'],v['passed'],flush=True)
  if id=='cable':
   wall=TriangleDistance(p[f]).query(inner);v=summary(wall);v.update(hat=id,head=hid,part='inner-to-outer actual material distance; negative is inside outer wall',minimumNearestThicknessMM=float(abs(wall).min()*1000),passed=bool(np.all(wall<.0001) and abs(wall).min()>.0025));records.append(v);print('WALL',hid,v['minimumNearestThicknessMM'],v['passed'],flush=True)
report={'scope':'33 static source-head/category combinations, with actual inner bearing parts separately sampled. Below -80mm (cords/shoulders) is outside this head-fitting audit. Numeric geometry is matched byte-for-byte by browser QA. Not continuous collision, full self-intersection or pressure.','checks':records,'passed':all(r['passed'] for r in records),'seconds':time.time()-start};(Q/'DISTANCE_REPORT.json').write_text(json.dumps(report,indent=2));print('DISTANCE_RESULT',len(records),report['passed'],flush=True)
if not report['passed']:raise SystemExit(1)
