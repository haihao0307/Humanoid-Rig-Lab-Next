const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function edit(p,fn){p=path.join(root,p);const s=fs.readFileSync(p,'utf8'),n=fn(s);if(s===n)throw Error('Unchanged '+p);fs.writeFileSync(p,n);}
function one(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error('Nonunique/missing anchor: '+a.slice(0,90));return s.replace(a,b);}
if(fs.readFileSync(root+'/app.js','utf8').includes("VERSION='emily-transfer/4.0.0'")){require('../anatomy/apply-et05.cjs');require('../anatomy/finalize-et05.cjs');}
edit('eyes/EyeSystem.js',s=>s.replace("eyes/5.0.0","eyes/6.0.0").replace('half:.0112,radius:.0122','half:.0119,radius:.0122').replace('half:.0110,radius:.0122','half:.0117,radius:.0122').replace('irisRadius=.456','irisRadius=.435').replace('irisDepth:.83,opening:.92','irisDepth:.83,opening:.88'));
edit('eyes/FittedEyes.js',s=>one(s,'eyeRadiusMM:12.2,defaultApertureMM:[22.2,6.7]',"eyeRadiusMM:12.2,irisRadiusRatio:.435,scaleStatus:'head-specific visual calibration, not medical measurement'"));
edit('research/ResearchEyes.js',s=>{
 const start=s.indexOf('function rail(u,upper){'),end=s.indexOf('function ocularHeight',start);
 if(start<0||end<0)throw Error('Missing rails');
 s=s.slice(0,start)+`function rail(u,upper){
 u=clamp(u,-1,1);const x=Math.abs(u),side=u<0?-1:1;
 const c=upper?[.38441346288415335,-.013457920226416842,.4445801720372662,.056531015805420755]:[-.26980682201867545,-.07559112460541781,-.25913444501352073,-.003966655456640926];
 const residual=v=>(1-v*v)*(c[0]+v*(c[1]+v*(c[2]+v*c[3])));
 const k=upper?1:2,baseline=lerp(REFERENCE_RAILS[0][k],REFERENCE_RAILS[32][k],(u+1)*.5);
 const join=side<0?.72:.78;
 if(x<=join)return baseline+residual(u);
 const l=1-join,t=(x-join)/l,h=.00001,r0=residual(side*join);
 const d0=(residual(side*(join+h))-residual(side*(join-h)))/(2*h);
 const d1=upper?(side<0?-.50:-.62):(side<0?.27:.30);
 // Cubic Hermite meets the measured centre with a continuous tangent and the
 // canthus with a finite angle: no rectangular corner, no zero-angle cusp.
 return baseline+(2*t*t*t-3*t*t+1)*r0+(t*t*t-2*t*t+t)*l*d0+(t*t*t-t*t)*l*d1;
}
`+s.slice(end);
 s=one(s,"ET05 anatomical palpebral envelope","ET06 connected palpebral envelope");
 s=one(s,'const open=this.config.opening??.92;','const open=this.config.opening??.88;');
 s=one(s,'upper?.00040:.00027','upper?.00078:.00030');
 s=one(s,'lerp(openClearance,.00029,blink)','lerp(openClearance,.00032,blink)');
 const edgeStart=s.indexOf('  const em=new THREE.MeshPhysicalMaterial({color:0x9a625a'),edgeEnd=s.indexOf('\n  const edge=new THREE.Mesh',edgeStart);
 if(edgeStart<0||edgeEnd<0)throw Error('Missing ET05 edge material');
 s=s.slice(0,edgeStart)+`  const eu=[],ec=[];
  for(let a=0;a<=A;a++)for(let q=0;q<=es;q++){
   const src=entries[a].seamSrc,t=q/es;
   eu.push(src.u,src.v);ec.push(lerp(.84,1,t),lerp(.66,1,t),lerp(.61,1,t));
  }
  eg.setAttribute('uv',new THREE.Float32BufferAttribute(eu,2));eg.setAttribute('color',new THREE.Float32BufferAttribute(ec,3));
  const em=new THREE.MeshPhysicalMaterial({color:0xffffff,map:this.skin.map,vertexColors:true,roughness:.46,metalness:0,clearcoat:.24,clearcoatRoughness:.22,ior:1.36,envMapIntensity:.32,side:THREE.DoubleSide});`+s.slice(edgeEnd);
 s=one(s,'const thickness=.00010+.00056*smooth(t/.055)*(1-smooth((t-.35)/.45));','const thickness=.00010+(q.ny>=0?.00074:.00056)*smooth(t/.055)*(1-smooth((t-.35)/.45));');
 const innerStart=s.indexOf('  const IP=lid.inside.geometry.attributes.position;'),innerEnd=s.indexOf('  const lp=e.lashes.mesh.geometry.attributes.position;',innerStart);
 if(innerStart<0||innerEnd<0)throw Error('Missing inner/free margin update');
 s=s.slice(0,innerStart)+`  const IP=lid.inside.geometry.attributes.position,EP=lid.edge.geometry.attributes.position;
  const insetAt=(a)=>{const theta=a/lid.A*TAU,nx=Math.cos(theta),ny=Math.sin(theta),corner=smooth((1-Math.abs(nx))/.20);return (ny>=0?.00029:.00012)*corner*(1-blink);};
  for(let j=0;j<=lid.ni;j++)for(let i=0;i<=lid.A;i++){
   const row=j/lid.ni*.42*lid.R,lo=Math.floor(row),hi=Math.min(lid.R,lo+1),f=row-lo,theta=i/lid.A*TAU;
   const ia=lo*(lid.A+1)+i,ib=hi*(lid.A+1)+i,inset=insetAt(i)*(1-smooth(j/lid.ni));
   const x=lerp(P.getX(ia),P.getX(ib),f)-Math.cos(theta)*inset,y=lerp(P.getY(ia),P.getY(ib),f)-Math.sin(theta)*inset;
   const z=this.eyeFront(c,x,y),oz=lerp(P.getZ(ia),P.getZ(ib),f);
   IP.setXYZ(j*(lid.A+1)+i,x,y,z===null?oz-.0003:z+.000045);
  }
  IP.needsUpdate=true;lid.inside.geometry.computeVertexNormals();
  for(let a=0;a<=lid.A;a++){
   const theta=a/lid.A*TAU,nx=Math.cos(theta),ny=Math.sin(theta),corner=smooth((1-Math.abs(nx))/.20);
   for(let q=0;q<=lid.es;q++){
    const t=q/lid.es,b=Math.sin(Math.PI*t),k=a*(lid.es+1)+q,bulge=(ny>=0?.000055:.000035)*corner*(1-blink);
    const x=lerp(IP.getX(a),P.getX(a),t)+nx*b*bulge,y=lerp(IP.getY(a),P.getY(a),t)+ny*b*bulge;
    let z=lerp(IP.getZ(a),P.getZ(a),t)+b*.000025;
    const contact=this.eyeFront(c,x,y);if(contact!==null&&q>0&&q<lid.es)z=Math.max(z,contact+.000045);
    EP.setXYZ(k,x,y,z);
   }
  }
  EP.needsUpdate=true;lid.edge.geometry.computeVertexNormals();
  // The tear meniscus follows the posterior edge. It is not the lid geometry.
  const rp=e.rim.mesh.geometry.attributes.position;
  for(let a=0;a<=e.rim.A;a++){
   const theta=a/e.rim.A*TAU,i=Math.round(a/e.rim.A*lid.A),nx=Math.cos(theta),ny=Math.sin(theta);
   const r=.000014+.000026*Math.max(0,-ny);
   for(let q=0;q<=e.rim.S;q++){const b=q/e.rim.S*TAU;rp.setXYZ(a*(e.rim.S+1)+q,IP.getX(i)+nx*Math.cos(b)*r,IP.getY(i)+ny*Math.cos(b)*r,IP.getZ(i)+Math.sin(b)*r+.000005);}
  }
  rp.needsUpdate=true;e.rim.mesh.geometry.computeVertexNormals();
`+s.slice(innerEnd);
 s=one(s,"reconstruction:'ET05 thick palpebral margins / tapered canthi / contact shell'","reconstruction:'ET06 joined skin-margin-conjunctiva / finite canthal tangents'");
 const audit=` audit(){
  const rows=[];
  for(const e of this.eyes){
   this._fittingEye=e;const {c,lid}=e,P=lid.mesh.geometry.attributes.position,I=lid.inside.geometry.attributes.position,E=lid.edge.geometry.attributes.position;
   let seamMax=0,nonfinite=0,minGap=Infinity,penetrations=0,tested=0;
   for(let a=0;a<=lid.A;a++)for(const [p,i,j] of [[P,a,a*(lid.es+1)+lid.es],[I,a,a*(lid.es+1)]])seamMax=Math.max(seamMax,Math.hypot(p.getX(i)-E.getX(j),p.getY(i)-E.getY(j),p.getZ(i)-E.getZ(j)));
   for(const p of [P,I,E])for(let i=0;i<p.count;i++)if(![p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))nonfinite++;
   for(const p of [I,E])for(let i=0;i<p.count;i++){const z=this.eyeFront(c,p.getX(i),p.getY(i));if(z===null)continue;const gap=p.getZ(i)-z;minGap=Math.min(minGap,gap);tested++;if(gap<-.0000001)penetrations++;}
   const edgeLength=a=>{let d=0;for(let q=1;q<=lid.es;q++){const i=a*(lid.es+1)+q;d+=Math.hypot(E.getX(i)-E.getX(i-1),E.getY(i)-E.getY(i-1),E.getZ(i)-E.getZ(i-1));}return d*1000;};
   rows.push({name:c.name,nonfiniteVertices:nonfinite,maxSharedEdgeErrorMM:seamMax*1000,posteriorAndMarginMinAxialGapMM:minGap*1000,posteriorAndMarginPenetrations:penetrations,contactTestVertices:tested,upperFreeMarginArcMM:edgeLength(lid.A/4),lowerFreeMarginArcMM:edgeLength(3*lid.A/4),radiusMM:c.radius*1000,irisRadiusRatio:.435,restingOpening:this.config.opening,eyeHidden:!e.ball.visible,outerBoundaryDeviationMM:e.contactReport.outerBoundaryDeviationMM,verticalApertureMM:e.contactReport.verticalApertureMM,horizontalApertureMM:e.contactReport.horizontalApertureMM});
  }
  this._fittingEye=null;return {version:'ET06',units:'millimetres',scope:'actual inner-surface and free-margin vertices against rotated two-sphere; not exhaustive triangle CCD',eyes:rows};
 }
`;
 s=one(s,' dispose(){for(const e of this.eyes)',audit+' dispose(){for(const e of this.eyes)');return s;
});
edit('talkinghead/IntegratedEyes.js',s=>s.replace('eyes/5.0.0','eyes/6.0.0'));
edit('app.js',s=>{
 s=s.replaceAll('emily-transfer/5.0.0','emily-transfer/6.0.0').replaceAll("version:'ET05'","version:'ET06'").replaceAll('ET05','ET06').replaceAll('opening:.92','opening:.88');
 s=one(s,'window.__EYES__={version:EYE_VERSION,','window.__EYES__={version:EYE_VERSION,audit:()=>eyesRig.audit(),');
 s=one(s,"const views={eyes:","const views={lidSide:{p:[.093,.059,.175],t:[.0217,.069,.075]},lidBelow:{p:[.028,.035,.165],t:[.0217,.069,.075]},eyes:");
 s=one(s,"resize();setCamera('portrait');apply();updateLayer();state.ready=true;","resize();setCamera('eyes');apply();updateLayer();state.ready=true;");
 return s;
});
edit('index.html',s=>s.replaceAll('ET05','ET06').replace('value="0.92"','value="0.88"').replace('缩小静息眼裂与眼球暴露','校准静息眼裂、虹膜比例与眼球暴露').replace('<button data-camera="iris">','<button data-camera="lidSide">睑缘侧看</button><button data-camera="lidBelow">上睑底面</button><button data-camera="iris">'));
edit('anatomy/bundle.cjs',s=>s.replaceAll('emily-transfer/5.0.0','emily-transfer/6.0.0').replaceAll('eyes/5.0.0','eyes/6.0.0').replaceAll('ET05','ET06').replace('nominalHorizontalApertureMM:22.2,nominalVerticalApertureMM:6.7,defaultOpening:.92','nominalHorizontalApertureMM:23.6,defaultOpening:.88,irisRadiusRatio:.435').replace('upperMarginDesignedThickerThanLower:true','upperMarginDesignedThickerThanLower:true,connectedTexturedFreeMargin:true,finiteCanthalTangents:true,actualVertexAudit:true'));
console.log('ET06_CONNECTED_MARGIN_PATCH_APPLIED');
