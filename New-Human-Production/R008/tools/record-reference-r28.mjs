// Manual visible-image observations in native pixels, never a model texture.
import fs from 'node:fs';
import {normalizeReference} from '../FaceLandmarks.mjs';
const points={
 pupilRight:[119,163,.95],pupilLeft:[198,161,.95],
 eyeRight0:[139,164,.85],eyeRight1:[130,159,.8],eyeRight2:[111,159,.8],eyeRight3:[101,163,.85],eyeRight4:[111,166,.8],eyeRight5:[130,166,.8],
 eyeLeft0:[178,164,.85],eyeLeft1:[188,158,.8],eyeLeft2:[205,156,.8],eyeLeft3:[215,160,.85],eyeLeft4:[205,163,.8],eyeLeft5:[188,165,.8],
 browRight0:[143,151,.85],browRight1:[132,145,.85],browRight2:[120,143,.85],browRight3:[106,142,.8],browRight4:[94,147,.75],
 browLeft0:[172,151,.85],browLeft1:[183,147,.85],browLeft2:[196,144,.85],browLeft3:[210,144,.8],browLeft4:[222,146,.75],
 bridge0:[157,153,.8],bridge1:[157,174,.65],bridge2:[157,193,.65],bridge3:[158,209,.8],
 noseBase0:[140,213,.85],noseBase1:[149,218,.85],noseBase2:[158,222,.85],noseBase3:[168,218,.85],noseBase4:[177,213,.85],
 lipOuter0:[129,245,.85],lipOuter1:[139,241,.85],lipOuter2:[150,238,.85],lipOuter3:[158,240,.85],lipOuter4:[167,238,.85],lipOuter5:[179,241,.85],lipOuter6:[189,245,.85],
 lipOuter7:[178,252,.85],lipOuter8:[167,255,.85],lipOuter9:[158,256,.85],lipOuter10:[149,255,.85],lipOuter11:[138,251,.85],
 lipInner0:[133,245,.7],lipInner1:[147,245,.8],lipInner2:[158,246,.85],lipInner3:[171,245,.8],lipInner4:[185,245,.7],lipInner5:[171,247,.65],lipInner6:[158,248,.65],lipInner7:[146,247,.65],
 cheekRight:[80,188,.8],cheekLeft:[234,187,.8],jawRight:[107,255,.8],jawLeft:[207,255,.8],
 contour0:[79,186,.8],contour1:[84,205,.8],contour2:[92,226,.8],contour3:[101,246,.8],contour4:[111,261,.8],contour5:[124,276,.8],contour6:[135,287,.8],contour7:[146,296,.8],contour8:[158,300,.9],
 contour9:[171,296,.8],contour10:[183,287,.8],contour11:[195,276,.8],contour12:[205,261,.8],contour13:[215,246,.8],contour14:[224,226,.8],contour15:[231,205,.8],contour16:[234,186,.8],
 hairlineCentre:[155,75,.45],hairlineRight:[103,94,.25],hairlineLeft:[211,89,.25],glabella:[158,149,.85]
};
const reference=normalizeReference({schema:'human/face-reference@1',kind:'image-observation',image:{width:292,height:438,name:'user-reference-20261004.webp'},landmarks:Object.fromEntries(Object.entries(points).map(([id,[x,y,confidence]])=>[id,{xy:[x/292,y/438],confidence,visible:true}])),notes:'助手按用户原图人工记录，像素读数约 ±2–4 px；细小眼缘/内唇约 ±1–2 px。左右按人物自身。两眼中心校正图片平面内倾斜；轻微转头、透视、光影不能完全排除。轮廓对应为语义近似，发际线遮挡降低可信度；耳与太阳穴被头发遮挡，不参与。照片深度、绝对尺寸、内部组织未知。'});
const session={schema:'human/face-reference-session@1',id:'user-reference-r28',status:'reference-recorded',reference,recipe:null,fit:null,imageURL:'./face-reference-image',observation:{method:'manual-native-pixel-landmarks',pixelUncertainty:[2,4],imageInputOnly:true,depth:'NotObserved',absoluteScale:'NotObserved'}};
session.eyeAppearance=Object.fromEntries(['Left','Right'].map(side=>[side,{irisDiameterRatio:11/Math.hypot(79,2),pupilDiameterRatio:5/Math.hypot(79,2)}]));
session.observation.eyes={irisHorizontalDiameterPixels:{Left:11,Right:11},pupilHorizontalDiameterPixels:{Left:5,Right:5},confidence:.55,uncertaintyPixels:2,shape:'horizontal extent observed; circular tangent-plane pigment assumed',colour:'NotObserved under photographed illumination'};
fs.writeFileSync(new URL('../face-reference.json',import.meta.url),JSON.stringify(session,null,2)+'\n');
console.log(JSON.stringify({points:Object.keys(points).length,width:292,height:438}));
