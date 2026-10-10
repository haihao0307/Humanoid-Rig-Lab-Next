// Gray studio: ray-intersected floor and back plane with distance haze.
// The fog is background-only so it cannot hide yarn/edge defects.
const studioVS=`#version 300 es
precision highp float;out vec2 vUv;void main(){vec2 q=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=q;gl_Position=vec4(q*2.-1.,.9999,1.);}`;
const studioFS=`#version 300 es
${fragCommon}${shade}
in vec2 vUv;out vec4 O;uniform vec3 uForward,uRight,uUp;uniform float uAspect,uTanHalf,uFog;
void main(){
 vec2 uv=vUv*2.-1.;vec3 rd=normalize(uForward+uRight*uv.x*uAspect*uTanHalf+uUp*uv.y*uTanHalf);
 float t=800.;vec3 N=vec3(0,0,1);bool hit=false;
 if(rd.z<-.0001){float tWall=(-140.-uCam.z)/rd.z;if(tWall>0.){t=tWall;hit=true;}}
 if(rd.y<-.0001){float tFloor=(-56.-uCam.y)/rd.y;if(tFloor>0.&&tFloor<t){t=tFloor;N=vec3(0,1,0);hit=true;}}
 vec3 P=uCam+rd*t;vec3 c=vec3(.21,.217,.224);
 if(hit){float softPool=exp(-dot((P.xy-vec2(-35,20))*vec2(.007,.006),(P.xy-vec2(-35,20))*vec2(.007,.006)));
  c*=.65+.18*max(0.,dot(N,normalize(uKeyPos-P)))+.23*softPool;
  c*=.76+.24*visibility(P,8.);
 }
 float haze=(1.-exp(-max(0.,t-160.)*.008))*uFog;
 c=mix(c,vec3(.30,.315,.332),haze);
 float cloud=n2(uv*vec2(1.6,1.1)+12.)*.6+n2(uv*3.+31.)*.4;
 c+=uFog*.018*(cloud-.5);
 c*=1.-.10*dot(uv*.55,uv*.55);
 O=vec4(tone(c),1.);
}`;
const studioProg=program(studioVS,studioFS);
let shadowFbo=null,shadowTex=null,shadowSize=0,shadowKey='',shadowDrawing=false,shadowDrawCalls=0,shadowTriangles=0;
let lightVP=new Float32Array(16),keyPos=[-90,115,125],keyColor=[2.4,2.34,2.22],fillColor=[.55,.64,.79];
function configureLights(){
 keyPos=[-90,115,125];keyColor=[2.4,2.34,2.22];fillColor=[.55,.64,.79];
 if(state.light===1){keyPos=[-135,55,35];keyColor=[3.0,2.64,2.20];fillColor=[.46,.56,.73];}
 if(state.light===2){keyPos=[-85,100,105];keyColor=[2.7,2.23,1.76];fillColor=[.48,.73,1.08];}
 if(state.light===3){keyPos=[-40,120,160];keyColor=[2.45,2.48,2.50];fillColor=[.82,.79,.72];}
 lightVP=mul(ortho(-130,130,-125,125,1,600),look(keyPos,[0,-8,0]));
}
function shadowUniforms(p){
 mat(p,'uLightVP',lightVP);v3(p,'uKeyPos',keyPos);v3(p,'uKeyColor',keyColor);v3(p,'uFillColor',fillColor);
 uf(p,'uExposure',state.exposure);ui(p,'uShadowPass',shadowDrawing?1:0);uf(p,'uShadowTexel',1/Math.max(1,shadowSize));
 gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,shadowDrawing?dummyTex:(shadowTex||dummyTex));ui(p,'uShadowMap',7);
}
function makeShadow(){
 configureLights();const size=innerWidth<750?768:1024;
 if(!shadowFbo){shadowSize=size;shadowFbo=gl.createFramebuffer();shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Shadow FBO incomplete');}
 let key=[state.weave,state.thickness,state.slub,state.damage,state.fray,state.shape,state.light,state.seam,state.animate?clock:0].join('|');
 shadowDrawCalls=0;shadowTriangles=0;
 if(shadowKey===key){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return;}
 shadowDrawing=true;const old=[geomLevel,longMorph,sideMorph,drawCount];geomLevel=0;longMorph=0;sideMorph=0;
 gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFbo);gl.viewport(0,0,shadowSize,shadowSize);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.clear(gl.DEPTH_BUFFER_BIT);
 drawYarns(yarnProg,lightVP,keyPos);
 for(const [prog,m] of [[looseProg,looseMesh],...(state.seam?[[seamProg,seams]]:[])]){uniforms(prog,lightVP,keyPos);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);drawCount++;shadowTriangles+=m.count/3;}
 shadowTriangles+=(mainMeshes[0].count*instanceCounts[0]+mainMeshes[1].count*instanceCounts[1])/3;
 shadowDrawCalls=drawCount-old[3];[geomLevel,longMorph,sideMorph,drawCount]=old;shadowDrawing=false;shadowKey=key;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}
function drawStudio(eye,aspect){
 gl.disable(gl.DEPTH_TEST);gl.depthMask(false);uniforms(studioProg,new Float32Array(16),eye);
 let target=[state.panX||0,state.panY||0,3],forward=norm(target.map((v,i)=>v-eye[i])),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
 v3(studioProg,'uForward',forward);v3(studioProg,'uRight',right);v3(studioProg,'uUp',up);uf(studioProg,'uAspect',aspect);uf(studioProg,'uTanHalf',Math.tan(36*Math.PI/360));uf(studioProg,'uFog',state.fog);
 gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);drawCount++;gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
}
