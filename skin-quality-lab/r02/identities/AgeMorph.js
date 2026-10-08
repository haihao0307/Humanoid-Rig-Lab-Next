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
  // A slight authored depth adjustment follows the original scan's asymmetry.
  const depth = side === -1 ? .004 : -.003;
  add('malar-volume', [x(.033), .046, .072+depth], [.016,.019,.026], [-side*.00065,-.0010,-.0027]);
  add('submalar-hollow', [x(.041), .032, .063+depth], [.013,.019,.023], [-side*.0010,-.0003,-.00185]);
  add('temple-volume', [x(.054), .083, .039+depth], [.012,.017,.022], [-side*.0017,-.00020,-.00045]);
  const eyeX = side === -1 ? -.0332 : .0245; // measured outer scan lid surfaces
  add('lower-orbit-pad', [eyeX, .0585, .0723], [.0105,.0041,.020], [side*.00012,-.00045,.00135], -side*.12);
  add('tear-trough', [eyeX-side*.007, .0535, .077], [.0090,.0025,.019], [0,-.00015,-.00075], -side*.27);
  add('upper-lid-fold', [eyeX, side === -1 ? .0730 : .0726, .0778], [.0105,.0047,.021], [0,-.0011,.00095], -side*.10);
  // Mouth corners descend locally; the philtrum and central lip contact are not
  // independently pulled apart. Broad nasolabial support gives volume contrast.
  add('mouth-corner', [x(.023), .0175, .081+depth], [.0060,.0064,.016], [side*.00018,-.00145,-.00025]);
  add('nasolabial-support', [x(.028), .029, .079+depth], [.0058,.012,.018], [side*.00028,-.00065,.00105], side*.38);
  add('nasolabial-groove', [x(.0225), .028, .082+depth], [.0020,.010,.016], [0,-.00010,-.00050], side*.36);
  add('marionette-groove', [x(.025), .006, .078+depth], [.0025,.0080,.017], [0,-.00015,-.00055], side*.16);
  add('lower-cheek-pad', [x(.036), .008, .066+depth], [.013,.013,.026], [side*.00075,-.0010,.00125]);
  add('jowl-soft-tissue', [x(.032), -.005, .064+depth], [.011,.012,.027], [side*.0011,-.0026,.00165]);
  add('prejowl-transition', [x(.018), -.007, .083+depth], [.0055,.008,.015], [-side*.0001,-.00010,-.0005]);
}
// A single broad under-chin envelope replaces repeated neck bands. The jaw's
// bony identity is retained while soft tissue continues smoothly into the neck.
add('submental-soft-tissue', [X_CENTER,-.027,.062], [.020,.013,.021], [0,-.0015,.0016]);
add('anterior-neck', [X_CENTER,-.049,.036], [.020,.023,.018], [0,-.00065,.00135]);

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
  function diagnostics(){return {schema:SCHEMA,strength,vertexCount:p.count,triangleCount:geometry.index.count/3,topologyChanged:false,uvChanged:false,neutralRestore:'original position and normal byte copy',normalMethod:'analytic inverse-transpose deformation-gradient transport of original scan normals',maximumDisplacementMeters:maximum*strength,unitMaximumDisplacementMeters:maximum,unitAffectedVertices:changed,unitJacobianDeterminantRange:[minDet,maxDet],fields:[...new Set(fields.map(f=>f.name))],basis:'art-directed closed-eye R02 scan; not medically validated'};}
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
