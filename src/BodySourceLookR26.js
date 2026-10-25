/* Appearance changes never modify source geometry. Light directions, shadow
 * resolution and the unresolved generic R02 material controls stay separate. */
(()=>{'use strict';
function create(original){
 const bodyKeys=['enabled','regionalColor','bodyVariation','bodyPores','jointTone','neckCreases'],materialKeys=['originalRoughness','originalOil','originalDetail','originalVariation','originalRedness','originalOilFilm'],lightKeys=['key','rim','environment','exposure','environmentRotation','keyColor','rimColor'],body=original.person.proceduralBodySurface.settings,appearance={roughness:.52,noise:1,oil:.45,bodyVariation:.64,bodyPores:.78,jointTone:.42,neckCreases:.34,...body},lighting=original.person.restoredLighting.profile,equal=BodyPageHandoffR23.equal;
 function checkAppearance(values){for(const[k,v]of Object.entries(values)){if(k==='diagnostic')continue;if(bodyKeys.includes(k)||materialKeys.includes(k)){if(k==='enabled'?typeof v!=='boolean':!Number.isFinite(v)||v<0||v>1)return false;}else if(!equal(v,appearance[k]))return false;}return true;}
 function checkLighting(values){return Object.entries(values).every(([k,v])=>lightKeys.includes(k)?k.endsWith('Color')?typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v):Number.isFinite(v)&&(k==='environmentRotation'||v>=0):equal(v,lighting[k]));}
 function checkStructureLighting(values){return Object.entries(values).every(([k,v])=>['keyAzimuth','keyElevation','rimAzimuth','rimElevation'].includes(k)?Number.isFinite(v):checkLighting({[k]:v}));}
 function requireArchive(archive){const own=archive?.person?.bodyFunctionSystem;if(own?.appearance&&!checkAppearance(own.appearance))throw Error('这个附加外观尚未接入原形体显示，请在参数页保留当前人物。');if(own?.lighting&&!checkLighting(own.lighting))throw Error('当前灯光方向或阴影设置尚未接入原形体显示，请在参数页保留当前人物。');return true;}
 return{bodyKeys,materialKeys,lightKeys,checkAppearance,checkLighting,checkStructureLighting,requireArchive,lightValues:values=>Object.fromEntries(lightKeys.filter(k=>values?.[k]!==undefined).map(k=>[k,values[k]])),bodyValues:values=>Object.fromEntries(bodyKeys.filter(k=>values?.[k]!==undefined).map(k=>[k,values[k]])),materialValues:values=>Object.fromEntries(materialKeys.filter(k=>values?.[k]!==undefined).map(k=>[k,values[k]])),baselineAppearance:structuredClone(appearance),baselineLighting:structuredClone(lighting)};
}
globalThis.BodySourceLookR26={create};
})();
