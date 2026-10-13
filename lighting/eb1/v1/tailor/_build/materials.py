from pathlib import Path
import json
r=Path(__file__).resolve().parents[1]
s=(r/'surface-binding.mjs').read_text()
s=s.replace('export function panelRecords(native,packet){let offset=0;', 'export function panelRecords(native,packet){let offset=0,faceOffset=0;')
s=s.replace('tris:p.triangles.flat(),boundary:p.boundary};offset+=n;', 'tris:Array.from(native.geometry.index.array.slice(faceOffset,faceOffset+p.triangles.length*3),v=>v-offset),boundary:p.boundary};faceOffset+=p.triangles.length*3;offset+=n;')
(r/'surface-binding.mjs').write_text(s)
s=(r/'material-shaders.mjs').read_text()
s=s.replace("import {leatherFieldGLSL} from './leather-field.mjs';", "import './native/cotton-surface.js';\nimport './native/noise-kernel.js';\nconst cotton=globalThis.KAOPUCottonSurface,noise=globalThis.KAOPUDenimNoise;\nconst nativeHash=`float hash(float x){uint n=(uint(int(x))^0x9e3779b9u)*0x85ebca6bu;n^=n>>13;n*=0xc2b2ae35u;return float(n^(n>>16))/4294967296.;}`;\n")
s=s.replace('varying vec3 vSolidColour;varying vec3 vSolidCoord;','varying vec3 vSolidColour;varying vec3 vSolidCoord;varying vec3 vYarnT;',1)
s=s.replace('${bindingGLSL}\nfloat colourAt', '${bindingGLSL}\n${cotton.shapeGLSL}\nfloat stitchArc(float t){return 3.926862431999*t-.019512499729*sin(12.56637061436*t)+.012534954656*sin(25.13274122872*t)+.000256499088*sin(37.69911184308*t)-.000120229580*sin(50.26548245744*t)-.000009090432*sin(62.8318530718*t)+.000002920105*sin(75.39822368616*t);}\nfloat colourAt')
s=s.replace('uRadius*.9','uRadius*1.4')
s=s.replace('float crimpFilter=uLOD<.5?.18:1.;float z=mix(aa,bb,f)*uThickness*.265*crimpFilter+(uLOD<.5?(uKind<.5?.13:-.13)*uThickness:0.);','float crimpFilter=uLOD<.5?.55:1.;float z=mix(aa,bb,f)*uThickness*.265*crimpFilter; if(uKind>.5)z-=uThickness*.235*.18;')
s=s.replace('t*uPitch*3.926862432','stitchArc(t)*uPitch').replace('radius*1.05','radius*1.02')
s=s.replace('ra=(uKind<.5?uPitch:uWeftPitch)*.51*uPacking;rz=uThickness*(uKind<.5?.235:.17);ra*=1.+.025*sin(t*.31+lane*2.3);','ra=(uKind<.5?uPitch*.49:uWeftPitch*.235)*uPacking;rz=uThickness*.235*(uKind<.5?1.:.68);vec2 cottonShape=cottonPacking(theta,arc,lane+uKind*137.);ra*=cottonShape.x;rz*=cottonShape.x;')
s=s.replace('if(uLOD<.5&&uKnit<.5)NN=normalize(N*.75+NN*.25);','if(uLOD<.5&&uKnit<.5)NN=normalize(N*.24+NN*.76);\n vYarnT=normalize(normalMatrix*T);')
s=s[:s.index('export const leatherShader=')]+'''export const yarnFragmentHead=`
varying vec3 vYarnT;uniform float uFilterScale;
${nativeHash}
${noise.glsl}
${cotton.surfaceGLSL}
`;
export const yarnNormalFragment=`
if(uKnit<.5){float variation;normal=fiberSurface(normal,normalize(vYarnT),vec2(vSolidCoord.x,vSolidCoord.y*.18),vSolidCoord.z,variation);diffuseColor.rgb*=clamp(variation,.55,1.4);}
`;
export const leatherShader=`
attribute float shellLayer,shellRim;attribute vec2 rimUV,chartUV;
uniform sampler2D uNativeHeight;uniform float uThickness,uDepth,uTile,uPlain;
varying vec3 vSolidColour;varying vec3 vSolidCoord;varying float vLeatherLayer;varying float vLeatherRim;
${bindingGLSL}
void solidVertex(out vec3 P,out vec3 NN){vec3 N,U,V;surfaceFrame(chartUV,P,N,U,V);
 vec4 encoded=texture2D(uNativeHeight,chartUV/uTile);float height=(encoded.r*65280.+encoded.g*255.)/65535.;
 float h=uThickness+(height-.5)*uDepth;P+=N*(.2+shellLayer*h)*.001;
 NN=shellLayer>.5?N:-N;if(shellRim>.5)NN=normalize(U*rimUV.x+V*rimUV.y);
 vSolidColour=mix(vec3(1.),vec3(.52),uPlain);vSolidCoord=vec3(chartUV,0.);vLeatherLayer=shellLayer;vLeatherRim=shellRim;
}
`;
export const leatherFragmentHead=`varying float vLeatherLayer;varying float vLeatherRim;uniform float uDepth,uTile,uPlain;`;
export const leatherNormalFragment=`
if(vLeatherLayer<.5||vLeatherRim>.5){roughnessFactor=.94;diffuseColor.rgb*=vec3(1.12,1.04,.92);}
`;
'''
s=s.replace('float groove=.5+.5*cos(twistPhase);diffuseColor.rgb*=1.-.07*detail*groove*(1.-uPlain);','float groove=.5+.5*cos(twistPhase);diffuseColor.rgb*=1.-.045*detail*groove*(1.-uPlain)*uKnit;')
(r/'material-shaders.mjs').write_text(s)
m=json.loads((r/'materials.json').read_text())
for q in m:
 if q['family']=='denim':
  q['runtimeDonor']='denim-r11@086414b317f313bf9465ea957753ae7e84453f6f'
  q['geometry']['warpPitch']=.42;q['geometry']['weftPitch']=.64;q['geometry']['thickness']=.70
 if q['family']=='leather':q['runtimeDonor']='leather-r13@65951309b46262784e72bb617ba1ca6cb5ca217f'
 if q['family']=='knit':
  q['runtimeDonor']='knit-r11@20b466073bb458408a078260a018460c81f627b9';q['parameters']['needle-kind']=0
  q['label']=q['label'].replace('反针','正针').replace('反面','外表正面')
(r/'materials.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
