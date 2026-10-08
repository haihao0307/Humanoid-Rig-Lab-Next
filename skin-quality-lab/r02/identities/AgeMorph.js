/**
 * Reversible, scan-specific artistic age study for the R02 closed-eye head.
 * This is authored shape design, NOT a medical/biological ageing prediction.
 * Only metre-space R02 geometry after its two original subdivisions is valid.
 * No topology, UV, textures, materials, skeleton or other workbench is changed.
 *
 * import { createScanAgeMorph } from './identities/AgeMorph.js';
 * const age = createScanAgeMorph(mesh.geometry); // capture neutral exactly once
 * age.apply(identity === 'weathered' ? 1 : 0);   // then resample hair/fuzz roots
 * age.restore();                               // byte-exact neutral P and N
 *
 * Attribute names skinNeutralPosition and skinNeutralNormal are stable lookup
 * coordinates for anatomical masks. Hair ROOTS must use current position/normal.
 */
const records = new WeakMap();
const SCHEMA = 'kaopu/r02-scan-artistic-age@1';
const CALIBRATION = 'r024-elder-shape-2';
const X_CENTER = -.0034;

// Each entry is an ellipsoidal displacement, not a periodic wrinkle pattern.
// The closed eye surface receives one continuous 3-D field on both sides of the
// lid contact: it never moves the upper and lower lid using disjoint UV masks.
const fields = [];
function add(name, center, sigma, displacement, angle = 0) {
  fields.push({name,center,sigma,displacement,cos:Math.cos(angle),sin:Math.sin(angle)});
}
for (const side of [-1, 1]) {
  const x = a => X_CENTER + side * a;
  const depth = side === -1 ? .004 : -.003;
  // Second visual pass: move the cheek's volume transition downward, retain
  // high zygomatic support, then build its lower soft-tissue apron separately.
  // These independently placed support/hollow pairs are not a global multiplier.
  add('malar-volume', [x(.033), .046, .072+depth], [.015,.014,.025], [-side*.00105,-.0015,-.0038]);
  add('submalar-hollow', [x(.039), .030, .067+depth], [.012,.017,.024], [-side*.00135,-.00075,-.0027]);
  add('temple-volume', [x(.054), .083, .039+depth], [.012,.017,.022], [-side*.0019,-.00020,-.00055]);
  const eyeX = side === -1 ? -.0332 : .0245;
  // Raised lower orbital pad + recessed border: the bag is a broad volume,
  // while the trough is a smaller continuous transition beneath it.
  add('lower-orbit-pad', [eyeX, .0590, .0728], [.0102,.0040,.019], [side*.00016,-.0011,.0030], -side*.12);
  add('tear-trough', [eyeX-side*.005, .0528, .077], [.0100,.00225,.019], [0,-.00035,-.00125], -side*.24);
  add('lateral-orbit-drape', [eyeX+side*.010,.055,.069], [.0068,.0055,.019], [side*.0002,-.0011,.00115], -side*.26);
  // Hood over the existing closed lid, a hollow above, and a softer outer
  // fold replace the first pass's almost uniformly convex upper lid.
  add('upper-lid-fold', [eyeX, side === -1 ? .0718 : .0714, .0780], [.0108,.0043,.020], [0,-.00265,.00255], -side*.10);
  add('upper-lid-sulcus', [eyeX-side*.002,.0778,.0785], [.0104,.0025,.019], [0,-.0002,-.00120], -side*.07);
  add('outer-lid-hood', [eyeX+side*.012,.0690,.0720], [.0065,.0050,.018], [side*.00015,-.0019,.0011], -side*.23);
  add('outer-brow-settle', [eyeX+side*.009,.0795,.0750], [.010,.0068,.020], [0,-.00085,.00025], -side*.16);
  add('mouth-corner', [x(.0238), .0175, .081+depth], [.0063,.0068,.016], [side*.00018,-.0022,-.0003]);
  add('nasolabial-support', [x(.0288), .027, .079+depth], [.0068,.012,.019], [side*.00045,-.00125,.0021], side*.38);
  add('nasolabial-groove', [x(.0225), .027, .082+depth], [.0027,.011,.017], [0,-.00015,-.0011], side*.36);
  add('marionette-groove', [x(.0255), .0035, .078+depth], [.0028,.0100,.018], [0,-.00025,-.00125], side*.16);
  add('lower-cheek-pad', [x(.037), .005, .065+depth], [.012,.013,.025], [side*.0012,-.0021,.00225]);
  // Focus the jowl below the mandibular edge instead of translating the whole
  // lower face. An additional lateral apron reaches the actual side-view edge.
  add('jowl-soft-tissue', [x(.033), -.007, .061+depth], [.0105,.0115,.026], [side*.00225,-.0057,.0022]);
  add('lateral-jaw-apron', [x(.044), .001, .035+depth], [.0105,.014,.024], [side*.00135,-.00335,.00075]);
  add('prejowl-transition', [x(.019), -.006, .083+depth], [.0048,.010,.017], [-side*.00045,-.00010,-.00125]);
}
// Under-chin slack now changes the profile, continuing into an anterior drape.
// Only two individually placed, unequal, oblique neck folds are authored.
// There is no repeating horizontal wave/noise and no circumferential neck ring.
add('submental-soft-tissue', [X_CENTER,-.030,.060], [.025,.016,.023], [0,-.0041,.0038]);
add('anterior-neck', [X_CENTER,-.054,.035], [.021,.024,.020], [0,-.00115,.0022]);
add('central-neck-drape', [X_CENTER-.001,-.053,.039], [.008,.023,.018], [0,-.0011,.00145], -.08);
add('upper-neck-fold', [X_CENTER-.003,-.047,.041], [.025,.0028,.016], [0,-.00012,-.00105], -.07);
add('lower-neck-fold', [X_CENTER+.003,-.069,.029], [.019,.0035,.015], [0,-.00010,-.00065], .12);

