/* R06: dipole profile quadrature, not a complete BSSRDF/path tracer.
   Unit is mm. Coefficients are explicit artist candidates, not measurements. */
(function(root){'use strict';
const cfg={eta:1.4,reducedScatteringPerMm:18,absorptionPerMm:[1.1,.75,.55],supportMm:1.2};
function profile(r,a,s=cfg.reducedScatteringPerMm,eta=cfg.eta){
 if(!(r>=0&&a>0&&s>0&&eta>=1))throw Error('Invalid optical coefficient');
 const st=a+s,D=1/(3*st),alpha=s/st,stt=Math.sqrt(3*a*st);
 const F=-1.440/(eta*eta)+.710/eta+.668+.0636*eta,A=(1+F)/(1-F);
 const zr=1/st,zv=zr+4*A*D,dr=Math.hypot(r,zr),dv=Math.hypot(r,zv);
 return alpha/(4*Math.PI)*(zr*(1+stt*dr)*Math.exp(-stt*dr)/dr**3+zv*(1+stt*dv)*Math.exp(-stt*dv)/dv**3);
}
function integrate(config=cfg){const edges=[0,.08,.20,.50,config.supportMm],bands=Array.from({length:4},()=>[0,0,0]);
 for(let b=0;b<4;b++)for(let k=0;k<96;k++){let dr=(edges[b+1]-edges[b])/96,r=edges[b]+(k+.5)*dr;for(let c=0;c<3;c++)bands[b][c]+=2*Math.PI*r*dr*profile(r,config.absorptionPerMm[c],config.reducedScatteringPerMm,config.eta);}
 const reflectance=[0,1,2].map(c=>bands.reduce((s,b)=>s+b[c],0));
 return {config:{...config},reflectance,weights:bands.map(b=>b.map((v,c)=>v/reflectance[c])),method:'Jensen radial profile integrated in four annuli; shader uses a local three-tap longitudinal approximation, not the full measured Weave BSSRDF'};
}
root.KAOPUFiberOptics={config:cfg,profile,integrate};if(typeof module!=='undefined')module.exports=root.KAOPUFiberOptics;
})(globalThis);
