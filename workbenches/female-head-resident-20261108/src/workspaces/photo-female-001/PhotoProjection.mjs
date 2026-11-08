// View-dependent diagnostic only: actual photo on the visible face; the
// inferred hair-covered region uses a separately labelled generated edit.
// The independent procedural-skin mode does not sample either image.
export async function createFemaleProjection(gl){
 const [response,sideResponse]=await Promise.all([fetch('./projection-parameters.json'),fetch('./side-projection-parameters.json')]);if(!response.ok||!sideResponse.ok)throw Error('照片观察映射不可用');const [record,sideRecord]=await Promise.all([response.json(),sideResponse.json()]);
 if(record.schema!=='human.photo-female-001.observation-projection/1'||record.accepted!==false)throw Error('照片观察映射版本不匹配');
 if(sideRecord.schema!=='human.photo-female-001.generated-side-projection/1'||sideRecord.accepted!==false)throw Error('侧面观察映射版本不匹配');
 async function imageTexture(path){const img=new Image();img.src=path;await img.decode();const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.generateMipmap(gl.TEXTURE_2D);return t;}
 const [original,edited,sidePositive,sideNegative]=await Promise.all([imageTexture('./reference.jpg'),imageTexture('./reference-hair-removed-full-head-generated.png'),imageTexture('./reference-generated-left-facing-masked.png'),imageTexture('./reference-generated-right-facing-masked.png')]);
 const number=x=>Number(x).toPrecision(10),vec=a=>`vec2(${number(a[0])},${number(a[1])})`;
 const n=record.controls.length,m=record.faceOval.length;
 const controls=record.controls.map(vec).join(','),first=record.original.weights.map(vec).join(','),second=record.hairRemovedGenerated.weights.map(vec).join(','),oval=record.faceOval.map(vec).join(',');
 const affine=(r,p)=>`${vec(r.affine[0])}+${vec(r.affine[1])}*${p}.x+${vec(r.affine[2])}*${p}.y`;
 const sideDecl=(name,map)=>{const count=map.controls.length;return `const vec2 ${name}A[${count}]=vec2[${count}](${map.controls.map(vec).join(',')});const vec2 ${name}W[${count}]=vec2[${count}](${map.weights.map(vec).join(',')});vec2 ${name}Map(vec2 p){vec2 q=${affine(map,'p')};for(int i=0;i<${count};i++){vec2 d=p-${name}A[i];float r=dot(d,d);q+=${name}W[i]*r*log(max(r,1e-12));}return q;}`;};
 const header=`uniform sampler2D femReference,femEdited,femSidePositive,femSideNegative;uniform float femProjection;
 const vec2 femAnchors[${n}]=vec2[${n}](${controls});
 const vec2 femOriginalW[${n}]=vec2[${n}](${first});
 const vec2 femEditedW[${n}]=vec2[${n}](${second});
 const vec2 femOval[${m}]=vec2[${m}](${oval});
 vec2 femPhotoMap(vec2 p,bool edited){vec2 q=edited?(${affine(record.hairRemovedGenerated,'p')}):(${affine(record.original,'p')});for(int i=0;i<${n};i++){vec2 d=p-femAnchors[i];float r=dot(d,d),basis=r*log(max(r,1e-12));q+=(edited?femEditedW[i]:femOriginalW[i])*basis;}return q;}
 float femFaceCoverage(vec2 p){bool inside=false;float distanceToEdge=2.;for(int i=0;i<${m};i++){vec2 a=femOval[i],b=femOval[(i+1)%${m}],ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-9),0.,1.);distanceToEdge=min(distanceToEdge,length(p-(a+t*ab)));if(((a.y>p.y)!=(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside?smoothstep(.006,.055,distanceToEdge):0.;}
 float femInFrame(vec2 uv){return smoothstep(0.,.06,uv.x)*smoothstep(0.,.06,uv.y)*smoothstep(0.,.06,1.-uv.x)*smoothstep(0.,.06,1.-uv.y);}
 ${sideDecl('femPos',sideRecord.maps.positive)}
 ${sideDecl('femNeg',sideRecord.maps.negative)}
 float femOutsideEllipse(vec2 p,vec2 centre,vec2 radius){return smoothstep(.82,1.18,length((p-centre)/radius));}
 `;
 const anchor='gl_FragColor = linearToOutputTexel( gl_FragColor );',declaration='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;';
 function fragment(source){if(source.split(anchor).length!==2||source.split(declaration).length!==2)throw Error('照片观察接口改变');return source.replace(declaration,header+'\n'+declaration).replace(anchor,anchor+`
 if(femProjection>.5){
  // Fixed virtual cameras at +/-75 degrees. Both side views are generated
  // estimates and remain a photographic observation layer, not skin albedo.
  float sgn=nativePoint.x>=0.?1.:-1.;float ca=.2588190451,sa=.9659258263*sgn;
  float den=1820.-sa*nativePoint.x-ca*(nativePoint.z-20.);
  vec2 sideModel=vec2(.5+6.87109375*(ca*nativePoint.x-sa*(nativePoint.z-20.))/den,.5+6.87109375*(294.-nativePoint.y)/den);
  vec2 su=sgn>0.?femPosMap(sideModel):femNegMap(sideModel);
  vec4 sideSample=sgn>0.?texture(femSidePositive,su):texture(femSideNegative,su);vec3 sideRGB=sideSample.rgb;
  // The darker side of the original portrait differs strongly in lighting
  // from the generated estimate. There, retain the analytic skin's broad
  // colour/lighting and add only generated high-frequency appearance. The
  // opposite side uses the generated image without this transfer.
  if(sgn<0.){vec3 low=textureLod(femSideNegative,su,4.).rgb;sideRGB=clamp(gl_FragColor.rgb+sideRGB-low,vec3(0.),vec3(1.));}
  vec3 sideMaskRGB=sideSample.rgb;float sideSkin=smoothstep(.035,.11,sideMaskRGB.r-sideMaskRGB.g)*smoothstep(.045,.13,sideMaskRGB.r-sideMaskRGB.b)*smoothstep(.15,.24,sideMaskRGB.r);
  float sideFacing=smoothstep(.05,.34,dot(normalize(nativeNormal.xyz),vec3(sa,0.,ca)));
  float sideFeatures=sgn>0.?
   femOutsideEllipse(su,vec2(.340,.477),vec2(.105,.077))*femOutsideEllipse(su,vec2(.225,.668),vec2(.078,.050))*femOutsideEllipse(su,vec2(.635,.555),vec2(.081,.095)):
   femOutsideEllipse(su,vec2(.650,.486),vec2(.105,.077))*femOutsideEllipse(su,vec2(.755,.684),vec2(.079,.050))*femOutsideEllipse(su,vec2(.360,.568),vec2(.082,.095));
  float sideWeight=sideFacing*sideSkin*sideFeatures*sideSample.a*smoothstep(5.,20.,abs(nativePoint.x))*femInFrame(su)*femInFrame(sideModel);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,sideRGB,clamp(sideWeight,0.,1.));
  vec2 modelUV=vec2(.5+6.87109375*nativePoint.x/(1840.-nativePoint.z),.5+6.87109375*(294.-nativePoint.y)/(1840.-nativePoint.z));
  vec2 uv0=femPhotoMap(modelUV,false),uv1=femPhotoMap(modelUV,true);
  vec3 realRGB=texture(femReference,uv0).rgb,editRGB=texture(femEdited,uv1).rgb;
  float oval=femFaceCoverage(modelUV),face=oval*femInFrame(uv0)*smoothstep(.39,.45,modelUV.y);
  float skinColour=smoothstep(.15,.25,editRGB.r)*smoothstep(.055,.13,editRGB.r-editRGB.g)*smoothstep(.09,.19,editRGB.r-editRGB.b);
  float scalpOval=length((uv1-vec2(.476,.470))/vec2(.235,.203));
  float scalpInterior=1.-smoothstep(.80,.98,scalpOval);
  float skin=mix(skinColour,1.,oval*smoothstep(.28,.34,modelUV.y))*femInFrame(uv1);
  float generated=skin*(1.-face)*scalpInterior*smoothstep(.075,.16,modelUV.y)*(1.-smoothstep(.41,.49,modelUV.y));
  float frontal=smoothstep(.12,.42,dot(normalize(nativeNormal.xyz),normalize(vec3(0.,294.,1840.)-nativePoint)));
  float total=face+generated,weight=clamp(total*frontal,0.,1.);
  vec3 observed=(editRGB*generated+realRGB*face)/max(total,1e-5);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,observed,weight);
 }
 `);}
 function bind(g,program){for(const [unit,texture,name] of [[9,original,'femReference'],[10,edited,'femEdited'],[11,sidePositive,'femSidePositive'],[12,sideNegative,'femSideNegative']]){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,texture);g.uniform1i(g.getUniformLocation(program,name),unit);}}
 return{fragment,bind,report:()=>({kind:'photographic-observation-only',sourceSHA256:record.originalSHA256,generatedSHA256:record.generatedSHA256,generatedSides:[sideRecord.maps.positive.referenceSHA256,sideRecord.maps.negative.referenceSHA256],landmarksAccepted:false,photoContainsLighting:true})};
}
