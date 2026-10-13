from pathlib import Path
import hashlib,json
r=Path(__file__).resolve().parents[1]
p=r/'material-shaders.mjs';s=p.read_text()
old='P+=.001*.48*radius*(cos(phase+ply*TAU/3.)*B+sin(phase+ply*TAU/3.)*W);ra=rz=radius*.55;'
new='''float phi=phase+ply*TAU/3.;vec3 radialPly=cos(phi)*B+sin(phi)*W;
 P+=.001*.48*radius*radialPly;
 // Cross section must be perpendicular to the helix, not to the untwisted core.
 vec3 plyT=normalize(T+(-sin(phi)*B+cos(phi)*W)*(.48*radius*TAU/max(.3,uTwist)));
 B=normalize(B-plyT*dot(B,plyT));T=plyT;W=normalize(cross(B,T));ra=rz=radius*.55;'''
assert s.count(old)==1,'unexpected frozen knit frame'
s=s.replace(old,new)
s=s.replace('varying vec3 vYarnT;', 'varying vec3 vYarnT;varying vec3 vClothN;')
s=s.replace('vYarnT=normalize(normalMatrix*T);','vYarnT=normalize(normalMatrix*T);vClothN=normalize(normalMatrix*N);')
s=s.replace('uniform float uFilterScale;', 'uniform float uFilterScale;uniform float uPitch,uWeftPitch;uniform vec3 uDye,uWeftDye;')
old='if(uKnit<.5){float variation;normal=fiberSurface(normal,normalize(vYarnT),vec2(vSolidCoord.x,vSolidCoord.y*.18),vSolidCoord.z,variation);diffuseColor.rgb*=clamp(variation,.55,1.4);}'
new='''if(uKnit<.5){
 float variation;normal=fiberSurface(normal,normalize(vYarnT),vec2(vSolidCoord.x,vSolidCoord.y*.18),vSolidCoord.z,variation);diffuseColor.rgb*=clamp(variation,.55,1.4);
 // Integrate the unresolved 3:1 twill colours in the actual pixel footprint.
 // The closed warp and weft geometry remains; no texture or opaque backing plane.
 float mmPerPixel=1000.*max(length(dFdx(vViewPosition)),length(dFdy(vViewPosition)));
 float average=smoothstep(.35,1.25,mmPerPixel/max(.01,min(uPitch,uWeftPitch)));
 vec3 clothN=normalize(vClothN);bool outer=dot(clothN,normalize(vViewPosition))>=0.;
 vec3 meanColour=mix(uDye,uWeftDye,outer?.25:.75);meanColour=mix(meanColour,vec3(.52),uPlain);
 diffuseColor.rgb=mix(diffuseColor.rgb,meanColour,average);
 normal=normalize(mix(normal,outer?clothN:-clothN,average*.92));
}'''
assert s.count(old)==1,'unexpected frozen cotton shading'
s=s.replace(old,new);p.write_text(s)
for n in ['app.mjs','index.html']:
 p=r/n;s=p.read_text().replace('MP04.2','MP04.3');p.write_text(s)
p=r/'solid-textiles.mjs';s=p.read_text().replace("stats.twistConvention='R11 twist pitch in mm, not turns/mm'", "stats.twistConvention='R11 twist pitch in mm with helix-normal ply frames';stats.subpixelColour='analytic 3:1 twill colour average, closed geometry retained'");p.write_text(s)
metrics=['cloth-kernel.c','cloth-kernel.wasm','native-motion.mjs','coupled-cloth.mjs','wasm-cloth.mjs','waist-attachments.mjs','material-settings.mjs','motion-cache.mjs','bake-default.mjs','materials.json']
(r/'FINISH_SCOPE.json').write_text(json.dumps({'version':'MP04.3','parentRuntimeCommit':'44ee0e6286161893678df41e74bd4181e0dc8d99','parentRuntimeRun':38350576867,'physicalClipProtocol':'MP04.2 unchanged','changes':['ply cross-section normal frame follows actual helical tangent','pixel-footprint 3:1 twill colour/normal integration without replacing closed yarn geometry'],'physicsFileHashes':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in metrics},'userAccepted':False,'physicalDeviceTested':False},ensure_ascii=False,indent=2))
print('MP04.3 optical fixes applied; native physics and material dimensions unchanged')
