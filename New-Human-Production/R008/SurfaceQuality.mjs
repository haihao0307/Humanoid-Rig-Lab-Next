// Generation recipes only. No vertices, textures or sampled caches in a recipe.
export const SURFACE_PRESETS=Object.freeze({
 '.020':{label:'轻量',edgeMetres:.020,surfaceErrorMetres:.0005,anatomicalDetail:false},
 '.012':{label:'均衡',edgeMetres:.012,surfaceErrorMetres:.0003,anatomicalDetail:true},
 '.008':{label:'精细',edgeMetres:.008,surfaceErrorMetres:.0002,anatomicalDetail:true},
 '.006':{label:'近景',edgeMetres:.006,surfaceErrorMetres:.00012,anatomicalDetail:true},
});
export const DEFAULT_SURFACE_DETAIL=Object.freeze({schema:'human-r008/surface-detail@1',density:'.008',normalStrength:.8,microStrength:.35,pixelScale:1.5});
export function normalizeSurfaceDetail(input={}){
 const out={...DEFAULT_SURFACE_DETAIL,...input};if(Object.keys(input).some(k=>!Object.hasOwn(DEFAULT_SURFACE_DETAIL,k))||out.schema!==DEFAULT_SURFACE_DETAIL.schema||!Object.hasOwn(SURFACE_PRESETS,out.density))throw Error('表面精度配方无效');
 for(const [key,min,max]of [['normalStrength',0,1.5],['microStrength',0,1],['pixelScale',1,2]])if(!Number.isFinite(out[key])||out[key]<min||out[key]>max)throw Error('表面细节参数超出范围');return out;
}
export function surfaceGenerationOptions(density){if(!Object.hasOwn(SURFACE_PRESETS,density))throw Error('未知表面精度');const {label,...options}=SURFACE_PRESETS[density];return options;}
export function localSurfaceEdge(point,edgeMetres,anatomicalDetail){
 if(!anatomicalDetail)return edgeMetres;
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const head=smooth(1.48,1.57,point[1]),hands=smooth(.265,.30,Math.abs(point[0]))*(1-smooth(.98,1.10,point[1]))*smooth(.62,.70,point[1]);
 return edgeMetres*(1-Math.max(.5*head,.35*hands));
}
