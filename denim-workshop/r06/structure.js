/* Shared smooth, non-repeating material-space deformation. It warps every
   yarn, child fiber and seam consistently; crossing topology is not randomized. */
(function(root){'use strict';
function field(x,y,strength=1){
 return [x+strength*(.27*Math.sin(y*.213+x*.047+1.3)+.11*Math.sin(x*.713+y*.377+.71)),y+strength*(.22*Math.sin(x*.197-y*.051+2.6)+.095*Math.sin(y*.679-x*.413+1.17))];
}
function jacobian(x,y,s=1){let a=y*.213+x*.047+1.3,b=x*.713+y*.377+.71,c=x*.197-y*.051+2.6,d=y*.679-x*.413+1.17;
 return [1+s*(.01269*Math.cos(a)+.07843*Math.cos(b)),s*(.05751*Math.cos(a)+.04147*Math.cos(b)),s*(.04334*Math.cos(c)-.039235*Math.cos(d)),1+s*(-.01122*Math.cos(c)+.064505*Math.cos(d))];}
const glsl=`
uniform float uStructure;
vec2 clothField(vec2 m){float x=m.x,y=m.y;return m+uStructure*vec2(.27*sin(y*.213+x*.047+1.3)+.11*sin(x*.713+y*.377+.71),.22*sin(x*.197-y*.051+2.6)+.095*sin(y*.679-x*.413+1.17));}
mat2 clothJacobian(vec2 m){float x=m.x,y=m.y,a=y*.213+x*.047+1.3,b=x*.713+y*.377+.71,c=x*.197-y*.051+2.6,d=y*.679-x*.413+1.17;
return mat2(1.+uStructure*(.01269*cos(a)+.07843*cos(b)),uStructure*(.04334*cos(c)-.039235*cos(d)),uStructure*(.05751*cos(a)+.04147*cos(b)),1.+uStructure*(-.01122*cos(c)+.064505*cos(d)));}
vec3 carrier(vec2 m){return carrierRaw(clothField(m));}
mat3 basis(vec2 m){mat3 b=basisRaw(clothField(m));mat2 j=clothJacobian(m);vec3 x=b[0]*j[0][0]+b[1]*j[0][1],y=b[0]*j[1][0]+b[1]*j[1][1];return mat3(x,y,normalize(cross(x,y)));}
`;
root.KAOPUClothStructure={field,jacobian,glsl};if(typeof module!=='undefined')module.exports=root.KAOPUClothStructure;
})(globalThis);
