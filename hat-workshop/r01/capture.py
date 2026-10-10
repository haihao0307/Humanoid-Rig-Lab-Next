"""Capture actual evaluated original common-person head samples. Never synthesize a replacement head."""
from pathlib import Path
import json,hashlib
import numpy as np
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent
URL='https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/02f596def9d07ebfc187e1eb18ad345a57c8a6b6/kaopu-unified-human-workbench/face-transfer/preview.html'
def main():
 if (ROOT/'NATIVE_HEADS.json').exists():return
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':1040});page.set_default_timeout(240000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(URL,wait_until='domcontentloaded',timeout=90000)
  page.wait_for_function('!!window.fullCommonWorkbench',timeout=120000)
  page.evaluate('fullCommonWorkbench.load()')
  page.wait_for_function('fullCommonWorkbench.diagnostics().ready && !fullCommonWorkbench.diagnostics().busy',timeout=240000)
  identities=page.evaluate('fullCommonWorkbench.faceIdentities()');print('NATIVE_IDENTITIES',json.dumps(identities,ensure_ascii=False),flush=True)
  heads=[]
  for choice in [None]+identities[:2]:
   if choice:page.evaluate('(id)=>fullCommonWorkbench.selectFaceIdentity(id)',choice['id'])
   raw=page.evaluate('()=>({positions:Array.from(fullCommonWorkbench.positions()),faces:Array.from(fullCommonWorkbench.faces()),archive:fullCommonWorkbench.archive(),metrics:fullCommonWorkbench.measurements()})')
   v=np.array(raw['positions']).reshape(-1,3);f=np.array(raw['faces']).reshape(-1,3);top=float(v[:,1].max());selected=f[(v[f,1]>top-.43).all(axis=1)];ids=np.unique(selected);remap={int(v):i for i,v in enumerate(ids)}
   origin=np.array([0,top-.10,0.])
   ring=v[(v[:,1]>top-.105)&(v[:,1]<top-.075)]
   origin[0]=(ring[:,0].min()+ring[:,0].max())/2;origin[2]=(ring[:,2].min()+ring[:,2].max())/2
   width=float(np.ptp(ring[:,0]));depth=float(np.ptp(ring[:,2]));a=width/2;b=depth/2;perimeter=float(np.pi*(3*(a+b)-np.sqrt((3*a+b)*(a+3*b))))
   cropped=(v[ids]-origin).astype('<f4');indices=np.array([[remap[int(i)] for i in face] for face in selected],dtype='<u4')
   head={'id':'native-default' if not choice else choice['id'],'title':'原总台 · 默认头形' if not choice else '原总台 · '+choice.get('label',choice['id']),'positions':cropped.flatten().tolist(),'faces':indices.flatten().tolist(),'sourceVertexIds':ids.tolist(),'sourceOrigin':origin.tolist(),'headWidthM':width,'headDepthM':depth,'ellipseCircumferenceM':perimeter,'fullPositionsSHA256':hashlib.sha256(v.astype('<f4').tobytes()).hexdigest(),'archive':raw['archive'],'metrics':raw['metrics'],'scope':'static original evaluated geometry; presentation material replaced only in hat app; no live rig or original skin quality claim'}
   heads.append(head);print('NATIVE_SAMPLE',head['id'],len(ids),len(indices),width,depth,perimeter,flush=True)
  (ROOT/'NATIVE_HEADS.json').write_text(json.dumps({'source':URL,'commit':'02f596def9d07ebfc187e1eb18ad345a57c8a6b6','heads':heads,'pageErrors':errors},ensure_ascii=False,separators=(',',':')))
  if errors:print('NATIVE_ERRORS',errors)
  browser.close()
if __name__=='__main__':main()
