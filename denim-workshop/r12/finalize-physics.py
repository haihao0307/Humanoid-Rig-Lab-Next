"""Idempotent correction of attachment-dependent residual observation.
Apply only known old/new forms; never relax tests or modify earlier versions.
"""
from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'dynamics.js';s=f.read_text()
pairs=[
 ('this.initGlobal();',"this.solveRods=[...t.rods].sort((a,b)=>(a.type==='bridge'?0:1)-(b.type==='bridge'?0:1));this.initGlobal();"),
 (' for(let pass=0;pass<4;pass++){',' let budget=4;this.lastConstraintPasses=0;for(let pass=0;pass<budget;pass++){'),
 ('for(const r of t.rods)this.rodBlock(r);\n }',"""for(const r of this.solveRods)this.rodBlock(r);
  for(const a of t.attachments)this.embedded(a.node);
  this.lastConstraintPasses=pass+1;
  if(pass===budget-1&&budget<12){let unresolved=false;for(let k=0;k<ls.length;k+=5){const type=ls[k+4];if(type!==0&&type!==3)continue;const a=ls[k]*3,b=ls[k+1]*3,ratio=Math.hypot(x[a]-x[b],x[a+1]-x[b+1],x[a+2]-x[b+2])/ls[k+2];if((type===0?ratio-1:Math.abs(ratio-1))>.08){unresolved=true;break;}}if(unresolved)budget+=2;}
 }"""),
 ('substepIterations:4,','substepIterations:this.lastConstraintPasses||4,adaptiveIterationLimit:12,'),
 (' this.revision++;}\n advance',' for(const a of t.attachments){this.embedded(a.node);const k=a.node*3;for(let c=0;c<3;c++)v[k+c]=(x[k+c]-p[k+c])/h;}\n this.revision++;}\n advance')
]
for old,new in pairs:
 if new in s:continue
 assert s.count(old)==1,(old,'Unrecognized source; explicit review required')
 s=s.replace(old,new)
f.write_text(s)
print('Attachment positions precede residual checks; bounded adaptive iterations, bridge-before-tail order, post-contact root update.')
