/* Explicit, versioned target-head boundary. Rigid coordinates and unit conversion
 * only: the head is never resized to make a hat fit. No anatomical detection. */
export const HEAD_SCHEMA='kaopu.head-fit-input/1';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],vec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function decodeHeadInput(input){
 if(!input||input.schema!==HEAD_SCHEMA)throw Error('头形输入版本不匹配');
 if(!['m','mm'].includes(input.units))throw Error('头形必须明确使用 m 或 mm，不能猜测单位');
 if(typeof input.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(input.id))throw Error('头形ID无效');
 const f=input.frame;if(!f||!['origin','x','y','z'].every(k=>vec(f[k])))throw Error('缺少明确的头部坐标基准');
 for(const v of [f.x,f.y,f.z])if(Math.abs(dot(v,v)-1)>1e-5)throw Error('坐标轴必须为单位向量');
 if(Math.abs(dot(f.x,f.y))+Math.abs(dot(f.x,f.z))+Math.abs(dot(f.y,f.z))>1e-5||dot(cross(f.x,f.y),f.z)<.99999)throw Error('坐标轴不正交或发生镜像');
 if(input.datum!=='calibrated-hat-frame')throw Error('尚未标定佩戴基准的头形不能自动套用');
 const p=input.position,ix=input.index;if(!Array.isArray(p)||p.length%3||p.length<900||p.length>1500000||!p.every(Number.isFinite))throw Error('头形顶点无效或超出当前容量');
 const n=p.length/3;if(!Array.isArray(ix)||ix.length%3||ix.length<900||ix.length>4500000||!ix.every(i=>Number.isInteger(i)&&i>=0&&i<n))throw Error('头形三角形索引无效');
 const scale=input.units==='mm'?.001:1,out=new Float32Array(p.length);
 for(let i=0;i<p.length;i+=3){const q=p.slice(i,i+3).map((v,k)=>(v-f.origin[k])*scale);out[i]=dot(q,f.x);out[i+1]=dot(q,f.y);out[i+2]=dot(q,f.z);}
 const upper=[];let top=-Infinity;for(let i=0;i<out.length;i+=3){top=Math.max(top,out[i+1]);if(out[i+1]>0)upper.push([out[i],out[i+2]]);}
 if(top<.070||top>.140||upper.length<100)throw Error('头顶与佩戴基准不在当前验证范围；请先校准，而非缩放人物');
 const ext=upper.reduce((a,p)=>[Math.min(a[0],p[0]),Math.max(a[1],p[0]),Math.min(a[2],p[1]),Math.max(a[3],p[1])],[Infinity,-Infinity,Infinity,-Infinity]),width=ext[1]-ext[0],depth=ext[3]-ext[2];
 if(width<.120||width>.230||depth<.145||depth>.270)throw Error('头形宽深超出当前范围；未改变当前人物');
 return {id:input.id,title:String(input.title||input.id).slice(0,80),rawPositions:out,rawIndex:Uint32Array.from(ix),sourceFrame:structuredClone(f),sourceUnits:input.units,datum:input.datum,headWidthM:width,headDepthM:depth,ellipseCircumferenceM:0,inputProvenance:'user-imported calibrated head geometry',notAnatomicallyDetected:true};
}
export function exportHeadInput(id,title,position,index){return {schema:HEAD_SCHEMA,id,title,units:'m',datum:'calibrated-hat-frame',frame:{origin:[0,0,0],x:[1,0,0],y:[0,1,0],z:[0,0,1]},position:Array.from(position),index:Array.from(index),notice:'Coordinate template, not automatic head landmark extraction. Rig binding/revision should be preserved by the integrating human system.'};}
