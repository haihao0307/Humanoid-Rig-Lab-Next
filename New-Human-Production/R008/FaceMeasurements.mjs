import {referenceCoordinates,referencePointPixels} from './FaceLandmarks.mjs';
const rows=[];
const distance=(id,label,a,b,group)=>rows.push({id,label,a,b,group,type:'distance'});
const vertical=(id,label,a,b,group)=>rows.push({id,label,a,b,group,type:'vertical'});
distance('eyeSpacing','两眼中心间距','pupilLeft','pupilRight','整体');
distance('faceWidth','颧部宽','cheekLeft','cheekRight','轮廓');
distance('templeWidth','太阳穴宽','templeLeft','templeRight','轮廓');
distance('jawWidth','下颌宽','jawLeft','jawRight','轮廓');
distance('chinWidth','下巴宽（轮廓 6–12）','contour5','contour11','轮廓');
vertical('faceHeight','发际线至下巴','hairlineCentre','contour8','整体');
vertical('upperThird','上庭（发际线–眉间）','hairlineCentre','glabella','整体');
vertical('middleThird','中庭（眉间–鼻底）','glabella','noseBase2','整体');
vertical('lowerThird','下庭（鼻底–下巴）','noseBase2','contour8','整体');
for(const side of ['Left','Right']){const name=side==='Left'?'左':'右';distance('eyeWidth'+side,name+'眼裂宽','eye'+side+'0','eye'+side+'3','眼');vertical('eyeHeight'+side,name+'眼裂高（中段）','eye'+side+'1','eye'+side+'5','眼');vertical('browDistance'+side,name+'眉眼间距','brow'+side+'2','pupil'+side,'眉');distance('browLength'+side,name+'眉区长度','brow'+side+'0','brow'+side+'4','眉');rows.push({id:'eyeTilt'+side,label:name+'眼角倾斜',a:'eye'+side+'0',b:'eye'+side+'3',group:'眼',type:'tilt',sign:side==='Left'?1:-1});}
distance('innerCanthusDistance','内眼角间距','eyeLeft0','eyeRight0','眼');
distance('noseWidth','鼻翼宽','noseBase0','noseBase4','鼻');
vertical('noseLength','鼻根至鼻底','bridge0','noseBase2','鼻');
distance('mouthWidth','口宽','lipOuter0','lipOuter6','口');
vertical('upperLip','上唇中段厚度','lipOuter3','lipInner2','口');
vertical('lowerLip','下唇中段厚度','lipInner6','lipOuter9','口');
vertical('philtrum','鼻底至上唇','noseBase2','lipOuter3','口');
vertical('chinLength','下唇至下巴','lipOuter9','contour8','轮廓');
export const FACE_MEASURES=Object.freeze(rows);
export const FACE_COMPARISON_CAMERA=Object.freeze({fovDegrees:22,target:[0,1.645,.055],distanceMetres:.95,projection:'perspective',pose:'neutral/frontal',leftRight:'subject +X = image right'});
export function projectCanonical(point){const depth=1.005-point[2];return [point[0]/depth,(1.645-point[1])/depth];}
export function measurementRows(landmarks,reference=null,project=projectCanonical){
 const byId=Object.fromEntries(landmarks.filter(p=>p.point).map(p=>[p.id,p])),projected=Object.fromEntries(Object.entries(byId).map(([id,p])=>[id,project(p.point)])),coordinates=referenceCoordinates(projected);
 let target=null;try{if(reference)target=referenceCoordinates(referencePointPixels(reference));}catch{}
 function read(d,p){if(!p[d.a]||!p[d.b])return null;const a=p[d.a],b=p[d.b];return d.type==='vertical'?Math.abs(a[1]-b[1]):d.type==='tilt'?Math.atan2(-(b[1]-a[1])*d.sign,Math.abs(b[0]-a[0]))*180/Math.PI:Math.hypot(a[0]-b[0],a[1]-b[1]);}
 return FACE_MEASURES.map(d=>{const a=byId[d.a],b=byId[d.b],actual=a&&b?(d.type==='vertical'?Math.abs(a.point[1]-b.point[1])*1000:d.type==='tilt'?read(d,coordinates):Math.hypot(...a.point.map((x,k)=>x-b.point[k]))*1000):null,ratio=read(d,coordinates),goal=target?read(d,target):null,confidence=a&&b?Math.min(a.confidence,b.confidence):0;
  return {...d,actual,unit:d.type==='tilt'?'°':'mm',ratio,target:goal,error:goal!==null&&ratio!==null?ratio-goal:null,confidence,referenceConfidence:reference?.landmarks[d.a]&&reference?.landmarks[d.b]?Math.min(reference.landmarks[d.a].confidence,reference.landmarks[d.b].confidence):null};});
}
