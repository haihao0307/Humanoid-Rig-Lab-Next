// Ordinary four-panel net sewing-line paper, generated BEFORE 3D placement.
// Original project equations; no gusset-cut remnants and no rest lengths from XYZ.
export function createBasicShortsPaper(m, options={}){
 const o={columns:10,rows:18,hipRow:6,crotchRow:12,waistEase:.025,hipEase:.10,thighEase:.07,crotchDrop:.012,frontRiseEase:.025,backRiseEase:.035,inseamLength:.15,sideIntake:.008,inseamTaper:.01,...options};
 const lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t),dist=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
 const length=a=>a.slice(1).reduce((s,p,i)=>s+dist(p,a[i]),0),depth=m.crotchDepth+o.crotchDrop,legY=Math.sqrt(o.inseamLength**2-o.inseamTaper**2),pieces=[],drafts={};
 for(const kind of ['front','back']){
  const front=kind==='front',hip=((front?m.hipFrontArc:m.hipBackArc)+o.hipEase/2)/2,waist=((front?m.waistFrontArc:m.waistBackArc)+o.waistEase/2)/2,cw=[hip-o.sideIntake-waist,0];
  const makeRise=e=>Array.from({length:o.crotchRow+1},(_,r)=>{
   if(r<=o.hipRow)return lerp(cw,[0,m.waistToHip],r/o.hipRow);
   const t=(r-o.hipRow)/(o.crotchRow-o.hipRow);
   // A quarter-ellipse sampled on horizontal material stations. The former
   // cubic-parameter rows clustered almost on top of the crotch corner and
   // produced ill-conditioned sliver triangles inside otherwise valid paper.
   return[-e*(1-Math.sqrt(Math.max(0,1-t*t))),m.waistToHip+(depth-m.waistToHip)*t];
  });
  const desired=(front?m.frontRiseLength+o.frontRiseEase:m.backRiseLength+o.backRiseEase);let lo=0,hi=1;
  if(length(makeRise(0))>desired)throw Error('Basic rise route is shorter than its vertical paper depth');
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(length(makeRise(mid))<desired)lo=mid;else hi=mid;}
  const extension=(lo+hi)/2;drafts[kind]={hip,waist,extension,rise:makeRise(extension),desired};
 }
 const hemTarget=options.hemCircumference??Math.max(m.thighCircumference.left,m.thighCircumference.right)+o.thighEase,base=drafts.front.hip+drafts.back.hip+drafts.front.extension+drafts.back.extension,hemOffset=(hemTarget-base+2*o.inseamTaper)/2;
 const outerY=r=>r<=o.hipRow?m.waistToHip*r/o.hipRow:r<=o.crotchRow?m.waistToHip+(depth-m.waistToHip)*(r-o.hipRow)/(o.crotchRow-o.hipRow):depth+legY*(r-o.crotchRow)/(o.rows-o.crotchRow);
 const offset=r=>r<=o.hipRow?-o.sideIntake*(1-r/o.hipRow):hemOffset*(r-o.hipRow)/(o.rows-o.hipRow),index=(r,c)=>r*(o.columns+1)+c;
 for(const id of ['FL','FR','BL','BR']){
  const kind=id[0]==='F'?'front':'back',side=id[1]==='L'?'left':'right',mirror=side==='left'?-1:1,d=drafts[kind],uv=[],tri=[];
  for(let r=0;r<=o.rows;r++){
   const inner=r<=o.crotchRow?d.rise[r]:[-d.extension+o.inseamTaper*(r-o.crotchRow)/(o.rows-o.crotchRow),outerY(r)],outer=[d.hip+offset(r),outerY(r)];
   if(outer[0]<=inner[0])throw Error('Basic paper width inverted');
   for(let c=0;c<=o.columns;c++){const p=lerp(inner,outer,c/o.columns);uv.push([mirror*p[0],p[1]]);}
  }
  const quality=t=>{const[a,b,c]=t.map(i=>uv[i]),det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);return mirror*det>0?Math.abs(det)/(dist(a,b)**2+dist(b,c)**2+dist(c,a)**2):-Infinity;};
  for(let r=0;r<o.rows;r++)for(let c=0;c<o.columns;c++){const a=index(r,c),b=index(r,c+1),z=index(r+1,c),e=index(r+1,c+1),one=[[a,b,z],[b,e,z]],two=[[a,b,e],[a,e,z]],score=ts=>Math.min(...ts.map(quality)),chosen=score(one)>score(two)?one:two;if(!Number.isFinite(score(chosen)))throw Error('Basic paper grid folded');tri.push(...chosen);}
  const seq=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
  pieces.push({id,kind:'leg-panel',side,bodySide:kind,materialCoordinates:uv,triangles:tri,grid:{columns:o.columns,rows:o.rows},boundaries:{waist:seq(0,o.columns).map(c=>index(0,c)),hem:seq(0,o.columns).map(c=>index(o.rows,c)),rise:seq(0,o.crotchRow).map(r=>index(r,0)),inseam:seq(o.crotchRow,o.rows).map(r=>index(r,0)),outseam:seq(0,o.rows).map(r=>index(r,o.columns))},crotchCorner:index(o.crotchRow,0)});
 }
 const seams=[];for(const [id,a,b,edge]of [['front-rise','FL','FR','rise'],['back-rise','BL','BR','rise'],['left-inner','FL','BL','inseam'],['right-inner','FR','BR','inseam'],['left-side','FL','BL','outseam'],['right-side','FR','BR','outseam']]){
  const pa=pieces.find(p=>p.id===a),pb=pieces.find(p=>p.id===b),ia=pa.boundaries[edge],ib=pb.boundaries[edge];
  const mismatch=Math.max(...ia.slice(1).map((v,i)=>Math.abs(dist(pa.materialCoordinates[v],pa.materialCoordinates[ia[i]])-dist(pb.materialCoordinates[ib[i+1]],pb.materialCoordinates[ib[i]]))));
  if(mismatch>1e-10)throw Error('Basic paper seam feed mismatch '+id);
  seams.push({id,aPiece:a,bPiece:b,pairs:ia.map((v,i)=>({a:v,b:ib[i]})),maximumSegmentMismatchM:mismatch});
 }
 return{version:'complete-four-panel-basic-block-1',pieces,seams,options:o,measurements:m,drafts,depth,hemTarget,paperAuthority:'flat source sewing-line equations; full rise and inner-leg corners; no gusset cut and no formed-surface rest metric'};
}

