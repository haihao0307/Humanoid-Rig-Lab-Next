import {createFemaleProjection} from './PhotoProjection.mjs';

// Observation-only experiment. The fitted procedural field is a separate
// artifact and must be retrained against any changed observation target.
export async function createFemaleProjectionFeatureMaskR03(gl){
 const [base,response,sideResponse]=await Promise.all([createFemaleProjection(gl),fetch('./side-feature-exclusion-r03.json'),fetch('./side-projection-parameters.json')]);
 if(!response.ok||!sideResponse.ok)throw Error('侧面眼眉遮罩记录不可用');
 const record=await response.json(),sideRecord=await sideResponse.json();
 if(record.schema!=='human.female.generated-side-feature-mask/3'||record.accepted!==false||JSON.stringify(record.featherPixels)!=='[2,8]')throw Error('侧面眼眉遮罩版本不匹配');
 const num=n=>Number(n).toPrecision(10);
 function polygon(name,kind){
  const item=record.sides?.[name],side=sideRecord.maps?.[name],hull=item?.hulls?.[kind];
  if(!item||item.reference!==side?.reference||item.referenceSHA256!==side?.referenceSHA256||!Array.isArray(item.dimensions)||item.dimensions.length!==2||item.dimensions.some(x=>!Number.isInteger(x)||x<=0)||!Array.isArray(hull)||hull.length<3||hull.length>64||hull.some(p=>!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)||x<0||x>1)))throw Error('侧面眼眉遮罩来源或范围无效');
  const points=hull.map(p=>`vec2(${num(p[0])},${num(p[1])})`).join(','),n=hull.length,scale=item.dimensions.map(num).join(',');
  return `float femFeatureOutside${name}${kind}(vec2 p){const vec2 points[${n}]=vec2[${n}](${points});vec2 scale=vec2(${scale});bool inside=false;float distancePX=1e6;for(int i=0;i<${n};i++){vec2 a=points[i],b=points[(i+1)%${n}],ab=(b-a)*scale,ap=(p-a)*scale;float t=clamp(dot(ap,ab)/max(dot(ab,ab),1e-9),0.,1.);distancePX=min(distancePX,length(ap-t*ab));if(((a.y>p.y)!=(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;}return inside?0.:smoothstep(2.,8.,distancePX);}`;
 }
 const helper=`uniform float u_femCoverageFix;\n${polygon('positive','eye')}\n${polygon('positive','brow')}\n${polygon('negative','eye')}\n${polygon('negative','brow')}\n`;
 function maskExpression(name){const c=record.sides[name].browConfidence;if(!c||!Number.isInteger(c.threshold8bit)||c.threshold8bit<0||c.threshold8bit>247||c.transition8bit!==8)throw Error('眉部参考置信度无效');return `femFeatureOutside${name}eye(su)*mix(smoothstep(${num(c.threshold8bit/255)},${num((c.threshold8bit+8)/255)},sideSample.r),1.,femFeatureOutside${name}brow(su))`;}
 function fragment(source){
  let result=base.fragment(source);const declaration='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;',positive='femOutsideEllipse(su,vec2(.340,.477),vec2(.105,.077))',negative='femOutsideEllipse(su,vec2(.650,.486),vec2(.105,.077))';
  if(result.split(declaration).length!==2||result.split(positive).length!==2||result.split(negative).length!==2)throw Error('侧面观察遮罩接口改变');
  result=result.replace(declaration,helper+declaration).replace(positive,`mix(${positive},${maskExpression('positive')},u_femCoverageFix)`).replace(negative,`mix(${negative},${maskExpression('negative')},u_femCoverageFix)`);
  return result;
 }
 return {...base,fragment,report:()=>({...base.report(),eyeMask:'landmark-eye-and-image-derived-brow-confidence-study',eyeMaskAccepted:false})};
}
