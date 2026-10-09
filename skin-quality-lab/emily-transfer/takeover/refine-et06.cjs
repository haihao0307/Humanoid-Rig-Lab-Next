const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
if(fs.readFileSync(root+'/app.js','utf8').includes("VERSION='emily-transfer/6.1.0'")){console.log('ET06.1_ALREADY_INSTALLED');process.exit(0);}
function edit(p,f){p=path.join(root,p);const s=fs.readFileSync(p,'utf8'),n=f(s);if(s===n)throw Error('No refinement '+p);fs.writeFileSync(p,n);}
function one(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error('Missing/ambiguous '+a.slice(0,70));return s.replace(a,b);}
edit('research/ResearchEyes.js',s=>{
 s=one(s,'const A=192,R=32','const A=256,R=32');s=one(s,'const ni=14,','const ni=64,');
 s=one(s,'w=Math.sqrt(Math.max(0,1-nx*nx))','w=Math.max(0,1-nx*nx)');
 s=one(s,'  let z=Math.sqrt(r*r-dx*dx-dy*dy);\n  const f=',`  let z=Math.sqrt(r*r-dx*dx-dy*dy);
  // Only the corneal cap differs from the sphere. Its conservative bounding
  // ball is centred 0.98r forward with radius 0.53r. Rays outside its projected
  // disc hit the spherical sclera exactly, without a Newton solve.
  const capX=inv?inv[2]*r*.98:0,capY=inv?inv[6]*r*.98:0;
  if((dx-capX)*(dx-capX)+(dy-capY)*(dy-capY)>r*r*.2809)return c.z+z;
  const f=`);
 let a=s.indexOf('  if(blink>0&&c.referenceSurface){',s.indexOf(' margin(c,a,blink)')),b=s.indexOf('  return new THREE.Vector3(x,y,z);',a);if(a<0||b<0)throw Error('No closure correction');
 s=s.slice(0,a)+'  // The scan anchors surrounding skin; a closing free margin stays on the globe.\n'+s.slice(b);
 a=s.indexOf('  for(let j=0;j<=lid.ni;j++)for(let i=0;i<=lid.A;i++){',s.indexOf('const insetAt='));b=s.indexOf('  IP.needsUpdate=true;',a);if(a<0||b<0)throw Error('No inner chart');
 s=s.slice(0,a)+`  // Hidden conjunctiva is a continuous spherical chart. No off-globe depth
  // fallbacks are joined by triangles that pass through the optical surface.
  for(let i=0;i<=lid.A;i++){
   const theta=i/lid.A*TAU,nx=Math.cos(theta),ny=Math.sin(theta),inset=insetAt(i);
   const ox=P.getX(i)-nx*inset,oy=P.getY(i)-ny*inset,r=c.radius;
   const ax=(ox-c.x)/r,ay=(oy-c.y)/r,az=Math.sqrt(Math.max(0,1-ax*ax-ay*ay));
   const bx=nx*Math.sin(1.44),by=ny*Math.sin(1.44),bz=Math.cos(1.44);
   const angle=Math.acos(clamp(ax*bx+ay*by+az*bz,-.999999,1)),sin=Math.sin(angle);
   for(let j=0;j<=lid.ni;j++){
    const t=j/lid.ni,wa=sin>.000001?Math.sin((1-t)*angle)/sin:1-t,wb=sin>.000001?Math.sin(t*angle)/sin:t;
    const x=j===0?ox:c.x+r*(wa*ax+wb*bx),y=j===0?oy:c.y+r*(wa*ay+wb*by),z=this.eyeFront(c,x,y);
    if(z===null)throw Error('Inner globe chart escaped support');
    IP.setXYZ(j*(lid.A+1)+i,x,y,z+.000085);
   }
  }
`+s.slice(b);
 s=one(s,'contact+.000045','contact+.000085');
 s=s.replace('posteriorTearGapMM:.045','posteriorTearGapMM:.085');
 s=s.replace('The posterior conjunctival surface remains 0.045 mm off the globe.','The posterior surface uses 0.085 mm axial numerical clearance, not a tear-film measurement.');
 s=one(s,'bulge=(ny>=0?.000055:.000035)','bulge=(ny>=0?.00016:.000035)');
 // A closed-scan normal map contains a baked crease. Do not stretch that crease
 // across the new free margin: retain it on the surrounding skin, not its lip.
 s=one(s,'mix(.48,1.,smoothstep(.06,.68,vLidT))','mix(.08,1.,smoothstep(.16,.55,vLidT))');
 s=s.replace('ET03-continuous-lid-shell-1','ET06.1-continuous-lid-shell');
 // Broad head/eyebrow shadows remain; sub-millimetre contact shading is local.
 s=one(s,'m.castShadow=true;m.receiveShadow=true;','m.castShadow=false;m.receiveShadow=true;');
 s=one(s,'edge.castShadow=true;edge.receiveShadow=true;','edge.castShadow=false;edge.receiveShadow=true;');
 s=one(s,' audit(){',' audit(detailed=false){');
 s=one(s,'   const edgeLength=a=>{',`   let triangleMin=Infinity,trianglePenetrations=0,triangleSamples=0;
   if(detailed)for(const geo of [lid.inside.geometry,lid.edge.geometry]){
    const p=geo.attributes.position,ix=geo.index.array;
    for(let k=0;k<ix.length;k+=3)for(const w of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){
     const a=ix[k],b=ix[k+1],d=ix[k+2],x=w[0]*p.getX(a)+w[1]*p.getX(b)+w[2]*p.getX(d),y=w[0]*p.getY(a)+w[1]*p.getY(b)+w[2]*p.getY(d),z=w[0]*p.getZ(a)+w[1]*p.getZ(b)+w[2]*p.getZ(d),front=this.eyeFront(c,x,y);
     if(front===null)continue;const gap=z-front;triangleSamples++;triangleMin=Math.min(triangleMin,gap);if(gap<-.0000001)trianglePenetrations++;
    }
   }
   const surfaceTests={triangleSamples,trianglePenetrations,triangleMinAxialGapMM:detailed?triangleMin*1000:null};
   const edgeLength=a=>{`);
 s=one(s,'rows.push({name:c.name,','rows.push({surfaceTests,name:c.name,');
 s=one(s,"version:'ET06',units:","version:'ET06.1',units:");
 s=one(s,"scope:'actual inner-surface and free-margin vertices against rotated two-sphere; not exhaustive triangle CCD'","scope:'actual vertices, optional triangle centroids and all edge midpoints; rotated two-sphere; sampled static poses, not exhaustive continuous CCD'");
 return s;
});
for(const f of ['app.js','eyes/EyeSystem.js','talkinghead/IntegratedEyes.js','anatomy/bundle.cjs'])edit(f,s=>s.replaceAll('emily-transfer/6.0.0','emily-transfer/6.1.0').replaceAll('eyes/6.0.0','eyes/6.1.0').replaceAll("'ET06'","'ET06.1'").replaceAll('ET06 ·','ET06.1 ·').replaceAll('· ET06','· ET06.1').replace('audit:()=>eyesRig.audit()','audit:(detailed=false)=>eyesRig.audit(detailed)').replace('posteriorTearGapMM:.045','posteriorTearGapMM:.085'));
edit('index.html',s=>s.replaceAll('ET06','ET06.1'));
edit('takeover/qa.cjs',s=>{
 s=s.replaceAll("'ET06'","'ET06.1'").replaceAll('emily-transfer/6.0.0','emily-transfer/6.1.0').replaceAll('__EYES__.audit()','__EYES__.audit(true)');
 s=one(s,"assert.equal(e.nonfiniteVertices,0,label+' nonfinite');","assert.equal(e.nonfiniteVertices,0,label+' nonfinite');assert(e.surfaceTests.triangleSamples>10000);assert.equal(e.surfaceTests.trianglePenetrations,0,label+' triangle interior contact');assert(e.surfaceTests.triangleMinAxialGapMM>=-.0001,label+' triangle clearance');");
 s=one(s,'Math.abs(e.verticalApertureMM)<.0001','Math.abs(e.verticalApertureMM)<.0001&&e.upperFreeMarginArcMM<.7&&e.lowerFreeMarginArcMM<.7');
 s=one(s,"[-.004,-.04,.65]])","[-.004,-.04,.65],[-.16,.17,.65],[.16,.17,.65],[-.16,-.04,.65],[.16,-.04,.65]])");
 s=s.replace('25_CONTACT_STATES_PASS','45_CONTACT_STATES_PASS');return s;
});
console.log('ET06.1_SPHERICAL_CONTACT_TRIANGLE_AUDIT_INSTALLED');
