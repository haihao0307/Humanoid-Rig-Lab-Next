/* Head/neck R1. Source-backed anatomical relationships; authored surface sizes.
 * No imported mesh, images, measured subject or bone scaling. Metres, +Y up, +Z anterior.
 * Stable limb bindings. This release corrects the cervical REST layout once and
 * increments the binding revision. Subsequent pose controls only write rotations.
 */
const HEAD_NECK_SHAPE_DEFAULT=Object.freeze({neckWidth:1,frontDepth:1,backDepth:1,scmDefinition:1,submentalFullness:1,napeFullness:1});
const HEAD_NECK_SHAPE_LIMITS=Object.freeze({neckWidth:[.88,1.12],frontDepth:[.88,1.12],backDepth:[.88,1.12],scmDefinition:[0,1.5],submentalFullness:[.6,1.4],napeFullness:[.6,1.4]});
const hnS=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*t*(10+t*(-15+6*t));};
const hnG=(x,s)=>Math.exp(-((x/s)**2));
// Local to the head origin. Anterior and posterior radii are independent.
// Neck continues under the jaw and reaches the occiput; it does not collapse
// to the chin's tiny section around the entire circumference.
const HEAD_NECK_PROFILE_ROWS=Object.freeze([
 [-.190,.123,.093,.080,0,-.005],
 [-.167,.108,.083,.075,0,-.008],
 [-.147,.080,.069,.068,0,-.008],
 [-.127,.061,.053,.061,0,-.007],
 [-.108,.051,.045,.056,0,-.006],
 [-.088,.046,.042,.052,0,-.006],
 [-.067,.046,.043,.050,0,-.005],
 [-.045,.050,.047,.051,0,-.003],
 [-.020,.056,.053,.060,0,-.002],
 [ .012,.065,.060,.073,0,-.003],
 [ .025,.069,.066,.080,0,-.006]
]);
const HEAD_NECK_PROFILE=tissueProfile(HEAD_NECK_PROFILE_ROWS);
function validateHeadNeckShape(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('头颈参数必须是对象');
 const p={...HEAD_NECK_SHAPE_DEFAULT};
 for(const[k,v]of Object.entries(input)){const bounds=HEAD_NECK_SHAPE_LIMITS[k];if(!bounds||typeof v!=='number'||!Number.isFinite(v)||v<bounds[0]||v>bounds[1])throw Error('头颈参数超出编辑范围：'+k);p[k]=v;}
 return p;
}
function headNeckBlend(y,cs){const u=(1-clamp(cs,-1,1))*.5;return hnS(-.095+.060*u,-.057+.069*u,y);}
function headNeckSurfacePoint(tissue,t,theta,original){
 const hip=tissue.bind.get('hips'),head=tissue.bind.get('head'),y=hip.p[1]+t-head.p[1];
 if(bodyAuthorY(t)<=.499||y>=.026)return original;
 const p=tissue.human.headNeckShape||HEAD_NECK_SHAPE_DEFAULT;
 // Match the face sampler's angular density exactly at the upper boundary.
 const a=theta-.62*Math.sin(theta)*tissueSmooth(-.085,-.045,y),cs=Math.cos(a),sn=Math.sin(a);
 const n=HEAD_NECK_PROFILE(y),f=FACE_PROFILE(y),blend=headNeckBlend(y,cs);
 const zone=hnS(-.173,-.125,y)*(1-hnS(-.035,.022,y));
 n[0]*=1+(p.neckWidth-1)*zone;n[1]*=1+(p.frontDepth-1)*zone;n[2]*=1+(p.backDepth-1)*zone;
 let x=sn*(n[0]+(f[0]-n[0])*blend);
 let neckZ=n[4]+cs*(cs>=0?n[1]:n[2]);
 let faceZ=f[4]+cs*(cs>=0?f[1]:f[2]);
 if(cs>0&&blend>.96)faceZ=tissueHeadFront(x,y);
 let z=head.p[2]+neckZ+(faceZ-neckZ)*blend;
 // Broad oblique SCM tracks: medial sternoclavicular roots to mastoid region.
 const u=clamp((y+.16)/.15,0,1),track=.30+1.32*u,ang=Math.abs(Math.atan2(sn,cs));
 const longitudinal=Math.sin(Math.PI*clamp((y+.174)/.190,0,1))**1.4;
 const scm=.0024*p.scmDefinition*hnG(ang-track,.23)*longitudinal*(1-blend*.75);
 x+=sn*scm;z+=cs*scm;
 // Under-chin tissue is a bounded sloping floor, not a hanging bulb.
 z+=.0025*(p.submentalFullness-1)*hnG(y+.088,.029)*Math.max(0,cs)**4;
 // Posterior support remains broad and blends into the lower occiput.
 const nape=.0022*p.napeFullness*hnG(y+.074,.055)*Math.max(0,-cs)**2*(1-blend);
 z-=nape;
 // Very shallow anterior laryngeal cue and suprasternal hollow.
 z+=.0012*hnG(x,.014)*hnG(y+.121,.018)*Math.max(0,cs)**3;
 z-=.0012*hnG(x,.018)*hnG(y+.171,.015)*Math.max(0,cs)**3;
 // C2 transition at the medial neck base; approved shoulder caps remain unchanged.
 const medial=1-hnS(.078,.120,Math.abs(original[0]));
 const mask=hnS(.499,.548,bodyAuthorY(t))*(medial+(1-medial)*hnS(-.143,-.119,y))*(1-hnS(.010,.026,y));
 return [original[0]+(x-original[0])*mask,original[1],original[2]+(z-original[2])*mask];
}
function headNeckVertexWeights(tissue,v){
 const head=tissue.bind.get('head'),hip=tissue.bind.get('hips'),y=v.p[1]-head.p[1],t=bodyAuthorY(v.p[1]-hip.p[1]);
 if(t<=.540)return;
 const foreign=v.w.reduce((n,[id,w])=>n+(/^(left|right)_/.test(id)?w:0),0);
 if(foreign>.00001)return;
 const n=HEAD_NECK_PROFILE(y),z=v.p[2]-head.p[2]-n[4],theta=Math.atan2(v.p[0]/n[0],z/(z>=0?n[1]:n[2]));
 const cs=Math.cos(theta),b=headNeckBlend(y,cs);
 const base=surfaceSpineWeights(tissue,v.p[1]);
 v.w=surfaceWeights([...base.map(([id,w])=>[id,w*(1-b)]),['head',b]]);
}
function refineHeadNeckSurfaceVertices(tissue,cage){
 let count=0;const hip=tissue.bind.get('hips');
 for(const v of cage.v){if(v.p[1]>hip.p[1]+bodyAxialY(.540)){headNeckVertexWeights(tissue,v);count++;}}
 tissue.headNeckSurfaceReport={schema:'jarvis/head_neck_surface@1',version:'1.15.0',parameters:{...(tissue.human.headNeckShape||HEAD_NECK_SHAPE_DEFAULT)},headBindPosition:[...tissue.bind.get('head').p],atlasBindPosition:[...tissue.bind.get('C1').p],weightReviewVertices:count,method:'angle-dependent jaw/occiput union; oblique low-relief neck fields; cranial ownership weights',facialIdentityChanged:false,fullSoftTissuePhysics:false};
}
const HEAD_NECK_KNOWLEDGE_CONTRACT=Object.freeze({schema:'jarvis/head_neck_generation_contract@1',version:'1.15.0',units:'metre',sources:[
 {id:'HN01',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/7-2-the-skull',supports:'occipital condyles articulate with atlas; mastoid/nuchal attachment landmarks'},
 {id:'HN02',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/7-3-the-vertebral-column',supports:'seven cervical vertebrae; cervical lordotic curve; atlas and axis'},
 {id:'HN03',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints',supports:'different atlanto-occipital and atlantoaxial articulations'},
 {id:'HN04',url:'https://humananatomy.host.dartmouth.edu/BHA/public_html/part_8/chapter_50.html',supports:'SCM attachments and oblique path; trapezius attachments; anterior/posterior triangles'},
 {id:'HN05',url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back',supports:'suprahyoid and infrahyoid layers; posterior muscle relationships; figures 11.13 and 11.14 inspected'}
],rules:[
 'Distinguish anterior under-jaw, lateral mandibular angle and posterior occipital transitions.',
 'Do not use the chin closing section as an all-around neck ring.',
 'Head/neck rest alignment is binding data; pose controls do not translate joints or scale bones.',
 'Face, skull and detail surfaces share the same head binding. Facial contours retain cranial skin ownership.',
 'SCM follows sternum/medial clavicle to mastoid; surface relief remains broad and low.',
 'Posterior neck blends to occiput and trapezius; no spherical neck inserts.',
 'Approved hand, forearm and shoulder parameters and construction remain frozen.',
 'Review same-camera side/front/back plus head rotation, nodding and extension.',
 'Rebuild from immutable canonical source; never accumulate offsets.'
],defaults:HEAD_NECK_SHAPE_DEFAULT,limits:HEAD_NECK_SHAPE_LIMITS,sourceVsDesign:'Sources support relationships; coordinates, default offsets and edit bounds are authored character design, not measured anatomy or medical normal ranges.',restRevision:{from:1,to:2,previousHeadZ:.056,newHeadZ:.016,cervicalEndZ:.008,headForwardOfAtlasM:.008},unimplemented:['individual occipital condyle contact','muscle force dynamics','skin sliding','full head-to-chest collision','facial redesign']});
