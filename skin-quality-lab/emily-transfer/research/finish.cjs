const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');
let source=fs.readFileSync(__dirname+'/ResearchEyes.js','utf8');
if(!source.includes('// ET03 matching shadow surfaces R4')){
 const edit=(a,b)=>{if(!source.includes(a))throw Error('Missing final eye anchor '+a);source=source.replaceAll(a,b);};
 edit('m.castShadow=false;m.receiveShadow=true;',`m.castShadow=true;m.receiveShadow=true;
  // Use the same deformation and support mask in the shadow pass. Unlike VSM,
  // PCF does not turn every shadow receiver into an implicit shadow caster.
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
  depth.onBeforeCompile=s=>{
   s.uniforms.uLidSurface={value:this.skin.userData.surfaceTexture||null};
   // The skin callback supplies the same shared texture and relief uniforms.
   const probe={uniforms:{},vertexShader:'#include <common>\\n#include <begin_vertex>',fragmentShader:''};
   old(probe);Object.assign(s.uniforms,probe.uniforms);
   s.uniforms.uShadowPatch={value:new THREE.Vector4(c.x,c.y,c.rx,c.ry)};
   s.vertexShader='attribute float eyelidT;varying vec3 vLidShadowPosition;uniform sampler2D uSurface;uniform float uRelief,uBaseline;\\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\\ntransformed+=normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001*(1.-uBaseline)*smoothstep(.13,.68,eyelidT);vLidShadowPosition=transformed;');
   s.fragmentShader='varying vec3 vLidShadowPosition;uniform vec4 uShadowPatch;\\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\\nvec2 q=(vLidShadowPosition.xy-uShadowPatch.xy)/uShadowPatch.zw;if(dot(q,q)>1.000001)discard;');
  };
  depth.customProgramCacheKey=()=> 'ET03-lid-shadow-matched-4';m.customDepthMaterial=depth;`);
 // Invisible inward-facing tissue must not be rendered through the outside.
 edit('color:0x96574f,roughness:.46,side:THREE.DoubleSide','color:0x96574f,roughness:.46,side:THREE.FrontSide');
 source+='\n// ET03 matching shadow surfaces R4\n';fs.writeFileSync(__dirname+'/ResearchEyes.js',source);
}
require('./build.cjs');
let app=fs.readFileSync(root+'/app.js','utf8');
app=app.replace('renderer.shadowMap.type=THREE.VSMShadowMap;','renderer.shadowMap.type=THREE.PCFSoftShadowMap;');
app=app.replace('key.shadow.mapSize.set(1024,1024);key.shadow.radius=14;key.shadow.blurSamples=12;','key.shadow.mapSize.set(4096,4096);key.shadow.radius=2;key.shadow.blurSamples=12;');
app=app.replace('key.shadow.normalBias=.00022;','key.shadow.normalBias=.00012;');
// Keep the established skin lighting and all source textures; only the shadow
// filter and matching depth geometry are replaced after the layer diagnosis.
fs.writeFileSync(root+'/app.js',app);
const esbuild=require('esbuild'),vm=require('vm'),crypto=require('crypto');const r01=path.resolve(root,'../r01');
const bundled=esbuild.buildSync({entryPoints:[root+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}}).outputFiles[0].text;
const sha=process.env.ASSET_COMMIT;if(!/^[0-9a-f]{40}$/.test(sha||''))throw Error('Fixed SHA required');const prefix='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+sha+'/skin-quality-lab/';
const code=bundled.replaceAll('../r01/',prefix+'r01/').replaceAll('../r02/',prefix+'r02/').replaceAll('</script','<\\/script');new vm.Script(code);
const html=fs.readFileSync(root+'/index.html','utf8');const preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');
const scripts=[...preview.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];if(scripts.length!==1||scripts[0][1]!==code)throw Error('Final embedded script mismatch');new vm.Script(scripts[0][1]);fs.writeFileSync(root+'/preview.html',preview);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),manifest=JSON.parse(fs.readFileSync(root+'/BUILD_MANIFEST.json','utf8'));
Object.assign(manifest,{appSHA256:hash(app),previewSHA256:hash(preview),shadowMethod:'PCFSoft 4096 with matching eyelid displacement and clip mask',oldVSMArtifactsDiagnosed:true,capturedClosureAnchored:true,sourceSkinLightingPreserved:true});fs.writeFileSync(root+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));console.log('ET03_FINAL_BUILD',JSON.stringify(manifest));
