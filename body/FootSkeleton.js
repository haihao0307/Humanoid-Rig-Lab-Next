/* R9 foot construction in ankle-local metres; +Z anterior, canonical +X lateral.
 * Seven tarsals, five metatarsals and fourteen phalanges remain separate bones.
 * All coordinates are authored dimensions; see docs/BODY_PLAN_R9.md. */
function footBoneFieldsV07(s){
 const P=p=>[p[0]*s,p[1],p[2]];
 const make=(id,fn,lo,hi)=>({id,field:p=>fn(P(p)),lo:[s>0?lo[0]:-hi[0],lo[1],lo[2]],hi:[s>0?hi[0]:-lo[0],hi[1],hi[2]]});
 return [
  make('talus',p=>{let d=sup(p,[0,-.009,.001],[.018,.013,.021],2.6);d=S(d,sweptEll(p,[-.001,-.018,.018],[-.011,-.021,.034],[.012,.011,.013]),.004);return S(d,E(p,[-.014,-.023,.036],[.017,.013,.015]),.003)},[-.034,-.040,-.024],[.023,.007,.054]),
  make('calcaneus',p=>{let d=sup(p,[.002,-.044,-.024],[.024,.020,.027],2.5);d=S(d,sup(p,[.008,-.044,.012],[.020,.016,.022],2.6),.004);d=S(d,E(p,[-.018,-.029,-.001],[.014,.008,.013]),.003);return cut(d,E(p,[0,-.011,.001],[.018,.010,.022]))},[-.037,-.068,-.055],[.033,-.018,.039]),
  make('navicular',p=>{let d=sup(p,[-.014,-.028,.055],[.021,.012,.013],2.6);return S(d,E(p,[-.031,-.032,.054],[.008,.007,.009]),.002)},[-.042,-.044,.038],[.012,-.012,.072]),
  make('cuboid',p=>{let d=sup(p,[.027,-.044,.054],[.016,.012,.019],3);return cut(d,sweptEll(p,[.014,-.056,.050],[.044,-.056,.063],[.003,.002,.003]))},[.008,-.059,.031],[.047,-.027,.076]),
  ...[['medial_cuneiform',-.029,-.034,.079,.013,.012,.013],['intermediate_cuneiform',-.010,-.030,.076,.009,.011,.011],['lateral_cuneiform',.008,-.033,.077,.010,.012,.013]].map(([id,x,y,z,rx,ry,rz])=>make(id,p=>{const t=clamp((p[1]-y)/ry,-1,1);return sup(p,[x,y,z],[rx*(.83+.17*t),ry,rz],3)},[x-rx*1.3,y-ry*1.3,z-rz*1.3],[x+rx*1.3,y+ry*1.3,z+rz*1.3]))
 ];
}
const RAYS=[
 [[-.029,-.039,.090],[-.034,-.055,.143],[.027,.018]],
 [[-.010,-.033,.086],[-.014,-.055,.152],[.020,.011,.0075]],
 [[.008,-.036,.087],[.006,-.055,.146],[.018,.010,.007]],
 [[.024,-.044,.074],[.024,-.055,.136],[.016,.009,.0065]],
 [[.036,-.046,.071],[.039,-.055,.122],[.014,.0075,.006]]
];
function footRaysV07(s){return RAYS.map(([a,b,ph],f)=>({base:footBonePoint([a[0]*s,a[1],a[2]]),head:footBonePoint([b[0]*s,b[1],b[2]]),phalanges:ph.map(v=>v*ADULT_SPEC.foot.boneScale[2]),radius:(f===0?.0061:.0048-f*.00025)*ADULT_SPEC.foot.boneScale[0],toeDirection:lowerToeDirection(s,f)}));}
