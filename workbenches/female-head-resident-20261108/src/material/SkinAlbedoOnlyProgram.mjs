// The source albedo signal has no lighting dependency. A separate program
// keeps the original surface shader byte-for-byte intact for all other passes.
export function skinAlbedoOnlyFragment(source,{derivativeHelpers=false}={}){
 const anchor='vec3 geometryPosition = - vViewPosition;';
 if(source.split(anchor).length!==2)throw Error('原材质基础色输出位置改变');
 const out=`float blend=.55;blend=mix(blend,.35,clamp(srForeheadMask,0.,1.));blend=mix(blend,.12,clamp(srNoseMask,0.,1.));blend=mix(blend,.18,clamp(srEarMask,0.,1.));blend=mix(blend,.05,clamp(psE,0.,1.));blend=mix(blend,.02,clamp(psL,0.,1.));gl_FragColor=vec4(material.diffuseColor,blend);${derivativeHelpers?'if(!derivativeOutput())discard;':''}return;`;
 return source.replace(anchor,out+anchor);
}
