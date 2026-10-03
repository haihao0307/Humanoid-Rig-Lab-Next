globalThis.AtlasDemoAdapter=function(context,getRoots){
 const demo=window.__ATLAS_DEMO,kind=context.adapter,T=window.__ATLAS_NATIVE?.T||window.__ATLAS_IMPORTED?.T||window.__ATLAS_THREE||window.AtlasTurntable?.T,wrapped=new Map(),materials=new WeakMap(),pigment=T?new T.Color():null;
 function apply(){
  if(kind==='fish'){const r=__KAOPU_R13__.renderer;r.school.fish.forEach((f,i)=>{const base=r.__atlasVariants[i];f.variant.scale=base.scale.map((v,k)=>v*(r.__atlasRecord?.bodyScale??1)*demo.view[k]);f.variant.brightness=base.brightness*(r.__atlasRecord?.brightness??1);f.variant.tint=base.tint.map((v,k)=>v*demo.tint[k]);});return;}
  if(!T||['cat','eagle'].includes(kind))return;
  pigment.setRGB(...demo.tint);const roots=getRoots();for(const [root,group]of wrapped)if(!roots.includes(root)){group.removeFromParent();wrapped.delete(root);}
  for(const root of roots){if(!root?.parent)continue;let group=wrapped.get(root);if(!group){group=new T.Group();group.name='warehouse-demonstration-transform';root.parent.add(group);group.add(root);wrapped.set(root,group);}const v=demo.view;group.scale.set(...(kind==='palau'?[v[0],v[2],v[1]]:v));
   root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(m?.color){let original=materials.get(m);if(!original){original=m.color.clone();materials.set(m,original);}m.color.copy(original).multiply(pigment);}else if(m?.isShaderMaterial&&/gl_FragColor\s*=/.test(m.fragmentShader)){if(!m.uniforms.uAtlasDemoTint){m.uniforms.uAtlasDemoTint={value:new T.Vector3(1,1,1)};m.fragmentShader='uniform vec3 uAtlasDemoTint;\n'+m.fragmentShader.replace(/(gl_FragColor\s*=\s*vec4\([^;]*;)/g,'$1gl_FragColor.rgb*=uAtlasDemoTint;');m.needsUpdate=true;}m.uniforms.uAtlasDemoTint.value.set(...demo.tint);}}});group.updateMatrixWorld(true);
  }
 }
 return{apply,set(values){demo.configure(values);apply();},snapshot:()=>demo.info(),resetBase(){for(const root of getRoots())root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m?.color&&materials.has(m)){m.color.copy(materials.get(m));materials.delete(m);}});},bakeRaw(items){for(const m of items){const a=m.positions;for(let i=0;i<a.length;i++)a[i]*=demo.view[i%3];m.material.color=m.material.color.map((v,k)=>v*demo.tint[k]);}return items;},wrapped};
};
