import * as THREE from 'three';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z), clamp=THREE.MathUtils.clamp;
export const PROFILE=Object.freeze({id:'juvenile-white-shark-morphology-v1',species:'Carcharodon carcharias',lengthM:3.6,sourceType:'literature-guided procedural approximation',measuredSpecimen:false,vertebraCountClaim:false});
export function createShark(){
 const root=new THREE.Group();root.name='shark_01';
 const bones=[],rest=[],axial=[];
 function bone(name,parent,world){const b=new THREE.Bone();b.name=name;const i=bones.length; b.position.copy(world);if(parent!==null)b.position.sub(rest[parent]); bones.push(b);rest.push(world.clone());if(parent!==null)bones[parent].add(b);return i;}
 const skull=bone('chondrocranium',null,V(.72,0,0));
 for(let i=0;i<22;i++)axial.push(bone('axial_'+String(i).padStart(2,'0'),i?axial[i-1]:skull,V(.50-i*.0833,0,0)));
 const jaw=bone('mandibular_arch',skull,V(.81,-.103,0));
 const finL=bone('pectoral_left',axial[0],V(.43,-.12,.245));
 const finR=bone('pectoral_right',axial[0],V(.43,-.12,-.245));
 const pelvicL=bone('pelvic_left',axial[12],V(-.52,-.17,.12));
 const pelvicR=bone('pelvic_right',axial[12],V(-.52,-.17,-.12));
 const caudal=bone('caudal_fin',axial.at(-1),V(-1.33,0,0));
 const p=[],colors=[],si=[],sw=[],idx=[];
 const dorsal=new THREE.Color('#687e84'), belly=new THREE.Color('#e4e0cf');
 const palette={skin:[1,1,1],mouth:[.064,.022,.027],teeth:[.74,.71,.59],eye:[.002,.004,.006],gill:[.035,.048,.045],fintop:[dorsal.r,dorsal.g,dorsal.b],finbottom:[belly.r,belly.g,belly.b]};
 function weights(x){if(x>=.65)return[skull,skull,1,0];const u=clamp((.5-x)/.0833,0,21),a=Math.floor(u),b=Math.min(a+1,21);return[axial[a],axial[b],1-(u-a),u-a];}
 function vertex(q,override=null,type='skin'){const n=p.length/3;p.push(q.x,q.y,q.z);let col;
 if(type==='skin'){const y=q.y, irregular=.016*Math.sin(q.x*14+q.z*6)+.009*Math.sin(q.x*43);const blend=THREE.MathUtils.smoothstep(y+irregular,-.15,-.035);col=belly.clone().lerp(dorsal,blend);const f=1+.017*Math.sin(q.x*32+q.z*64)*Math.sin(q.y*81);col.multiplyScalar(f);colors.push(col.r,col.g,col.b);}else colors.push(...palette[type]);
 let w=override===null?weights(q.x):[override,override,1,0];si.push(w[0],w[1],0,0);sw.push(w[2],w[3],0,0);return n;}
 function grid(rows,cols,fn,weight=null,type='skin',flip=false,omit=null){let ids=[];for(let i=0;i<=rows;i++){ids[i]=[];for(let j=0;j<=cols;j++)ids[i][j]=vertex(fn(i/rows,j/cols),typeof weight==='function'?weight(i/rows,j/cols):weight,type);}
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){if(omit?.((i+.5)/rows,(j+.5)/cols))continue;let a=ids[i][j],b=ids[i+1][j],c=ids[i][j+1],d=ids[i+1][j+1];idx.push(...(flip?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}return ids;}
 const sections=[[1.56,.009,.016,.017],[1.47,.046,.075,.018],[1.33,.12,.155,.016],[1.12,.205,.226,.01],[.83,.274,.278,0],[.49,.327,.30,-.006],[.13,.334,.285,-.014],[-.24,.293,.238,-.012],[-.61,.214,.167,0],[-.95,.122,.094,0],[-1.24,.06,.061,.008],[-1.36,.041,.05,.008]];
 function cross(x){let k=0;while(k<sections.length-2&&x<sections[k+1][0])k++;const a=sections[k],b=sections[k+1],u=clamp((a[0]-x)/(a[0]-b[0]),0,1);const out=[];for(let c=1;c<4;c++){const prev=sections[Math.max(0,k-1)],next=sections[Math.min(sections.length-1,k+2)],m0=(b[c]-prev[c])/(b[0]-prev[0])*(b[0]-a[0]),m1=(next[c]-a[c])/(next[0]-a[0])*(b[0]-a[0]);out.push((2*u**3-3*u*u+1)*a[c]+(u**3-2*u*u+u)*m0+(-2*u**3+3*u*u)*b[c]+(u**3-u*u)*m1);}return out;}
 const mouthStart=.84,mouthEnd=1.415;
 function bodyPoint(t,a){const x=1.56-t*2.92,[ry,rz,cy]=cross(x),ang=a*Math.PI*2;return V(x,cy+ry*Math.cos(ang),rz*Math.sin(ang));}
 grid(110,64,bodyPoint,null,'skin',false,(t,a)=>{const x=1.56-t*2.92;return x>mouthStart&&x<mouthEnd&&a>.325&&a<.675;});
 grid(30,30,(u,v)=>{const x=mouthStart+u*(mouthEnd-mouthStart),[ry,rz,cy]=cross(x),a=(.325+v*.35)*Math.PI*2;return V(x,cy+ry*Math.cos(a)-.002,rz*Math.sin(a));},jaw,'skin',true);
 function oval(center,radii,which,type,nu=28,nv=18){grid(nv,nu,(u,v)=>{let a=u*Math.PI,b=v*Math.PI*2;return V(center.x+radii.x*Math.sin(a)*Math.cos(b),center.y+radii.y*Math.cos(a),center.z+radii.z*Math.sin(a)*Math.sin(b));},which,type,true);}
 oval(V(1.125,-.097,0),V(.30,.049,.155),skull,'mouth');
 oval(V(1.09,-.17,0),V(.25,.048,.157),jaw,'mouth');
 const bez=(a,b,c,t)=>a.clone().multiplyScalar((1-t)**2).addScaledVector(b,2*t*(1-t)).addScaledVector(c,t*t);
 function fin(lead,trail,thickness,which,normal){for(let sign of[-1,1])grid(28,16,(u,v)=>{let a=bez(...lead,u),b=bez(...trail,u);return a.lerp(b,v).addScaledVector(normal,sign*thickness*(1-u)*Math.sin(Math.PI*v));},which,normal.y>0?(sign>0?'fintop':'finbottom'):'skin',sign<0);}
 fin([V(.30,.28,0),V(.14,.76,0),V(-.20,.91,0)],[V(-.53,.25,0),V(-.36,.33,0),V(-.20,.91,0)],.051,null,V(0,0,1));
 fin([V(-.89,.112,0),V(-.94,.27,0),V(-1.05,.30,0)],[V(-1.17,.075,0),V(-1.10,.12,0),V(-1.05,.30,0)],.018,null,V(0,0,1));
 for(const sign of[-1,1]){
 fin([V(.52,-.11,sign*.22),V(.22,-.23,sign*.69),V(-.40,-.28,sign*1.03)],[V(-.11,-.17,sign*.205),V(-.18,-.27,sign*.70),V(-.40,-.28,sign*1.03)],.036,sign>0?finL:finR,V(0,1,0));
 fin([V(-.42,-.17,sign*.12),V(-.56,-.21,sign*.34),V(-.84,-.25,sign*.40)],[V(-.81,-.125,sign*.10),V(-.76,-.20,sign*.29),V(-.84,-.25,sign*1.40- sign)],.020,sign>0?pelvicL:pelvicR,V(0,1,0));
 }
 fin([V(-.92,-.10,0),V(-1.02,-.26,0),V(-1.13,-.28,0)],[V(-1.20,-.056,0),V(-1.11,-.10,0),V(-1.13,-.28,0)],.018,null,V(0,0,1));
 fin([V(-1.29,.016,0),V(-1.44,.49,0),V(-1.98,.86,0)],[V(-1.55,-.012,0),V(-1.57,.49,0),V(-1.98,.86,0)],.047,caudal,V(0,0,1));
 fin([V(-1.29,.016,0),V(-1.49,-.37,0),V(-1.89,-.65,0)],[V(-1.55,-.012,0),V(-1.61,-.35,0),V(-1.89,-.65,0)],.042,caudal,V(0,0,1));
 for(let s of[-1,1]){
 oval(V(1.075,.033,s*.221),V(.039,.038,.018),skull,'eye',20,14);
 oval(V(1.347,-.045,s*.104),V(.020,.010,.017),skull,'gill',14,10);
 for(let g=0;g<5;g++){let x=.77-g*.071;grid(18,2,(u,v)=>{let a=.66+u*1.67,[ry,rz,cy]=cross(x);return V(x+(v-.5)*.010+.013*Math.sin(u*Math.PI),cy+ry*Math.cos(a),s*(rz+.0025)*Math.sin(a));},g<2?skull:null,'gill',s<0);}
 }
 function tooth(center,w,h,which,up){const a=vertex(center.clone().add(V(-w/2,0,-.006)),which,'teeth'),b=vertex(center.clone().add(V(w/2,0,-.006)),which,'teeth'),c=vertex(center.clone().add(V(0,up*h,.002)),which,'teeth'),d=vertex(center.clone().add(V(0,0,.01)),which,'teeth');idx.push(a,b,c,a,d,b,a,c,d,b,d,c);}
 for(let k=0;k<25;k++){const a=(k/24)*Math.PI, x=.84+.51*Math.sin(a),z=.166*Math.cos(a),h=.026+.008*Math.sin(a);tooth(V(x,-.082,z),.030,h,skull,-1);tooth(V(x-.015,-.167,z*.97),.026,h*.85,jaw,1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));geo.setIndex(idx);geo.computeVertexNormals();
 const mat=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.40,metalness:.10,clearcoat:.18,clearcoatRoughness:.40,side:THREE.DoubleSide});
 const mesh=new THREE.SkinnedMesh(geo,mat);mesh.name='procedural_white_shark_skin';mesh.frustumCulled=false;mesh.add(bones[0]);const skeleton=new THREE.Skeleton(bones);mesh.bind(skeleton);root.add(mesh);
 const cartilage=new THREE.Group();cartilage.name='cartilage_structure_approximation';root.add(cartilage);cartilage.visible=false;
 const cartilageMat=new THREE.MeshStandardMaterial({color:'#a9d4c8',roughness:.60,emissive:'#143e3a',emissiveIntensity:.2,depthTest:false});
 const pieces=[];
 function attached(g,m,b,offset=V(),q=null){const o=new THREE.Mesh(g,m);o.position.copy(offset);if(q)o.quaternion.copy(q);o.renderOrder=10;cartilage.add(o);pieces.push({o,b,offset:offset.clone(),q:o.quaternion.clone()});return o;}
 const cyGeo=new THREE.CylinderGeometry(.030,.034,.062,10);cyGeo.rotateZ(Math.PI/2);
 for(let i=0;i<axial.length;i++){
 const scale=1-.54*i/22,o=attached(cyGeo,cartilageMat,axial[i]);o.scale.set(1,scale,scale);
 const arch=new THREE.TorusGeometry(.038*scale,.006,5,12,Math.PI);arch.rotateY(Math.PI/2);attached(arch,cartilageMat,axial[i],V(0,.033*scale,0));
 }
 const craniumGeo=new THREE.SphereGeometry(1,24,14);let cr=attached(craniumGeo,cartilageMat,skull,V(.34,.02,0));cr.scale.set(.38,.125,.165);
 function rod(a,b,bi,r=.01){let d=b.clone().sub(a),m=a.clone().add(b).multiplyScalar(.5);const g=new THREE.CylinderGeometry(r,r*.8,d.length(),7);attached(g,cartilageMat,bi,m.clone().sub(rest[bi]),new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));}
 for(let s of[-1,1]){for(let i=0;i<7;i++)rod(V(.40-i*.04,-.12,s*.25),V(-.1-i*.045,-.25,s*(.52+i*.065)),s>0?finL:finR,.009);}
 const jawPts=[];for(let i=0;i<=30;i++){let a=i/30*Math.PI;jawPts.push(V(.08+.48*Math.sin(a),-.058,.167*Math.cos(a)));}
 attached(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(jawPts),40,.015,7,false),cartilageMat,jaw);
 const mouth=new THREE.Object3D();mouth.position.set(.58,-.10,0);bones[skull].add(mouth);
 const desired=bones.map(()=>new THREE.Quaternion());let phase=0,turnSmooth=0,jawAngle=0;
 function update(dt,speed,yawRate,pitch,jawTarget){phase+=dt*2*Math.PI*(.38+speed*.28);turnSmooth=THREE.MathUtils.damp(turnSmooth,yawRate,5,dt);desired[skull].identity();let prev=0;
 for(let i=0;i<axial.length;i++){let u=(i+1)/axial.length,tangent=(.018+.28*u*u)*Math.sin(phase-u*4.5)-turnSmooth*.32*u;desired[axial[i]].setFromAxisAngle(V(0,1,0),clamp(tangent-prev,-.12,.12));prev=tangent;}
 desired[caudal].setFromAxisAngle(V(0,1,0),Math.sin(phase-4.7)*.16);
 desired[finL].setFromEuler(new THREE.Euler(.09+turnSmooth*.12,0,pitch*.16+.014*Math.sin(phase)));
 desired[finR].setFromEuler(new THREE.Euler(-.09+turnSmooth*.12,0,pitch*.16+.014*Math.sin(phase)));
 jawAngle=THREE.MathUtils.damp(jawAngle,clamp(jawTarget,0,.72),8,dt);desired[jaw].setFromAxisAngle(V(0,0,1),-jawAngle);
 const t=1-Math.exp(-dt*18);for(let i=0;i<bones.length;i++)bones[i].quaternion.slerp(desired[i],t);
 root.updateMatrixWorld(true);skeleton.update();
 if(cartilage.visible)for(const e of pieces){e.o.position.copy(e.offset).applyMatrix4(bones[e.b].matrixWorld);root.worldToLocal(e.o.position);bones[e.b].getWorldQuaternion(e.o.quaternion);e.o.quaternion.premultiply(root.quaternion.clone().invert()).multiply(e.q);}
 }
 function audit(){let maxLengthError=0,maxScaleError=0,maxWeightError=0;for(let i=0;i<bones.length;i++){const expected=i===0?rest[i]:rest[i].clone().sub(rest[bones.indexOf(bones[i].parent)]);maxLengthError=Math.max(maxLengthError,bones[i].position.distanceTo(expected));maxScaleError=Math.max(maxScaleError,bones[i].scale.distanceTo(V(1,1,1)));}for(let i=0;i<sw.length;i+=4)maxWeightError=Math.max(maxWeightError,Math.abs(sw[i]+sw[i+1]+sw[i+2]+sw[i+3]-1));return{boneCount:bones.length,axialControlCount:axial.length,skinnedMeshes:1,vertices:p.length/3,triangles:idx.length/3,maxLengthError,maxScaleError,maxWeightError,actualSpecimenReconstruction:false};}
 return{root,mesh,bones,skeleton,cartilage,mat,mouth,update,audit,getJaw:()=>jawAngle,profile:PROFILE};
}
export function createFishGeometry(){
 const g=new THREE.SphereGeometry(1,16,10);g.scale(.16,.054,.039);
 const tail=new THREE.BufferGeometry();tail.setAttribute('position',new THREE.Float32BufferAttribute([-.13,0,0,-.24,.066,0,-.213,0,0,-.13,0,0,-.213,0,0,-.24,-.066,0],3));tail.computeVertexNormals();return{body:g,tail};
}
