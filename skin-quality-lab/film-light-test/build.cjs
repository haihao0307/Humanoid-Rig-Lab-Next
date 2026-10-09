const fs=require('fs'),path=require('path');
const d=path.resolve(__dirname,'../r02');let js=fs.readFileSync(d+'/app.js','utf8');
if(!js.includes("VERSION='skin-quality-lab/r02.1'"))throw Error('R02.1 baseline required');
js="import {RectAreaLightUniformsLib} from './vendor/lights/RectAreaLightUniformsLib.js';\n"+js;
const anchor='let physical=THREE.ShaderChunk.lights_physical_pars_fragment;';if(!js.includes(anchor))throw Error('Physical shader anchor missing');
const lobe=`
 #ifdef USE_CLEARCOAT
 vec2 cuv=LTC_Uv(geometryClearcoatNormal,viewDir,material.clearcoatRoughness);
 vec4 ct1=texture2D(ltc_1,cuv),ct2=texture2D(ltc_2,cuv);
 mat3 cmInv=mat3(vec3(ct1.x,0,ct1.y),vec3(0,1,0),vec3(ct1.z,0,ct1.w));
 vec3 cf=material.clearcoatF0*ct2.x+(vec3(1.)-material.clearcoatF0)*ct2.y;
 clearcoatSpecularDirect+=lightColor*cf*LTC_Evaluate(geometryClearcoatNormal,viewDir,position,cmInv,rectCoords);
 #endif
`;
const spec='reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );';
js=js.replace(anchor,()=>anchor+'\n physical=physical.replace('+JSON.stringify('vec3 lightColor = rectAreaLight.color;')+','+JSON.stringify('vec3 lightColor = rectAreaLight.color * mix(1.,clamp(vSkinAO,.12,1.),.7);')+');\n physical=physical.replace('+JSON.stringify(spec)+','+JSON.stringify(spec+lobe)+');');
js+=`
let filmKey;
window.__SKIN_LAB__.setAreaLight=(power=20,width=.3,height=.5)=>{
 if(!filmKey){RectAreaLightUniformsLib.init();filmKey=new THREE.RectAreaLight(0xffffff,power,width,height);scene.add(filmKey);}
 filmKey.intensity=power;filmKey.width=width;filmKey.height=height;filmKey.color.copy(key.color);filmKey.position.copy(key.position);filmKey.lookAt(key.target.position);
 key.intensity=.5;fill.intensity=.12;skin.envMapIntensity=.2;renderer.shadowMap.needsUpdate=true;entryDirty=true;dirty=true;
 state.areaTest={power,width,height,directionalAssist:.5,visibility:'Static hemispherical visibility, not area ray-traced shadows'};
};
`;
fs.writeFileSync(d+'/area-test.js',js);let html=fs.readFileSync(d+'/index.html','utf8').replace('src="./app.js"','src="./area-test.js"');fs.writeFileSync(d+'/area-test.html',html);
console.log('Generated isolated light experiment; canonical index and app remain unchanged');
