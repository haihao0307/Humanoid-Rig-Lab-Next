function makeFuzz(geo){
 let seed=20261007;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
 const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,idx=geo.index.array;
 const area=new Float64Array(idx.length/3);let sum=0;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),tmp=new THREE.Vector3(),edge=new THREE.Vector3();
 for(let i=0;i<idx.length;i+=3){a.fromBufferAttribute(p,idx[i]);b.fromBufferAttribute(p,idx[i+1]);c.fromBufferAttribute(p,idx[i+2]);sum+=tmp.subVectors(b,a).cross(edge.subVectors(c,a)).length()*.5;area[i/3]=sum;}
 const ps=[],ns=[],tans=[],uvs=[],st=[],sides=[],ix=[];let count=0;
 const nn=new THREE.Vector3(),tangent=new THREE.Vector3(),q=new THREE.Vector3(),v=new THREE.Vector3(),flow=new THREE.Vector3(.12,-1,.06);
 for(let k=0;k<60000&&count<14000;k++){
  const pick=rand()*sum;let lo=0,hi=area.length-1;while(lo<hi){let mid=(lo+hi)>>>1;if(area[mid]<pick)lo=mid+1;else hi=mid;}
  const f=lo*3,ia=idx[f],ib=idx[f+1],ic=idx[f+2];let u=rand(),w=rand();if(u+w>1){u=1-u;w=1-w}
  a.fromBufferAttribute(p,ia);b.fromBufferAttribute(p,ib);c.fromBufferAttribute(p,ic);q.copy(a).multiplyScalar(1-u-w).addScaledVector(b,u).addScaledVector(c,w);
  if(q.y<-.105||q.y>.155||q.z<-.055)continue;
  const ax=Math.abs(q.x);if(ax<.027&&q.y>-.081&&q.y<-.016&&q.z>.055)continue;
  if(ax<.019&&q.y>-.012&&q.y<.095&&q.z>.08)continue;
  if(q.y>.08&&rand()>.42)continue;
  nn.set(n.getX(ia)*(1-u-w)+n.getX(ib)*u+n.getX(ic)*w,n.getY(ia)*(1-u-w)+n.getY(ib)*u+n.getY(ic)*w,n.getZ(ia)*(1-u-w)+n.getZ(ib)*u+n.getZ(ic)*w).normalize();
  flow.set(.12*Math.sign(q.x),-1,.07);tangent.copy(flow).addScaledVector(nn,-nn.dot(flow)).normalize();
  const length=.00035+rand()*.0011,uu=uv.getX(ia)*(1-u-w)+uv.getX(ib)*u+uv.getX(ic)*w,vv=uv.getY(ia)*(1-u-w)+uv.getY(ib)*u+uv.getY(ic)*w;
  const offset=ps.length/3;
  for(let j=0;j<=3;j++){let t=j/3;v.copy(q).addScaledVector(nn,.000012+length*t*.55).addScaledVector(tangent,length*t*t*.75);
   for(const side of [-1,1]){ps.push(v.x,v.y,v.z);ns.push(nn.x,nn.y,nn.z);tans.push(nn.x*.55+tangent.x*t*1.5,nn.y*.55+tangent.y*t*1.5,nn.z*.55+tangent.z*t*1.5);uvs.push(uu,vv);st.push(t);sides.push(side);}
   if(j<3){let j0=offset+j*2;ix.push(j0,j0+1,j0+2,j0+1,j0+3,j0+2);}}
  count++;
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(ns,3));g.setAttribute('tangentHair',new THREE.Float32BufferAttribute(tans,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('strandT',new THREE.Float32BufferAttribute(st,1));g.setAttribute('strandSide',new THREE.Float32BufferAttribute(sides,1));g.setIndex(ix);
 const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uFuzz:{value:values.fuzz},uRelief:E.uRelief,uSurface:E.uSurface,uPixelHeight:{value:1000},uLightDir:{value:new THREE.Vector3(-.5,.5,.6)},uLightPower:{value:2.45}},
 vertexShader:`attribute vec3 tangentHair;attribute float strandT,strandSide;uniform sampler2D uSurface;uniform float uRelief,uPixelHeight;varying float vt,vs,coverage;varying vec3 vn,vv,vHair;
 void main(){vt=strandT;vs=strandSide;vec3 pp=position+normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001;vec4 p=modelViewMatrix*vec4(pp,1.);vv=-p.xyz;vn=normalize(normalMatrix*normal);vHair=normalize(mat3(modelViewMatrix)*tangentHair);vec3 across=normalize(cross(vHair,normalize(vv)));float width=.000008*(1.-.8*vt);float pixel=-p.z/(projectionMatrix[1][1]*uPixelHeight*.5);float halfwidth=max(width,pixel*.48);coverage=width/halfwidth;p.xyz+=across*strandSide*halfwidth;gl_Position=projectionMatrix*p;}`,
 fragmentShader:`uniform float uFuzz,uLightPower;uniform vec3 uLightDir;varying float vt,vs,coverage;varying vec3 vn,vv,vHair;
 void main(){vec3 N=normalize(vn),V=normalize(vv),L=normalize(uLightDir),T=normalize(vHair);float edge=pow(1.-abs(dot(N,V)),1.8);float lam=max(dot(N,L),0.);float longitudinal=sqrt(max(1.-pow(dot(T,normalize(L+V)),2.),0.));float sheen=pow(longitudinal,22.)*(.1+.9*edge);float alpha=uFuzz*coverage*(1.-smoothstep(.25,1.,abs(vs)))*(.6+.4*edge)*smoothstep(0.,.09,vt)*(1.-smoothstep(.82,1.,vt));vec3 col=vec3(.34,.24,.16)*(.22+lam*uLightPower*.4)+vec3(.6,.48,.32)*sheen*uLightPower*.22;gl_FragColor=vec4(col,alpha);}`});
 fuzz=new THREE.Mesh(g,mat);fuzz.frustumCulled=false;scene.add(fuzz);state.fuzzStrands=count;state.fuzzTriangles=g.index.count/3;
}
