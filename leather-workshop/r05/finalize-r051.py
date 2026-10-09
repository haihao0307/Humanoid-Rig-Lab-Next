"""R05.1 final geometry/appearance integration. All R04 dependencies remain read-only."""
from pathlib import Path
import io,json,hashlib,urllib.request
from PIL import Image
r=Path(__file__).resolve().parent
p=r/'site/seam.mjs';s=p.read_text()
s=s.replace('side*(p.layerThickness-p.groove+p.diameter*.47)','side*(p.layerThickness-p.diameter*.65)')
s=s.replace('sidePoint(p,hs[0],initialSide,initialSide)','sidePoint(p,hs[0],initialSide,0)')
a=s.index('function bridge(');b=s.index('function join(',a)
s=s[:a]+'''function bridge(a,b,side,slack,p){
 const dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L;
 const rx=Math.min(p.diameter*.95,L*.24),ry=p.diameter*(.65+.47)-p.groove;
 const out=[],steps=24;
 const add=(u,y)=>out.push([a[0]+ux*u,y,a[2]+uz*u]);
 for(let i=0;i<=steps;i++){const f=i/steps*Math.PI/2;add(rx*(1-Math.cos(f)),a[1]+side*ry*Math.sin(f));}
 const span=L-2*rx,amp=slack*Math.min(p.pitch*.18,span*span/(25*p.diameter)),N=Math.max(16,Math.ceil(span/.05));
 for(let i=1;i<=N;i++){const f=i/N;add(rx+span*f,a[1]+side*(ry+amp*Math.sin(Math.PI*f)**2));}
 for(let i=1;i<=steps;i++){const f=i/steps*Math.PI/2;add(L-rx+rx*Math.sin(f),b[1]+side*ry*Math.cos(f));}
 return out;
}
function passage(a,b,p){
 const out=[],N=Math.max(32,Math.ceil(dist(a,b)/.05));
 for(let i=0;i<=N;i++){const t=i/N,s=t*t*(3-2*t);out.push([mix(a[0],b[0],s),mix(a[1],b[1],t),mix(a[2],b[2],s)]);}
 return out;
}
'''+s[b:]
s=s.replace('for(const r of routes)r.points=roundRoute(r.points,p.diameter*.85);','// Analytic skin-entry turns are already tangent continuous.')
s=s.replace('points:roundRoute(points,model.params.diameter*.85)','points')
s=s.replace("throughBothLayers:true,lockstitch:false", "throughBothLayers:true,curvedEntrySpansIncluded:true,lockstitch:false")
p.write_text(s)
p=r/'site/geometry.js';s=p.read_text();a=s.index('function resample(');b=s.index('export function makeThreadGeometry(',a)
s=s[:a]+'''function resample(points,step){
 const p=[V(points[0])],cum=[0];let total=0;
 for(const v of points.slice(1)){const q=V(v),L=q.distanceTo(p.at(-1));if(L<1e-7)continue;total+=L;p.push(q);cum.push(total);}
 if(total<1e-7)return {out:p,lengths:cum,total};
 const N=Math.max(1,Math.ceil(total/step)),out=[],lengths=[];let j=0;
 for(let i=0;i<=N;i++){const d=total*i/N;while(j<p.length-2&&cum[j+1]<d)j++;out.push(p[j].clone().lerp(p[j+1],(d-cum[j])/(cum[j+1]-cum[j])));lengths.push(d);}
 return {out,lengths,total};
}
'''+s[b:];p.write_text(s)
# Use a reviewed grain source, not the earlier flesh-like mottled trial.
assets=r/'assets-grain';assets.mkdir(exist_ok=True)
prov=assets/'PROVENANCE.json'
if not prov.exists():
 manifest={'asset':'brown_leather','author':'Rob Tuytel','source':'https://polyhaven.com/a/brown_leather','license':'CC0-1.0','licenseURL':'https://polyhaven.com/license','originalTileMM':400,'cropMM':[150,75],'originalResolution':[8192,8192],'processedResolution':[3072,1536],'processing':'crop original texels; diffuse WebP quality 97, normal/roughness lossless WebP','files':{}}
 for name,tag in [('diff','albedo'),('nor_gl','nor_gl'),('rough','rough')]:
  url=f'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/8k/brown_leather/brown_leather_{tag}_8k.jpg'
  raw=urllib.request.urlopen(url,timeout=180).read();im=Image.open(io.BytesIO(raw)).convert('RGB');assert im.size==(8192,8192)
  crop=im.crop((2560,3328,5632,4864));path=assets/(name+'.webp')
  if name=='diff':crop.save(path,format='WEBP',quality=97,method=6)
  elif name=='rough':crop.convert('L').save(path,format='WEBP',lossless=True,method=6)
  else:crop.save(path,format='WEBP',lossless=True,method=6)
  manifest['files'][name]={'url':url,'rawSHA256':hashlib.sha256(raw).hexdigest(),'processedSHA256':hashlib.sha256(path.read_bytes()).hexdigest()}
 prov.write_text(json.dumps(manifest,indent=2))
