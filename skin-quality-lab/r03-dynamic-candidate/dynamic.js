// Independent browser implementation. No Unity source, shaders, textures or demo assets are included.
// General operations: localized displacement, indexed-mesh strain, and an artistic colour response.
export const dynamicDefaults={enabled:true,smile:.55,brow:.22,blush:.6,wrinkle:.6,tensionGain:3,pulse:.22,rate:1,playing:true,diagnostic:0};
export const deformationGLSL=`
float dynGaussian(vec3 p,vec3 center,vec3 radius){vec3 q=(p-center)/radius;return exp(-dot(q,q));}
vec3 dynamicOffset(vec3 p,float smile,float brow){
 float front=smoothstep(.015,.055,p.z);
 vec2 corner=vec2(dynGaussian(p,vec3(.031,-.040,.077),vec3(.026,.022,.037)),dynGaussian(p,vec3(-.031,-.040,.077),vec3(.026,.022,.037)))*front;
 vec2 cheek=vec2(dynGaussian(p,vec3(.046,.003,.065),vec3(.024,.027,.040)),dynGaussian(p,vec3(-.046,.003,.065),vec3(.024,.027,.040)))*front;
 vec2 forehead=vec2(dynGaussian(p,vec3(.029,.066,.066),vec3(.024,.018,.040)),dynGaussian(p,vec3(-.029,.066,.066),vec3(.024,.018,.040)))*front;
 return vec3((.0040*(corner.x-corner.y)+.0012*(cheek.x-cheek.y))*smile,.0060*(corner.x+corner.y)*smile+.0028*(cheek.x+cheek.y)*smile-.0035*(forehead.x+forehead.y)*brow,.0018*(cheek.x+cheek.y)*smile+.0015*(forehead.x+forehead.y)*brow);
}`;
function offset(x,y,z,smile,brow,out,i){const gauss=(cx,cy,cz,rx,ry,rz)=>Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2));let f=Math.max(0,Math.min(1,(z-.015)/.04));f=f*f*(3-2*f);const ar=gauss(.031,-.040,.077,.026,.022,.037)*f,al=gauss(-.031,-.040,.077,.026,.022,.037)*f,br=gauss(.046,.003,.065,.024,.027,.040)*f,bl=gauss(-.046,.003,.065,.024,.027,.040)*f,cr=gauss(.029,.066,.066,.024,.018,.040)*f,cl=gauss(-.029,.066,.066,.024,.018,.040)*f;out[i]=(.004*(ar-al)+.0012*(br-bl))*smile;out[i+1]=.006*(ar+al)*smile+.0028*(br+bl)*smile-.0035*(cr+cl)*brow;out[i+2]=.0018*(br+bl)*smile+.0015*(cr+cl)*brow;}
export function createDynamicLayer(THREE,geo){
 const rest=geo.attributes.position.array.slice(),restNormal=geo.attributes.normal.array.slice(),ix=geo.index.array,n=rest.length/3;
 const delta=new Float32Array(rest.length),normalDelta=new Float32Array(rest.length),deformed=new Float32Array(rest.length),strain=new Float32Array(n);
 // Shape basis and its differential are precomputed once. Slider updates do not
 // evaluate Gaussian fields 6 times per vertex; only linear combinations remain.
 const basisA=new Float32Array(rest.length),basisB=new Float32Array(rest.length),jacA=new Float32Array(n*9),jacB=new Float32Array(n*9);
 {const e=1e-5,a=new Float64Array(3),b=new Float64Array(3);for(let i=0;i<rest.length;i+=3){const x=rest[i],y=rest[i+1],z=rest[i+2];offset(x,y,z,1,0,basisA,i);offset(x,y,z,0,1,basisB,i);for(let shape=0;shape<2;shape++){const jac=shape?jacB:jacA;for(let axis=0;axis<3;axis++){offset(x+(axis===0?e:0),y+(axis===1?e:0),z+(axis===2?e:0),1-shape,shape,a,0);offset(x-(axis===0?e:0),y-(axis===1?e:0),z-(axis===2?e:0),1-shape,shape,b,0);for(let q=0;q<3;q++)jac[i*3+axis*3+q]=(a[q]-b[q])/(2*e);}}}}
 const adj=Array.from({length:n},()=>new Set());for(let k=0;k<ix.length;k+=3){const a=ix[k],b=ix[k+1],c=ix[k+2];adj[a].add(b).add(c);adj[b].add(a).add(c);adj[c].add(a).add(b);}
 const offsets=new Uint32Array(n+1);for(let i=0;i<n;i++)offsets[i+1]=offsets[i]+adj[i].size;const neighbours=new Uint32Array(offsets[n]);for(let i=0;i<n;i++)neighbours.set([...adj[i]],offsets[i]);
 const lengthMean=(p,i)=>{let s=0,k=i*3;for(let a=offsets[i];a<offsets[i+1];a++){const j=neighbours[a]*3;s+=Math.hypot(p[k]-p[j],p[k+1]-p[j+1],p[k+2]-p[j+2]);}return s/Math.max(1,offsets[i+1]-offsets[i]);};
 const restLength=new Float64Array(n);for(let i=0;i<n;i++)restLength[i]=lengthMean(rest,i);
 geo.setAttribute('dynamicDelta',new THREE.BufferAttribute(delta,3));geo.setAttribute('dynamicNormalDelta',new THREE.BufferAttribute(normalDelta,3));geo.setAttribute('dynamicStrain',new THREE.BufferAttribute(strain,1));
 const uniforms={uDynamic:{value:1},uDynamicBlush:{value:.6},uDynamicWrinkle:{value:.6},uDynamicGain:{value:3},uDynamicPulse:{value:0},uDynamicDiagnostic:{value:0},uDynamicSmile:{value:.55},uDynamicBrow:{value:.22}};
 const state={source:'independent general geometry and artistic shading',enginePath:'CPU adjacency/strain + GPU vertex delta application',vertices:n,edges:neighbours.length/2,affectedVertices:0,maxDisplacementMM:0,minStrain:0,maxStrain:0,updateMS:0};
 let lastSmile=NaN,lastBrow=NaN;
 function update(v){uniforms.uDynamic.value=v.enabled?1:0;uniforms.uDynamicBlush.value=v.blush;uniforms.uDynamicWrinkle.value=v.wrinkle;uniforms.uDynamicGain.value=v.tensionGain;uniforms.uDynamicDiagnostic.value=v.diagnostic;uniforms.uDynamicSmile.value=v.smile;uniforms.uDynamicBrow.value=v.brow;
 if(lastSmile===v.smile&&lastBrow===v.brow)return;lastSmile=v.smile;lastBrow=v.brow;const begin=performance.now();
 state.maxDisplacementMM=0;state.affectedVertices=0;
 for(let i=0;i<rest.length;i+=3){delta[i]=basisA[i]*v.smile+basisB[i]*v.brow;delta[i+1]=basisA[i+1]*v.smile+basisB[i+1]*v.brow;delta[i+2]=basisA[i+2]*v.smile+basisB[i+2]*v.brow;deformed[i]=rest[i]+delta[i];deformed[i+1]=rest[i+1]+delta[i+1];deformed[i+2]=rest[i+2]+delta[i+2];const d=Math.hypot(delta[i],delta[i+1],delta[i+2]);if(d>1e-5)state.affectedVertices++;state.maxDisplacementMM=Math.max(state.maxDisplacementMM,d*1000);}
 // Cofactor (inverse-transpose up to normalization) transports the original normal.
 const dx=new Float64Array(3),dy=new Float64Array(3),dz=new Float64Array(3);
 for(let i=0;i<rest.length;i+=3){for(let axis=0;axis<3;axis++){const col=[dx,dy,dz][axis];for(let q=0;q<3;q++){const j=i*3+axis*3+q;col[q]=jacA[j]*v.smile+jacB[j]*v.brow+(q===axis?1:0);}}
 const nx=restNormal[i],ny=restNormal[i+1],nz=restNormal[i+2];const cx=(dy[1]*dz[2]-dy[2]*dz[1])*nx+(dz[1]*dx[2]-dz[2]*dx[1])*ny+(dx[1]*dy[2]-dx[2]*dy[1])*nz,cy=(dy[2]*dz[0]-dy[0]*dz[2])*nx+(dz[2]*dx[0]-dz[0]*dx[2])*ny+(dx[2]*dy[0]-dx[0]*dy[2])*nz,cz=(dy[0]*dz[1]-dy[1]*dz[0])*nx+(dz[0]*dx[1]-dz[1]*dx[0])*ny+(dx[0]*dy[1]-dx[1]*dy[0])*nz,l=Math.hypot(cx,cy,cz)||1;normalDelta[i]=cx/l-nx;normalDelta[i+1]=cy/l-ny;normalDelta[i+2]=cz/l-nz;}
 state.minStrain=Infinity;state.maxStrain=-Infinity;for(let i=0;i<n;i++){strain[i]=restLength[i]>1e-9?(lengthMean(deformed,i)/restLength[i]-1):0;state.minStrain=Math.min(state.minStrain,strain[i]);state.maxStrain=Math.max(state.maxStrain,strain[i]);}
 for(const a of['dynamicDelta','dynamicNormalDelta','dynamicStrain'])geo.attributes[a].needsUpdate=true;state.updateMS=performance.now()-begin;
 }
 function vertex(s){Object.assign(s.uniforms,uniforms);s.vertexShader='attribute vec3 dynamicDelta,dynamicNormalDelta;attribute float dynamicStrain;uniform float uDynamic;varying float vDynamicStrain;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(uDynamic>.5)objectNormal=normalize(objectNormal+dynamicNormalDelta);');s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=dynamicDelta*uDynamic;vDynamicStrain=dynamicStrain;');}
 function patchSkin(s){vertex(s);s.fragmentShader='uniform float uDynamic,uDynamicBlush,uDynamicWrinkle,uDynamicGain,uDynamicPulse,uDynamicDiagnostic;varying float vDynamicStrain;\n'+s.fragmentShader;
 s.fragmentShader=s.fragmentShader.replace('float skinSpecMask=',`float dynamicStretch=clamp(vDynamicStrain*uDynamicGain,-1.,1.);float dynamicPressure=max(-dynamicStretch,0.);float dynamicRegion=clamp(skinZone+.35*exp(-pow((vSkinPosition.y-.066)/.025,2.))*skinFront,0.,1.);
 float dynamicBlood=uDynamic*(uDynamicBlush*(.55*dynamicRegion+dynamicPressure*1.5)+uDynamicPulse*dynamicRegion);
 if(uBaseline<.5)diffuseColor.rgb*=exp(vec3(.22,-.36,-.25)*dynamicBlood);
 float skinSpecMask=`);
 // Albedo pass must see the same dynamic colour before returning.
 s.fragmentShader=s.fragmentShader.replace('if(uPass>1.5){gl_FragColor=vec4(diffuseColor.rgb,1.);return;}','');
 s.fragmentShader=s.fragmentShader.replace('float skinSpecMask=', 'if(uPass>1.5){gl_FragColor=vec4(diffuseColor.rgb,1.);return;}\n float skinSpecMask=');
 s.fragmentShader=s.fragmentShader.replace('float skinSpecMask=texture2D(uSpec,vMapUv).r;','float skinSpecMask=texture2D(uSpec,vMapUv).r;\n roughnessFactor=clamp(roughnessFactor+uDynamic*(dynamicPressure*.07-max(dynamicStretch,0.)*.04),.24,.85);');
 s.fragmentShader=s.fragmentShader.replace('mesoN.xy/max(mesoN.z,.3)*uMeso','mesoN.xy/max(mesoN.z,.3)*uMeso*(1.+uDynamic*uDynamicWrinkle*dynamicPressure*4.)');
 s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`if(uDynamicDiagnostic>.5&&uDynamic>.5){float st=clamp(vDynamicStrain*uDynamicGain,-1.,1.);outgoingLight=mix(vec3(.24,.3,.31),st<0.?vec3(.08,.45,.9):vec3(.96,.25,.06),min(1.,abs(st)*3.));}\n#include <opaque_fragment>`);
 }
 function patchFuzz(material){Object.assign(material.uniforms,uniforms);material.vertexShader='uniform float uDynamic,uDynamicSmile,uDynamicBrow;\n'+deformationGLSL+'\n'+material.vertexShader;material.vertexShader=material.vertexShader.replace('vec4 p=modelViewMatrix*vec4(pp,1.);','pp+=dynamicOffset(position,uDynamicSmile,uDynamicBrow)*uDynamic;vec4 p=modelViewMatrix*vec4(pp,1.);');}
 update(dynamicDefaults);return {uniforms,state,update,patchSkin,patchDepth:vertex,patchFuzz,rest,delta,strain};
}