// out = displacement xyz followed by row-major displacement Jacobian dD/dP.
// Analytic derivatives make normal transport exact for this authored field.
// The C1 compact tail is zero beyond 4 sigma: ears, cranium, shoulders and back
// are not given a spurious global normal rebuild when a face preset is chosen.
function field(x,y,z,out) {
  out.fill(0);
  if (y < -.145 || y > .16 || Math.abs(x-X_CENTER) > .11 || z < -.055) return out;
  for (const f of fields) {
    const dx=x-f.center[0],dy=y-f.center[1],dz=z-f.center[2];
    const qx=dx*f.cos+dy*f.sin,qy=-dx*f.sin+dy*f.cos;
    const ix=1/(f.sigma[0]*f.sigma[0]),iy=1/(f.sigma[1]*f.sigma[1]),iz=1/(f.sigma[2]*f.sigma[2]);
    const r2=qx*qx*ix+qy*qy*iy+dz*dz*iz;
    if(r2>=16)continue;
    let taper=1,derivative=0;
    if(r2>9){const t=(r2-9)/7;taper=1-t*t*(3-2*t);derivative=-6*t*(1-t)/7;}
    const exp=Math.exp(-.5*r2),weight=exp*taper,dw=exp*(derivative-.5*taper);
    const gx=dw*2*(qx*f.cos*ix-qy*f.sin*iy),gy=dw*2*(qx*f.sin*ix+qy*f.cos*iy),gz=dw*2*dz*iz;
    for(let axis=0;axis<3;axis++){
      const d=f.displacement[axis];out[axis]+=weight*d;
      const j=3+axis*3;out[j]+=d*gx;out[j+1]+=d*gy;out[j+2]+=d*gz;
    }
  }
  return out;
}

function assertGeometry(geometry) {
  const p=geometry?.attributes?.position,n=geometry?.attributes?.normal;
  if(!p||!n||p.itemSize!==3||n.itemSize!==3||p.count!==n.count||p.isInterleavedBufferAttribute||n.isInterleavedBufferAttribute)
    throw new Error('AgeMorph needs non-interleaved R02 position/normal attributes.');
  if(p.count!==143196 || geometry.index?.count!==848832)
    throw new Error('AgeMorph is calibrated only for the original R02 scan after two subdivisions.');
  geometry.computeBoundingBox();const b=geometry.boundingBox;
  if(Math.abs(b.min.x+.17120013)>.00002||Math.abs(b.max.y-.15921721)>.00002||Math.abs(b.max.z-.10362940)>.00002)
    throw new Error('AgeMorph requires the neutral scan in its original .04 metre scale and pose.');
}
function determinant(a,b,c,d,e,f,g,h,i){return a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);}

