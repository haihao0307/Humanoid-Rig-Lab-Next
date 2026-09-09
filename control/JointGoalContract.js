/* Bounded, auditable shoulder/elbow goals. Angle ranges are engineering limits,
 * not claims about every human's anatomy. No bind/topology/scale/mesh channels. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JarvisJointContract=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SCHEMA='jarvis/joint_goal@1.1',copy=x=>JSON.parse(JSON.stringify(x));
function number(text){const t=String(text).replace(/两/g,'二');if(/^\d+(?:\.\d+)?$/.test(t))return Number(t);const d={零:0,一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(!/^[零一二三四五六七八九十百]+$/.test(t))return NaN;let total=0,c=0;for(const k of t){if(k==='十'||k==='百'){total+=(c||1)*(k==='十'?10:100);c=0}else c=d[k]}return total+c;}
const maximum=s=>s.region==='elbow'?130:s.motion==='abduction'?90:120;
function validate(s){const errors=[];if(!s||typeof s!=='object'||Array.isArray(s))return{ok:false,errors:['关节目标结构无效']};
 for(const k of Object.keys(s))if(!['type','side','region','motion','angleDeg','duration','relative'].includes(k))errors.push('禁止关节协议外字段：'+k);
 if(s.type!=='joint_pose')errors.push('关节目标类型无效');if(!['left','right','both'].includes(s.side))errors.push('请明确左侧、右侧或双侧');if(!['shoulder','elbow'].includes(s.region))errors.push('当前开放肩臂和肘关节目标');if(!['flexion','abduction','rest'].includes(s.motion)||(s.region==='elbow'&&s.motion==='abduction'))errors.push('关节运动方向无效');
 if(s.relative!=null&&typeof s.relative!=='boolean')errors.push('相对角度标记无效');const max=maximum(s);if(!Number.isFinite(s.angleDeg)||s.angleDeg<(s.relative?-45:0)||s.angleDeg>(s.relative?45:max))errors.push(s.relative?'单次相对调整限制在正负 45 度':'本版工程范围为 0 至 '+max+' 度');if(s.motion==='rest'&&(s.angleDeg!==0||s.relative))errors.push('放下手臂目标必须为绝对零角度');if(!Number.isFinite(s.duration)||s.duration<.5||s.duration>10)errors.push('到位时间必须在 0.5 至 10 秒内');return{ok:!errors.length,errors};
}
function measured(context,side,region,motion){return context?.jointMotion?.angles?.[`${side}:${region}:${motion}`];}
function parse(text,ctx={}){
 let t=String(text).normalize('NFKC').replace(/\s/g,'').replace(/^(?:请|帮我|把|将|你|先)+/,'').replace(/(?:一下|吧|好吗|可以吗|好不好)$/,'');const assumptions=[],evidence=[];
 if(/^(?:为什么|怎么|如何|假如|如果)|(?:是什么意思|怎么做)$/.test(t))return null;
 if(ctx.staleMotionContext)return{error:'场景或身体状态已变化，请重新说明要调整哪只手以及方向。',code:'JOINT_CONTEXT_REQUIRED'};
 const last=ctx.lastMotion,active=ctx.jointMotion?.resolvedGoal;let side=/左(?:边|侧)?(?:的)?(?:手|臂|胳膊|肘)/.test(t)?'left':/右(?:边|侧)?(?:的)?(?:手|臂|胳膊|肘)/.test(t)?'right':/(?:双|两)(?:只|个|条)?(?:手|臂|胳膊|肘)/.test(t)?'both':null;
 let region=/肘|小臂|前臂/.test(t)?'elbow':/手|胳膊|手臂|平举/.test(t)?'shoulder':null;
 const inherited=/另一|另一个|另外一|换一|再|一点|一些|些|更|慢|快|刚才|刚刚|保持|放低|抬高|弯曲|伸直/.test(t);
 const bodyLike=side||region||/^(?:再)?(?:抬高|举高|放低|(?:低|高|慢|快)(?:一点|一些|些|点)|弯一点|弯曲一点|伸直一点|再来一次|重复刚才的动作)/.test(t);
 if(!bodyLike)return null;
 if(/不要|别|禁止|不许|不能/.test(t))return{error:'请明确要停止动作，还是对某个关节设置限制。',code:'JOINT_NEGATION_SCOPE'};
 if(/另一|另外一|换一/.test(t)){if(!last||last.side==='both')return{error:'“另一只手”需要先确定刚才使用的是左手还是右手。',code:'JOINT_CONTEXT_REQUIRED',slot:'side'};side=last.side==='left'?'right':'left';evidence.push('另一侧来自上一条已接受的手臂目标');}
 if(!side){side=ctx.clarifiedSide||(inherited?last?.side:null);if(side)evidence.push('左右侧来自本轮澄清或上一条手臂目标');}
 if(!region)region=last?.region||'shoulder';
 const onlyCopy=/^(?:换|换成|改成)?(?:另(?:外)?一(?:只|条|个)?(?:手|手臂|胳膊|边|侧))(?:也(?:这样|一样|来一次|抬起来)?)?$/.test(t)||/^(?:再来一次|重复刚才的动作)$/.test(t);
 const onlyTiming=/^(?:再|稍微)?(?:慢|快)(?:一点|一些|些|点)$/.test(t);
 if(onlyCopy||onlyTiming){if(!last)return{error:'需要先有一个明确的动作，才能沿用它调整速度或换边。',code:'JOINT_CONTEXT_REQUIRED'};
  const step=copy(active||last);step.type='joint_pose';if(onlyCopy){step.side=side||last.side;if(step.relative){const v=measured(ctx,last.side,last.region,last.motion);if(!Number.isFinite(v))return{error:'缺少上次动作的实际关节角度，请先指定一个绝对目标。',code:'JOINT_CONTEXT_REQUIRED'};step.angleDeg=v;delete step.relative;}}
  if(onlyTiming){step.duration=+Math.min(10,Math.max(.5,step.duration*(/慢/.test(t)?1.5:1/1.5))).toFixed(2);if(step.relative){const v=ctx.jointMotion?.lastResolvedGoal;if(v){step.angleDeg=v.angleDeg;delete step.relative;}else return{error:'缺少已解析的动作目标，请明确手臂角度。',code:'JOINT_CONTEXT_REQUIRED'};}assumptions.push('保持同一关节目标，通过到位时间调整速度');}
  return{step,assumptions,evidence,contextAfter:{lastMotion:copy(step)}};
 }
 let duration=/慢慢|缓慢|慢一点|慢些/.test(t)?3:/快一点|快些|快点/.test(t)?1:1.6;const tm=t.match(/(?:用|在)([零一二两三四五六七八九十百\d.]+)秒(?:内)?/);if(tm){duration=number(tm[1]);t=t.replace(tm[0],'');}
 t=t.replace(/慢慢地?|缓慢地?|稍微|稍稍|轻轻地?|快一点|慢一点|快些|慢些|轻一点/g,'');
 const verb=/抬|举|放下|放低|垂下|落下|弯|屈|伸直|伸展|展开|张开|平举|高一点|低一点|高一些|低一些|再高些|再低些|往上|向上|往下|向下/.test(t);
 if(!verb&&!onlyCopy)return null;
 if(!side)return{error:'你希望左手、右手，还是双手做这个动作？',code:'JOINT_SIDE_REQUIRED',slot:'side',choices:[{id:'left',name:'左手',text:'左手'},{id:'right',name:'右手',text:'右手'},{id:'both',name:'双手',text:'双手'}]};
 let motion=region==='elbow'?'flexion':/侧平举|侧面|侧方|向外|往外|展开|张开/.test(t)?'abduction':/放下|垂下|落下/.test(t)?'rest':last&&inherited&&last.region===region&&last.motion!=='rest'?last.motion:'flexion';
 let relative=/再|更|一点|一些|些/.test(t)&&!/抬起|举起|平举|放下|垂下|落下|弯到|到.*度|至.*度/.test(t);
 const down=/放低|往下|向下|低一点|低一些|低些|伸直一点|伸直一些/.test(t);if(down&&motion!=='rest')relative=true;
 const numeric=t.match(/([零一二两三四五六七八九十百\d.]+)度/);let angleDeg=numeric?number(numeric[1]):motion==='rest'?0:/肩(?:膀|部)?(?:一样高|齐平)|平举/.test(t)?90:region==='elbow'?90:90;
 if(/过头顶|头顶上|完全举过头|竖直举/.test(t))return{error:'已理解为手臂举过头顶。当前独立控制仅开放前举 120 度、侧举 90 度以内，暂不下发这个目标。',code:'JOINT_CAPABILITY_GAP',recognizedGoal:{side,region,motion:'overhead'}};
 if(relative){angleDeg=(numeric?angleDeg:/多|大一点|大一些/.test(t)?15:10)*(down?-1:1);assumptions.push(`“一点”按本版工程步长解释，本次相对调整 ${angleDeg} 度；基准取执行时实际姿态`);}
 else if(/伸直/.test(t)){angleDeg=0;motion='flexion';}
 else if(!numeric&&!/平举|一样高|齐平|放下|垂下|落下/.test(t)){if(/稍微|稍稍|轻轻|一点/.test(text))angleDeg=region==='elbow'?30:25;assumptions.push(`未给出精确角度，本次采用 ${angleDeg} 度的明确目标`);}
 // No unmatched direction, target, qualifier or action is silently discarded.
 let residue=t.replace(/(?:左|右)(?:边|侧)?(?:的)?|(?:双|两)(?:只|个|条)?|手肘|肘关节|手臂|胳膊|前臂|小臂|肘|臂|手|向前|往前|向侧面|向侧方|侧向|侧面|侧方|向外|往外|向上|往上|向下|往下|抬起来|举起来|抬起|举起|抬高|举高|放下|放低|垂下|落下|抬|举|弯曲|屈曲|弯|屈|伸直|伸展|展开|张开|侧平举|平举|高一点|低一点|高一些|低一些|高些|低些|与肩膀齐平|和肩膀一样高|肩膀一样高|肩膀齐平|到|至|再|更|一点|一些|些|多|大|小|了|起来|的|地|[零一二两三四五六七八九十百\d.]+度/g,'');
 if(residue)return{error:`已识别手臂目标，但“${residue}”还没有对应的可靠控制含义，请补充方向或幅度。`,code:'JOINT_UNKNOWN_MODIFIER',raw:residue};
 const step={type:'joint_pose',side,region,motion,angleDeg,duration,...(relative?{relative:true}:{})},check=validate(step);return check.ok?{step,assumptions,evidence,contextAfter:{lastMotion:copy(step)}}:{error:check.errors.join('；'),code:'JOINT_LIMIT'};
}
function describe(s){const side={left:'左',right:'右',both:'双'}[s.side],part=s.region==='elbow'?side+'肘':side+'手臂';return(s.relative?`${part}在实际姿态上${s.angleDeg<0?'减少':'增加'} ${Math.abs(s.angleDeg)} 度`:s.motion==='rest'?`放下${part}`:`${part}${s.region==='elbow'?'弯曲':s.motion==='abduction'?'侧向抬起':'向前抬起'}到 ${s.angleDeg} 度`)+`，${s.duration} 秒到位`;}
return{SCHEMA,parse,validate,describe,number,maximum,measured};
});
