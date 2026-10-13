from pathlib import Path
r=Path(__file__).resolve().parents[1];s=(r/'solid-textiles.mjs').read_text()
s=s.replace('import {yarnShader,yarnFragment,leatherShader,leatherFragmentHead,leatherNormalFragment}','import {yarnShader,yarnFragment,yarnFragmentHead,yarnNormalFragment,leatherShader,leatherFragmentHead,leatherNormalFragment}')
s=s.replace('const templates=', "import {LeatherKernel,DEFAULT as NATIVE_LEATHER_DEFAULT} from './native/leather-r13.mjs';\nconst templates=")
a=s.index('function physical(');b=s.index('function workerBuild',a)
s=s[:a]+'''function depthMaterial(uniforms,program){const m=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=program+'\\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 mpDepthP,mpDepthN;solidVertex(mpDepthP,mpDepthN);vec3 transformed=mpDepthP;');};m.customProgramCacheKey=()=> 'mp04-metric-depth-'+(program===leatherShader?'leather':'yarn');return m;}
function physical(uniforms,program,info,nativeMaterial=null){const leather=!!nativeMaterial,p=info.parameters;
 const m=nativeMaterial?nativeMaterial.clone():new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:info.family==='knit'?.86:.82,metalness:0,sheen:info.family==='knit'?.62:.30,sheenColor:C(p['base-dye']||info.geometry?.warpDye||'#a2aab1').multiplyScalar(1.5),sheenRoughness:.92,side:THREE.FrontSide,envMapIntensity:.6});
 m.userData.uniforms=uniforms;
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=program+'\\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','vec3 solidP,solidN;solidVertex(solidP,solidN);vec3 objectNormal=solidN;').replace('#include <begin_vertex>','vec3 transformed=solidP;');
 shader.fragmentShader='varying vec3 vSolidColour;varying vec3 vSolidCoord;\\n'+(leather?leatherFragmentHead:'uniform float uKnit,uTwist,uLOD,uPlain;\\n'+yarnFragmentHead)+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\\ndiffuseColor.rgb*=vSolidColour;\\n'+(leather?'':yarnFragment.replace('uniform float uKnit,uTwist,uLOD,uPlain;','')));
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','vec3 mpNativeNormal=normal;\\n#include <normal_fragment_maps>\\n'+(leather?leatherNormalFragment+'\\nif(vLeatherLayer<.5||vLeatherRim>.5)normal=mpNativeNormal;':yarnNormalFragment));
 if(leather)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\\n#ifdef USE_CLEARCOAT\\nmaterial.clearcoat*=step(.5,vLeatherLayer)*(1.-step(.5,vLeatherRim));\\n#endif');
 };m.customProgramCacheKey=()=>leather?'mp04-native-r13-leather':'mp04-native-r11-cotton-knit';return m;
}
''' +s[b:]
s=s.replace('{signal,onProgress}={}', '{signal,onProgress,renderer}={}')
s=s.replace("separateClothLayers:false};", "separateClothLayers:false,donor:info.runtimeDonor||'native-r11',outerSideConvention:'outward oriented original panels, right-side knit throughout exterior',shadowGeometry:'identical displaced solid yarn / leather depth pass'};\n const depths=[],nativeKernel=leather?new LeatherKernel(renderer):null;let nativeMaterial=null;if(nativeKernel){const p={...NATIVE_LEATHER_DEFAULT,...info.parameters,resolution:1024};nativeMaterial=nativeKernel.bake(p);stats.proceduralMaterialMaps=5;stats.nativeMaterialBakeMS=nativeKernel.bakeMS;stats.nativeLeatherResolution=1024;}\n")
a=s.index('const p=info.parameters,s=info.settings,u=',s.index('if(leather){const shell'));b=s.index('continue;}',a)
s=s[:a]+'''g.setAttribute('chartUV',new THREE.BufferAttribute(shell.uvs.slice(),2));const normalized=new Float32Array(shell.uvs.length);for(let j=0;j<normalized.length;j++)normalized[j]=shell.uvs[j]/(info.parameters.tileMM||96);g.setAttribute('uv',new THREE.BufferAttribute(normalized,2));
 const p=info.parameters,s=info.settings,u={...deformer.uniforms,...binding.uniforms,...U({uThickness:s.thickness,uDepth:s.grainDepth,uTile:p.tileMM||96,uPlain:0,uNativeHeight:nativeKernel.maps.height})},m=physical(u,leatherShader,info,nativeMaterial),mesh=new THREE.Mesh(g,m),depth=depthMaterial(u,leatherShader);mesh.customDepthMaterial=depth;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);geometries.push(g);mats.push(m);depths.push(depth);continue;}''' +s[b+len('continue;}'):]
s=s.replace('uFuzz:0,uShift:shift','uFuzz:.45,uCotton:.78,uStaple:.74,uNap:.6,uFilterScale:1.,uShift:shift')
s=s.replace('const m=physical(u,yarnShader,info);mats.push(m);return m;', 'const m=physical(u,yarnShader,info);m.userData.depth=depthMaterial(u,yarnShader);depths.push(m.userData.depth);mats.push(m);return m;')
s=s.replace('mesh.frustumCulled=false;group.add(mesh);tiles.push', 'mesh.customDepthMaterial=materials[0].userData.depth;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;group.add(mesh);tiles.push')
s=s.replace('t.mesh.material=t.materials[lod];', 't.mesh.material=t.materials[lod];t.mesh.customDepthMaterial=t.materials[lod].userData.depth;')
s=s.replace('let forceDetail=false;', 'let forceDetail=false,moving=false;')
s=s.replace('t.mesh.visible=frustum.intersectsSphere(t.sphere);', 't.mesh.visible=moving||frustum.intersectsSphere(t.sphere);')
s=s.replace('deform(){deformer', 'motion(on){moving=!!on;},deform(){deformer')
s=s.replace('mats.forEach(m=>m.dispose());new Set', 'mats.forEach(m=>m.dispose());depths.forEach(m=>m.dispose());nativeKernel?.dispose();new Set')
s=s.replace("layerMechanics:'knit layers share compliant mid-surface with offset thickness, not independent yarn mechanics'", "layerMechanics:'one native needle surface with metric thickness; no duplicated fabric'")
(r/'solid-textiles.mjs').write_text(s)
