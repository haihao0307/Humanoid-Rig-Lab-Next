from pathlib import Path
p=Path(__file__).resolve().parent/'fit/field.mjs';s=p.read_text()
if 'sourceFitProfile as sourceDatum' not in s:
 s=s.replace("import {normals,sectionProfile,sample,measurements,FIT_SPECS} from '../mother.mjs';", "import {normals,sectionProfile,sample,measurements,FIT_SPECS} from '../mother.mjs';\nimport {sourceFitProfile as sourceDatum} from '../../r03/fit/field.mjs';")
 s=s.replace("cable:{bandY:8,pitch:0", "cable:{bandY:12,pitch:-6")
 a=s.index(' const c=CONSTRUCTION[meta.id],p=');b=s.index('\n}\nexport function deform',a)
 s=s[:a]+''' const c=CONSTRUCTION[meta.id],datum=sourceDatum(mesh,meta),knit=c.mode.startsWith('knit');
 const p=knit?new Float32Array(datum.q):Float32Array.from(mesh.position,(v,i)=>v-meta.origin[i%3]);let lo=Infinity,hi=-Infinity;for(let i=1;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i]);}
 let sourceBand=knit?0:c.sourceY;const F=polarField(p,mesh.index,Math.max(lo+.0001,sourceBand-.024),hi-.00001);let ring;
 if(meta.id==='visor'){ring=Array.from({length:128},(_,i)=>datum.ring.radius(i*TAU/128));}
 else{try{ring=robustRing(F,sourceBand+.002);}catch(e){const valid=F.layers.filter(l=>Array.from(l.inner).filter(x=>Number.isFinite(x)&&x>.03).length/F.angles>.97).sort((a,b)=>Math.abs(a.y-sourceBand)-Math.abs(b.y-sourceBand));if(!valid.length)throw e;sourceBand=valid[0].y;ring=robustRing(F,sourceBand);}}
 return {p,field:F,ring,top:hi,sourceBand,construction:c,sourceDatum:knit?datum.frame:{method:'nearest actual encircling inner section, no radius from decorative brim',sourceBand}};''' +s[b:]
 p.write_text(s)
