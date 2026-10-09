"""Non-destructive same-subject repair of visible capture marks.
Only the new eye materials read this atlas; original scan assets remain unchanged.
No claim is made to recover unobserved true eyelid skin from a single capture.
"""
from pathlib import Path
import base64, hashlib, io, json
import cv2
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
LAB=ROOT.parent
OUT=Path(__file__).resolve().parent
RECT=(1540,1120,2520,1320)
L,T,R,B=RECT; W,H=R-L,B-T
color_path=LAB/'r01/assets/hires/albedo-4k.jpg'
original=np.asarray(Image.open(color_path).convert('RGB'))
assert original.shape==(4096,4096,3)
poly=[[(1612,1193),(1640,1172),(1695,1160),(1798,1163),(1850,1173),(1880,1188),(1893,1210),(1880,1251),(1815,1268),(1680,1263),(1620,1248),(1598,1220)],[(2190,1189),(2240,1170),(2378,1170),(2436,1180),(2470,1200),(2474,1225),(2445,1254),(2380,1270),(2265,1270),(2203,1255),(2174,1222)]]
im=Image.new('L',(W,H));draw=ImageDraw.Draw(im)
for p in poly:draw.polygon([(x-L,y-T)for x,y in p],fill=255)
mask=np.asarray(im).copy()
mask=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(17,17)))
alpha=cv2.GaussianBlur(mask,(0,0),4.0).astype(np.float32)/255
alpha=np.where(alpha<.003,0,np.where(alpha>.99,1,alpha))
# Healthy edge colours constrain the fill; neighbouring real skin supplies grain.
healing_mask=np.uint8(alpha>0)*255
crop=original[T:B,L:R].copy()
healed=cv2.inpaint(crop,healing_mask,6,cv2.INPAINT_TELEA).astype(np.float32)
DONOR_DY=215
clean=original[T+DONOR_DY:B+DONOR_DY,L:R].astype(np.float32)
grain=clean-cv2.GaussianBlur(clean,(0,0),2.3)
repaired=np.uint8(np.clip(healed+.58*grain,0,255))
rgba=np.dstack((repaired,np.uint8(alpha*255)))
# Pack two measured normal bands into one image, with finer eyelid amplitudes.
packed=[]
for name,gain in [('meso.webp',.48),('micro.webp',.68)]:
 data=np.asarray(Image.open(LAB/'r02/assets'/name).convert('RGB'))[T+DONOR_DY:B+DONOR_DY,L:R].astype(np.float32)/255*2-1
 slopes=data[...,:2]/np.maximum(data[...,2:3],.1)*gain
 nxy=slopes/np.sqrt(1+np.sum(slopes*slopes,axis=2,keepdims=True))
 packed.append(np.uint8(np.clip((nxy*.5+.5)*255,0,255)))
normals=np.concatenate(packed,axis=2)
surf=np.asarray(Image.open(LAB/'r02/assets/surface.webp').convert('RGB'))[T+DONOR_DY:B+DONOR_DY,L:R].astype(np.float32)
surf[...,:2]=127.5+(surf[...,:2]-127.5)*.60
surf[...,2]=127.5+(surf[...,2]-127.5)*.22
surface=np.dstack((np.uint8(np.clip(surf,0,255)),np.uint8(alpha*255)))
for data in [rgba,normals,surface]:data[alpha==0]=0
files={}
for name,data in [('color',rgba),('normalBands',normals),('surface',surface)]:
 buf=io.BytesIO();Image.fromarray(data).save(buf,format='PNG',optimize=True)
 raw=buf.getvalue();files[name]='data:image/png;base64,'+base64.b64encode(raw).decode()
 (OUT/(name+'-repair.png')).write_bytes(raw)
meta={'schema':'kaopu/periocular-scan-repair@1','atlasRectPixels':list(RECT),'atlasSize':[W,H],
 'uvRect':[L/4096,(4096-B)/4096,W/4096,H/4096],
 'source':'same existing Lee scan textures; no additional person or stock skin',
 'albedoSHA256':hashlib.sha256(color_path.read_bytes()).hexdigest(),
 'maskPolygonsPixels':poly,'donorOffsetPixels':[0,DONOR_DY],
 'method':'masked capture-mark removal, constrained colour inpaint and same-subject fine-detail transfer',
 'originalAssetsModified':False,'hiddenTrueSkinRecovered':False,'scope':'new eyelid materials only',
 'maskedPixels':int(np.count_nonzero(alpha)), 'extraTextures':3,
 'extraBaseLevelGPUBytes':W*H*4*3,
 'outputs':{n:{'bytes':len((OUT/(n+'-repair.png')).read_bytes()),'sha256':hashlib.sha256((OUT/(n+'-repair.png')).read_bytes()).hexdigest()}for n in files}}
(OUT/'RepairData.js').write_text('export const REPAIR_META='+json.dumps(meta,separators=(',',':'))+';\nexport const REPAIR_DATA='+json.dumps(files,separators=(',',':'))+';\n')
(OUT/'REPAIR_SOURCE.json').write_text(json.dumps(meta,indent=2))
preview=np.uint8(np.clip(repaired.astype(float)*alpha[...,None]+crop*(1-alpha[...,None]),0,255))
Image.fromarray(preview).save(OUT/'repair-review.png')
print(json.dumps(meta,indent=2))
