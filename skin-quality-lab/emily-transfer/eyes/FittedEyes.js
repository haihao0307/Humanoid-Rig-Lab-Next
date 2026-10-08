import * as THREE from 'three';
import {EyeSystem} from './EyeSystem.js';
import {EYE_PHOTO_DATA} from './EyePhotoData.js';
const clamp=THREE.MathUtils.clamp,smooth=t=>t*t*(3-2*t);

// Fit the original scan non-destructively. Iris color: MakeHuman CC0 atlas.
export class FittedEyes extends EyeSystem {
 constructor(options){
  super(options);
  this.ready=new THREE.TextureLoader().loadAsync(EYE_PHOTO_DATA).then(tex=>{
   tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;this.photoTexture=tex;
   for(const e of this.eyes){
    const old=e.ball.material.onBeforeCompile;
    e.contact={uEyePhoto:{value:tex},uEyeToHead:{value:new THREE.Matrix3()},uSocket:{value:new THREE.Vector4(e.c.half,e.c.rx,e.c.ry,e.c.sign)},uOpening:{value:this.config.opening},uBlink:{value:0}};
    e.ball.material.envMapIntensity=.30;e.ball.material.specularIntensity=.50;
    e.ball.material.onBeforeCompile=s=>{
     old(s);Object.assign(s.uniforms,e.contact);
     s.fragmentShader=s.fragmentShader.replace('vec3 ocularAlbedo(){',`
      uniform sampler2D uEyePhoto;uniform mat3 uEyeToHead;uniform vec4 uSocket;uniform float uOpening,uBlink;
      vec3 headEyePoint(){return uEyeToHead*vEyePoint;}
      float orbitContact(){
       vec3 p=headEyePoint();float nx=clamp(p.x/uSocket.x,-1.,1.);float ny=pow(max(0.,1.-nx*nx),.61);
       float seam=-.0037+.0031*pow(abs(nx),1.8)-.0012*nx*uSocket.w;
       float upper=mix(-.0012-.0014*nx*uSocket.w+.0053*ny*uOpening,seam,uBlink);
       float lower=mix(-.0012-.0014*nx*uSocket.w-.0031*ny*uOpening,seam,uBlink);
       float a=.28+.72*smoothstep(0.,.0032,upper-p.y);
       float b=.65+.35*smoothstep(0.,.0018,p.y-lower);
       return a*b;
      }
      vec3 ocularAlbedo(){`);
     s.fragmentShader=s.fragmentShader.replace('vec3 sclera=texture2D(uScleraField,scleraUV).rgb;',`
      vec3 hp=headEyePoint();vec2 edge=hp.xy/uSocket.yz;if(dot(edge,edge)>.975*.975)discard;
      vec2 photoCenter=vec2(723.,721.)/1024.;
      vec3 sclera=texture2D(uEyePhoto,photoCenter+P.xy*.285).rgb*.66;
     `);
     const start=s.fragmentShader.indexOf('vec3 inner=vec3(.20,.125,.046);'),end=s.fragmentShader.indexOf('float pupilMask=',start);
     if(start<0||end<0)throw Error('Iris shading integration anchor absent');
     s.fragmentShader=s.fragmentShader.slice(0,start)+`
      float photoRadius=(33.+82.*expanded)/1024.;
      vec2 irisUV=photoCenter+vec2(cos(angle*6.2831853-3.14159265),sin(angle*6.2831853-3.14159265))*photoRadius;
      vec3 photo=texture2D(uEyePhoto,irisUV).rgb;
      vec3 iris=photo*uIrisColor*.56;
      iris*=.90+.10*field.g;
      float ring=smoothstep(.89,1.02,r);iris*=1.-ring*.62;
     `+s.fragmentShader.slice(end);
     s.fragmentShader=s.fragmentShader.replace('return color*lidShade;','return color*orbitContact();');
     s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight*=.62+.38*orbitContact();\n#include <opaque_fragment>');
    };
    e.ball.material.customProgramCacheKey=()=> 'ET02-fitted-CC0-iris-1.2';e.ball.material.needsUpdate=true;
   }
   this.setPalette(this.config.iris);this.update(0,true);this.requestRender();return this;
  });
 }
 setPalette(name){
  const colors={blue:[.64,.86,1.],hazel:[1.,.68,.30],brown:[.38,.19,.07],green:[.60,.84,.42]};if(!colors[name])return;
  this.config.iris=name;for(const e of this.eyes)e.uniforms.uIrisColor.value.setRGB(...colors[name]);this.requestRender();
 }
 makeLid(c,sample,mat){
  const result=super.makeLid(c,sample,mat),g=result.mesh.geometry;
  // The skin head provides orbital shadows. Thin local lids use analytic contact
  // shading on the eye rather than low-resolution self-shadowing staircase bands.
  result.mesh.castShadow=false;
  g.setAttribute('eyelidT',new THREE.Float32BufferAttribute(result.entries.map(e=>e.t),1));
  const old=mat.onBeforeCompile;
  mat.onBeforeCompile=s=>{old(s);s.uniforms.uLidPatch={value:new THREE.Vector4(c.x,c.y,c.rx,c.ry)};s.vertexShader='attribute float eyelidT;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('uRelief*.001*(1.-uBaseline)','uRelief*.001*(1.-uBaseline)*smoothstep(.28,.88,eyelidT)');
   s.fragmentShader='uniform vec4 uLidPatch;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 patchXY=(vSkinPosition.xy-uLidPatch.xy)/uLidPatch.zw;if(dot(patchXY,patchXY)>1.004004)discard;');
  };
  mat.polygonOffset=true;mat.polygonOffsetFactor=-.05;mat.polygonOffsetUnits=-.1;
  mat.customProgramCacheKey=()=> 'ET02-lids-C1-boundary-1.2';return result;
 }
 eyeFront(c,x,y){
  const e=this._fittingEye,inv=e?e.surfaceInverse:null,r=c.radius,dx=x-c.x,dy=y-c.y,disc=r*r-dx*dx-dy*dy;
  if(disc<=0)return null;
  let z=Math.sqrt(disc),m=inv?.elements;
  for(let i=0;i<6;i++){
   const lx=m?m[0]*dx+m[4]*dy+m[8]*z:dx,ly=m?m[1]*dx+m[5]*dy+m[9]*z:dy,lz=m?m[2]*dx+m[6]*dy+m[10]*z:z;
   const rsq=r*r-lx*lx-ly*ly;if(rsq<=1e-10)break;
   const s=Math.sqrt(rsq),a=clamp((s/r-.75)/.25,0,1),t=smooth(a),height=s+r*.13*t*t;
   const slope=1+6.24*t*a*(1-a),derivative=m?m[10]+slope*(lx*m[8]+ly*m[9])/s:1;
   if(Math.abs(derivative)<.1)break;
   const delta=clamp((lz-height)/derivative,-.003,.003);z-=delta;if(Math.abs(delta)<1e-7)break;
  }
  return c.z+z;
 }
 rimPoint(c,a,blink){const p=super.rimPoint(c,a,blink),z=this.eyeFront(c,p.x,p.y);if(z!==null)p.z=Math.max(p.z,z+.00030);return p;}
 updateLid(e,blink){
  this._fittingEye=e;e.surfaceInverse=e.surfaceInverse||new THREE.Matrix4();e.surfaceInverse.makeRotationFromQuaternion(e.pivot.quaternion).invert();
  super.updateLid(e,blink);
  const g=e.lid.mesh.geometry,P=g.attributes.position;
  for(let i=0;i<P.count;i++){
   const q=e.lid.entries[i],seam=e.c.y-.0037+.0031*Math.pow(Math.abs(q.nx),1.8)-.0012*q.nx*e.c.sign;
   const inner=this.rimPoint(e.c,q.a,blink),sourceY=THREE.MathUtils.lerp(seam,q.yo,q.t);
   // Match the original position AND its first derivative at the patch boundary.
   P.setY(i,sourceY+(inner.y-seam)*(1-smooth(q.t)));
   if(q.t>.87)continue;const z=this.eyeFront(e.c,P.getX(i),P.getY(i));
   if(z!==null&&z+.00024>P.getZ(i)){const weight=1-smooth(clamp((q.t-.69)/.18,0,1));P.setZ(i,THREE.MathUtils.lerp(P.getZ(i),z+.00024,weight));}
  }
  P.needsUpdate=true;g.computeVertexNormals();const N=g.attributes.normal;
  for(let i=0;i<P.count;i++){const q=e.lid.entries[i],t=smooth(clamp((q.t-.76)/.24,0,1));if(t){const n=new THREE.Vector3(N.getX(i),N.getY(i),N.getZ(i)).lerp(q.src.n,t).normalize();N.setXYZ(i,n.x,n.y,n.z);}}N.needsUpdate=true;
  this._fittingEye=null;
 }
 update(dt,instant=false){
  const changed=super.update(dt,instant);let clamped=false;
  for(const e of this.eyes){if(e.contact){e.contact.uEyeToHead.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(e.pivot.quaternion));e.contact.uBlink.value=this.state.blink;e.contact.uOpening.value=this.config.opening;}}
  if(this.state.lockErrorDegrees)clamped=this.state.lockErrorDegrees.some(x=>x>.1);
  this.state.clamped=clamped;return changed;
 }
 lock(){super.lock();this.state.mode='fixed';}
 setMode(mode){super.setMode(mode);this.state.mode=this.config.mode;}
 setTarget(v){super.setTarget(v);this.state.mode='fixed';}
 info(){return {...super.info(),externalEyeAssets:1,irisSource:'MakeHuman system grey_eye.png, CC0',fittedCornealEnvelope:true,boundaryContinuity:'C1 local displacement'};}
 dispose(){this.photoTexture?.dispose();super.dispose();}
}
