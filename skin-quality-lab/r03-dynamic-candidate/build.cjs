// Build a small fixed-source loader. The approved source files stay alongside preview.html.
const fs=require('fs'),path=require('path');const d=__dirname;
const loader=String.raw`(async()=>{
 const text=async url=>{const response=await fetch(url);if(!response.ok)throw Error('Resource '+response.status+': '+url);return response.text()};
 const blob=(source,name)=>URL.createObjectURL(new Blob([source+'\n//# sourceURL='+name],{type:'text/javascript'}));
 const query=decodeURIComponent(location.search.slice(1));
 const page=location.hostname==='htmlpreview.github.io'&&query.startsWith('https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/')?query:location.href;
 const root=new URL('.',page);const vendor='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/2368e26e76114f45e716cefba3320cfd76c61a9e/skin-quality-lab/r01/vendor/';
 document.getElementById('loadingText').textContent='载入固定版本引擎与自主动态模块';
 const [core,engine,orbit,gltf,utils,dynamic,eye,app]=await Promise.all([text(vendor+'three.core.js'),text(vendor+'three.module.js'),text(vendor+'addons/controls/OrbitControls.js'),text(vendor+'addons/loaders/GLTFLoader.js'),text(vendor+'addons/utils/BufferGeometryUtils.js'),text(new URL('dynamic.js',root)),text(new URL('eye.js',root)),text(new URL('app.js',root))]);
 const coreURL=blob(core,'three.core.fixed-r180.js');const engineURL=blob(engine.replaceAll('./three.core.js',coreURL),'three.module.fixed-r180.js');const utilsURL=blob(utils,'BufferGeometryUtils.fixed-r180.js');
 const orbitURL=blob(orbit,'OrbitControls.fixed-r180.js'),gltfURL=blob(gltf.replaceAll('../utils/BufferGeometryUtils.js',utilsURL),'GLTFLoader.fixed-r180.js');
 const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:{'three':engineURL,'three/addons/controls/OrbitControls.js':orbitURL,'three/addons/loaders/GLTFLoader.js':gltfURL}});document.head.append(map);
 const dynamicURL=blob(dynamic,'dynamic-candidate.js'),eyeURL=blob(eye,'eye-candidate.js');
 await import(blob(app.replaceAll('./dynamic.js',dynamicURL).replaceAll('./eye.js',eyeURL),'skin-r03-candidate.js'));
})().catch(error=>{document.getElementById('loadingText').textContent='加载未完成：'+error.message;document.getElementById('status').textContent='载入失败';console.error(error);});`;
new(require('vm').Script)(loader);let frame=fs.readFileSync(path.join(d,'frame.html'),'utf8').replace(/<script type="importmap">[\s\S]*?<\/script>/,'');fs.writeFileSync(path.join(d,'preview.html'),frame+'<script>'+loader+'</script></body></html>');console.log('Built small preview loader',fs.statSync(path.join(d,'preview.html')).size);
