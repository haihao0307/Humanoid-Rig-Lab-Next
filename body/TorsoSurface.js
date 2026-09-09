/* Torso R1: authored surface anatomy, metre units. No external mesh.
 * Source-to-rule map: docs/anatomy/torso-r1/FRAMEWORK.md and CONTRACT.json.
 * Shoulder collar / upper-arm / hand constructors stay at their accepted baseline.
 * This field runs once in bind space, after subdivision, before final normals.
 */
const TORSO_SHAPE_DEFAULT=Object.freeze({chestWidth:1,chestDepth:1,backDepth:1,waistWidth:1,abdominalFullness:1,pectoralVolume:1,costalDefinition:1,scapularRelief:1});
const TORSO_SHAPE_LIMITS=Object.freeze({chestWidth:[.93,1.07],chestDepth:[.92,1.08],backDepth:[.9,1.1],waistWidth:[.92,1.08],abdominalFullness:[.8,1.2],pectoralVolume:[.5,1.4],costalDefinition:[0,1.4],scapularRelief:[0,1.4]});
const torsoG=(x,s)=>Math.exp(-((x/s)**2));
const torsoS=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*t*(10+t*(-15+6*t));};
// A surface envelope, not a list of isolated ribs. Soft tissue and rib-cage
// proportions remain separate controls; coefficients below are authored design.
const TORSO_ENVELOPE_ROWS=Object.freeze([
 [.080,.160,.110,.111,0,.001],
 [.110,.156,.108,.104,0,.004],
 [.160,.141,.103,.090,0,.008],
 [.205,.137,.106,.087,0,.010],
 [.250,.145,.111,.094,0,.009],
 [.300,.158,.120,.103,0,.005],
 [.350,.167,.125,.107,0,.003],
 [.395,.169,.131,.107,0,.003],
 [.435,.162,.124,.101,0,.004],
 [.475,.151,.102,.087,0,.007],
 [.505,.123,.085,.071,0,.010],
 [.514,.111,.079,.064,0,.010],
 [.533,.072,.068,.051,0,.005],
 [.568,.052,.051,.047,0,.014]
]);
const TORSO_REFERENCE_PROFILE=tissueProfile(ADULT_SPEC.authorTorsoProfile);
const TORSO_BASE_PROFILE=tissueProfile(ADULT_BASE_SPEC.profiles.torso);
const TORSO_ENVELOPE_PROFILE=tissueProfile(TORSO_ENVELOPE_ROWS);
function validateTorsoShape(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('躯干参数必须为对象');
 const p={...TORSO_SHAPE_DEFAULT};
 for(const[k,v]of Object.entries(input)){const r=TORSO_SHAPE_LIMITS[k];if(!r||!Number.isFinite(v)||v<r[0]||v>r[1])throw Error('躯干参数超出编辑范围：'+k);p[k]=v;}
 // Design-domain checks, never presented as diagnostic cutoffs.
 const width=.334*p.chestWidth,depth=.225*p.chestDepth+.008*p.backDepth+.014*p.pectoralVolume;
 if(depth/width>.87||depth/width<.56)throw Error('胸廓宽深组合超出本版设计范围，请同时核对胸宽与胸深');
 if(.274*p.waistWidth/width>.97)throw Error('腰宽已接近胸廓宽度，请联动调整胸廓宽度');
 return p;
}
function torsoEnvelope(t,p=TORSO_SHAPE_DEFAULT){
 const r=TORSO_ENVELOPE_PROFILE(t);if(BODY_SEX==='female'){
 const selected=TORSO_REFERENCE_PROFILE(t),base=TORSO_BASE_PROFILE(t);
 for(let k=0;k<3;k++)r[k]*=selected[k]/base[k];
 }const chest=torsoS(.19,.32,t)*(1-torsoS(.46,.528,t)),waist=torsoG(t-.189,.084),abd=torsoG(t-.174,.096);
 r[0]*=1+(p.chestWidth-1)*chest+(p.waistWidth-1)*waist;
 r[1]*=1+(p.chestDepth-1)*chest+.55*(p.abdominalFullness-1)*abd;
 r[2]*=1+(p.backDepth-1)*chest;
 return r;
}
function torsoSurfaceRelief(x,t,cs,p){
 const a=Math.abs(x),front=Math.max(0,cs),back=Math.max(0,-cs);
 let relief=0;
 if(front>0){
  // Pectoral fan: the lower border rises laterally, all transitions broad.
  const lateral=clamp(a/.157,0,1),lower=.350+.045*lateral*lateral;
  // Two shallow broad fans, avoiding rectangular step masks at their margins.
  const medial=1-torsoG(a,.022),outer=1-torsoS(.112,.173,a);
  const fan=torsoG(t-(.421+.017*lateral),.072)*torsoG(a-.060,.095);
  relief+=.010*p.pectoralVolume*fan*medial*outer;
  relief-=.00065*p.pectoralVolume*torsoG(t-lower,.023)*medial*outer;
  relief-=.0012*torsoG(x,.019)*torsoG(t-.426,.080);
  // Costal margin slopes inferolaterally; preserve soft abdominal continuity.
  const arch=.322-.068*Math.pow(clamp(a/.146,0,1),.8);
  relief+=.0024*p.costalDefinition*torsoG(t-arch,.018)*torsoS(.018,.047,a)*(1-torsoS(.123,.157,a));
  // Long abdominal columns and oblique flank, low relief at neutral body fat.
  relief+=.0028*p.abdominalFullness*torsoG(a-.036,.026)*torsoG(t-.211,.103);
  relief+=.0018*torsoG(a-.112,.035)*torsoG(t-.186,.078);
  relief-=.0010*torsoG(x,.010)*torsoG(t-.229,.088);
  // Original umbilicus is already in the reference carrier, do not add twice.
  // Remove the old broad lower-chest bulge before applying the new pectoral fan.
  relief-=.007*torsoG(a-.074,.052)*torsoG(t-.36,.080);
  relief-=.0045*torsoG(a-.100,.055)*torsoG(t-.433,.040)*tissueSmooth(.325,.365,t);
  return relief*front*front;
 }
 return 0;
}