export function placeBasicShortsPaper(pattern,sectionAt,{waistY,crotchY,framePoint=p=>p,clearance=.008}={}){
 const o=pattern.options,uv=[],xyz=[],tri=[],ranges=[],waist=[],offsets=new Map();
 // Uniform arclength sampling prevents ellipse parameter angle from creating
 // avoidable compression. It does not change the two-dimensional cut paper.
 function arc(cx,cz,rx,rz,start,end,t){const p=[],s=[0];for(let i=0;i<=160;i++){const a=start+(end-start)*i/160;p.push([cx+rx*Math.sin(a),cz+rz*Math.cos(a)]);if(i)s.push(s.at(-1)+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));}const target=t*s.at(-1);let i=s.findIndex(v=>v>=target);if(i<=0)return p[0];const f=(target-s[i-1])/(s[i]-s[i-1]);return p[i-1].map((v,k)=>v+f*(p[i][k]-v));}
 for(const p of pattern.pieces){const begin=uv.length/2;offsets.set(p.id,begin);ranges.push({pieceId:p.id,offset:begin,count:p.materialCoordinates.length});
  const mirror=p.side==='left'?-1:1,front=p.bodySide==='front';
  for(let r=0;r<=o.rows;r++)for(let c=0;c<=o.columns;c++){
   const i=r*(o.columns+1)+c,u=p.materialCoordinates[i],t=c/o.columns,y=waistY-u[1],a=sectionAt(y,'hip'),b=sectionAt(y,p.side),upper=arc(0,a.centerZ??0,a.radiusX+clearance,a.radiusZ+clearance,front?0:Math.PI,Math.PI/2,t),lower=arc(Math.abs(b.centerX),b.centerZ??0,b.radiusX+clearance,b.radiusZ+clearance,front?-Math.PI/2:3*Math.PI/2,Math.PI/2,t);
   const fraction=Math.max(0,Math.min(1,(r-o.hipRow)/(o.crotchRow-o.hipRow))),blend=fraction*fraction*(3-2*fraction);
   let xz=upper.map((v,k)=>v+(lower[k]-v)*blend);
   if(r===o.crotchRow&&c===0)xz=[0,b.centerZ??0];
   if(r===o.crotchRow){const outer=Math.abs(b.centerX)+b.radiusX+clearance,center=outer/2;xz=arc(center,b.centerZ??0,center,b.radiusZ+clearance,front?-Math.PI/2:3*Math.PI/2,Math.PI/2,t);}
   xyz.push(...framePoint([mirror*xz[0],y,xz[1]]));uv.push(...u);
  }
  for(const t of p.triangles)tri.push(...t.map(i=>i+begin));waist.push(...p.boundaries.waist.map(i=>i+begin));
 }
 const seams=pattern.seams.map(s=>({...s,pairs:s.pairs.map(p=>({a:offsets.get(s.aPiece)+p.a,b:offsets.get(s.bPiece)+p.b}))}));
 return{positions:Float64Array.from(xyz),uvs:Float64Array.from(uv),sourceUV:Float64Array.from(uv),triangles:Uint32Array.from(tri),ranges,seams,waistIndices:waist,elasticEdges:[],casing:{stitchPaths:[]},pieces:pattern.pieces,pattern,receipt:{paperAuthority:pattern.paperAuthority,upperY:waistY,hem:{y:waistY-pattern.depth-Math.sqrt(o.inseamLength**2-o.inseamTaper**2)},design:o,crotchY,waistbandPending:true}};
}
