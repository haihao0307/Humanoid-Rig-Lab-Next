// Compensated direct queries of the original eye planes and original trims.
// Shared by primary eye display and the independent secondary optical queries.
import {DS_ARITHMETIC_GLSL as BOUNDARY_ARITHMETIC_GLSL} from './ds-arithmetic-20261107.mjs';
export const EYE_DS_GLSL=`
${BOUNDARY_ARITHMETIC_GLSL}
uniform highp sampler2D u_eyeDSData;
uniform int u_eyeDSWidth;
uniform highp sampler2D u_eyeDSPlanes;
uniform int u_eyeDSPlaneWidth;
uniform vec3 u_eyeDSAnchorHigh,u_eyeDSAnchorLow,u_eyeDSCentreHigh,u_eyeDSCentreLow;
uniform vec2 u_eyeDSScale;
vec2 dsAdd(vec2 a,vec2 b){return bdSumDS(a,b);}
vec2 dsSub(vec2 a,vec2 b){return bdSumDS(a,-b);}
vec2 dsMul(vec2 a,vec2 b){return bdProductDS(a,b);}
vec2 dsDiv(vec2 a,vec2 b){float q=bdRound(a.x/b.x);vec2 r=dsSub(a,dsMul(vec2(q,0.),b));vec2 v=dsAdd(vec2(q,0.),vec2(bdRound(bdRound(r.x+r.y)/b.x),0.));r=dsSub(a,dsMul(v,b));return dsAdd(v,vec2(bdRound(bdRound(r.x+r.y)/b.x),0.));}
float dsValue(vec2 a){return a.x+a.y;}
int dsSign(vec2 a){return a.x>0.?1:a.x<0.?-1:a.y>0.?1:a.y<0.?-1:0;}
vec2 eyeDSData(int owner,int scalar){int i=owner*17+scalar/2;vec4 p=texelFetch(u_eyeDSData,ivec2(i%u_eyeDSWidth,i/u_eyeDSWidth),0);return scalar%2==0?p.xy:p.zw;}
vec2 eyeDSDotRow(int owner,int row,vec2 p[3]){vec2 v=vec2(0.);for(int k=0;k<3;k++)v=dsAdd(v,dsMul(eyeDSData(owner,row*3+k),p[k]));return v;}
vec2 eyeDSPlane(int owner,int base,vec2 p[3],out float absoluteTerms){vec2 v=eyeDSData(owner,base);absoluteTerms=1.+abs(v.x)+abs(v.y);for(int k=0;k<3;k++){vec2 z=dsMul(eyeDSData(owner,base+1+k),p[k]);v=dsAdd(v,z);absoluteTerms+=abs(z.x)+abs(z.y);}return v;}
vec2 eyeWorldData(int owner,int scalar){int i=owner*13+scalar/2;vec4 p=texelFetch(u_eyeDSPlanes,ivec2(i%u_eyeDSPlaneWidth,i/u_eyeDSPlaneWidth),0);return scalar%2==0?p.xy:p.zw;}
vec2 eyeWorldPlane(int owner,int base,vec2 p[3],out float absoluteTerms){vec2 v=eyeWorldData(owner,base);absoluteTerms=1.+abs(v.x)+abs(v.y);for(int k=0;k<3;k++){vec2 z=dsMul(eyeWorldData(owner,base+1+k),p[k]);v=dsAdd(v,z);absoluteTerms+=abs(z.x)+abs(z.y);}return v;}
// faceMode 0: original front, 1: original back, 2: both. ParameterBase is a
// numerical ray rebase, not a different ray or a geometric approximation.
// Result 0=empty, 1=resolved original plane/trim hit, 2=numerically uncertain.
int eyeDSIntersect(int owner,vec2 origin[3],vec2 direction[3],float parameterBase,float rayMin,float rayMax,int faceMode,out vec2 distance,out vec2 sourcePoint[3],out vec3 geometricNormal){
 vec2 relative[3];for(int k=0;k<3;k++){relative[k]=dsSub(dsAdd(origin[k],dsMul(vec2(parameterBase,0.),direction[k])),vec2(u_eyeDSCentreHigh[k],u_eyeDSCentreLow[k]));geometricNormal[k]=dsValue(eyeWorldData(owner,16+k));}
 vec2 facing=vec2(0.);for(int k=0;k<3;k++)facing=dsAdd(facing,dsMul(eyeWorldData(owner,16+k),direction[k]));
 if((faceMode==0&&dsSign(facing)>=0)||(faceMode==1&&dsSign(facing)<=0))return 0;
 float scale;vec2 value=eyeWorldPlane(owner,0,relative,scale),slope=vec2(0.);for(int k=0;k<3;k++)slope=dsAdd(slope,dsMul(eyeWorldData(owner,1+k),direction[k]));
 if(dsSign(slope)==0){distance=vec2(parameterBase,0.);return abs(dsValue(value))<=1e-8?2:0;}
 vec2 dt=dsDiv(-value,slope);distance=dsAdd(vec2(parameterBase,0.),dt);
 if(any(isnan(distance))||any(isinf(distance)))return 2;
 if(dsSign(dsSub(distance,vec2(rayMin,0.)))<0||dsSign(dsSub(distance,vec2(rayMax,0.)))>0)return 0;
 vec2 hitRelative[3];for(int k=0;k<3;k++){hitRelative[k]=dsAdd(relative[k],dsMul(dt,direction[k]));sourcePoint[k]=dsAdd(vec2(u_eyeDSAnchorHigh[k],u_eyeDSAnchorLow[k]),dsDiv(hitRelative[k],u_eyeDSScale));}
 bool uncertain=false;
 for(int edge=0;edge<3;edge++){
  float terms;vec2 v=eyeWorldPlane(owner,4+edge*4,hitRelative,terms);
  // Keep the original Float64 containsOwn threshold. The extra term only
  // decides uncertainty; it never changes an outside trim into an accepted hit.
  float minimumGuard=dsValue(eyeWorldData(owner,19+edge)),maximumGuard=dsValue(eyeWorldData(owner,22+edge)),error=1.1368683772161603e-13*terms;
  if(dsValue(dsSub(v,vec2(maximumGuard,0.)))>error)return 0;
  if(dsValue(dsSub(v,vec2(minimumGuard,0.)))>=-error)uncertain=true;
 }
 float terms;vec2 residual=eyeWorldPlane(owner,0,hitRelative,terms);if(abs(dsValue(residual))>1e-8)return 2;
 return uncertain?2:1;
}
`;
export function splitDS(value){const high=Math.fround(value);return[high,Math.fround(value-high)];}
export function bindEyeDSTable(gl,program,table,unit=1){
 gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,table.texture);gl.uniform1i(gl.getUniformLocation(program,'u_eyeDSData'),unit);gl.uniform1i(gl.getUniformLocation(program,'u_eyeDSWidth'),table.width);gl.uniform1ui(gl.getUniformLocation(program,'u_bdRoundMask'),0);
 if(!table.planeTexture)throw Error('Original composed eye plane table is required');gl.activeTexture(gl.TEXTURE0+unit+1);gl.bindTexture(gl.TEXTURE_2D,table.planeTexture);gl.uniform1i(gl.getUniformLocation(program,'u_eyeDSPlanes'),unit+1);gl.uniform1i(gl.getUniformLocation(program,'u_eyeDSPlaneWidth'),table.planeWidth);
 for(const[name,value]of [['Anchor',table.transform.anchorSource],['Centre',table.transform.centre]]){const terms=value.map(splitDS);gl.uniform3fv(gl.getUniformLocation(program,'u_eyeDS'+name+'High'),terms.map(x=>x[0]));gl.uniform3fv(gl.getUniformLocation(program,'u_eyeDS'+name+'Low'),terms.map(x=>x[1]));}gl.uniform2fv(gl.getUniformLocation(program,'u_eyeDSScale'),splitDS(table.transform.scale));
}