function torsoVertexMask(v,hipY){
 const t=bodyAuthorY(v.p[1]-hipY),a=Math.abs(v.p[0]);
 if(t<=.086||t>=.546||a>=.193)return 0;
 let arm=0,girdle=0;
 for(const[id,w]of v.w){if(/^(left|right)_/.test(id)){if(/_(SC|AC)$/.test(id))girdle+=w;else if(/_(upperArm|forearm|radiusRotation|hand|metacarpal_|finger_)/.test(id))arm+=w;}}
 // Infinitesimal appendicular weights occur on torso boundary vertices. Use
 // C2 weight fades rather than a binary cutoff which would create a ridge.
 const upper=torsoS(.325,.411,t),medial=1-upper*torsoS(.065,.160,a);
 return torsoS(.086,.165,t)*(1-torsoS(.500,.546,t))*medial
   *(1-torsoS(0,.11,girdle))*(1-torsoS(0,.13,arm));

}
function refineTorsoSurfaceVertices(tissue,cage){
 const p=validateTorsoShape(tissue.human.torsoShape||TORSO_SHAPE_DEFAULT),hy=tissue.bind.get('hips').p[1];
 let count=0,max=0;const changed=[];
 for(let i=0;i<cage.v.length;i++){
  const v=cage.v[i],ref=TORSO_REFERENCE_PROFILE(bodyAuthorY(v.p[1]-hy));
  const mask=torsoVertexMask(v,hy)*torsoS(0,.035,v.p[2]-ref[4]);if(mask<=0)continue;
  const[x,y,z]=v.p,t=bodyAuthorY(y-hy),old=TORSO_REFERENCE_PROFILE(t),r=torsoEnvelope(t,p);
  const cs=clamp((z-old[4])/(z>=old[4]?old[1]:old[2]),-1,1);
  const dx=x*(r[0]/old[0]-1);
  const posteriorFade=.45*(1-.4*torsoS(.05,.14,Math.abs(x))*torsoS(.30,.40,t));
  // A sign switch displaced adjacent flank vertices to different depth planes.
  const depthFade=posteriorFade+(1-posteriorFade)*torsoS(-.20,.20,cs);
  const dz=((r[4]-old[4])+cs*((cs>=0?r[1]:r[2])-(cs>=0?old[1]:old[2]))+torsoSurfaceRelief(x,t,cs,p))*depthFade;
  v.p=[x+dx*mask,y,z+dz*mask];
  max=Math.max(max,Math.hypot(dx*mask,dz*mask));count++;changed.push(i);
 }
 tissue.torsoSurfaceReport={schema:'jarvis/torso_surface_report@1',version:'1.14.0',parameters:p,changedVertices:count,maxDisplacementM:max,topologyChanged:false,boneLengthsChanged:false,sourceFramework:'docs/anatomy/torso-r1/FRAMEWORK.md',method:'bind-space regional continuous envelope and low-relief anatomy fields'};
 tissue.torsoChangedVertices=changed;
}

