// R008 semantic seeds are explicitly calibrated, not automatic anatomy detections.
export const LANDMARK_SCHEMA='human/face-reference@1';
const seeds=[];
const add=(id,label,x,y,group='表面',options={})=>seeds.push({id,label,xy:[x,y],group,confidence:.65,evidence:'calibrated-semantic/surface-bound',...options});
const jawY=[1.637,1.619,1.601,1.584,1.571,1.559,1.550,1.545,1.542,1.545,1.550,1.559,1.571,1.584,1.601,1.619,1.637];
for(let i=0;i<17;i++)add('contour'+i,'轮廓 '+(i+1),i<8?-.07:i>8?.07:0,jawY[i],'轮廓',{contour:i!==8,chin:i===8,side:i<8?-1:1,confidence:.7});
for(const sign of [1,-1]){
 const side=sign===1?'Left':'Right',label=sign===1?'左':'右';
 for(let i=0;i<5;i++)add('brow'+side+i,label+'眉 '+(i+1),sign*(.019+i*.008),[1.669,1.672,1.674,1.673,1.669][i],'眉');
 const eye=[[ -.0118,0 ],[-.0059,.0033*Math.sqrt(.75)],[.0059,.0033*Math.sqrt(.75)],[.0118,0],[.0059,-.0023*Math.sqrt(.75)],[-.0059,-.0023*Math.sqrt(.75)]];
 for(let i=0;i<6;i++)add('eye'+side+i,label+'眼缘 '+(i+1),sign*(.034+eye[i][0]),1.656+eye[i][1],'眼',{eye:true,sign,confidence:1,evidence:'constructed-eye-aperture'});
 add('pupil'+side,label+'眼中心',sign*.034,1.656,'眼',{eye:true,sign,pupil:true,confidence:1,evidence:'constructed-eye-axis'});
 add('cheek'+side,label+'颧部轮廓',sign*.070,1.634,'轮廓',{contour:true,side:sign,confidence:.7});
 add('jaw'+side,label+'下颌轮廓',sign*.062,1.571,'轮廓',{contour:true,side:sign,confidence:.7});
 add('temple'+side,label+'太阳穴轮廓',sign*.077,1.674,'轮廓',{contour:true,side:sign,confidence:.7});
 add('ear'+side,label+'耳外缘',sign*.094,1.622,'耳',{contour:true,side:sign,confidence:.55});
}
for(let i=0;i<4;i++)add('bridge'+i,'鼻梁 '+(i+1),0,[1.661,1.649,1.636,1.624][i],'鼻');
for(let i=0;i<5;i++)add('noseBase'+i,'鼻底 '+(i+1),[-.019,-.010,0,.010,.019][i],[1.615,1.611,1.610,1.611,1.615][i],'鼻');
const outer=[[-.026,1.587],[-.017,1.592],[-.008,1.596],[0,1.594],[.008,1.596],[.017,1.592],[.026,1.587],[.017,1.582],[.008,1.578],[0,1.577],[-.008,1.578],[-.017,1.582]];
const inner=[[-.022,1.587],[-.010,1.588],[0,1.589],[.010,1.588],[.022,1.587],[.010,1.585],[0,1.584],[-.010,1.585]];
for(let i=0;i<12;i++)add('lipOuter'+i,'外唇 '+(i+1),...outer[i],'口');
for(let i=0;i<8;i++)add('lipInner'+i,'内唇 '+(i+1),...inner[i],'口');
add('hairlineCentre','发际线中央',0,1.713,'额',{confidence:.4,evidence:'calibrated-hairline/verify-in-image'});
add('hairlineLeft','左发际线',.050,1.708,'额',{confidence:.4,evidence:'calibrated-hairline/verify-in-image'});
add('hairlineRight','右发际线',-.050,1.708,'额',{confidence:.4,evidence:'calibrated-hairline/verify-in-image'});
add('glabella','眉间中心',0,1.674,'额');
export const FACE_LANDMARKS=Object.freeze(seeds.map(s=>Object.freeze(s)));

