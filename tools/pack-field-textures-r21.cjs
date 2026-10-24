'use strict';const fs=require('fs');let s=fs.readFileSync('src/BodyRayR21.js','utf8'),g=fs.readFileSync('src/BodyRayIntervalsR21.glsl','utf8');
fs.writeFileSync('qa/fidelity-r21/offline/ray-before-packing.js',s);fs.writeFileSync('qa/fidelity-r21/offline/intervals-before-packing.glsl',g);
function replace(a,b){if(!s.includes(a))throw Error('Packed-field marker missing: '+a.slice(0,90));s=s.replace(a,b);}
replace('uniform sampler3D uNormalField,uField,uLocal0,uLocal1,uLocal2,uLocal3;','uniform sampler3D uNormalField;uniform sampler2D uPackedField;uniform int uPackedWidth,uFieldOffset[5];');
const start=s.indexOf('vec4 fieldValues(sampler3D tex,'),end=s.indexOf('\n',start);if(start<0)throw Error('Field interpolant missing');
const old=s.slice(start,end),normal=old.replace('vec4 fieldValues','vec4 normalFieldValues');
const packed=old.replace('sampler3D tex','int region').replaceAll('texelFetch(tex,','packedFetch(region,');
replace(old,`vec4 packedFetch(int region,ivec3 p,int lod){ivec3 g=ivec3(region==0?uGrid:region==1?uLGrid0:region==2?uLGrid1:region==3?uLGrid2:uLGrid3);int at=uFieldOffset[region]+p.x+g.x*(p.y+g.y*p.z);return texelFetch(uPackedField,ivec2(at%uPackedWidth,at/uPackedWidth),0);}\n${normal}\n${packed}`);
replace('fieldValues(uNormalField,','normalFieldValues(uNormalField,');
for(const [a,b]of [['uField','0'],['uLocal0','1'],['uLocal1','2'],['uLocal2','3'],['uLocal3','4']])s=s.replaceAll('fieldValues('+a+',','fieldValues('+b+',');
replace('gl.bindTexture(gl.TEXTURE_3D,texture);','gl.bindTexture(gl.TEXTURE_2D,texture);');
replace('gl.uniform1i(locations.uField,0);','gl.uniform1i(gl.getUniformLocation(program,"uPackedField"),0);gl.uniform1i(gl.getUniformLocation(program,"uPackedWidth"),current.packedWidth);gl.uniform1iv(gl.getUniformLocation(program,"uFieldOffset[0]"),current.fieldOffsets);');
const a=s.indexOf('gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,texture);',s.indexOf('function field(value)')),b=s.indexOf('gl.activeTexture(gl.TEXTURE0);if(value.stats.calibration',a);if(a<0||b<0)throw Error('Texture upload markers missing');
const upload=`gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);const regions=[value,...value.locals],offsets=[],width=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));let texels=0;for(const r of regions){offsets.push(texels);texels+=r.field.length/4;}const height=Math.ceil(texels/width);if(height>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('当前精度超出设备纹理容量');const packed=new Float32Array(width*height*4);for(let i=0;i<regions.length;i++)packed.set(regions[i].field,offsets[i]*4);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,packed);value.packedWidth=width;value.fieldOffsets=offsets;`;
s=s.slice(0,a)+upload+s.slice(b);
// Source values and layouts stay byte-identical; only GPU addressing changes.
for(const [a,b]of [['uField','0'],['uLocal0','1'],['uLocal1','2'],['uLocal2','3'],['uLocal3','4']])g=g.replaceAll('functionRange('+a+',','functionRange('+b+',').replaceAll('fieldCubic('+a+',','fieldCubic('+b+',');
g=g.replaceAll('sampler3D tex','int region').replaceAll('texelFetch(tex,','packedFetch(region,');
fs.writeFileSync('src/BodyRayR21.js',s);fs.writeFileSync('src/BodyRayIntervalsR21.glsl',g);
