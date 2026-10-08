const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),base='1d4a616672f2a45e869d4ef3e36e710b11f5cf41';
function original(name){if(process.env.R02_BASE_DIR)return fs.readFileSync(path.join(process.env.R02_BASE_DIR,name),'utf8');return cp.execFileSync('git',['show',base+':skin-quality-lab/r02/'+name],{encoding:'utf8',maxBuffer:8*1024*1024});}
let js=original('app.js'),html=original('index.html');
const originalSHA=crypto.createHash('sha1').update('blob '+Buffer.byteLength(js)+'\0').update(js).digest('hex');if(originalSHA!=='932ce840dc7276708c2088d05ff01db50112453d')throw Error('R02 source anchor changed');
function swap(a,b){if(!js.includes(a))throw Error('Missing R02 source anchor: '+a.slice(0,110));js=js.replaceAll(a,b);}
swap("VERSION='skin-quality-lab/r02.1'","VERSION='skin-quality-lab/r02.4-brow-age'");
swap("document.title='皮肤质感实验室 · R02.1'","document.title='皮肤质感实验室 · R02.4 三套表皮'");
swap("'R02.1 · MICRO SKIN'","'R02.4 · 3 SKINS'");
swap('Object.assign(U,E);','Object.assign(U,E);Object.assign(U,{uIdentityEnabled:{value:0},uIdentityRoughness:{value:null},uIdentityFeatures:{value:null},uIdentityRoughnessBase:{value:.5}});');
swap('uniform float uPass,uDetail,','uniform float uIdentityEnabled,uIdentityRoughnessBase;uniform sampler2D uIdentityRoughness,uIdentityFeatures;\nuniform float uPass,uDetail,');
swap('uniform sampler2D uSurface;uniform float uRelief,uBaseline;','uniform sampler2D uSurface,uIdentityFeatures;uniform float uRelief,uBaseline,uIdentityEnabled;');
swap('transformed+=normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001*(1.-uBaseline);','transformed+=normal*((texture2D(uSurface,uv).b-.5)+uIdentityEnabled*(texture2D(uIdentityFeatures,uv).b-.5))*uRelief*.001*(1.-uBaseline);');
swap('uBaseline:U.uBaseline});','uBaseline:U.uBaseline,uIdentityFeatures:U.uIdentityFeatures,uIdentityEnabled:U.uIdentityEnabled});');
swap('float skinSpecMask=texture2D(uSpec,vMapUv).r;vec3 skinSurface=texture2D(uSurface,vMapUv).rgb;','float skinSpecMask=texture2D(uSpec,vMapUv).r;vec3 skinSurface=texture2D(uSurface,vMapUv).rgb;\n if(uIdentityEnabled>.5)roughnessFactor=clamp(texture2D(uIdentityRoughness,vMapUv).g+roughnessFactor-uIdentityRoughnessBase,.24,.85);');
swap("makeFuzz(geo);initEntry();initPost();resize();setCamera('portrait');apply();","makeFuzz(geo);initEntry();initPost();resize();setCamera('portrait');await installSkinIdentities({albedo,normal,spec,surfaceMap},load);apply();");
swap("fuzz.visible=values.fuzz>0&&!compareHeld&&state.layer==='beauty';","fuzz.visible=(values.fuzz>0||identityRuntime?.hasHair())&&!compareHeld&&state.layer==='beauty';");
swap("function recipe(){return {schema:","function recipe(){return {identity:identityRuntime?.report(),schema:");
swap('function loadRecipe(o){','async function loadRecipe(o){await identityRuntime.restore(o.identity);');
swap("$('restore').onclick=()=>{","$('restore').onclick=async()=>{");
swap('loadRecipe(JSON.parse(v));','await loadRecipe(JSON.parse(v));');
swap('loadRecipe(JSON.parse(await f.text()));','await loadRecipe(JSON.parse(await f.text()));');
swap("$('reset').onclick=()=>{","$('reset').onclick=async()=>{await identityRuntime.set('original');");
swap("localStorage.setItem('skin-quality-lab-r02',","localStorage.setItem('skin-quality-lab-r02-identities',");
swap("localStorage.getItem('skin-quality-lab-r02')","localStorage.getItem('skin-quality-lab-r02-identities')");
js="import {attachFiberMaterial,fiberMaterialDiagnostics} from './identities/FiberMaterial.js';\nimport {createScanAgeMorph} from './identities/AgeMorph.js';\nimport {scanBrowGuide} from './identities/BrowAnatomy.js';\n"+js;
swap('uniform sampler2D uSurface;uniform float uRelief,uPixelHeight;','uniform sampler2D uSurface,uIdentityFeatures;uniform float uIdentityEnabled,uRelief,uPixelHeight;');
swap('vec3 pp=position+normal*(texture2D(uSurface,uv).b-.5)*uRelief*.001;', 'vec3 pp=position+normal*((texture2D(uSurface,uv).b-.5)+uIdentityEnabled*(texture2D(uIdentityFeatures,uv).b-.5))*uRelief*.001;');
swap('uFuzz:{value:values.fuzz},uRelief:E.uRelief,', 'uFuzz:{value:values.fuzz},uIdentityFeatures:U.uIdentityFeatures,uIdentityEnabled:U.uIdentityEnabled,uRelief:E.uRelief,');
// Clear inherited eyebrow imprints using the SAME source UV region as roots.
swap('((texture2D(uSurface,uv).b-.5)+uIdentityEnabled*(texture2D(uIdentityFeatures,uv).b-.5))','(mix(texture2D(uSurface,uv).b-.5,texture2D(uSurface,uv+vec2(0.,.06)).b-.5,uIdentityEnabled*texture2D(uIdentityFeatures,uv).g)+uIdentityEnabled*(texture2D(uIdentityFeatures,uv).b-.5))');
swap('float skinSpecMask=texture2D(uSpec,vMapUv).r;vec3 skinSurface=texture2D(uSurface,vMapUv).rgb;', 'float skinSpecMask=texture2D(uSpec,vMapUv).r;vec3 skinSurface=texture2D(uSurface,vMapUv).rgb;float scanBrowRegion=uIdentityEnabled*texture2D(uIdentityFeatures,vMapUv).g;skinSpecMask=mix(skinSpecMask,.45,scanBrowRegion);skinSurface=mix(skinSurface,vec3(.5),scanBrowRegion);');
swap('vec2 slopes=mapN.xy/max(mapN.z,.2)+mesoN.xy/max(mesoN.z,.3)*uMeso+microN.xy/max(microN.z,.3)*uMicro;', 'float browClean=uIdentityEnabled*texture2D(uIdentityFeatures,vNormalMapUv).g;mesoN=mix(mesoN,texture2D(uMesoMap,vNormalMapUv+vec2(0.,.06)).rgb*2.-1.,browClean);microN=mix(microN,texture2D(uMicroMap,vNormalMapUv+vec2(0.,.06)).rgb*2.-1.,browClean);vec2 slopes=mapN.xy/max(mapN.z,.2)+mesoN.xy/max(mesoN.z,.3)*uMeso+microN.xy/max(microN.z,.3)*uMicro;');
swap("ear:{p:[.32,.054,.16],t:[.075,.025,0]}","ear:{p:[.32,.054,.16],t:[.075,.025,0]},brow:{p:[.125,.100,.215],t:[.027,.076,.066]},quarter:{p:[.27,.095,.38],t:[0,.055,.012]},high:{p:[.17,.21,.42],t:[0,.060,.018]},profile:{p:[.44,.065,.08],t:[0,.040,.008]}");
swap("const num={beauty:0,albedo:1,normal:2,roughness:3,specular:4,diffuse:5}","const num={beauty:0,albedo:1,normal:2,roughness:3,specular:4,diffuse:5,browmask:6,clay:7}");
swap('U.uLayer.value=num<4?num:0;', 'U.uLayer.value=num===6?4:num===7?5:num<4?num:0;');
swap('if(uBaseline<.5){diffuseColor.rgb*=exp(', 'if(uLayer>4.5)diffuseColor.rgb=vec3(.32);\n if(uBaseline<.5&&uLayer<4.5){diffuseColor.rgb*=exp(');
swap('normal=normalize(tbn*mapN);','normal=normalize(tbn*(uLayer>4.5?vec3(0.,0.,1.):mapN));');
swap('if(uLayer>2.5&&uLayer<3.5)outgoingLight=vec3(roughnessFactor);','if(uLayer>2.5&&uLayer<3.5)outgoingLight=vec3(roughnessFactor);if(uLayer>3.5&&uLayer<4.5)outgoingLight=vec3(1.,.24,.025)*texture2D(uIdentityFeatures,vMapUv).r;');
swap('if(mode>4.5)c=diff;', 'if(mode>4.5)c=diff;if(mode>5.5&&mode<6.5)c=f.rgb;');
// Existing R02 post-process remains unchanged. Identity code owns only maps,
// rooted fibres and recipe UI. Initialization yields on its texture loads.
js+='\n'+fs.readFileSync(path.join(__dirname,'runtime.js'),'utf8');
const tuneFile=path.join(__dirname,'tune.json');
if(fs.existsSync(tuneFile))for(const [a,b]of JSON.parse(fs.readFileSync(tuneFile,'utf8')).replace){if(!js.includes(a))throw Error('Identity lookdev anchor absent: '+a);js=js.replaceAll(a,()=>b);}
const style=`\n.identity-choices{display:grid;gap:6px}.identity-choices button{text-align:left;font-size:12px;padding:9px 10px}.identity-choices b{display:inline-block;width:20px;color:#d9bc96}.identity-note{font-size:10px;line-height:1.7;color:#9ca1a9;margin:9px 0}.identity-quick{display:flex;gap:5px;flex-wrap:wrap;width:100%;margin-top:3px}#layerLabel{top:112px}#baselineBadge{top:112px}#mapsDialog{background:#191d23;color:#ddd;border:1px solid #625543;border-radius:10px;width:min(1100px,92vw);max-height:90vh;padding:20px}#mapsDialog::backdrop{background:#000b}.map-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.map-grid figure{margin:0}.map-grid img{width:100%;border-radius:5px}.map-grid figcaption{padding:10px 0;color:#d6bb9b;font-size:12px}#mapsClose{float:right}.identity-status{color:#c3a786;font-size:10px}#identityMaps{width:100%;font-size:11px}@media(max-width:760px){#layerLabel{top:128px}.map-grid{grid-template-columns:1fr}.identity-quick{gap:4px}.identity-quick button{font-size:10px}}\n`;
html=html.replace('</style>',style+'#layerLabel,#baselineBadge{top:148px}</style>');
const controls=(id,label,min,max,value)=>`<div class="control"><label for="${id}">${label}<output id="${id}Out">${value}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="0.01" value="${value}"></div>`;
const panel=`<div class="section" id="identitiesPanel"><h2>三套独立表皮 <small>R02.4 / IDENTITY</small></h2><div class="identity-choices"><button data-identity="porcelain"><b>01</b>冷白雀斑 · 无须细眉</button><button data-identity="umber"><b>02</b>深褐短须 · 浓眉浅疤</button><button data-identity="weathered"><b>03</b>风化熟龄 · 灰白胡须</button><button data-identity="original">原 R02 扫描 · 保留对照</button></div><p id="identityDescription" class="identity-note"></p><div id="identityStatus" class="identity-status" role="status">准备贴图</div>${controls('browDensity','独立眉毛密度',0,1,1)}${controls('beardDensity','独立胡须密度',0,1,1)}${controls('beardLength','胡须长度倍率',.25,2,1)}<button id="identityMaps">检查实际 UV 贴图</button><button id="ageShapeToggle" style="width:100%;margin-top:6px">熟龄形态对照</button><p class="hint">原扫描闭眼基线保留；熟龄增加可回退的颊部、眼周与下颌形态。眉区依据原扫描UV逐侧定位，眉胡重绑当前三角面。</p></div>`;
html=html.replace('<aside class="side" aria-label="皮肤与光线参数">','<aside class="side" aria-label="皮肤与光线参数">'+panel);
html=html.replace('<button id="shot">截图</button></div>','<button id="shot">截图</button><div class="identity-quick"><button data-identity="porcelain">01 冷白雀斑</button><button data-identity="umber">02 深褐短须</button><button data-identity="weathered">03 风化熟龄</button><button data-identity="original">原 R02</button></div></div>');
html=html.replace('同一扫描参考上的艺术调节，不是不同人物或医学测量。','下方仅控制材质响应；上方三套表皮分别读取独立绘制的纹理与眉胡配方。');
html=html.replace('材质起点','材质响应');
html=html.replace('<button id="shot">截图</button>', '<button data-camera="quarter">斜侧</button><button data-camera="high">俯视</button><button data-camera="profile">纯侧面</button><button data-camera="brow">眉区近景</button><button id="shot">截图</button>');
html=html.replace('</select></div><div class="control">', '</select></div><div class="control">');
html=html.replace('<option value="diffuse">', '<option value="browmask">眉区定位</option><option value="clay">仅看形态（无毛发）</option><option value="diffuse">');
html=html.replace('<script type="module" src="./app.js"></script>','<dialog id="mapsDialog"><button id="mapsClose">关闭</button><h2>当前表皮 · 实际材质通道</h2><p class="identity-note">贴图绑定到三维 UV；原 R02 的 4K 扫描中频与微孔贴图继续独立参与渲染。</p><div id="mapGallery" class="map-grid"></div></dialog><script type="module" src="./app.js"></script>');
fs.writeFileSync(root+'/app.js',js);fs.writeFileSync(root+'/index.html',html);
if(!process.argv.includes('--no-bundle')){
 const esbuild=require('esbuild'),old=path.resolve(root,'../r01');let code=esbuild.buildSync({stdin:{contents:js,resolveDir:root,loader:'js'},bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{'three':old+'/vendor/three.module.js','three/addons':old+'/vendor/addons'}}).outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
 new(require('vm').Script)(code);
 const ref=process.env.ASSET_COMMIT;if(!/^[a-f0-9]{40}$/.test(ref||''))throw Error('ASSET_COMMIT must be an immutable full commit SHA');
 const publicRoot='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+ref+'/skin-quality-lab/';
 let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');
 preview=preview.replaceAll('../r01/assets/',publicRoot+'r01/assets/').replaceAll('./assets/',publicRoot+'r02/assets/').replaceAll('../r01/vendor/',publicRoot+'r01/vendor/').replaceAll('./THIRD_PARTY.txt',publicRoot+'r02/THIRD_PARTY.txt');
 const publicScript=preview.match(/<script>([\s\S]*?)<\/script>/);if(!publicScript)throw Error('Public executable absent');new(require('vm').Script)(publicScript[1]);
 fs.writeFileSync(root+'/preview.html',preview);
 fs.writeFileSync(root+'/BUILD_MANIFEST_IDENTITIES.json',JSON.stringify({schema:'kaopu/skin-identity-build@1',version:'R02.4',baselineCommit:base,assetCommit:ref,sourceSHA256:crypto.createHash('sha256').update(js).digest('hex'),profiles:['porcelain','umber','weathered'],originalRetained:true,geometryChanged:'weathered reversible scan-age morph; neutral baseline exact',originalParametricBodyIntegrated:false,generatedPortraitsUsed:false},null,2));
}
console.log('R02.4 independent identity source built',Buffer.byteLength(js));