export function bindFaceLandmarks(surface,data,eyes){
 const parts=new Map(data.charts.map(c=>[c.id,c.part])),head=[];
 for(let i=0;i<surface.positions.length/3;i++)if(parts.get(surface.chartIds[i])===2)head.push(i);
 const triangles=[],bins=new Map(),size=.006;
 for(const g of surface.groups)if(g.materialIndex===2)for(let i=g.start;i<g.start+g.count;i+=3){const ids=Array.from(surface.indices.subarray(i,i+3)),p=ids.map(id=>Array.from(surface.positions.subarray(id*3,id*3+3)));if(p.some(v=>v[1]<1.525)||p.every(v=>v[2]<.025))continue;const row={ids,p};triangles.push(row);const lo=[0,1].map(a=>Math.floor(Math.min(...p.map(v=>v[a]))/size)),hi=[0,1].map(a=>Math.floor(Math.max(...p.map(v=>v[a]))/size));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++){const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(row);}}
 function bind(x,y){let best=null;for(const {ids,p:[a,b,c]} of bins.get(Math.floor(x/size)+','+Math.floor(y/size))||[]){const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,w=1-u-v;if(Math.min(u,v,w)<-1e-6)continue;const z=u*a[2]+v*b[2]+w*c[2];if(!best||z>best.point[2])best={ids,weights:[u,v,w],point:[x,y,z]};}
  if(best)return best;let id=-1,distance=Infinity;for(const k of head){const p=surface.positions,d=(p[k*3]-x)**2+(p[k*3+1]-y)**2;if(p[k*3+2]>.04&&d<distance){distance=d;id=k;}}return id>=0&&distance<.000064?{ids:[id],weights:[1],point:Array.from(surface.positions.subarray(id*3,id*3+3)),fallback:true}:null;
 }
 return FACE_LANDMARKS.map(seed=>{
  let binding=null;
  if(seed.eye){const e=eyes.eyes.find(e=>e.sign===seed.sign),x=seed.xy[0]-e.cx,y=seed.xy[1]-1.656,z=seed.pupil?.0125:Math.sqrt(Math.max(0,.0125**2-x*x-y*y))+.00010;binding={point:[seed.xy[0],seed.xy[1],e.cz+z],constructed:true};}
  else if(seed.contour){let best=-Infinity,id=-1;for(const k of head){const p=surface.positions,x=p[k*3]*seed.side,y=p[k*3+1],z=p[k*3+2];if(Math.abs(y-seed.xy[1])<.0018&&z>.025&&x>best){best=x;id=k;}}if(id>=0)binding={ids:[id],weights:[1],point:Array.from(surface.positions.subarray(id*3,id*3+3)),silhouette:true};}
  else if(seed.chin){let best=Infinity,id=-1;for(const k of head){const p=surface.positions;if(Math.abs(p[k*3])<.007&&p[k*3+2]>.065&&p[k*3+1]>1.525&&p[k*3+1]<best){best=p[k*3+1];id=k;}}if(id>=0)binding={ids:[id],weights:[1],point:Array.from(surface.positions.subarray(id*3,id*3+3)),silhouette:true};}
  else binding=bind(...seed.xy);
  return {...seed,binding,status:binding?'available':'NotObserved',confidence:binding?.fallback?Math.min(.4,seed.confidence):binding?seed.confidence:0};
 });
}
export function referenceCoordinates(points){
 const left=points.pupilLeft,right=points.pupilRight;if(!left||!right)throw Error('先记录左右眼中心，才能建立可比较的照片坐标');
 const dx=left[0]-right[0],dy=left[1]-right[1],distance=Math.hypot(dx,dy);if(distance<1e-5)throw Error('两眼中心距离太小');
 const centre=[(left[0]+right[0])/2,(left[1]+right[1])/2],ux=dx/distance,uy=dy/distance;
 return Object.fromEntries(Object.entries(points).map(([id,p])=>{const x=p[0]-centre[0],y=p[1]-centre[1];return [id,[(x*ux+y*uy)/distance,(-x*uy+y*ux)/distance]];}));
}
export function normalizeReference(input){
 if(!input||input.schema!==LANDMARK_SCHEMA||!input.image||!Number.isInteger(input.image.width)||!Number.isInteger(input.image.height)||input.image.width<1||input.image.height<1||!input.landmarks||Array.isArray(input.landmarks))throw Error('参考数据需要 schema、图片宽高与标志点');
 const landmarks={};for(const [id,p]of Object.entries(input.landmarks)){if(!FACE_LANDMARKS.some(s=>s.id===id)||!p||!Array.isArray(p.xy)||p.xy.length!==2||p.xy.some(v=>!Number.isFinite(v)||v<0||v>1)||!Number.isFinite(p.confidence)||p.confidence<0||p.confidence>1)throw Error('参考标志点无效：'+id);landmarks[id]={xy:[...p.xy],confidence:p.confidence,visible:p.visible!==false};}
 return {schema:LANDMARK_SCHEMA,kind:input.kind==='synthetic-demo'?'synthetic-demo':'image-observation',image:{width:input.image.width,height:input.image.height,name:String(input.image.name||'reference').slice(0,200)},landmarks,notes:String(input.notes||'').slice(0,1500),depth:'NotObserved',absoluteScale:'NotObserved'};
}
export function referencePointPixels(reference){return Object.fromEntries(Object.entries(reference.landmarks).filter(([,p])=>p.visible&&p.confidence>0).map(([id,p])=>[id,[p.xy[0]*reference.image.width,p.xy[1]*reference.image.height]]));}