const TORSO_KNOWLEDGE_CONTRACT=Object.freeze({schema:'jarvis/torso_generation_contract@1',version:'1.14.0',units:'metre',referenceFrame:'bind space, Y above hips, Z anterior',knowledgeStatus:'source-backed structural relationships; authored surface coefficients; not medical measurements',layers:['thoracic envelope','regional soft-tissue relief','continuous skinned surface'],rules:['Preserve joint IDs, parent graph, bind lengths and accepted appendicular dimensions.','Keep thoracic width, anterior depth and posterior depth separate.','Blend sternum into upper chest; avoid a single flat vertical chest slab.','Use shallow paired pectoral fans and inferolateral costal margins.','Keep abdominal midline, wall and flanks continuous.','Use broad scapular planes; no independent spherical back bulges.','Use continuous transition masks, never binary tiny-weight cutoffs.','Parameter changes rebuild from immutable baseline, never accumulate offsets.','Review front, back, side, oblique and movement screenshots.'],defaults:TORSO_SHAPE_DEFAULT,limits:TORSO_SHAPE_LIMITS,limitsAre:'engineering edit-domain bounds, not clinical normal ranges',sources:['https://openstax.org/books/anatomy-and-physiology-2e/pages/7-4-the-thoracic-cage','https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax','https://humananatomy.host.dartmouth.edu/BHA/public_html/part_2/chapter_8.html','https://humananatomy.host.dartmouth.edu/BHA/public_html/part_4/chapter_19.html','https://openstax.org/books/anatomy-and-physiology-2e/pages/7-3-the-vertebral-column'],unimplemented:['rib-to-skin clearance solver','scapular sliding','soft-tissue volume conservation','full contact and self-collision']});

// Match the existing procedural thoracic bone geometry to the revised envelope.
// Joint anchors/parent graph stay fixed. Spine and shoulder bones are untouched.
// Muscular relief is deliberately excluded from this structural transformation.
function fitThoracicGeometryToEnvelope(tissue){
 const h=tissue.human,p=validateTorsoShape(h.torsoShape||TORSO_SHAPE_DEFAULT),hy=tissue.bind.get('hips').p[1];
 if(!h.torsoBoneBaseline)h.torsoBoneBaseline=new Map();
 const objects=[...h.bones.filter(b=>b.id==='sternum'||/_(left|right)?rib_/.test(b.id)),...h.cartilage.filter(c=>c.anatomyRegion==='costal')];
 let changed=0,max=0;
 for(const o of objects){
  if(!h.torsoBoneBaseline.has(o))h.torsoBoneBaseline.set(o,o.g);
  const g=h.torsoBoneBaseline.get(o),f=tissue.bind.get(o.joint.id),positions=new Float32Array(g.p.length);
  for(let i=0;i<g.p.length;i+=3){
   const local=Array.from(g.p.subarray(i,i+3)),v=point(f,local),[x,y,z]=v,t=bodyAuthorY(y-hy),a=Math.abs(x);
   if(t<=.086||t>=.546){positions.set(local,i);continue}
   const old=TORSO_REFERENCE_PROFILE(t),r=torsoEnvelope(t,p),cs=clamp((z-old[4])/(z>=old[4]?old[1]:old[2]),-1,1);
   const m=torsoS(.086,.165,t)*(1-torsoS(.500,.546,t))*(1-torsoS(.325,.411,t)*torsoS(.065,.160,a))*torsoS(.04,.10,Math.hypot(x,z-old[4]));
   const depthFade=cs<0?.45*(1-.4*torsoS(.05,.14,a)*torsoS(.30,.40,t)):1;
   const dx=x*(r[0]/old[0]-1)*m,dz=((r[4]-old[4])+cs*((cs>=0?r[1]:r[2])-(cs>=0?old[1]:old[2])))*m*depthFade;
   positions.set(rotate(inv(f.q),sub([x+dx,y,z+dz],f.p)),i);max=Math.max(max,Math.hypot(dx,dz));if(Math.abs(dx)+Math.abs(dz)>1e-10)changed++;
  }
  o.g={...g,...mesh(positions,g.i)};
 }
 tissue.thoracicGeometryReport={objects:objects.length,changedVertices:changed,maxDisplacementM:max,fromImmutableBaseline:true,jointAnchorsChanged:false,method:'continuous regional cage warp without superficial muscle relief',clearanceStatus:'requires sampled surface audit; no full-contact solver'};
}
