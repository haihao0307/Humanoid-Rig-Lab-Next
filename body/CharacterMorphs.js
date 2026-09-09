/* Body identity is authored once before pose deformation. Every tissue instance owns its generated coordinates. */
const CHARACTER_MORPH_LIMITS=Object.freeze({shoulderWidth:[.80,1.18],chestWidth:[.82,1.18],waistWidth:[.78,1.20],hipWidth:[.86,1.25],neckWidth:[.82,1.14],limbVolume:[.78,1.22],softness:[.65,1.45],breastProjectionM:[0,.10],faceWidth:[.90,1.08]});
function defaultCharacterMorphs(sex){return {...BODY_ARCHETYPES[sex].morphs};}
function validateCharacterMorphs(input,sex){
 if(input===undefined)return defaultCharacterMorphs(sex);
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('母体外形参数必须是对象');
 const value=defaultCharacterMorphs(sex);
 for(const [key,v]of Object.entries(input)){const limits=CHARACTER_MORPH_LIMITS[key];if(!limits||!Number.isFinite(v)||v<limits[0]||v>limits[1])throw Error('母体外形参数越界：'+key);value[key]=v;}
 return value;
}
