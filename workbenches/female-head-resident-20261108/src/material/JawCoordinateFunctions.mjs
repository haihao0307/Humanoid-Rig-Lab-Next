import{JAW_COORDINATE_PROFILE}from'./JawCoordinateProfile.mjs';
// BOUNDARY_ARITHMETIC_GLSL is shared with the tongue coordinate module.
// Angular predicates pass through the origin, so normalization preserves sign.
export const JAW_COORDINATE_GLSL=`
#ifdef JAW_DEBUG
int jawLeafDebug=-1;vec3 jawHighDebug,jawLowDebug;vec4 jawCoeffHiDebug,jawCoeffLoDebug,jawSumDebug;
#endif
uniform highp isampler2D u_jawNodes;uniform highp sampler2D u_jawPlanes,u_jawCoefficients;
uniform int u_jawActive;uniform ivec4 u_jawChartMap[14],u_jawChartRoots[4];uniform vec4 u_jawBoundsHigh[13],u_jawBoundsLow[13];
vec4 jawCoefficient(int i){return texelFetch(u_jawCoefficients,ivec2(i%4096,i/4096),0);}
bool jawCoordinates(vec3 point,vec3 normal,int functionID,out vec2 value){value=vec2(0);if(u_jawActive==0||functionID<0||functionID>=56)return false;int chart=u_jawChartMap[functionID/4][functionID%4];if(chart<0)return false;vec4 hi=u_jawBoundsHigh[chart],lo=u_jawBoundsLow[chart];vec3 qh,ql;for(int axis=0;axis<3;axis++){vec2 q=bdSumDS(vec2(point[axis],0),-vec2(hi[axis],lo[axis]));qh[axis]=q.x/hi.w;ql[axis]=q.y/hi.w;}
#ifdef JAW_DEBUG
jawHighDebug=qh;jawLowDebug=ql;
#endif
int index=u_jawChartRoots[chart/4][chart%4],leaf=-1;for(int level=0;level<160;level++){ivec2 node=texelFetch(u_jawNodes,ivec2(index%4096,index/4096),0).rg;if(node.x<0){leaf=-node.x-1;break;}int at=index*4;vec4 ph=texelFetch(u_jawPlanes,ivec2(at%4096,at/4096),0),nh=texelFetch(u_jawPlanes,ivec2((at+1)%4096,(at+1)/4096),0),pl=texelFetch(u_jawPlanes,ivec2((at+2)%4096,(at+2)/4096),0),nl=texelFetch(u_jawPlanes,ivec2((at+3)%4096,(at+3)/4096),0);vec2 sum=vec2(ph.x,pl.x);for(int axis=0;axis<3;axis++){sum=bdSumDS(sum,bdProductDS(vec2(ph[axis+1],pl[axis+1]),vec2(qh[axis],ql[axis])));sum=bdSumDS(sum,bdProductDS(vec2(nh[axis],nl[axis]),vec2(normal[axis],0)));}float uncertainty=1e-13*(1.+dot(abs(ph),vec4(1))+dot(abs(nh.xyz),vec3(1)));bool positive=sum.x>uncertainty||(sum.x==uncertainty&&sum.y>0.);index=positive?node.y:node.x;}if(leaf<0)return false;
#ifdef JAW_DEBUG
jawLeafDebug=leaf;
#endif
for(int channel=0;channel<2;channel++){vec4 h=jawCoefficient(leaf*4+channel*2),l=jawCoefficient(leaf*4+channel*2+1);vec2 sum=vec2(h.x,l.x);
#ifdef JAW_DEBUG
if(channel==0){jawCoeffHiDebug=h;jawCoeffLoDebug=l;}
#endif
for(int axis=0;axis<3;axis++){sum=bdSumDS(sum,bdProductDS(vec2(h[axis+1],l[axis+1]),vec2(qh[axis],ql[axis])));
#ifdef JAW_DEBUG
if(channel==0)jawSumDebug[axis]=sum.x+sum.y;
#endif
}value[channel]=sum.x+sum.y;}return true;}
`;
function jawTexture(gl,unit,data,channels,integer,width=4096){const height=Math.max(1,Math.ceil(data.length/(width*channels))),padded=integer?new Int32Array(width*height*channels):new Float32Array(width*height*channels);padded.set(data);const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,integer?gl.RG32I:gl.RGBA32F,width,height,0,integer?gl.RG_INTEGER:gl.RGBA,integer?gl.INT:gl.FLOAT,padded);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;}
function jawBinding(gl,textures,active){const cache=new WeakMap(),p=JAW_COORDINATE_PROFILE,map=new Int32Array(56).fill(-1),roots=new Int32Array(16),hi=new Float32Array(52),lo=new Float32Array(52);if(active){map.set(p.sourceFunctionChartMap);roots.set(p.roots);p.bounds.forEach((b,i)=>b.forEach((v,k)=>{hi[i*4+k]=v;lo[i*4+k]=v-hi[i*4+k];}));}return{bind(program){let U=cache.get(program);if(!U){U=Object.fromEntries(['Active','Nodes','Planes','Coefficients','ChartMap[0]','ChartRoots[0]','BoundsHigh[0]','BoundsLow[0]'].map(k=>[k,gl.getUniformLocation(program,'u_jaw'+k)]));cache.set(program,U);}gl.uniform1i(U.Active,active?1:0);gl.uniform4iv(U['ChartMap[0]'],map);gl.uniform4iv(U['ChartRoots[0]'],roots);gl.uniform4fv(U['BoundsHigh[0]'],hi);gl.uniform4fv(U['BoundsLow[0]'],lo);textures.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE4+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(U[['Nodes','Planes','Coefficients'][i]],4+i);});},report:()=>({profile:p.id,active,sourceFunctionCharts:active?p.roots.length:0,bytes:active?p.bytes:0,sourceVertices:0,sourceFaces:0,coordinates:'Physical position and original interpolated surface normal; source layer retained',sourceFidelityAccepted:false}),dispose(){textures.forEach(t=>gl.deleteTexture(t));}};}
export async function createJawCoordinateFunctions(gl){const p=JAW_COORDINATE_PROFILE,r=await fetch(p.url);if(!r.ok)throw Error('牙齿与牙龈属性函数未就绪');const b=await r.arrayBuffer(),h=new Uint32Array(b,0,4);if(h[0]!==0x4a415731||h[1]!==p.nodes||h[2]!==p.attributeFunctions||b.byteLength!==p.bytes)throw Error('原口腔分层属性版本不匹配');const nodes=jawTexture(gl,4,new Int32Array(b,16,p.nodes*2),2,true),planes=jawTexture(gl,5,new Float32Array(b,16+p.nodes*8,p.nodes*16),4,false),coeff=jawTexture(gl,6,new Float32Array(b,16+p.nodes*72,p.attributeFunctions*16),4,false);if(gl.getError())throw Error('原口腔属性上传失败');return jawBinding(gl,[nodes,planes,coeff],true);}
export function createEmptyJawCoordinateFunctions(gl){return jawBinding(gl,[jawTexture(gl,4,new Int32Array([-1,-1]),2,true,1),jawTexture(gl,5,new Float32Array(4),4,false,1),jawTexture(gl,6,new Float32Array(4),4,false,1)],false);}
