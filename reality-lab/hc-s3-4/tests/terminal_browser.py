from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];Q=Path(os.environ.get('RF34_QA',str(R/'qa/file')));Q.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('RF34_URL',(R/'preview.html').as_uri());D=json.loads((R/'diagnosis.json').read_text());checks=[]
def check(name,value):
 if not value:raise AssertionError(name)
 checks.append({'name':name,'passed':True})
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1050});page.goto(URL,wait_until='domcontentloaded',timeout=90000);page.wait_for_function('!!window.__REALITY_S34__ && !!document.getElementById("terminal-fault")')
 s=page.evaluate('__REALITY_S34__.report().summary');t=s['terminal'];e=t['edge']
 check('actual terminating edge is the recorded top edge',t['role']=='top' and e['edgeIndex']==3289 and e['panelId']=='right_btorso')
 check('original guard occurs at eleventh fitting step',t['fittingStepOneBased']==11)
 check('first lower-garment transient is recovered',s['firstObserved']['worstEdge']['role']=='bottom' and t['firstTransientRecoveredAt']['states'][1]['maxRatio']<=1.45)
 check('visible terminal card distinguishes the two events','不是本次最终触发回滚' in page.locator('#terminal-fault').inner_text())
 page.locator('#focus-terminal').click();state=page.evaluate('__REALITY_S34__.report()');check('terminal button selects actual gate checkpoint',state['selectedEvent']==D['trace']['gate']['event']['sequence']-1)
 check('terminal button selects right back torso edge',e['panelId'] in page.locator('#edge-values').inner_text() and str(e['edgeIndex']) in page.locator('#members').inner_text())
 page.locator('#focus-persistent').click();check('persistent-crossing button selects the verified boundary',page.evaluate('__REALITY_S34__.report().selectedEvent')==t['persistentRoleCrossing']['after']['sequence']-1)
 page.locator('#jump-first').click();check('first transient remains independently reviewable',page.evaluate('__REALITY_S34__.report().selectedEvent')==D['trace']['firstCrossing']['event']['sequence']-1)
 b.close()
(Q/'TERMINAL.json').write_text(json.dumps({'passed':True,'checks':checks,'count':len(checks),'sourceFitAccepted':False},indent=2));print('TERMINAL_CHECKS',len(checks))
