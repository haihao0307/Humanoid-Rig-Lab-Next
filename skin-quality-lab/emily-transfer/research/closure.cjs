const fs=require('fs'),path=require('path');const file=path.join(__dirname,'ResearchEyes.js');let s=fs.readFileSync(file,'utf8');
if(!s.includes('// ET03 captured-closure anchors R3')){
 const edit=(a,b)=>{if(!s.includes(a))throw Error('Missing captured-closure anchor '+a);s=s.replaceAll(a,b);};
 edit('makeLid(c,sample,mat){','makeLid(c,sample,mat){\n  c.referenceSurface=sample;c.closedCurve=new Map();');
 edit('seam+.00045*ny','seam');edit('seam+.00045*q.ny','seam');
 edit('const y=c.y-.0005+lerp(rest,center,blink);',`const closedY=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
  const y=lerp(c.y-.0005+rest,closedY,blink);`);
 edit('const z=this.eyeFront(c,x,y);return new THREE.Vector3(x,y,z===null?c.z+.003:z+.00009);',`const front=this.eyeFront(c,x,y);let z=front===null?c.z+.003:front+.00009;
  if(blink>0&&c.referenceSurface){
   const key=Math.round(nx*1e9);let closedZ=c.closedCurve.get(key);
   if(closedZ===undefined){closedZ=c.referenceSurface(c.x+c.half*nx,closedY).z;c.closedCurve.set(key,closedZ);}
   z=Math.max(z,lerp(z,closedZ,blink));
  }
  return new THREE.Vector3(x,y,z);`);
 edit('y+=side*.00043*smooth(t/.045)*(1-smooth((t-.045)/.30))*arc;','y+=side*.00043*smooth(t/.045)*(1-smooth((t-.045)/.30))*arc*(1-blink);');
 edit('const {c,lid}=e,g=lid.mesh.geometry,P=g.attributes.position;let minClear=Infinity,penetration=0;',`const {c,lid}=e,g=lid.mesh.geometry,P=g.attributes.position;let minClear=Infinity,penetration=0;
  const orientation=new THREE.Euler().setFromQuaternion(e.pivot.quaternion,'YXZ');c.gazePitch=orientation.x;c.gazeYaw=orientation.y;
  const margins=Array.from({length:lid.A+1},(_,i)=>this.margin(c,i/lid.A*TAU,blink));
  let closureError=0,boundaryError=0;`);
 edit('const q=lid.entries[i],inner=this.margin(c,q.a,blink),t=q.t','const q=lid.entries[i],inner=margins[i%(lid.A+1)],t=q.t');
 edit('P.setXYZ(i,x,y,z);',`P.setXYZ(i,x,y,z);
   const error=Math.hypot(P.getX(i)-q.xs,P.getY(i)-q.ys,P.getZ(i)-q.src.z);
   if(blink>.999)closureError=Math.max(closureError,error);if(q.t===1)boundaryError=Math.max(boundaryError,error);`);
 edit('eyeballHiddenForClosure:false','eyeballHiddenForClosure:false,capturedClosureMaxDeviationMM:blink>.999?closureError*1000:null,outerBoundaryDeviationMM:boundaryError*1000');
 const a=s.indexOf(' update(dt,instant=false){'),b=s.indexOf(' snapshot(){',a);if(a<0||b<0)throw Error('Update function absent');
 s=s.slice(0,a)+` update(dt,instant=false){
  const extraChanged=this._oldSquint!==this.config.squint||this._oldManual!==this.config.manualBlink;
  const changed=super.update(dt,instant);
  // The inherited motion update already invokes the overridden contact solver.
  // Only a non-motion control change needs an extra geometry update.
  if(!instant&&!changed&&extraChanged&&this.eyes)for(const e of this.eyes)this.updateLid(e,this.state.blink);
  this._oldSquint=this.config.squint;this._oldManual=this.config.manualBlink;
  for(const e of this.eyes)e.ball.material.envMapRotation.copy(this.scene.environmentRotation);
  this.state.contact=this.eyes?.map(e=>e.contactReport);return changed||extraChanged;
 }
`+s.slice(b);
 s+='\n// ET03 captured-closure anchors R3\n';fs.writeFileSync(file,s);
}
console.log('ET03_CAPTURED_CLOSURE_APPLIED',file);
