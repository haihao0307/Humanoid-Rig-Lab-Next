// Review-driven corrections. Inputs remain pinned and all changes are inspectable.
const fs=require('fs'),path=require('path');const file=path.join(__dirname,'ResearchEyes.js');let s=fs.readFileSync(file,'utf8');
if(!s.includes('// ET03 review correction R2')){
 const edit=(a,b)=>{if(!s.includes(a))throw Error('Missing review anchor '+a);s=s.replaceAll(a,b);};
 // The source-field offset must vanish at both canthi. A sign-only offset tore
 // the two copies of the circular parameter seam apart by 0.9 mm.
 edit('seam+(ny>=0?.00045:-.00045)','seam+.00045*ny');
 edit('seam+(q.ny>=0?.00045:-.00045)','seam+.00045*q.ny');
 edit('weight=1-smooth(t)','weight=1-smooth(t/.74)');
 const a=s.indexOf('function rail(u,upper){'),b=s.indexOf('function ocularHeight(',a);
 if(a<0||b<0)throw Error('Reference rail function absent');
 s=s.slice(0,a)+`function rail(u,upper){
 u=clamp(u,-1,1);const t=(u+1)*.5;
 // Endpoint-constrained least squares of the 33 measured CC0 contour points.
 const c=upper?[.38441346288415335,-.013457920226416842,.4445801720372662,.056531015805420755]:[-.26980682201867545,-.07559112460541781,-.25913444501352073,-.003966655456640926];
 const k=upper?1:2,baseline=lerp(REFERENCE_RAILS[0][k],REFERENCE_RAILS[32][k],t);
 return baseline+(1-u*u)*(c[0]+u*(c[1]+u*(c[2]+u*c[3])));
}
`+s.slice(b);
 edit('e.ball.geometry.dispose();e.ball.geometry=opticalMesh(e.c.radius);',`e.ball.geometry.dispose();e.ball.geometry=opticalMesh(e.c.radius);
    // Three.js uses scene.environmentIntensity while material.envMap is null.
    // Bind the same environment explicitly so ocular intensity actually works.
    e.ball.material.envMap=this.scene.environment;
    e.ball.material.envMapIntensity=.38;
    e.ball.material.envMapRotation.copy(this.scene.environmentRotation);`);
 edit('const rest=(upper?top:bottom)*(this.config.opening||1),narrow=(upper?-.0020:.0020)*squint*w;',`const open=this.config.opening||1;
  let topOpen=top*open-pitch*.0056*w-.0020*squint*w;
  let bottomOpen=bottom*open-pitch*.0023*w+.0020*squint*w;
  if(topOpen<bottomOpen+.00006*w){const mid=(topOpen+bottomOpen)*.5;topOpen=mid+.00003*w;bottomOpen=mid-.00003*w;}
  const rest=upper?topOpen:bottomOpen,narrow=0;`);
 edit('lerp(rest+gaze+narrow,center,blink)','lerp(rest,center,blink)');
 edit("s.fragmentShader='varying float vLidT;uniform vec4 uResearchPatch;\\n'+s.fragmentShader;",`s.fragmentShader='varying float vLidT;uniform vec4 uResearchPatch;\\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('normal=normalize(tbn*mapN);','mapN.xy*=mix(.48,1.,smoothstep(.06,.68,vLidT));normal=normalize(tbn*normalize(mapN));');`);
 edit('this.state.contact=this.eyes?.map(e=>e.contactReport);return changed;',`for(const e of this.eyes)e.ball.material.envMapRotation.copy(this.scene.environmentRotation);
  this.state.contact=this.eyes?.map(e=>e.contactReport);return changed;`);
 s+='\n// ET03 review correction R2\n';fs.writeFileSync(file,s);
}
console.log('ET03_REVIEW_REFINEMENT',file);
