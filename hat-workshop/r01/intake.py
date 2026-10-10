"""Read publicly licensed hat packs; never execute their contents."""
import hashlib,json,pathlib,urllib.request,zipfile,io
root=pathlib.Path(__file__).parent
sources=[]
for pack,lic in [('hats01','cc0'),('hats03','cc-by')]:
 url=f'https://files.makehumancommunity.org/asset_packs/{pack}/{pack}_{lic}.zip'
 try:
  data=urllib.request.urlopen(url,timeout=90).read()
 except Exception:
  url=url.replace('files.makehuman','files2.makehuman')
  data=urllib.request.urlopen(url,timeout=90).read()
 print('PACK',pack,len(data),hashlib.sha256(data).hexdigest())
 z=zipfile.ZipFile(io.BytesIO(data))
 entries=[]
 for n in z.namelist():
  if n.endswith('/') or n.startswith('/') or '..' in pathlib.PurePosixPath(n).parts:continue
  item={'path':n,'bytes':z.getinfo(n).file_size}
  if n.endswith(('.mhmat','.mhclo','.txt')):
   text=z.read(n).decode('utf-8','replace')
   item['header']=text[:1400] if n.endswith('.mhclo') else text[:4000]
  if n.endswith('.obj'):
   txt=z.read(n).decode('utf-8','replace').splitlines()
   vertices=[line for line in txt if line.startswith('v ')];faces=[line for line in txt if line.startswith('f ')]
   item.update(vertices=len(vertices),faces=len(faces),sample=vertices[:3])
  entries.append(item)
 sources.append({'pack':pack,'url':url,'sha256':hashlib.sha256(data).hexdigest(),'entries':entries})
 (root/'cache').mkdir(exist_ok=True)
 (root/'cache'/f'{pack}.zip').write_bytes(data)
(root/'SOURCE_INTAKE.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2))
print(json.dumps(sources,ensure_ascii=False))
