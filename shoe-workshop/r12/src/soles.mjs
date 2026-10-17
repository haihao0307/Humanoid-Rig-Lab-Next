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
   out.push(panel('welt-'+side,[patch(pt,104,5,{normal:()=>V(0,1,0),uv:(u,v)=>[u*last.L/100,v*.03]})],1.05,'welt',{name:'帮底连接沿条',kind:'connection',explode:[0,-12,0]}));
   out.push(seam('welt-stitch-'+side,t=>{const s=mix(.01,.99,t);return V(last.center(s)+side*(last.width(s)+1.55),last.soleTop(s)+.8,last.L*(s-.5));},{pitch:3.25,width:.43}));
  }
 }else{
  for(const side of[-1,1]){
   out.push(panel('foxing-'+side,[patch((u,v)=>{const s=u,w=last.width(s)+.85+2.9*Math.pow(Math.sin(Math.PI*s),.3);return V(last.center(s)+side*w,last.soleTop(s)-mix(-3,11,v),last.L*(s-.5));},144,10,{normal:()=>V(side,0,0),uv:(u,v)=>[u*last.L/100,v*.14]})],1.6,'rubber',{name:'硫化橡胶包边',kind:'connection',coversUpperBottom:true,explode:[side*18,-14,0]}));
   out.push(descriptor('foxing-bead-'+side,pathGeometry(Array.from({length:181},(_,i)=>{const s=i/180;return V(last.center(s)+side*(last.width(s)+.85+3.1*Math.pow(Math.sin(Math.PI*s),.3)),last.soleTop(s)+2.6,last.L*(s-.5));}),1.3,1.1),'rubber',{kind:'connection',name:'橡胶包边上沿',explode:[side*18,-10,0]}));
  }
 }
 // Real low-relief rubber tread, kept clear of the unsupported midfoot.
 const lugs=[];for(let i=0;i<21;i++){const s=mix(.48,.94,i/20),w=last.width(s)*.78;for(const side of[-1,1]){const g=new T.BoxGeometry(Math.max(2,w*.75),.8,2.1);g.rotateY(side*.35);g.translate(last.center(s)+side*w*.48,last.soleTop(s)-last.style.sole-.25,last.L*(s-.5));lugs.push(g);}}
 out.push(descriptor('forefoot-tread',mergeGeometry(lugs),'rubber',{name:'前掌防滑细纹',kind:'tread',tractionTested:false,explode:[0,-39,0]}));
 return out;
}
