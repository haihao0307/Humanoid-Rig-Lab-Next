const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function edit(p,fn){const s=read(p),n=fn(s);if(n===s)throw Error('No polish '+p);fs.writeFileSync(path.join(root,p),n);}
function one(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error('Missing/nonunique '+a.slice(0,90));return s.replace(a,b);}
if(read('app.js').includes("VERSION='emily-transfer/7.1.0'")){console.log('ET071_ALREADY_INSTALLED');process.exit(0);}
if(!read('app.js').includes("VERSION='emily-transfer/7.0.0'"))throw Error('Require ET07 rendered baseline');
edit('natural/NaturalEyes.js',s=>{
 s=one(s,"  // Do not suppress all skin frequencies:",`  // Separate the captured broad crease from fine surface structure. A copied
  // closed-eye normal field is not the new open-lid shape. Keep measured fine
  // skin frequencies instead of scaling the whole normal map to near zero.
  s.fragmentShader=s.fragmentShader.replace('mapN.xy*=normalScale',\`float unbake=1.-smoothstep(.16,.68,vLidT);vec3 oldBroadN=textureLod(normalMap,vTissueUV,2.).xyz*2.-1.;mapN.xy-=oldBroadN.xy*unbake*.92;mapN=normalize(mapN);mapN.xy*=normalScale\`);
  s.fragmentShader=s.fragmentShader.replace('vec2 slopes=mapN.xy',\`vec3 oldBroadM=textureLod(uMesoMap,vTissueUV,2.).xyz*2.-1.;mesoN.xy-=oldBroadM.xy*unbake*.78;mesoN=normalize(mesoN);vec2 slopes=mapN.xy\`);
  // Do not suppress all skin frequencies:`);
 s=one(s,'const donor=sample(x,y),blend=1-smooth((q.t-.45)/.27);','const donor=sample(x,y),blend=upper?1-smooth((q.t-.10)/.36):1-smooth((q.t-.45)/.27);');
 s=one(s,'colors.push(.48+.15*warm,.23+.13*warm,.20+.10*warm);','colors.push(.25+.045*warm,.092+.026*warm,.078+.022*warm);');
 s=one(s,'clearcoat:.36,clearcoatRoughness:.22,envMapIntensity:.34','clearcoat:.28,clearcoatRoughness:.24,envMapIntensity:.20');
 const a=s.indexOf(' for(let i=0;i<=U;i++){',s.indexOf('function updateCanthus')),b=s.indexOf(' P.needsUpdate=true;',a);if(a<0||b<0)throw Error('Canthus update not found');
 s=s.slice(0,a)+` for(let i=0;i<=U;i++)for(let j=0;j<=V;j++){
  const t=i/U,v=j/V,roundEnd=.52+.48*Math.sin(Math.PI*v),u=-1+.155*t*roundEnd;
  const angle=Math.acos(u*c.sign),top=rig.margin(c,angle,blink),bottom=rig.margin(c,TAU-angle,blink);
  const x=lerp(top.x,bottom.x,v),y=lerp(top.y,bottom.y,v),front=rig.eyeFront(c,x,y);
  const mound=.00010*Math.sin(Math.PI*t)*Math.pow(Math.sin(Math.PI*v),1.4)*(1-blink);
  const plica=.00004*Math.exp(-Math.pow((t-.90)/.095,2))*Math.sin(Math.PI*v)*(1-blink);
  P.setXYZ(i*(V+1)+j,x,y,(front===null?lerp(top.z,bottom.z,v)-.00012:front+.00010)+mound+plica);
 }
`+s.slice(b);
 s=one(s,'this.ready=this.ready.then(()=>{for(const e of this.eyes)makeCanthus(this,e);this.update(0,true);this.requestRender();return this;});',`this.ready=this.ready.then(()=>{for(const e of this.eyes)makeCanthus(this,e);this.update(0,true);
   window.__NATURAL_REVIEW__={setVisibility:flags=>{for(const e of this.eyes){const parts={margin:e.lid.edge,rim:e.rim.mesh,inside:e.lid.inside,canthus:e.canthus.mesh,lashes:e.lashes.mesh};for(const [k,v]of Object.entries(flags))if(parts[k]&&typeof v==='boolean')parts[k].visible=v;}this.requestRender();}};
   this.requestRender();return this;});`);
 s=one(s,'   return {name:e.c.name,boundaryUVMaxError:',`   let canthusMin=Infinity,canthusPenetrations=0,canthusSamples=0,canthusInvalid=0;
   this._fittingEye=e;
   if(e.canthus){const g=e.canthus.mesh.geometry,p=g.attributes.position,ix=g.index.array;
    const test=(x,y,z)=>{if(![x,y,z].every(Number.isFinite)){canthusInvalid++;return;}const front=this.eyeFront(e.c,x,y);if(front===null)return;const gap=z-front;canthusMin=Math.min(canthusMin,gap);canthusSamples++;if(gap<-.0000001)canthusPenetrations++;};
    for(let i=0;i<p.count;i++)test(p.getX(i),p.getY(i),p.getZ(i));
    if(detailed)for(let i=0;i<ix.length;i+=3)for(const w of [[1/3,1/3,1/3],[.5,.5,0],[0,.5,.5],[.5,0,.5]]){const a=ix[i],b=ix[i+1],c=ix[i+2];test(w[0]*p.getX(a)+w[1]*p.getX(b)+w[2]*p.getX(c),w[0]*p.getY(a)+w[1]*p.getY(b)+w[2]*p.getY(c),w[0]*p.getZ(a)+w[1]*p.getZ(b)+w[2]*p.getZ(c));}
   }
   this._fittingEye=null;
   return {canthalContact:{minAxialGapMM:Number.isFinite(canthusMin)?canthusMin*1000:null,penetrations:canthusPenetrations,samples:canthusSamples,invalid:canthusInvalid},name:e.c.name,boundaryUVMaxError:`);
 return s.replaceAll("'ET07'","'ET07.1'").replaceAll('ET07-tissue','ET071-tissue');
});
for(const p of ['app.js','eyes/EyeSystem.js','talkinghead/IntegratedEyes.js','anatomy/bundle.cjs','natural/qa.cjs'])edit(p,s=>s.replaceAll('emily-transfer/7.0.0','emily-transfer/7.1.0').replaceAll('eyes/7.0.0','eyes/7.1.0').replaceAll("'ET07'","'ET07.1'").replaceAll('ET07 ·','ET07.1 ·').replaceAll('· ET07','· ET07.1'));
edit('index.html',s=>s.replaceAll('ET07','ET07.1'));
edit('natural/qa.cjs',s=>one(s,'assert(t.sameAlbedoTexture&&t.canthalPatch);','assert(t.sameAlbedoTexture&&t.canthalPatch);assert.equal(t.canthalContact.invalid,0);assert.equal(t.canthalContact.penetrations,0);assert(t.canthalContact.samples>1000);'));
edit('natural/visual.cjs',s=>{
 s=s.replace("version:'ET07'","version:'ET07.1'");
 s=one(s,"await shot('06-eye-macro');",`await shot('06-eye-macro');
 await page.evaluate(()=>__NATURAL_REVIEW__.setVisibility({rim:false}));await shot('11-no-tear-rim');
 await page.evaluate(()=>__NATURAL_REVIEW__.setVisibility({margin:false}));await shot('12-no-free-margin');
 await page.evaluate(()=>__NATURAL_REVIEW__.setVisibility({inside:false}));await shot('13-no-inner-surface');
 await page.evaluate(()=>__NATURAL_REVIEW__.setVisibility({rim:true,margin:true,inside:true}));
 const saved=await page.evaluate(()=>({...__SKIN_LAB__.values}));await page.evaluate(()=>__SKIN_LAB__.set({detail:0,meso:0,micro:0,pores:0}));await shot('14-detail-disabled');await page.evaluate(v=>__SKIN_LAB__.set(v),saved);
`);return s;
});
console.log('ET071_FREQUENCY_AND_CANTHUS_REVIEW_INSTALLED');
