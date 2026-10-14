"""R02 C2: thick underpile and continuous guard hairs, no stochastic dot masks."""
from pathlib import Path
P=Path(__file__).resolve().parent
p=P/'app.js';s=p.read_text()
if '// DENSE_PILE_C2' not in s:
 s=s.replace('const MAX=260000','const MAX=780000').replace("view==='hat'?210000:view==='swatch'?170000:MAX","view==='hat'?360000:view==='swatch'?360000:MAX")
 s=s.replace("root:'#291b15',mid:'#70513b',tip:'#bea88a',thickness:.13","root:'#3a2c22',mid:'#907760',tip:'#c9bba5',thickness:.14")
 s=s.replace('.142+.100*Math.sin(v*PI)-.025*v','.157+.100*Math.sin(v*PI)-.077*v')
 s=s.replace('.100*PI*Math.cos(v*PI)-.025','.100*PI*Math.cos(v*PI)-.077')
 s=s.replace('Math.pow(Math.sin(PI*(.055+.94*v)),.34),rad=.075*end','Math.pow(Math.max(.00002,Math.sin(PI*v)),.32),rad=.086*end')
 s=s.replace('Math.sin(a)*rad*.36','Math.sin(a)*rad*.42')
 s=s.replace('step(.73,aRandom.w)','step(.80,aRandom.w)')
 s=s.replace('mix(21.,8.,guard)','mix(7.,8.,guard)')
 s=s.replace('px*.95','px*mix(.52,.90,guard)')
 old='float edge=1.-smoothstep(.45,1.,abs(vAcross)),alpha=edge*vCover;if(alpha<.035)discard;'
 new='''float edge=1.-smoothstep(.65,1.,abs(vAcross));
 // The dense underpile uses depth-resolved core ribbons and native MSAA edge coverage.
 // The subpixel width floor represents unresolved pile; guard hair retains smooth alpha coverage.
 float alpha=mix(1.,edge*vCover,vGuard);if(edge<.015||alpha<.004)discard;'''
 assert old in s
 s=s.replace(old,new).replace('base*env*.67*occlusion','base*env*.90*occlusion')
 s=s.replace('transparent:false,depthWrite:true,alphaToCoverage:true','transparent:false,depthWrite:true,alphaToCoverage:false')
 anchor='function syncLight()'
 s=s.replace(anchor,"const guardMaterial=furMaterial.clone();guardMaterial.uniforms=U;guardMaterial.transparent=true;guardMaterial.depthWrite=false;guardMaterial.alphaToCoverage=false;\n"+anchor)
 # Generate two deterministic disjoint populations. Each still has its own root and curve.
 s=s.replace('randoms.set([rand(),rand(),rand(),rand()],i*4);','randoms.set([rand(),rand(),rand(),i<Math.floor(count*.8)?rand()*.8:.8+rand()*.2],i*4);')
 old='geo.instanceCount=Math.round(count*density);geo.userData.capacity=count;fur=new T.Mesh(geo,furMaterial);fur.frustumCulled=false;fur.renderOrder=3;subject.add(fur);'
 new='''geo.instanceCount=Math.round(count*density);geo.userData.capacity=count;
 fur=new T.Group();fur.geometry=geo;fur.userData.renderLayers=[];
 function addPopulation(start,n,seg,material){
  const g=new T.InstancedBufferGeometry(),ps=[],ix=[];
  for(let j=0;j<=seg;j++)ps.push(-1,j/seg,0,1,j/seg,0);
  for(let j=0;j<seg;j++){const k=j*2;ix.push(k,k+1,k+2,k+1,k+3,k+2);}
  g.setAttribute('position',new T.Float32BufferAttribute(ps,3));g.setIndex(ix);
  for(const [name,attr] of Object.entries(geo.attributes))if(name!=='position')g.setAttribute(name,new T.InstancedBufferAttribute(attr.array.subarray(start*attr.itemSize,(start+n)*attr.itemSize),attr.itemSize));
  g.instanceCount=n;g.userData.capacity=n;const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=3;fur.add(mesh);fur.userData.renderLayers.push(mesh);
 }
 const underCount=Math.floor(count*.80);addPopulation(0,underCount,3,furMaterial);addPopulation(underCount,count-underCount,7,guardMaterial);subject.add(fur);'''
 assert old in s
 s=s.replace(old,new)
 s=s.replace('if(o.material&&o.material!==furMaterial)o.material.dispose();','if(o.material&&o.material!==furMaterial&&o.material!==guardMaterial)o.material.dispose();')
 old='fur.geometry.instanceCount=Math.floor(fur.geometry.userData.capacity*density);U.uDensity.value=density;'
 new='''fur.geometry.instanceCount=0;for(const mesh of fur.userData.renderLayers){mesh.geometry.instanceCount=Math.floor(mesh.geometry.userData.capacity*density);fur.geometry.instanceCount+=mesh.geometry.instanceCount;}U.uDensity.value=density;'''
 assert old in s
 s=s.replace(old,new)
 s=s.replace('b.material.roughness=.98;b.material.sheen=plain?.16:.3;', 'b.material.roughness=1;b.material.specularIntensity=plain?.08:.15;b.material.sheen=plain?.35:.25;')
 # Fine authored wool-scale reflectance modulation; no imported image maps.
 inject="""
 mat.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 vMaterialPoint;\\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\\nvMaterialPoint=position;');
  shader.fragmentShader='varying vec3 vMaterialPoint;\\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grain=fract(sin(dot(floor(vMaterialPoint*2100.),vec3(127.1,311.7,74.7)))*43758.5453);
   float macroGrain=fract(sin(dot(floor(vMaterialPoint*530.),vec3(73.1,217.3,121.7)))*42758.5153);
   diffuseColor.rgb*=.88+.19*grain+.09*macroGrain;
  `);
 };
"""
 s=s.replace(' const mesh=new T.Mesh(geo,mat);',inject+' const mesh=new T.Mesh(geo,mat);')
 s=s.replace("$('#density-readout').textContent=Math.round(density*100)+'%';", "$('#density-readout').textContent=Math.round(density*100)+'%';if(fur)$('#fibers').textContent=(fur.geometry.instanceCount/10000).toFixed(1)+' 万';$('#guide-count').textContent=guides.length;$('#fps').textContent=simulating?'—':'静止';")
 s=s.replace('depthResolving:true','depthResolving:true,renderPopulations:fur.userData.renderLayers.map(m=>({count:m.geometry.instanceCount,segments:m.geometry.index.count/6,depthWrite:m.material.depthWrite,transparent:m.material.transparent})),coverageRounding:false')
 s+='\n// DENSE_PILE_C2: 80% occluding underpile, 20% continuous transparent guard hairs.\n'
 p.write_text(s)
q=P/'qa.py';t=q.read_text().replace("'260000 actual collar fibers',a['instances']==260000","'780000 actual collar fibers',a['instances']==780000")
# Geometry remains the production geometry. No test-only reduction or alternate material.
q.write_text(t)
h=P/'index.source.html';t=h.read_text().replace('生长毛皮','构建厚密毛领')
t=t.replace('不是逐毛碰撞，不是成衣布料物理','不是逐毛碰撞，不是成衣布料物理')
h.write_text(t)
print('C2 dense pile with continuous guard hairs; default 780000 roots, native underpile depth.')