else:
 manifest=json.loads(prov.read_text())
 for name,f in manifest['files'].items():assert hashlib.sha256((assets/(name+'.webp')).read_bytes()).hexdigest()==f['processedSHA256']
p=r/'site/appearance.js';s=p.read_text()
s=s.replace('t.repeat.set(96/75,96/75);t.offset.set(.04,.26);','t.repeat.set(96/150,96/75);t.offset.set(.012,.26);')
s=s.replace('normalScale:new T.Vector2(.65,.65)','normalScale:new T.Vector2(.82,.82)')
if 'sourceAlbedoMean' not in s:
 s=s.replace("m.name='OUTER_GRAIN_PBR';", "const sourceAlbedoMean=[.08401343,.02765351,.00580022];m.color.r/=sourceAlbedoMean[0];m.color.g/=sourceAlbedoMean[1];m.color.b/=sourceAlbedoMean[2];m.name='OUTER_GRAIN_PBR';")
s=s.replace('finishRoughness*.76 + roughnessFactor*.18','finishRoughness*.62 + roughnessFactor*.18')
p.write_text(s)
p=r/'build.py';s=p.read_text()
s=s.replace("Poly Haven Leather White by Rob Tuytel, CC0-1.0. https://polyhaven.com/a/leather_white", "Poly Haven Brown Leather by Rob Tuytel, CC0-1.0. https://polyhaven.com/a/brown_leather")
s=s.replace("name:'data:image/png;base64,'+base64.b64encode((r/'assets'/f'{name}.png').read_bytes()).decode()", "name:'data:image/webp;base64,'+base64.b64encode((r/'assets-grain'/f'{name}.webp').read_bytes()).decode()")
s=s.replace("'localSurfaceResponse':", "'grainSource':'assets-grain/PROVENANCE.json','localSurfaceResponse':") if "'grainSource'" not in s else s
p.write_text(s)
p=r/'site/template.html';s=p.read_text()
s=s.replace('Poly Haven / Rob Tuytel 的 CC0 皮革贴图','Poly Haven / Rob Tuytel 的 Brown Leather CC0 皮革贴图')
s=s.replace('Poly Haven / Rob Tuytel 的 Leather White 是本版写实粒面贴图来源，按 CC0 使用，取 4K 原图的 75 mm 区域，保持实际纹理尺度','Poly Haven / Rob Tuytel 的 Brown Leather 是本版写实粒面贴图来源，按 CC0 使用，取 8K 原图中的 150×75 mm 区域，保持实际纹理尺度')
s=s.replace('https://polyhaven.com/a/leather_white','https://polyhaven.com/a/brown_leather')
s=s.replace('松紧是可检查的线形参数，不是力值。','线形松紧控制几何；给定张力驱动独立的局部皮面响应，未做实物标定。')
s=s.replace('原表面为整体保持不变','原表面为整体保持不变')
p.write_text(s)
print('Final R05.1: smooth physical-size thread turns, original-finish grain, source integrity and unchanged R04.')
