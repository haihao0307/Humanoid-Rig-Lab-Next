async function loadAsset(meta,settings,hp,ctx){
 meta=await readPackage(meta);guard(ctx.signal);if(!meta.mother)throw Error('缺少程序母体配方');
 phase(ctx,'在线程中生成帽型');const start=performance.now();
 const {mesh,fit,workerMS}=await compute('build',{meta:lightMeta(meta),settings,profile:hp},{signal:ctx.signal,onStage:t=>phase(ctx,t)});guard(ctx.signal);
 phase(ctx,'解码内置原色');const maps={};let geometry=null;
 try{
  maps.color=await localTexture(meta.textures.color,'color',ctx.signal);guard(ctx.signal);
  geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(mesh.position,3));geometry.setAttribute('normal',new T.BufferAttribute(mesh.normal,3));geometry.setAttribute('uv',new T.BufferAttribute(mesh.uv,2));geometry.setIndex(new T.BufferAttribute(mesh.index,1));geometry.computeBoundingBox();
  const material=new T.MeshPhysicalMaterial({map:maps.color,normalMap:null,normalScale:new T.Vector2(.8,.8),color:new T.Color().setRGB(...(meta.diffuseColor||[1,1,1])),roughness:.86,metalness:0,sheen:.65,sheenColor:new T.Color(.45,.42,.38),sheenRoughness:.85,specularIntensity:.18,side:T.DoubleSide,alphaTest:.25,envMapIntensity:.45});
  const uniforms=installSurface(T,material),fitResults=new Map([[fitSignature(settings,hp),fit]]);
  return {geometry,material,maps,uniforms,meta,mesh,generationMS:performance.now()-start,workerMS,fitSource:null,fitKey:null,fitResult:null,fitResults};
 }catch(e){geometry?.dispose();Object.values(maps).forEach(t=>t.dispose());throw e;}
}
