"""A release-stress regression exposed excessive strain in the small tricorn
fold tabs. Use four 1/960 s steps with eight ordinary iterations each instead
of one 1/240 s step with 32 iterations. Rescale membrane compliance consistently.
No displacement clamp, prerecorded sway or mesh fallback is added.
"""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def change(file,a,b):
 p=R/file;s=p.read_text()
 if b in s:return
 assert s.count(a)==1,(file,'source drift',s.count(a),a[:70])
 p.write_text(s.replace(a,b))
change('site/products.js','b.connect(tab,[-tab.w/2+4,0],brim,[u,40]);b.connect(tab,[tab.w/2-4,0],side,[u,H/2-8]);','b.connect(tab,[-L/2,0],brim,[u,40]);b.connect(tab,[L/2,0],side,[u,H/2-8]);')
change('site/grip.mjs',"GRIP_VERSION='R07-shell-1'","GRIP_VERSION='R07-shell-2'")
change('site/grip.mjs','dt:1/240,iterations:32,gravity:9.81','dt:1/240,substeps:4,iterations:8,gravity:9.81')
change('site/grip.mjs','1/(q.area*q.t*this.cfg.dt**2)','1/(q.area*q.t*(this.cfg.dt/this.cfg.substeps)**2)')
change('site/grip.mjs','step(count=1){if(!this.active||this.failed)return;const dt=this.cfg.dt;','''step(count=1){return this.integrate(count*this.cfg.substeps);}
 integrate(count=1){if(!this.active||this.failed)return;const dt=this.cfg.dt/this.cfg.substeps;''')
change('site/grip.mjs','this.time+=dt;this.steps++;','this.time+=dt;this.steps++;this.peakStretch=Math.max(this.peakStretch,this.extension());')
change('site/grip.mjs','return{seamConstraintCount:this.surfaceLinks.length,','return{integrationSubstepS:this.cfg.dt/this.cfg.substeps,substepsPerNominalFrameStep:this.cfg.substeps,iterationsPerSubstep:this.cfg.iterations,seamConstraintCount:this.surfaceLinks.length,')
change('qa.py',"result['held']['maxStretch']<1.25,result)","result['held']['maxStretch']<1.25 and result['released']['maxStretch']<1.25 and result['released']['peakStretch']<1.25,result)")
print('Small-step XPBD, correctly scaled compliance, true tab anchors and stricter release-strain checks applied.')
