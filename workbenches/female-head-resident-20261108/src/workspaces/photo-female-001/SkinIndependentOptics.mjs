// Isolated experiment: let roughness vary while preserving the case's
// existing fitted appearance at psRoughness=.56. No claim of measured BRDF.
export function independentSkinOptics(source,{reference=.56}={}){
 if(!Number.isFinite(reference)||reference<=0||reference>1)throw Error('粗糙度参考值无效');const ref=Number(reference).toFixed(8);
 const lobe='float oil=txOil*(.38+.62*max(txNose,txForehead));float m1=mix(.34,.17,oil),m2=mix(.22,.075,oil);';
 const rough='material.roughness=mix(material.roughness,mix(.64,.40,txOil),gate);';
 if(source.split(lobe).length!==2||source.split(rough).length!==2)throw Error('独立粗糙度接口改变');
 return source.replace(lobe,lobe+`float txRoughFactor=psRoughness/${ref};m1*=txRoughFactor;m2*=txRoughFactor;`)
  .replace(rough,`material.roughness=mix(material.roughness,clamp(mix(.64,.40,txOil)+(psRoughness-${ref}),.20,.98),gate);`);
}
