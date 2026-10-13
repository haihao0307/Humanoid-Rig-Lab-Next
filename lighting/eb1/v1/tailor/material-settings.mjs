import {knitEnvelope} from './native/knit-r11.mjs';
export const LIMITS={gauge:[3.5,12,.1],diameter:[.9,4.8,.05],depth:[.65,2.8,.05],gap:[.2,2.5,.1],packing:[.85,1.1,.01],grain:[.35,2.5,.05],grainDepth:[.02,.3,.01],roughness:[.16,.95,.01],coat:[0,1,.02],thickness:[.65,2.8,.05]};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function defaults(m){const p=m.parameters||{},g=p.gauge||6.5,d=g*.35,oldHalf=.159154943092*g*.45+d*.52,target=.35+4*oldHalf+.55;return{gauge:g,diameter:d,depth:clamp((target-.35-d*1.06)/(2*.159154943092*g),.65,2.8),doubleLayer:false,gap:.55,wrongSide:false,packing:1.0,grain:p.grain||1,grainDepth:Math.min(.20,p.depth||.08),roughness:p.roughness||.9,coat:p.coat||0,thickness:p.thickness||1.2};}
export function settings(m,value={}){const s={...defaults(m),...value};for(const[k,[a,b]]of Object.entries(LIMITS)){if(!Number.isFinite(Number(s[k])))throw Error('面料参数无效：'+k);s[k]=clamp(Number(s[k]),a,b);}s.doubleLayer=false;s.wrongSide=false;return s;}
export function withSettings(m,value={}){const q=structuredClone(m),s=settings(m,value);q.settings=s;if(m.family==='knit'){Object.assign(q.parameters,{gauge:s.gauge,'yarn-size':s.diameter/1.4,'needle-kind':0});}else if(m.family==='leather'){Object.assign(q.parameters,{grain:s.grain,depth:s.grainDepth,roughness:s.roughness,coat:s.coat,thickness:s.thickness});}return q;}
export function layerLayout(info){const s=info.settings;if(info.family==='knit'){
 const e=knitEnvelope({pitch:s.gauge*.001,depth:s.depth,radius:s.diameter*.0005,variation:.06,pattern:0});
 const thickness=e.thickness*1000,half=thickness*.5;return{half,inner:.35+half,outer:.35+half,thickness:.35+thickness,layers:1,target:'former double-layer envelope',nativeEnvelope:e};}
 const t=info.family==='leather'?s.thickness:info.geometry.thickness;return{inner:.2,outer:.2+t,thickness:t+.2,layers:1};}
