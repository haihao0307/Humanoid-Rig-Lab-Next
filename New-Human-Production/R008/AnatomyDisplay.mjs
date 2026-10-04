import * as THREE from 'three';
import {fitMotorAnatomy,bellyProfile,pathMetrics,muscleKinematics} from './MotorAnatomy.mjs';

// Geometry is generated in this subject's bind frame. No baked anatomical assets.
export function createAnatomyDisplay(subject,actor){
 const profile=subject.body.anatomy,model=fitMotorAnatomy(profile),h=profile.frame.height;
 const root=new THREE.Group();root.name='GeneratedMotionAnatomy';actor.add(root);
 const framework=new THREE.Group(),muscles=new THREE.Group();root.add(framework,muscles);
 const rigid=[],moving=[],boneMaterial=new THREE.MeshStandardMaterial({color:0xddd2ab,roughness:.65}),jointMaterial=new THREE.MeshStandardMaterial({color:0x5fd6e5,roughness:.45});
 const v=p=>new THREE.Vector3(...p),axes={right:v(profile.frame.right),up:v(profile.frame.up),front:v(profile.frame.front)};
 const pos=r=>v(profile.joints[profile.roles[r]].position),offset=(p,x=0,y=0,z=0)=>p.clone().addScaledVector(axes.right,x*h).addScaledVector(axes.up,y*h).addScaledVector(axes.front,z*h);
 const owner=id=>{const group=new THREE.Group();group.matrixAutoUpdate=false;framework.add(group);rigid.push({group,bone:subject.skeleton.bones[id],inverse:subject.skeleton.boneInverses[id]});return group;};
 const roleGroup=r=>owner(profile.roles[r]);
 function ellipsoid(g,p,x,y,z,material=boneMaterial){const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),material);m.position.copy(p);m.scale.set(x*h,y*h,z*h);const matrix=new THREE.Matrix4().makeBasis(axes.right,axes.up,axes.front);m.quaternion.setFromRotationMatrix(matrix);g.add(m);return m;}
 function tube(g,points,r,material=boneMaterial){const curve=new THREE.CatmullRomCurve3(points,false,'centripetal'),mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*4),r*h,8,false),material);g.add(mesh);return mesh;}
 function longBone(a,b,r=.008,x=0,z=0){if(!Number.isInteger(profile.roles[a])||!Number.isInteger(profile.roles[b]))return;const g=roleGroup(a),p=offset(pos(a),x,0,z),q=offset(pos(b),x,0,z);tube(g,[p,p.clone().lerp(q,.5),q],r);ellipsoid(g,p,r*1.45,r*1.45,r*1.45);ellipsoid(g,q,r*1.6,r*1.6,r*1.6);}
 for(const side of ['l','r']){
  const sign=side==='l'?1:-1;
  longBone('upperarm_'+side,'lowerarm_'+side,.0075);longBone('lowerarm_'+side,'hand_'+side,.0045,-sign*.004,.002);longBone('lowerarm_'+side,'hand_'+side,.004,sign*.004,-.002);
  longBone('thigh_'+side,'calf_'+side,.011);longBone('calf_'+side,'foot_'+side,.008,-sign*.004,.001);longBone('calf_'+side,'foot_'+side,.004,sign*.009,-.003);
  longBone('clavicle_'+side,'upperarm_'+side,.005);longBone('foot_'+side,'ball_'+side,.006);
  const foot=roleGroup('foot_'+side),ankle=pos('foot_'+side),ball=pos('ball_'+side);ellipsoid(foot,offset(ankle,0,-.014,-.009),.013,.010,.017);
  for(let toe=0;toe<5;toe++){const spread=(toe-2)*.006*sign,base=offset(ball,spread,0,0),tip=offset(base,0,-.003,.018-(toe*.0018));tube(foot,[offset(ankle,spread*.3,-.003,0),base],.0028);tube(foot,[base,tip],.0021);}
  const scapula=roleGroup('chest'),shoulder=pos('upperarm_'+side),neck=pos('neck');tube(scapula,[offset(neck,sign*.030,-.035,-.025),offset(shoulder,-sign*.005,-.038,-.027),offset(neck,sign*.030,-.085,-.027),offset(neck,sign*.030,-.035,-.025)],.005);
  // Metacarpals and observed phalanges follow their own binding frames.
  for(const digit of ['thumb','index','middle','ring','pinky'])for(let n=1;n<=3;n++){
   const r=digit+'_'+n+'_'+side,id=profile.roles[r];if(!Number.isInteger(id))continue;
   if(n===1)longBone('hand_'+side,r,.0026);
   const next=digit+'_'+(n+1)+'_'+side;if(n<3)longBone(r,next,.0023);else{const bone=subject.skeleton.bones[id],child=bone.children.find(c=>c.isBone);if(child){const p=pos(r),q=new THREE.Vector3().setFromMatrixPosition(subject.bindWorld.get(child)||child.matrixWorld);tube(owner(id),[p,q],.002);}}
  }
  const patella=roleGroup('thigh_'+side);ellipsoid(patella,offset(pos('calf_'+side),0,0,.014),.011,.015,.007);
 }
 for(const r of ['pelvis','spineLower','spineMiddle','chest','neck']){const s=profile.segments[profile.roles[r]],g=roleGroup(r),a=v(s.start),b=v(s.end);for(let i=0;i<4;i++){const p=a.clone().lerp(b,(i+.2)/4);ellipsoid(g,p,r==='neck'?.011:.019,.006,r==='neck'?.010:.016);tube(g,[offset(p,0,0,-.010),offset(p,0,0,-.027)],.0035);}}
 const chest=pos('chest'),neck=pos('neck'),pelvis=pos('pelvis'),thorax=roleGroup('chest'),shoulderWidth=profile.observations.shoulderDistance/h;
 // A rig's chest joint can sit at the bottom of the thorax. Use neck/shoulder
 // landmarks for its upper edge instead of interpreting the bone name as a rib centre.
 const thoraxTop=offset(neck,0,-.040,0);
 for(let i=0;i<10;i++)for(const sign of [-1,1]){const t=i/9,width=shoulderWidth*(.34+.10*Math.sin(t*Math.PI)),height=-t*.145,depth=.037+.014*Math.sin(t*Math.PI),points=[];for(let k=0;k<=22;k++){const theta=k/22*Math.PI;points.push(offset(thoraxTop,sign*width*Math.sin(theta),height-.014*Math.sin(theta),-depth*Math.cos(theta)));}tube(thorax,points,.0028);}
 tube(thorax,[offset(thoraxTop,0,.005,.037),offset(thoraxTop,0,-.080,.049),offset(thoraxTop,0,-.145,.039)],.005);
 const hips=roleGroup('pelvis');for(const sign of [-1,1]){const width=Math.abs(pos('thigh_'+(sign===1?'l':'r')).clone().sub(pelvis).dot(axes.right))/h+.025,points=[];for(let i=0;i<=32;i++){const t=i/32*Math.PI*2;points.push(offset(pelvis,sign*(width*.67+width*.40*Math.cos(t)),.015+.042*Math.sin(t),-.007+.027*Math.cos(t)));}tube(hips,points,.010);tube(hips,[offset(pelvis,sign*width*.8,-.015,-.009),offset(pelvis,sign*width*.34,-.062,.025),offset(pelvis,0,-.036,.030)],.007);}
 ellipsoid(hips,offset(pelvis,0,.005,-.009),.026,.038,.014);
 const head=pos('head'),skull=roleGroup('head'),headTop=profile.frame.top-head.clone().sub(v(profile.frame.origin)).dot(axes.up),craniumY=Math.max(.035,Math.min(.066,headTop/h*.46));
 ellipsoid(skull,offset(head,0,craniumY,.012),.042,craniumY,.048);
 // Deliberately schematic facial bones: orbital rims + jaw, not recovered face anatomy.
 for(const sign of [-1,1]){const points=[];for(let i=0;i<=28;i++){const a=i/28*Math.PI*2;points.push(offset(head,sign*.020+.014*Math.cos(a),.023+.011*Math.sin(a),.054));}tube(skull,points,.0025);}
 tube(skull,[offset(head,-.036,.019,.032),offset(head,-.028,-.016,.047),offset(head,0,-.031,.051),offset(head,.028,-.016,.047),offset(head,.036,.019,.032)],.006);
 for(const r of ['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'])ellipsoid(roleGroup(r),pos(r),.007,.007,.007,jointMaterial);
 const inverseActor=new THREE.Matrix4();
 const segments=36,sides=12;
 for(const spec of model.muscles){const anchors=spec.attachments.map(a=>({bone:subject.skeleton.bones[a.bone],local:v(a.bindPoint).applyMatrix4(subject.skeleton.boneInverses[a.bone])})),curve=new THREE.CatmullRomCurve3(spec.attachments.map(a=>v(a.bindPoint)),false,'centripetal'),points=curve.getPoints(segments),rest=pathMetrics(points.map(p=>p.toArray())),geometry=new THREE.BufferGeometry(),positions=new Float32Array((segments+1)*(sides+1)*3),normals=new Float32Array(positions.length),colors=new Float32Array(positions.length),indices=[];
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:0,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.name=spec.id;mesh.frustumCulled=false;muscles.add(mesh);moving.push({spec,anchors,curve,rest,geometry,mesh,previousLength:rest.length,state:null});
 }
 let selection='all',mode='framework';
 function update(dt=0){actor.updateMatrixWorld(true);inverseActor.copy(actor.matrixWorld).invert();for(const r of rigid)r.group.matrix.copy(inverseActor).multiply(r.bone.matrixWorld).multiply(r.inverse);
  for(const m of moving){m.curve.points=m.anchors.map(a=>a.local.clone().applyMatrix4(a.bone.matrixWorld).applyMatrix4(inverseActor));const points=m.curve.getPoints(segments),metrics=pathMetrics(points.map(p=>p.toArray())),state=muscleKinematics(m.rest,metrics,m.spec.radius,m.previousLength,dt);m.previousLength=metrics.length;m.state=state;
   const frames=m.curve.computeFrenetFrames(segments,false),p=m.geometry.attributes.position,n=m.geometry.attributes.normal,c=m.geometry.attributes.color,color=new THREE.Color(state.lengthRatio<.98?0xe35732:state.lengthRatio>1.02?0x4985aa:0xa82c36),tendon=new THREE.Color(0xe5d9b5);
   if(selection===m.spec.id)color.set(0xffb73a);
   for(let i=0;i<=segments;i++){const t=i/segments,r=m.spec.radius*state.radialScale*bellyProfile(t),shade=t<.13||t>.87?tendon:color;for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,d=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a)),q=points[i].clone().addScaledVector(d,r),k=i*(sides+1)+j;p.setXYZ(k,q.x,q.y,q.z);n.setXYZ(k,d.x,d.y,d.z);c.setXYZ(k,shade.r,shade.g,shade.b);}}
   p.needsUpdate=n.needsUpdate=c.needsUpdate=true;m.mesh.visible=mode==='muscles'&&(selection==='all'||selection===m.spec.id||moving.find(q=>q.spec.id===selection)?.spec.antagonist===m.spec.id);m.mesh.material.opacity=1;
  }
 }
 update();root.visible=false;
 return {root,model,update,setMode(v){mode=v;root.visible=true;framework.visible=true;muscles.visible=v==='muscles';update();},select(id){selection=id;update();},get report(){return {schema:model.schema,mode,frameworkParts:rigid.length,muscles:moving.map(m=>({id:m.spec.id,label:m.spec.label,action:m.spec.action,antagonist:m.spec.antagonist,...m.state,restLength:m.rest.length,endpoints:m.curve.points.map(p=>p.toArray())})),authority:model.authority,unknown:model.unknown};},dispose(){root.removeFromParent();root.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material!==boneMaterial&&o.material!==jointMaterial)o.material.dispose();}});boneMaterial.dispose();jointMaterial.dispose();}};
}
