// A study-only output bridge: retain radiance before tone mapping and sRGB.
// The default shader source is returned verbatim when the study is absent.
export function skinLinearOutputSource(source,supported=false,diffuseSignals=false){
 if(!supported)return source;
 if(!source.includes('void main()'))throw Error('皮肤线性输出缺少着色入口');
 source=source.replace('void main()', 'uniform bool u_sssLinear;\nvoid main()');
 if(diffuseSignals){
  source=source.replace('uniform bool u_sssLinear;','uniform bool u_sssLinear;uniform int u_sssSignal;');
  const signals=`if(u_sssLinear&&u_sssSignal==1)gl_FragColor=vec4(gmDiffuse,1.);
  if(u_sssLinear&&u_sssSignal==2){
   float blend=.55;
   blend=mix(blend,.35,clamp(srForeheadMask,0.,1.));
   blend=mix(blend,.12,clamp(srNoseMask,0.,1.));
   blend=mix(blend,.18,clamp(srEarMask,0.,1.));
   blend=mix(blend,.05,clamp(psE,0.,1.));
   blend=mix(blend,.02,clamp(psL,0.,1.));
   gl_FragColor=vec4(material.diffuseColor,blend);
  }\n`;
  if(!source.includes('#if defined( TONE_MAPPING )'))throw Error('皮肤漫反射分离接口改变');
  source=source.replace('#if defined( TONE_MAPPING )',signals+'#if defined( TONE_MAPPING )');
 }
 const standard=source.includes('gl_FragColor = linearToOutputTexel( gl_FragColor );');
 if(standard){
  source=source.replace('gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );','if(!u_sssLinear)gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );');
  source=source.replace('gl_FragColor = linearToOutputTexel( gl_FragColor );','if(!u_sssLinear)gl_FragColor = linearToOutputTexel( gl_FragColor );');
  source=source.replaceAll('sceneEncode(u_sceneBackground)','(u_sssLinear?u_sceneBackground:sceneEncode(u_sceneBackground))');
 }else if(source.includes('sceneDisplay(result)')){
  source=source.replaceAll('sceneDisplay(result)','(u_sssLinear?result:sceneDisplay(result))');
 }else throw Error('未知的皮肤线性输出接口');
 return source;
}
