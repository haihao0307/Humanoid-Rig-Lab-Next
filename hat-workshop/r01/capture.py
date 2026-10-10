"""Capture original evaluated head samples with explicit native-to-view axes."""
from pathlib import Path
import json,hashlib
import numpy as np
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
URL='https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/02f596def9d07ebfc187e1eb18ad345a57c8a6b6/kaopu-unified-human-workbench/face-transfer/preview.html'
def main():
 if (ROOT/'NATIVE_HEADS.json').exists():
  prior=json.loads((ROOT/'NATIVE_HEADS.json').read_text())
  if prior.get('axisConversion')=='native-Z-up_to_Y-up_rotation-X-minus90':return
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':1040});page.set_default_timeout(240000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(URL,wait_until='domcontentloaded',timeout=90000)
  page.wait_for_function('!!window.fullCommonWorkbench',timeout=120000)
  page.evaluate('fullCommonWorkbench.load()')
  page.wait_for_function('fullCommonWorkbench.diagnostics().ready && !fullCommonWorkbench.diagnostics().busy',timeout=240000)
  identities=page.evaluate('fullCommonWorkbench.faceIdentities()');heads=[]
  for choice in [None]+[x for x in identities if x['id'] in ('long_narrow','short_broad')]:
   if choice:page.evaluate('(id)=>fullCommonWorkbench.selectFaceIdentity(id)',choice['id'])
   raw=page.evaluate('()=>({positions:Array.from(fullCommonWorkbench.positions()),faces:Array.from(fullCommonWorkbench.faces()),archive:fullCommonWorkbench.archive(),metrics:fullCommonWorkbench.measurements()})')
   native=np.array(raw['positions']).reshape(-1,3)
   v=native[:,[0,2,1]]*np.array([1,1,-1])
   f=np.array(raw['faces']).reshape(-1,3);top=float(v[:,1].max());selected=f[(v[f,1]>top-.38).all(axis=1)];ids=np.unique(selected);remap={int(v):i for i,v in enumerate(ids)}
   origin=np.array([0,top-.10,0.]);ring=v[(v[:,1]>top-.105)&(v[:,1]<top-.075)]
   origin[0]=(ring[:,0].min()+ring[:,0].max())/2;origin[2]=(ring[:,2].min()+ring[:,2].max())/2
   width=float(np.ptp(ring[:,0]));depth=float(np.ptp(ring[:,2]));a=width/2;b=depth/2;perimeter=float(np.pi*(3*(a+b)-np.sqrt((3*a+b)*(a+3*b))))
   if not (.10<width<.32 and .10<depth<.38 and 500<len(ids)<len(v)*.8):raise ValueError('Invalid native head extent/axes; refusing surrogate fit')
   if not np.allclose(np.linalg.norm(native[1:]-native[:-1],axis=1),np.linalg.norm(v[1:]-v[:-1],axis=1),rtol=1e-12,atol=1e-12):raise ValueError('Native distances changed')
   cropped=(v[ids]-origin).astype('<f4');indices=np.array([[remap[int(i)] for i in face] for face in selected],dtype='<u4')
   head={'id':'native-default' if not choice else choice['id'],'title':'原总台 · 默认头形' if not choice else '原总台 · '+choice.get('label',choice['id']),'positions':cropped.flatten().tolist(),'faces':indices.flatten().tolist(),'sourceVertexIds':ids.tolist(),'sourceOrigin':origin.tolist(),'headWidthM':width,'headDepthM':depth,'ellipseCircumferenceM':perimeter,'fullPositionsSHA256':hashlib.sha256(native.astype('<f4').tobytes()).hexdigest(),'archive':raw['archive'],'metrics':raw['metrics'],'scope':'static original geometry, proper axis rotation and translation only; not live rig or original skin material'}
   heads.append(head);print('NATIVE_SAMPLE',head['id'],len(ids),len(indices),width,depth,perimeter,flush=True)
  if len(heads)!=3 or len({h['fullPositionsSHA256'] for h in heads})!=3:raise ValueError('Three distinct native samples required')
  (ROOT/'NATIVE_HEADS.json').write_text(json.dumps({'source':URL,'commit':'02f596def9d07ebfc187e1eb18ad345a57c8a6b6','heads':heads,'axisConversion':'native-Z-up_to_Y-up_rotation-X-minus90','nativeUnits':'meter','humanScaleChanged':False,'pageErrors':errors},ensure_ascii=False,separators=(',',':')))
  if errors:print('NATIVE_ERRORS',errors)
  browser.close()
if __name__=='__main__':main()
