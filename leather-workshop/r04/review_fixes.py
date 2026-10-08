"""One-time, idempotent source review corrections; expanded files remain authoritative."""
from pathlib import Path
r=Path(__file__).resolve().parent
edits={
 'site/dynamics.mjs':[
  ("this.time+=h;this.steps++;", "this.peakSag=Math.max(this.peakSag,-this.x[3*this.centerId+1]);this.peakPenetration=Math.max(this.peakPenetration,st.penetration||0);\n  this.time+=h;this.steps++;"),
  ("this.cfg={...DEFAULT_DYNAMICS,...options};const c=this.cfg;", "this.cfg={...DEFAULT_DYNAMICS,...options};const c=this.cfg;\n  if(options.thickness===undefined&&PROFILES[c.profile])c.thickness=PROFILES[c.profile].thickness/1000;"),
  ("if(!b.active)return{penetration:0,count:0};const pos=b.pos,R=b.radius+this.cfg.thickness*.5;let maxPen=0,count=0;", "if(!b.active)return{penetration:0,count:0,energy:0};const pos=b.pos,R=b.radius+this.cfg.thickness*.5;let maxPen=0,count=0,energy=0;"),
  ("if(pen>0){maxPen=Math.max(maxPen,pen);count++;}", "if(pen>0){maxPen=Math.max(maxPen,pen);count++;energy+=1e5*pen*pen;}"),
  ("return{penetration:maxPen,count};", "return{penetration:maxPen,count,energy};"),
  ("totalEnergyJ:U+kinetic+gravitational,residualN:", "contactEnergyJ:contact.energy,totalEnergyJ:U+kinetic+gravitational+contact.energy,residualN:")
 ],
 'site/runtime.js':[
  ("$('pull').onchange=()=>pull(+$('pull').value);$('pullNow').onclick=()=>pull(+$('pull').value);", "$('pull').onchange=()=>{operation++;pull(+$('pull').value);};$('pullNow').onclick=()=>{operation++;pull(+$('pull').value);};"),
  ("if(hits.length&&p){drag=","if(hits.length&&p){operation++;drag=")
 ],
 'build.py':[
  ("(old/'THIRD_PARTY.txt').read_text().replace('--','—')","(r/'THIRD_PARTY.txt').read_text().replace('--','—')")
 ],
 'test.mjs':[
  ("let forces={};", "check('AL profile supplies its own default thickness',eq(new LeatherDynamics({profile:'AL'}).cfg.thickness,.00106,1e-12));\nd.stone.active=true;check('reported energy includes contact potential',d.report().contactEnergyJ>0&&eq(d.report().totalEnergyJ,d.report().elasticEnergyJ+d.report().kineticEnergyJ+d.report().potentialEnergyJ+d.report().contactEnergyJ,1e-10));\nlet forces={};")
 ],
 'test-scenes.mjs':[
  ("console.timeEnd(key);", "if(loaded.contactCount<1||loaded.stoneSpeedMS>.005||Math.abs(loaded.contactForceN-d.cfg.stoneMass*d.cfg.gravity)>.02*d.cfg.stoneMass*d.cfg.gravity)throw Error('Settled contact is not supporting the stone '+key);\nconsole.timeEnd(key);")
 ],
 'qa.py':[
  ("LEATHER_DYNAMICS.advance(.18)","LEATHER_DYNAMICS.advance(.1)"),
  ("LEATHER_DYNAMICS.advance(1.6)","LEATHER_DYNAMICS.advance(1.7)"),
  ("impact['stoneActive'] and impact['penetrationMM']<.03","impact['stoneActive'] and impact['contactCount']>0 and impact['penetrationMM']<.03"),
  ("ck('physical surface changes actual pixels'", "ck('settled stone supported by contact',loaded['contactCount']>0 and loaded['stoneSpeedMS']<.01 and abs(loaded['contactForceN']-.045*9.81)<.02*.045*9.81)\n  ck('physical surface changes actual pixels'")
 ]
}
for name,pairs in edits.items():
 p=r/name;s=p.read_text()
 for before,after in pairs:
  if after in s:continue
  assert s.count(before)==1,(name,before[:100],s.count(before))
  s=s.replace(before,after)
 p.write_text(s)
(r/'THIRD_PARTY.txt').write_text((r.parent/'r02/THIRD_PARTY.txt').read_text()+'''\n\nBending derivative reference\nhttps://github.com/InteractiveComputerGraphics/PositionBasedDynamics\nThe signed dihedral derivative was independently transcribed and finite-difference checked.\nThe complete third-party notice is retained for the reference implementation.\n\nThe MIT License (MIT)\nCopyright (c) 2015-present, PositionBasedDynamics contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n''')
print('Source review: complete contact energy accounting, per-profile thickness, settled contact gates.')