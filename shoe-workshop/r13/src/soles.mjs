import * as T from 'three';
import {V,mix,clamp,smooth,patch,panel,descriptor,seam,pathGeometry,mergeGeometry} from './kernel.mjs';

function slab(last,id,{s0=0,s1=1,extra=2,top=s=>last.soleTop(s),bottom=s=>last.soleTop(s)-last.style.sole,role='rubber',nu=98,nv=4,name=id,explode=[0,-24,0]}={}){
 const verts=[],indices=[],uv=[],N=(nu+1)*(nv+1);
 for(let layer=0;layer<2;layer++)for(let i=0;i<=nu;i++){const s=mix(s0,s1,i/nu),w=Math.max(.25,last.width(s)+extra*Math.pow(Math.sin(Math.PI*clamp(s)),.3));for(let j=0;j<=nv;j++){const x=last.center(s)+w*mix(-1,1,j/nv);verts.push(x,layer?bottom(s):top(s),last.L*(s-.5));uv.push(x/100,last.L*s/100);}}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;indices.push(a,a+1,b,a+1,b+1,b);indices.push(a+N,b+N,a+1+N,a+1+N,b+N,b+1+N);}
 const edge=[];for(let i=0;i<=nu;i++)edge.push(i*(nv+1));for(let j=1;j<=nv;j++)edge.push(nu*(nv+1)+j);for(let i=nu-1;i>=0;i--)edge.push(i*(nv+1)+nv);for(let j=nv-1;j>0;j--)edge.push(j);
 for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];indices.push(a,b,a+N,b,b+N,a+N);}
 // Grid coordinates run +X then +Z; reverse the assembled inward winding so
 // every closed slab has outward normals and a positive signed volume.
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.userData={closedSolid:true,connection:'continuous shared last bottom outline',units:'mm'};return descriptor(id,g,role,{kind:'sole',name,explode});
}
export function foxingOutline(last,u){
 const a=((u%1)+1)%1*Math.PI*2,s=(1+Math.cos(a))*.5,side=Math.sin(a)<0?-1:1;
 const raw=q=>last.width(q)+.85+2.9*Math.pow(Math.max(0,Math.sin(Math.PI*q)),.3);
 const cap=q=>{const h=.018,w=raw(q<h?h:1-h),slope=(raw(q<h?h+1e-5:1-h-1e-5)-raw(q<h?h-1e-5:1-h+1e-5))/2e-5,t=q<h?q:1-q,delta=w*w,A=2*delta/h-2*w*slope,B=(2*w*slope*h-delta)/(h*h);return Math.sqrt(Math.max(0,A*t+B*t*t));};
 const w=s<.018||s>.982?cap(s):raw(s);
 // Cover both the finite-width slab ends and the upper's .85 mm outer offset.
 // The additional .45 mm clearance is local to the rounded toe/heel end caps.
 const endClearance=(.85+.45)*(2*s-1)*(1-smooth(0,.035,Math.min(s,1-s)));
 return V(last.center(s)+side*w,last.soleTop(s),last.L*(s-.5)+endClearance);
}
function foxingBand(last){
 const nu=208,nv=8,thickness=1.6,position=[],normal=[],uv=[],indices=[],arc=[0],N=(nu+1)*(nv+1);
 const P=Array.from({length:nu+1},(_,i)=>foxingOutline(last,i/nu));P[nu]=P[0].clone();
 for(let i=1;i<=nu;i++)arc.push(arc[i-1]+P[i].distanceTo(P[i-1]));
 const outward=i=>{const u=i/nu,t=foxingOutline(last,u+1e-4).sub(foxingOutline(last,u-1e-4));return V(0,-1,0).cross(t).normalize();};
 for(let layer=0;layer<2;layer++)for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){
  const n=outward(i),p=P[i].clone();p.y+=3-14*j/nv;p.addScaledVector(n,-thickness*layer);
  position.push(...p.toArray());normal.push(...n.clone().multiplyScalar(layer?-1:1).toArray());uv.push(arc[i]/100,14*j/nv/100);
 }
 const add=(a,b,c)=>{const A=V(...position.slice(a*3,a*3+3)),B=V(...position.slice(b*3,b*3+3)),C=V(...position.slice(c*3,c*3+3)),n=V(...normal.slice(a*3,a*3+3));if(B.sub(A).cross(C.sub(A)).dot(n)<0)[b,c]=[c,b];indices.push(a,b,c);};
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+nv+1;add(a,b,a+1);add(b,b+1,a+1);}
 const outerCount=indices.length;
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=N+i*(nv+1)+j,b=a+nv+1;add(a,b,a+1);add(b,b+1,a+1);}
 const innerCount=indices.length-outerCount;
 for(const j of[0,nv])for(let i=0;i<nu;i++){
  const a=i*(nv+1)+j,b=a+nv+1,k=position.length/3,up=j===0?1:-1;
  for(const q of[a,b,b+N,a+N]){position.push(...position.slice(q*3,q*3+3));normal.push(0,up,0);}
  uv.push(arc[i]/100,0,arc[i+1]/100,0,arc[i+1]/100,thickness/100,arc[i]/100,thickness/100);add(k,k+1,k+3);add(k+1,k+2,k+3);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.addGroup(0,outerCount,0);g.addGroup(outerCount,innerCount,1);g.addGroup(outerCount+innerCount,indices.length-outerCount-innerCount,2);g.computeBoundingBox();
 g.userData={periodicU:true,ringSegments:nu,heightSegments:nv,noToeOrHeelEndCaps:true,closedCutWalls:true,thicknessMm:thickness};
 return descriptor('foxing-ring',g,'rubber',{name:'连续硫化橡胶包边',kind:'connection',thicknessMm:thickness,coversUpperBottom:true,explode:[0,-14,0]});
}
export function buildSoles(last){
 const canvas=last.style.id==='canvas',out=[];
 out.push(slab(last,'outsole',{extra:canvas?2.8:3.0,role:'rubber',name:'外底',explode:[0,-33,0]}));
 out.push(slab(last,'insole',{extra:-2.3,top:s=>last.soleTop(s)+1.3,bottom:s=>last.soleTop(s)+.2,role:'insole',name:'内底与皮垫',explode:[0,4,0]}));
 if(!canvas){
  out.push(slab(last,'stacked-heel',{s0:.001,s1:.255,extra:2.6,top:s=>last.soleTop(s)-last.style.sole+.2,bottom:s=>1.0,role:'heel',nu:36,name:'独立叠层后跟',explode:[0,-57,-8]}));
  out.push(slab(last,'heel-toplift',{s0:.001,s1:.255,extra:2.7,top:s=>2.3,bottom:s=>0,role:'rubber',nu:36,name:'后跟接地橡胶片',explode:[0,-66,-8]}));
  // The lasting/welt band overlaps the upper's lower boundary. This is a
  // geometric joint, not a validated bond-strength or Goodyear construction.
  for(const side of[-1,1]){
   const pt=(u,v)=>{const s=u,rim=Math.max(.18,Math.pow(Math.sin(Math.PI*s),.3));return V(last.center(s)+side*(last.width(s)+mix(.4,3.2,v)*rim),last.soleTop(s)+.7*(1-v),last.L*(s-.5));};
   const normal=(u,v)=>{const e=1e-4,du=pt(clamp(u+e),v).sub(pt(clamp(u-e),v)),dv=pt(u,clamp(v+e)).sub(pt(u,clamp(v-e))),n=du.cross(dv).normalize();return n.y<0?n.negate():n;};
   out.push(panel('welt-'+side,[patch(pt,160,5,{normal,uv:(u,v)=>[u*last.L/100,v*.03]})],1.05,'welt',{name:'帮底连接沿条',kind:'connection',explode:[0,-12,0]}));
   out.push(seam('welt-stitch-'+side,t=>pt(mix(.018,.982,t),.5),{pitch:3.25,width:.40,normalFn:t=>normal(mix(.018,.982,t),.5),supportPart:'welt-'+side}));
  }
 }else{
  out.push(foxingBand(last));
  out.push(descriptor('foxing-bead-ring',pathGeometry(Array.from({length:208},(_,i)=>foxingOutline(last,i/208).add(V(0,2.6,0))),1.3,1.1,true),'rubber',{kind:'connection',name:'连续橡胶包边上沿',explode:[0,-10,0]}));
 }
 // Real low-relief rubber tread, kept clear of the unsupported midfoot.
 const lugs=[];for(let i=0;i<21;i++){const s=mix(.48,.94,i/20),w=last.width(s)*.78;for(const side of[-1,1]){const g=new T.BoxGeometry(Math.max(2,w*.75),.8,2.1);g.rotateY(side*.35);g.translate(last.center(s)+side*w*.48,last.soleTop(s)-last.style.sole-.25,last.L*(s-.5));lugs.push(g);}}
 out.push(descriptor('forefoot-tread',mergeGeometry(lugs),'rubber',{name:'前掌防滑细纹',kind:'tread',tractionTested:false,explode:[0,-39,0]}));
 return out;
}
