"""Original CC BY scan split into meso/micro/relief. No synthetic enlargement."""
from pathlib import Path
import os,hashlib,io,json,urllib.request,zipfile
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
D=Path(__file__).resolve().parent;A=D/'assets';A.mkdir(exist_ok=True)
URL='https://assets.renderman.pixar.com/Tutorials/photorealistic_head/10100_skin_shading_renderman_21.zip'
SHA='15e802b52dc5bdf0fdb0921c5801c41dd3aff7db3f1f0bdfcb9d407f283172c3'
if (A/'bands.json').exists():
 m=json.loads((A/'bands.json').read_text())
 if all((A/n).exists() and hashlib.sha256((A/n).read_bytes()).hexdigest()==x['sha256'] for n,x in m['outputs'].items()):
  print('Verified existing scan bands');raise SystemExit(0)
cache=os.environ.get('SKIN_REFERENCE_ZIP')
if cache:b=Path(cache).read_bytes()
else:
 with urllib.request.urlopen(URL,timeout=180) as r:b=r.read(200000000)
assert hashlib.sha256(b).hexdigest()==SHA
z=zipfile.ZipFile(io.BytesIO(b));raw=Image.open(io.BytesIO(z.read('Skin_Shading/sourceimages/disp.tif')))
assert raw.size==(8192,8192) and np.asarray(raw).dtype==np.uint16
h=np.array(Image.fromarray(np.asarray(raw).astype(np.float32)/65535).resize((4096,4096),Image.Resampling.LANCZOS),dtype=np.float32)
del raw,b,z
sm1=gaussian_filter(h,1.0);sm7=gaussian_filter(h,7.0);sm24=gaussian_filter(h,24.0)
def normal(band,scale,name):
 dy,dx=np.gradient(band);sx=np.clip(-dx*scale,-2.5,2.5);sy=np.clip(dy*scale,-2.5,2.5);inv=1/np.sqrt(1+sx*sx+sy*sy)
 n=np.stack([sx*inv,sy*inv,inv],axis=-1)
 Image.fromarray(np.uint8(np.rint((n*.5+.5)*255))).save(A/name,format='WEBP',lossless=True,method=0)
normal(sm1-sm7,95,'meso.webp');normal(h-sm1,150,'micro.webp')
cavity=np.clip(.5+(h-sm7)*16,0,1);relief=np.clip(.5+(sm7-sm24)*3,0,1);rough=np.clip(.5+(sm1-sm7)*8,0,1)
rgb=np.stack([cavity,rough,relief],axis=-1)
Image.fromarray(np.uint8(np.rint(rgb*255))).save(A/'surface.webp',format='WEBP',lossless=True,method=0)
m={'schema':'kaopu/skin-bands@2','source':URL,'archive_sha256':SHA,'original':'Infinite 3D Head Scan, Lee Perry-Smith, CC BY 3.0','source_resolution':[8192,8192],'source_dtype':'uint16','runtime_resolution':[4096,4096],'method':'Scan frequency partition: micro sigma1 highpass; meso sigma1-7; relief sigma7-24. Artistic gains, not calibrated anatomical pore depth. No upscaling.','outputs':{}}
for p in A.iterdir():
 if p.suffix=='.webp':m['outputs'][p.name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(A/'bands.json').write_text(json.dumps(m,indent=2));print(json.dumps(m,indent=2))
