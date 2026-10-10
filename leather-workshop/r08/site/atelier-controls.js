// R08 keeps the inherited controls available, while providing composed defaults.
const artistSurface={relief:1,roughness:0,coat:0,grain:1,color:null};
const createSurface=AtelierMaterials.prototype.create;
AtelierMaterials.prototype.create=function(c,res){
 const recipe=artistSurface.color?{...c,color:artistSurface.color,override:{...c.override,color:artistSurface.color}}:c;
 const e=createSurface.call(this,recipe,res),m=e.material,prior=m.onBeforeCompile,key=m.customProgramCacheKey?.()||'';
 m.normalScale.multiplyScalar(artistSurface.relief);m.clearcoat=Math.max(0,Math.min(1,m.clearcoat+artistSurface.coat));const grain=artistSurface.grain,rough=artistSurface.roughness;
 m.onBeforeCompile=s=>{prior?.call(m,s);s.uniforms.uArtistGrain={value:grain};s.uniforms.uArtistRoughness={value:rough};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uArtistGrain;').replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv*=uArtistGrain;\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv*=uArtistGrain;\n#endif\n#ifdef USE_ROUGHNESSMAP\nvRoughnessMapUv*=uArtistGrain;\n#endif');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uArtistRoughness;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+uArtistRoughness,.10,.99);');};
 m.customProgramCacheKey=()=>key+'-R08-artist';return e;
};
function measureShell(){return hero.userData.rig.parts.map(p=>{const g=p.mesh.geometry,pos=g.attributes.position,n=g.userData.paperVertices,thickness=[];for(let i=0;i<n;i+=Math.max(1,Math.floor(n/60))){thickness.push(new T.Vector3().fromBufferAttribute(pos,i).distanceTo(new T.Vector3().fromBufferAttribute(pos,i+n)));}return{part:p.name,minMM:Math.min(...thickness),maxMM:Math.max(...thickness),wallEdges:g.userData.closedWallEdges,boundaryEdges:g.userData.boundaryEdges,periodic:g.userData.periodicOrCollapsedEdges,chordErrorMM:g.userData.maxBoundaryChordErrorMM};});}
const oldUpdateDetails=updateDetails;
updateDetails=function(){oldUpdateDetails();if(!hero)return;const rows=measureShell();$('shellReadout').textContent=rows.map(p=>`${p.part}: ${p.minMM.toFixed(2)}–${p.maxMM.toFixed(2)} mm`).join('\n');};
let isThicknessView=false;
function thicknessView(on){isThicknessView=on;$('thicknessView').classList.toggle('active',on);const rig=hero.userData.rig;
 for(const mesh of rig.meshes){if(mesh.userData.thread)continue;if(on){if(mesh.userData.beautyMaterials)continue;mesh.userData.beautyMaterials=mesh.material;const colors=Array.isArray(mesh.material)?['#b8c5bb','#748f81','#ad7943']:['#9e8664'];mesh.material=colors.map(c=>skinMaterial(new T.MeshStandardMaterial({color:c,roughness:.73,metalness:0}),rig,false));if(!Array.isArray(mesh.userData.beautyMaterials))mesh.material=mesh.material[0];}
 else if(mesh.userData.beautyMaterials){for(const m of(Array.isArray(mesh.material)?mesh.material:[mesh.material]))m.dispose();mesh.material=mesh.userData.beautyMaterials;delete mesh.userData.beautyMaterials;}}
 dirty=true;
}
function rebuildCraft(){if(!ready)return;const saved={yaw,pitch,distance,view,target:target.clone()},inspect=isThicknessView;isThicknessView=false;selectProduct(product);if(saved.view==='macro'){setView('macro');}else{yaw=saved.yaw;pitch=saved.pitch;distance=saved.distance;target.copy(saved.target);view=saved.view;}if(inspect)thicknessView(true);dirty=true;}
function initRestoredControls(){
 const controls=[['loftMM','loft'],['quiltMM','quiltMM'],['weaveMM','weaveMM'],['pitchMM','pitch'],['threadMM','threadDiameter'],['holeRadius','holeRadius'],['holePitch','holePitch'],['stiffnessScale','stiffnessScale']];
 for(const[id,key]of controls){const e=$(id);e.oninput=()=>{e.nextElementSibling.textContent=Number(e.value).toFixed(2);};e.onchange=()=>{craftConfig[key]=Number(e.value);rebuildCraft();};}
 for(const[id,key]of[['stitchStyle','stitchStyle'],['edgeFinish','edgeFinish'],['holeShape','holeShape'],['threadColor','threadColor']])$(id).onchange=()=>{craftConfig[key]=$(id).value;rebuildCraft();};
 for(const[id,key]of[['grainRelief','relief'],['surfaceRoughness','roughness'],['surfaceCoat','coat'],['grainScale','grain']]){const e=$(id);e.oninput=()=>{e.nextElementSibling.textContent=Number(e.value).toFixed(2);};e.onchange=()=>{artistSurface[key]=Number(e.value);selectMaterial(material,false);};}
 $('leatherColor').onchange=()=>{artistSurface.color=$('leatherColor').value;selectMaterial(material,false);};
 $('restoreSurface').onclick=()=>{Object.assign(artistSurface,{relief:1,roughness:0,coat:0,grain:1,color:null});for(const[id,key]of[['grainRelief','relief'],['surfaceRoughness','roughness'],['surfaceCoat','coat'],['grainScale','grain']]){$(id).value=artistSurface[key];$(id).nextElementSibling.textContent=artistSurface[key].toFixed(2);}selectMaterial(material,false);};
 $('thicknessView').onclick=()=>thicknessView(!isThicknessView);
 $('legacyCraft').onclick=()=>{const frame=$('craftArchiveFrame');if(!frame.srcdoc){const bytes=Uint8Array.from(atob(LEGACY_CRAFT_GZIP),c=>c.charCodeAt(0));new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(html=>{frame.srcdoc=html;});}$('craftArchive').showModal();};$('closeCraftArchive').onclick=()=>$('craftArchive').close();
}
initRestoredControls();
const originalSelectProduct=selectProduct;
selectProduct=function(id){isThicknessView=false;$('thicknessView').classList.remove('active');return originalSelectProduct(id);};
const originalPrepare=prepareGrab;
prepareGrab=function(){originalPrepare();if(window.LEATHER_ATELIER){window.LEATHER_ATELIER.measureShell=measureShell;window.LEATHER_ATELIER.thicknessView=thicknessView;}};
