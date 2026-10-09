"""R05-only look review: retain source finish as comparison; do not conceal thread geometry."""
from pathlib import Path
r=Path(__file__).resolve().parent
p=r/'site/appearance.js';s=p.read_text()
if 'pigmentCoverage' not in s:
 s=s.replace('grain(look){','grain(look,raw=false){')
 s=s.replace('normalScale:new T.Vector2(.82,.82)','normalScale:new T.Vector2(raw?.65:.24,raw?.65:.24)')
 s=s.replace("shader.uniforms.finishRoughness={value:look.roughness??.46};", "shader.uniforms.finishRoughness={value:look.roughness??.46};\n   shader.uniforms.pigmentCoverage={value:raw?1:.16};")
 s=s.replace('uniform float finishRoughness; varying float vCompression;', 'uniform float finishRoughness;uniform float pigmentCoverage; varying float vCompression;')
 old="shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>'"
 new="shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP\nvec4 texelColor=texture2D(map,vMapUv);\ntexelColor.rgb=mix(vec3(.08401343,.02765351,.00580022),texelColor.rgb,pigmentCoverage);\ndiffuseColor*=texelColor;\n#endif`);\n   "+old
 assert s.count(old)==1;s=s.replace(old,new)
 s=s.replace('grain-r051-${look.roughness}', 'grain-r051-${look.roughness}-${raw}')
 p.write_text(s)
p=r/'site/runtime.js';s=p.read_text().replace("appearance.grain(look):", "appearance.grain(look,$('materialSource').value==='vintage'):")
p.write_text(s)
p=r/'site/template.html';s=p.read_text()
s=s.replace('<option value="grain">写实粒面 · 授权 PBR 数据</option>','<option value="grain">精细涂饰粒面 · 写实</option><option value="vintage">原始做旧粒面 · 对照</option>')
s=s.replace('写实档采用 Poly Haven / Rob Tuytel 的 Brown Leather CC0 皮革贴图并调整涂饰；', '精细涂饰档保留真实粒面纹理，减弱做旧色斑与大褶皱凹凸；另可切换原始做旧粒面。素材为 Poly Haven / Rob Tuytel 的 Brown Leather，CC0；')
s=s.replace('保持实际纹理尺度，不把整幅纹理缩到一根针脚上。', '保持实际纹理尺度，不把整幅纹理缩到一根针脚上。精细涂饰档通过薄层颜料覆盖近似减弱色斑，并降低凹凸强度；这是独立外观处理，不是该实物已被重新测量。原始做旧档可以对照查看。')
p.write_text(s)
print('Fine pigmented finish with original-grain comparison; local deformation and R04 remain unchanged.')