export function createScanAgeMorph(geometry) {
  if(records.has(geometry))return records.get(geometry);
  assertGeometry(geometry);
  const p=geometry.attributes.position,n=geometry.attributes.normal;
  const neutralPosition=p.clone(),neutralNormal=n.clone();
  // Separate owned snapshots prevent external mask code from corrupting the
  // exact-restore buffers. Neither is ever overwritten by apply().
  const p0=neutralPosition.array.slice(),n0=neutralNormal.array.slice();
  geometry.setAttribute('skinNeutralPosition',neutralPosition);
  geometry.setAttribute('skinNeutralNormal',neutralNormal);
  const d=new Float32Array(p.count*3),jacobian=new Float32Array(p.count*9),tmp=new Float64Array(12);
  let maximum=0,changed=0,minDet=Infinity,maxDet=-Infinity;
  // Equal neutral positions produce exactly equal displacement, even where a
  // GLTF UV seam duplicates the same location with different UVs or normals.
  for(let v=0;v<p.count;v++){
    const k=v*3;field(p0[k],p0[k+1],p0[k+2],tmp);d.set(tmp.subarray(0,3),k);jacobian.set(tmp.subarray(3),v*9);
    const distance=Math.hypot(d[k],d[k+1],d[k+2]);maximum=Math.max(maximum,distance);if(distance>1e-8)changed++;
    const J=tmp.subarray(3),det=determinant(1+J[0],J[1],J[2],J[3],1+J[4],J[5],J[6],J[7],1+J[8]);
    minDet=Math.min(minDet,det);maxDet=Math.max(maxDet,det);
  }
  if(minDet<=.25)throw new Error('AgeMorph calibration produced an unsafe deformation gradient.');
  let strength=0;
  function refresh(){p.needsUpdate=true;n.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();}
  function restore(){p.array.set(p0);n.array.set(n0);strength=0;refresh();return api;}
  function apply(value=1){
    if(!Number.isFinite(value))throw new Error('AgeMorph strength must be finite.');
    const s=Math.max(0,Math.min(1,value));if(s===0)return restore();
    if(geometry.attributes.position!==p||geometry.attributes.normal!==n)throw new Error('AgeMorph position/normal attributes were replaced after neutral capture.');
    for(let v=0;v<p.count;v++){
      const k=v*3,j=v*9;p.array[k]=p0[k]+s*d[k];p.array[k+1]=p0[k+1]+s*d[k+1];p.array[k+2]=p0[k+2]+s*d[k+2];
      // n' = normalize(F^-T n), F=I+s*dD/dP. Cofactors / det; det is
      // positive, so normalization cancels the determinant division. This
      // preserves imported scan normals instead of smoothing every triangle.
      const a=1+s*jacobian[j],b=s*jacobian[j+1],c=s*jacobian[j+2],e=s*jacobian[j+3],f=1+s*jacobian[j+4],g=s*jacobian[j+5],h=s*jacobian[j+6],i=s*jacobian[j+7],l=1+s*jacobian[j+8];
      if(d[k]===0&&d[k+1]===0&&d[k+2]===0&&a===1&&f===1&&l===1&&b===0&&c===0&&e===0&&g===0&&h===0&&i===0){n.array[k]=n0[k];n.array[k+1]=n0[k+1];n.array[k+2]=n0[k+2];continue;}
      const nx=n0[k],ny=n0[k+1],nz=n0[k+2];
      const ox=(f*l-g*i)*nx+(g*h-e*l)*ny+(e*i-f*h)*nz;
      const oy=(c*i-b*l)*nx+(a*l-c*h)*ny+(b*h-a*i)*nz;
      const oz=(b*g-c*f)*nx+(c*e-a*g)*ny+(a*f-b*e)*nz;
      const norm=Math.hypot(ox,oy,oz)||1;n.array[k]=ox/norm;n.array[k+1]=oy/norm;n.array[k+2]=oz/norm;
    }
    strength=s;refresh();return api;
  }
  function diagnostics(){return {schema:SCHEMA,calibration:CALIBRATION,strength,vertexCount:p.count,triangleCount:geometry.index.count/3,topologyChanged:false,uvChanged:false,neutralRestore:'original position and normal byte copy',normalMethod:'analytic inverse-transpose deformation-gradient transport of original scan normals',maximumDisplacementMeters:maximum*strength,unitMaximumDisplacementMeters:maximum,unitAffectedVertices:changed,unitJacobianDeterminantRange:[minDet,maxDet],fields:[...new Set(fields.map(f=>f.name))],basis:'art-directed closed-eye R02 scan; not medically validated'};}
  const api={apply,restore,diagnostics,neutralPosition,neutralNormal,get strength(){return strength;}};
  records.set(geometry,api);return api;
}
export function applyAgeMorph(geometry,strength=1){return createScanAgeMorph(geometry).apply(strength);}
export function restoreAgeMorph(geometry){const age=records.get(geometry);return age?age.restore():createScanAgeMorph(geometry);}
// For independent numerical validation or rebinding a neutral-space sample.
export function sampleAgeDisplacement(x,y,z,strength=1){const a=field(x,y,z,new Float64Array(12)),s=Math.max(0,Math.min(1,strength));return [a[0]*s,a[1]*s,a[2]*s];}
// Snapshot for coordinated UV painting or diagnostics; returned arrays are
// copies, so callers cannot alter the deformation through this descriptor.
export function getAgeMorphRegions(){return fields.map(f=>({name:f.name,center:f.center.slice(),sigma:f.sigma.slice(),displacement:f.displacement.slice(),angle:Math.atan2(f.sin,f.cos)}));}
