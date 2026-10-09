const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function edit(p,f){const s=read(p),n=f(s);if(s===n)throw Error('No patch '+p);fs.writeFileSync(path.join(root,p),n);}
function one(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error('Missing/nonunique anchor '+a.slice(0,90));return s.replace(a,b);}
if(read('app.js').includes("VERSION='emily-transfer/7.3.0'")){console.log('ET073_ALREADY_INSTALLED');process.exit(0);}
if(!read('app.js').includes("VERSION='emily-transfer/7.2.0'"))throw Error('Require ET07.2 tested source');
edit('natural/NaturalEyes.js',s=>{
 s=one(s,'attribute vec2 tissueUV;attribute float tissueBand;varying vec2 vTissueUV;varying float vTissueBand;','attribute vec2 tissueUV,tissueDetailUV;attribute float tissueBand,tissueUpper;varying vec2 vTissueUV,vTissueDetailUV;varying float vTissueBand,vTissueUpper;');
 s=one(s,'vTissueUV=tissueUV;vTissueBand=tissueBand;','vTissueUV=tissueUV;vTissueBand=tissueBand;vTissueDetailUV=tissueDetailUV;vTissueUpper=tissueUpper;');
 s=one(s,"s.fragmentShader='varying vec2 vTissueUV;varying float vTissueBand;", "s.fragmentShader='varying vec2 vTissueUV,vTissueDetailUV;varying float vTissueBand,vTissueUpper;");
 s=one(s,'  if(isMargin){',`  // The upper mobile lid needs its own material-density coordinates. Reusing
  // the closed-scan UV compresses and elongates otherwise valid pores.
  if(!isMargin){
   s.fragmentShader=s.fragmentShader.replace('vec2 slopes=mapN.xy',\`float mobileLid=vTissueUpper*(1.-smoothstep(.36,.72,vLidT));
    vec3 cleanM=texture2D(uMesoMap,vTissueDetailUV).rgb*2.-1.;vec3 broadM=textureLod(uMesoMap,vTissueDetailUV,1.5).rgb*2.-1.;
    vec3 cleanMicro=texture2D(uMicroMap,vTissueDetailUV).rgb*2.-1.;
    mapN=normalize(mix(mapN,vec3(0.,0.,1.),mobileLid));
    mesoN=normalize(mix(mesoN,normalize(vec3((cleanM.xy-broadM.xy)*.65,1.)),mobileLid));
    microN=normalize(mix(microN,normalize(vec3(cleanMicro.xy*.72,1.)),mobileLid));
    vec2 slopes=mapN.xy\`);
   s.fragmentShader=s.fragmentShader.replace('float skinSpecMask=', 'roughnessFactor+=.035*vTissueUpper*(1.-smoothstep(.36,.72,vLidT));\\nfloat skinSpecMask=');
  }
  if(isMargin){`);
 s=one(s,'uv=g.attributes.uv,tu=[],tb=[],ao=', 'uv=g.attributes.uv,tu=[],tb=[],du=[],up=[],ao=');
 s=one(s,'tu.push(u,v);tb.push(1);uv.setXY(i,u,v);','tu.push(u,v);tb.push(1);du.push(donor.u,donor.v-215/4096);up.push(upper?1:0);uv.setXY(i,u,v);');
 s=one(s,"g.setAttribute('tissueBand',new THREE.Float32BufferAttribute(tb,1));", "g.setAttribute('tissueBand',new THREE.Float32BufferAttribute(tb,1));g.setAttribute('tissueDetailUV',new THREE.Float32BufferAttribute(du,2));g.setAttribute('tissueUpper',new THREE.Float32BufferAttribute(up,1));");
 s=one(s,'const eg=edge.geometry,euv=[],et=[],eb=[],eao=[];','const eg=edge.geometry,euv=[],et=[],eb=[],eao=[],edu=[],eup=[];');
 s=one(s,'et.push(0);eb.push(band);eao.push(ao.getX(a));','et.push(0);eb.push(band);eao.push(ao.getX(a));edu.push(du[2*a],du[2*a+1]);eup.push(up[a]);');
 s=one(s,"eg.setAttribute('skinOcclusion',new THREE.Float32BufferAttribute(eao,1));","eg.setAttribute('skinOcclusion',new THREE.Float32BufferAttribute(eao,1));eg.setAttribute('tissueDetailUV',new THREE.Float32BufferAttribute(edu,2));eg.setAttribute('tissueUpper',new THREE.Float32BufferAttribute(eup,1));");
 s=s.replace('additionalImages:0','externalSourceImages:0,derivedRepairTextures:3,upperLidMaterialDensityCoordinates:true');
 return s.replaceAll('ET07.2','ET07.3').replaceAll('ET071-tissue','ET073-tissue');
});
for(const p of ['app.js','eyes/EyeSystem.js','talkinghead/IntegratedEyes.js','anatomy/bundle.cjs','natural/qa.cjs','natural/visual.cjs'])edit(p,s=>s.replaceAll('emily-transfer/7.2.0','emily-transfer/7.3.0').replaceAll('eyes/7.2.0','eyes/7.3.0').replaceAll('ET07.2','ET07.3'));
edit('index.html',s=>s.replaceAll('ET07.2','ET07.3'));
edit('anatomy/bundle.cjs',s=>one(s,'neutralMaterialCoordinates:true','neutralMaterialCoordinates:true,upperLidSeparateDetailCoordinates:true,sourceCaptureMarkRepair:true'));
console.log('ET073_UPPER_LID_DETAIL_DENSITY_INSTALLED');
