"""One-time R15 -> R16 derivation. No solver or geometry reduction."""
from pathlib import Path
import shutil,hashlib,json
P=Path(__file__).resolve().parent; R=P.parent/'r15'
assert hashlib.sha256((R/'index.html').read_bytes()).hexdigest()=='4876d591cd8a4d3f8f891873d91faf179b48d2d52b2c535140e3d830989772ab'
if (P/'app.js').exists():raise SystemExit('Canonical source exists; use build.py, not derive.py')
for f in R.iterdir():
 if f.is_file() and (f.suffix in ['.js','.wasm','.c'] or f.name in ['template.html','build.py','LICENSE','THIRD_PARTY_NOTICES.md']):shutil.copy2(f,P/f.name)
def rep(s,a,b):
 assert s.count(a)==1,(a[:90],s.count(a))
 return s.replace(a,b,1)
s=(P/'app.js').read_text()
s=rep(s,'in vec2 aM;uniform mat4 uVP;uniform float uBack;', 'uniform highp sampler2D uR16Base,uR16Tangent,uR16Normal;uniform int uR16Cache;\nin vec2 aM;uniform mat4 uVP;uniform float uBack;')
s=rep(s,'void main(){mat3 b;vec3 base;materialFrame(aM,base,b);vN=', '''void main(){mat3 b;vec3 base;if(uR16Cache==1){ivec2 ij=ivec2(gl_VertexID%512,gl_VertexID/512);base=texelFetch(uR16Base,ij,0).xyz;b=mat3(1);b[1]=texelFetch(uR16Tangent,ij,0).xyz;b[2]=texelFetch(uR16Normal,ij,0).xyz;}else materialFrame(aM,base,b);vN=''' )
s=rep(s,"carrierMesh=mesh(a,ix,surfProg,'aM',2);", "carrierMesh=mesh(a,ix,surfProg,'aM',2);r16SetCoordinates(a);")
insert=r'''
// R16: exact carrier-vertex frame cache. No interpolation grid or temporal history.
const r16FrameCache={supported:!!gl.getExtension('EXT_color_buffer_float'),fbo:null,coords:null,textures:[],rows:0,count:0,key:'',valid:false,captures:0,hits:0,drawReads:0,bytes:0,captureCpuMs:0};
const r16CaptureVS=`#version 300 es
precision highp float;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}`;
const r16CaptureFS=`#version 300 es
${common}
uniform highp sampler2D uR16Coordinates;uniform int uR16Count;
layout(location=0) out vec4 oBase;layout(location=1) out vec4 oTangent;layout(location=2) out vec4 oNormal;
void main(){ivec2 ij=ivec2(gl_FragCoord.xy);int id=ij.y*512+ij.x;if(id>=uR16Count){oBase=vec4(0);oTangent=vec4(0);oNormal=vec4(0);return;}vec2 m=texelFetch(uR16Coordinates,ij,0).xy;vec3 p;mat3 b;materialFrame(m,p,b);oBase=vec4(p,1);oTangent=vec4(b[1],0);oNormal=vec4(b[2],0);}`;
const r16CaptureProg=r16FrameCache.supported?program(r16CaptureVS,r16CaptureFS):null;
function r16SetCoordinates(a){const c=r16FrameCache;c.valid=false;c.key='';if(!c.supported)return;
 const rows=Math.max(1,Math.ceil(a.length/2/512));c.count=a.length/2;
 if(rows!==c.rows){if(c.fbo)gl.deleteFramebuffer(c.fbo);if(c.coords)gl.deleteTexture(c.coords);c.textures.forEach(t=>gl.deleteTexture(t));c.rows=rows;
  const tex=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,512,rows);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);return t;};
  c.coords=tex();c.textures=[tex(),tex(),tex()];c.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,c.fbo);c.textures.forEach((t,i)=>gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0));gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('R16 Float32 frame cache incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null);c.bytes=512*rows*16*4;
 }
 const coordinates=new Float32Array(512*rows*4);for(let i=0;i<c.count;i++){coordinates[i*4]=a[i*2];coordinates[i*4+1]=a[i*2+1];}gl.bindTexture(gl.TEXTURE_2D,c.coords);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,512,rows,gl.RGBA,gl.FLOAT,coordinates);
}
function r16PrepareFrame(){const c=r16FrameCache,p=physicsView();if(!c.supported||state.r16Reference||!p.active||!p.ready||state.qaAudit){c.valid=false;return;}
 const key=[geometrySerial,state.shape,state.structure,state.experiment,p.revision,dynamics.generation,state.qaClock??0].join('|');if(c.valid&&c.key===key){c.hits++;return;}
 c.valid=false;const start=performance.now();gl.bindFramebuffer(gl.FRAMEBUFFER,c.fbo);gl.viewport(0,0,512,c.rows);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true);
 uniforms(r16CaptureProg,new Float32Array(16),[0,0,0]);gl.activeTexture(gl.TEXTURE13);gl.bindTexture(gl.TEXTURE_2D,c.coords);ui(r16CaptureProg,'uR16Coordinates',13);ui(r16CaptureProg,'uR16Count',c.count);gl.bindVertexArray(emptyVAO);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.depthMask(true);c.captures++;c.key=key;c.valid=true;c.captureCpuMs=performance.now()-start;
}
function r16BindFrame(p,flat,bakeMode){const c=r16FrameCache,use=c.valid&&!state.r16Reference&&!flat&&!bakeMode&&!state.qaAudit;
 ui(p,'uR16Cache',use?1:0);if(use){for(let i=0;i<3;i++){gl.activeTexture(gl.TEXTURE13+i);gl.bindTexture(gl.TEXTURE_2D,c.textures[i]);ui(p,['uR16Base','uR16Tangent','uR16Normal'][i],13+i);}if(p===surfProg||p===maskProg||p===macroShadowProg)c.drawReads++;}
}
function r16CacheReport(){const c=r16FrameCache;return {supported:c.supported,enabled:!state.r16Reference,valid:c.valid,vertices:c.count,bytes:c.bytes,captures:c.captures,hits:c.hits,drawReads:c.drawReads,captureCpuMs:c.captureCpuMs,exactMaterialCoordinates:true,temporalInterpolation:false};}
'''
pos=s.index('function physicsParameters()');s=s[:pos]+insert+'\n'+s[pos:]
s=rep(s,"v3(p,'uDiffusionCenter',optics.weights[0]);shadowUniforms(p);", "v3(p,'uDiffusionCenter',optics.weights[0]);shadowUniforms(p);r16BindFrame(p,flat,bakeMode);")
a='dynamics.upload();gpuTimer.start();';s=rep(s,a,a+'r16PrepareFrame();')
a='frameJob.generation=dynamics.generation;gpuTimer.start();';s=rep(s,a,a+'r16PrepareFrame();')
s=s.replace("ui(blit,'audit',state.qaAudit?1:0);", "ui(blit,'audit',state.qaAudit?1:0);ui(blit,'r16Reference',state.r16Reference?1:0);")
pos=s.index('function render(time=0)')
s=s[:pos]+'''function r16VisualKey(){const {fold,gripEnabled,selfCollision,friction,pullMm,tearStrengthN,seamSlackMm,seamStrengthN,seamEnabled,windSpeed,drive,motionFps,...visual}=state;return JSON.stringify(visual);}\n'''+s[pos:]
s=s.replace('const stateKey=JSON.stringify(state);','const stateKey=r16VisualKey();').replace('frameJob={key:JSON.stringify(state),','frameJob={key:r16VisualKey(),')
s=s.replace('performance:performanceReport(),renderTarget:', 'performance:performanceReport(),renderCache:r16CacheReport(),renderTarget:')
s=s.replace('window.__DENIM_WORKBENCH__={ready:false,','window.__DENIM_WORKBENCH__={ready:false,renderCacheReport:r16CacheReport,')
s=s.replace("version:'R15.0'","version:'R16.0'").replace("generator:'R15.0'","generator:'R16.0'").replace("'R14.0','R15.0'].includes", "'R14.0','R15.0','R16.0'].includes")
s=s.replace('trackedGpuBytes:', 'carrierFrameCacheBytes:r16FrameCache.bytes,trackedGpuBytes:r16FrameCache.bytes+')
(P/'app.js').write_text(s)
s=(P/'sampling.js').read_text()
s=rep(s,'uniform int audit;', 'uniform int audit;uniform int r16Reference;')
a='for(int y=0;y<4;y++)for(int x=0;x<4;x++)c+=integrated(uv+(vec2(x,y)+.5-2.)/(4.*outputSize));c/=16.;'
b='''// At native pixel size each pair is on the same bilinear segment. Four
 // weighted taps equal the original 16-tap linear footprint (up to float rounding).
 // Fractional supersampling and nonlinear local-LOD mixing retain the original path.
 if(r16Reference==0&&farBlend==0.&&all(equal(ivec2(outputSize),textureSize(im,0)))){
  vec2 d=.25/outputSize;c=(texture(im,uv+vec2(-d.x,-d.y)).rgb+texture(im,uv+vec2(d.x,-d.y)).rgb+texture(im,uv+vec2(-d.x,d.y)).rgb+texture(im,uv+d).rgb)*.25;
 }else{'''+a+'''}'''
s=rep(s,a,b);(P/'sampling.js').write_text(s)
s=(P/'template.html').read_text().replace('R15.0','R16.0').replace('R15','R16');(P/'template.html').write_text(s)
s=(P/'build.py').read_text().replace("'version':'R15.0'", "'version':'R16.0'").replace("'baseCommit':'9d5437755d69c8a86557b10cbfcf12dbb84812ed'", "'baseCommit':'895bf144e2a8e70b86f7f15cfeaedba2b4415170'").replace('denim-workshop/r15/index.html','denim-workshop/r16/index.html');(P/'build.py').write_text(s)
print('R16 exact vertex cache, native footprint pairing and physical-control scheduling applied.')
