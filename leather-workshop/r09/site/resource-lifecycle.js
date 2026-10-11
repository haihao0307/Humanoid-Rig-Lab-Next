// Dispose product-owned GPU programs and textures when switching products.
// The shared material catalogue and frozen thumbnails must remain alive.
const destroyBeforeR09=destroyGeometry;
destroyGeometry=function(root){if(!root)return;const seen=new Set();root.traverse(o=>{const m=o.customDepthMaterial;if(m&&!seen.has(m)){seen.add(m);m.dispose();}if(o.userData.beautyMaterials){for(const q of(Array.isArray(o.material)?o.material:[o.material]))q.dispose();}});if(root===hero&&heroMats){heroMats.thread.map?.dispose();heroMats.thread.normalMap?.dispose();for(const k of['back','edge','thread','brass'])heroMats[k]?.dispose();}destroyBeforeR09(root);};
