/* Jarvis compositional language planner v1.3.0. No motion or model weights here.
 * Output is an auditable semantic tree. Unknown or ambiguous input never partially executes.
 * Both local grammar and optional model proposals pass the same validator.
 */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./SceneGrounding.js'):root.JarvisSceneGrounding,typeof module==='object'&&module.exports?require('../control/JointGoalContract.js'):root.JarvisJointContract,typeof module==='object'&&module.exports?require('./ContextualUnderstanding.js'):root.JarvisContextualUnderstanding);if(typeof module==='object'&&module.exports)module.exports=api;else root.JarvisLanguage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Scene,Joint,Contextual){
'use strict';
const VERSION='1.13.0',SCHEMA='jarvis/semantic_plan@1.0';
const SKILLS=Object.freeze({joint_pose:'pose_arm',walk:'walk_to_region',carry:'carry_object',push:'push_object',sit:'sit_ground',lie:'lie_ground',stand:'stand_up',greet:'greet',wave:'wave',salute:'salute'});
const LABEL={walk:'走到',carry:'搬运',push:'推动',sit:'坐在地上',lie:'躺下',stand:'起身',greet:'打招呼',wave:'挥手',salute:'敬礼',wait:'等待',observe:'读取场景'};
const SHAPES={box:['长方体','箱子','箱','方块','立方体','盒子','工具箱','box','cube'],sphere:['球体','球','圆球','sphere','ball'],cylinder:['圆柱体','圆柱','柱子','柱体','cylinder'],cone:['圆锥体','圆锥','锥体','cone'],prism:['三棱柱','棱柱','prism'],square:['正方形','方形'],circle:['圆形','圆圈'],hexagon:['六边形','六角形']};
const COLOR_WORDS={red:['红色','红','red'],blue:['蓝色','蓝','blue'],yellow:['黄色','黄','yellow'],green:['绿色','绿','green'],purple:['紫色','紫','purple'],orange:['橙色','橙','orange'],white:['白色','白','white'],black:['黑色','黑','black']};
const PALETTE={red:[.88,.16,.2],blue:[.18,.48,.88],yellow:[.92,.72,.14],green:[.15,.65,.4],purple:[.66,.24,.76],orange:[.95,.43,.12],white:[.88,.9,.92],black:[.08,.1,.13]};
const SYNONYMS=[[/敬个礼|行个礼|敬一礼|敬礼一下|行礼/g,'敬礼'],[/挥挥手|挥一下手|招招手|招手/g,'挥手'],[/打个招呼|问个好|问好/g,'打招呼'],[/站起来|站起身|起立|站起|站好|起身站立/g,'起身'],[/坐下来|坐地上|坐到地上|在地上坐下/g,'坐下'],[/躺下来|平躺下来|仰卧|平躺/g,'躺下'],[/移动到|挪到|挪去|送至|送到|拿到|抱到|运到|搬运到|移到|搬去|放置到|放置在|放进|放入/g,'搬到'],[/推入|推进|推至|推去/g,'推到'],[/靠近|前往|走向|到达|来到/g,'走到'],[/一号区|第一区|第1区|一区/g,'Z1'],[/二号区|第二区|第2区|二区/g,'Z2'],[/三号区|第三区|第3区|三区/g,'Z3'],[/四号区|第四区|第4区|四区/g,'Z4']];
const clone=v=>JSON.parse(JSON.stringify(v));
const norm=v=>String(v||'').normalize('NFKC').trim();
const compact=v=>norm(v).replace(/\s+/g,'').toLowerCase();
const id=()=>`plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const num=s=>{const n={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};return n[s]??Number(s)};
function normalize(v){let t=norm(v).replace(/[？！!?]+$/,'').replace(/賈維斯/g,'贾维斯').replace(/^(?:贾维斯|jarvis)[,，:：\s]*/i,'');for(const [re,s]of SYNONYMS)t=t.replace(re,s);return t.replace(/第?(\d+)号?区/g,(_,n)=>'Z'+n).trim()}
function worldData(world){const w=world?.world||world||{};return{...w,objects:w.objects||[],zones:w.zones||[],revision:w.revision??0}}
function colorOf(e){let c=e.color;let named='';const name=String(e.name||'');for(const[k,a]of Object.entries(COLOR_WORDS))if(a.filter(w=>w.length>1).some(w=>name.includes(w))){named=k;break}if(typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))c=[1,3,5].map(k=>parseInt(c.slice(k,k+2),16)/255);if(!Array.isArray(c))return named;let best='',d=Infinity;const distance=p=>c.reduce((s,x,i)=>s+(x-p[i])**2,0);for(const[k,p]of Object.entries(PALETTE)){const v=distance(p);if(v<d){best=k;d=v}}return named&&distance(PALETTE[named])<=d+.12?named:best}
function wordsIn(t,dict){return Object.entries(dict).filter(([_,a])=>a.some(w=>t.includes(w))).map(([k])=>k)}
class UnderstandingError extends Error{constructor(code,message,detail={}){super(message);this.code=code;this.detail=detail}}
function problem(code,message,detail){throw new UnderstandingError(code,message,detail)}
function sanitizeRef(t){return normalize(t).replace(/^(?:把|将|那个|这个|那一个|这一个|一个|那只|这只|那块|这块|那件|这件|一下|先|请)+/g,'').replace(/(?:的那个|的那一个|的这个|里面|之内|里边|以内|这里|那里|那儿|这儿|那边|去|吧|一下|呢|啊)+$/g,'').trim()}
function candidateView(e){return{id:e.id,name:e.name,shape:e.shape,position:e.p,color:colorOf(e)}}
function resolveReference(raw,world,context={},options={}){
 const w=worldData(world),kind=options.kind||'any';let t=/^(它|这个|那个|那里|这里|那儿|这儿)$/.test(raw.trim())?raw.trim():sanitizeRef(raw),pool=kind==='object'?w.objects:kind==='zone'?w.zones:[...w.objects,...w.zones];
 if(!t)problem('MISSING_REFERENCE',kind==='object'?'需要操作哪个物体？':'目标位置在哪里？',{slot:options.slot,raw});
 if(/^(?:它|该物体|刚才的物体|刚才那个|刚刚那个|刚才那个物体|这件|那件|这个|那个)$/.test(t)){
  const ref=context.lastObject;const e=pool.find(e=>e.id===ref);if(e)return[e];problem('MISSING_CONTEXT','“它”还没有明确指代，请说出物体名称或编号。',{slot:options.slot,raw})}
 if(/^(?:那里|那儿|这儿|这里|刚才那里|刚才的位置|该区域|那个区域|上一个区域)$/.test(raw.trim())){const e=pool.find(e=>e.id===context.lastTarget);if(e)return[e];problem('MISSING_CONTEXT','还没有可确认的目标位置，请指定一个区域。',{slot:options.slot,raw})}
 if(/屏幕|镜头|你的左|你的右|你左|你右|我旁边|我的|给我|我这里|我这儿/.test(t))problem('UNAVAILABLE_FRAME','当前只有人物自身坐标和场景坐标。请明确说“人物左侧”或使用场景实体名称。',{raw});
 // Explicit IDs always use boundaries. An English word containing A is never an object reference.
 const ids=pool.filter(e=>new RegExp('(^|[^a-z0-9_])'+e.id+'($|[^a-z0-9_])','i').test(t));
 if(ids.length===1)return ids;
 if(ids.length>1){if(options.multiple)return ids;problem('AMBIGUOUS','这段描述同时包含多个对象，请选一个。',{slot:options.slot,raw,candidates:ids.map(candidateView)})}
 const excludes=[];t=t.replace(/除了(.+?)(?:以外|之外|外)/g,(_,s)=>{excludes.push(s);return''}).replace(/(?:除外|都|全部|所有|每个|每一个|各个|逐个|依次|其余|剩余|其他)/g,'').trim();
 const ct=compact(t),exact=pool.filter(e=>[e.name,...(e.aliases||[])].some(a=>a&&compact(a)===ct));
 let descriptor=ct;for(const word of [...Object.values(COLOR_WORDS).flat(),...Object.values(SHAPES).flat()].sort((a,b)=>b.length-a.length))descriptor=descriptor.split(word).join('');descriptor=descriptor.replace(/小|大|的|色|物体|东西|物品/g,'');let matches=descriptor===''?[]:exact;
 if(!matches.length){
  const colors=wordsIn(ct,COLOR_WORDS),shapes=wordsIn(ct,SHAPES);let hasConstraint=colors.length||shapes.length;
  matches=pool.filter(e=>(!colors.length||colors.includes(colorOf(e)))&&(!shapes.length||shapes.includes(e.shape)));
  if(/可搬|可动|能搬/.test(t)){matches=matches.filter(e=>e.movable!==false);hasConstraint=true}
  if(/固定|障碍/.test(t)){matches=matches.filter(e=>e.movable===false||e.category==='obstacle');hasConstraint=true}
  const longest=pool.flatMap(e=>[e.name,...(e.aliases||[])].filter(a=>a&&a.length>1&&ct.includes(compact(a))).map(a=>({e,len:a.length}))).sort((a,b)=>b.len-a.len);
  if(longest.length&&!colors.length&&!shapes.length){const max=longest[0].len;matches=[...new Map(longest.filter(v=>v.len===max).map(v=>[v.e.id,v.e])).values()];hasConstraint=true}
  if(!hasConstraint&&!/物体|东西|物品|目标|最近|最远|左边|右边|左侧|右侧|前面|后面|最大|最小/.test(t))matches=[];
  // Unknown descriptor words must not be silently ignored by a broad shape match.
  let residue=ct;for(const a of [...Object.values(COLOR_WORDS).flat(),...Object.values(SHAPES).flat()].sort((a,b)=>b.length-a.length))residue=residue.split(a).join('');
  residue=residue.replace(/距离|离|人物|智能人|身体|最近|最远|最大|最小|最左边|最右边|最左|最右|左边|右边|左侧|右侧|前面|后面|可搬运|可搬|可动|能搬|固定|障碍|的|色|物体|东西|物品|目标|我|所有|全部|其余|剩余|其他|小|大|第[一二三四五六七八九十\d]+个/g,'');
  if(residue&&!longest.some(v=>compact(v.e.name)===ct)&&!exact.length)matches=[];
 }
 for(const x of excludes){const ex=resolveReference(x,w,context,{kind,multiple:true});matches=matches.filter(e=>!ex.some(v=>v.id===e.id))}
 if(options.excludeIds)matches=matches.filter(e=>!options.excludeIds.includes(e.id));
 const pos=context.position||[0,0,1.75],distance=e=>Math.hypot(e.p[0]-pos[0],e.p[2]-pos[2]);
 if(matches.length>1&&/最近|最远|最大|最小|最左|最右|左边|右边/.test(t)){
  let fn=distance,sign=1;if(/最远/.test(t))sign=-1;if(/最大|最小/.test(t)){fn=e=>(e.w||e.r*2||1)*(e.h||1)*(e.d||e.r*2||1);sign=/最大/.test(t)?-1:1}if(/最左|左边/.test(t))fn=e=>e.p[0];if(/最右|右边/.test(t)){fn=e=>e.p[0];sign=-1}
  matches.sort((a,b)=>sign*(fn(a)-fn(b)));if(Math.abs(fn(matches[0])-fn(matches[1]))<.025)problem('AMBIGUOUS','有两个对象同样符合这项位置或尺寸描述，请补充颜色或编号。',{slot:options.slot,raw,candidates:matches.slice(0,5).map(candidateView)});matches=matches.slice(0,1)
 }
 const ordinal=t.match(/第([一二三四五六七八九十\d]+)个/);if(ordinal&&matches.length>1)problem('ORDER_UNSPECIFIED','需要先明确排序依据，或直接选择物体编号。',{slot:options.slot,raw,candidates:matches.map(candidateView)})
 if(!matches.length){if(options.allowNone)return[];problem('NOT_FOUND',`场景中找不到“${raw}”。请检查名称、颜色或是否已添加该物体。`,{slot:options.slot,raw})}
 if(matches.length>1&&!options.multiple)problem('AMBIGUOUS',`“${raw}”对应 ${matches.length} 个对象，请说明你指哪一个。`,{slot:options.slot,raw,candidates:matches.slice(0,8).map(candidateView)});
 return matches;
}
function flatten(nodes){return(Array.isArray(nodes)?nodes:[]).filter(n=>n&&typeof n==='object').flatMap(n=>n.kind==='condition'?[...flatten(n.then),...flatten(n.else)]:n.kind==='action'?[n]:[])}
function predicateValue(p,w,c={}){w=worldData(w);const entities=[...w.objects,...w.zones];if(p.type==='exists')return p.ids.some(id=>entities.some(e=>e.id===id));if(p.type==='inside'){const o=entities.find(e=>e.id===p.objectId),z=entities.find(e=>e.id===p.targetId);if(!o||!z)return false;const dx=Math.abs(o.p[0]-z.p[0]),dz=Math.abs(o.p[2]-z.p[2]),r=o.r||0;return z.shape==='square'?dx+r<=z.r&&dz+r<=z.r:Math.hypot(dx,dz)+r<=z.r*(z.shape==='hexagon'?Math.cos(Math.PI/6):1)}if(p.type==='movable')return !!w.objects.find(e=>e.id===p.objectId&&e.movable!==false);if(p.type==='posture')return c.posture===p.value;throw Error('不支持的条件')}
function describeStep(s,w){if(s.type==='joint_pose')return Joint.describe(s);const all=[...worldData(w).objects,...worldData(w).zones],name=id=>{const e=all.find(e=>e.id===id);return e?`${e.name}（${id}）`:id};const relation={inside:'内',near:'旁边',left:'左侧',right:'右侧',front:'前侧',behind:'后侧'}[s.relation]||'';if(s.type==='wait')return`等待 ${s.duration} 秒`;if(s.type==='observe')return'读取当前场景并汇报';return`${LABEL[s.type]||s.type}${s.objectId?' '+name(s.objectId):''}${s.targetId?(s.objectId?' 到 ':' ')+name(s.targetId)+relation:''}${s.duration?'，持续 '+s.duration+' 秒':''}`}
function renderSummary(nodes,w){return(nodes||[]).map(n=>n.kind==='condition'?`检查条件“${n.label}”，成立时：${renderSummary(n.then,w).join('，')}；否则：${renderSummary(n.else,w).join('，')||'跳过'}`:describeStep(n.step,w))}
function validatePlan(plan,world,capabilities){
 const errors=[],w=worldData(world),all=[...w.objects,...w.zones],available=new Set((capabilities?.semanticSkills||[]).map(s=>s.id));let count=0;
 const err=s=>errors.push(s);const keys=(o,allowed)=>{if(!o||typeof o!=='object'||Array.isArray(o)){err('对象结构无效');return}for(const k of Object.keys(o))if(!allowed.includes(k))err('不允许的字段：'+k)};
 keys(plan.constraints||{},['protectedIds','collisionAvoidance','forbiddenActions']);if(plan.constraints?.collisionAvoidance===false)err('不能关闭碰撞约束');if(plan.constraints?.protectedIds&&!Array.isArray(plan.constraints.protectedIds))err('保护对象列表无效');if(plan.constraints?.forbiddenActions&&!Array.isArray(plan.constraints.forbiddenActions))err('禁止动作列表无效');
 function walk(nodes,depth=0){if(!Array.isArray(nodes)||depth>4){err('计划嵌套或结构无效');return}for(const n of nodes){if(!n||typeof n!=='object'||Array.isArray(n)){err('节点结构无效');continue}if(++count>64){err('计划超过 64 个节点');return}if(n.kind==='condition'){keys(n,['kind','id','predicate','then','else','label']);const p=n.predicate||{};keys(p,['type','ids','objectId','targetId','value','negate']);if(!['exists','inside','movable','posture'].includes(p.type))err('条件类型不支持');if(p.negate!=null&&typeof p.negate!=='boolean')err('条件否定标记无效');if(p.type==='posture'&&!['standing','sitting','lying'].includes(p.value))err('姿势条件无效');if(p.type==='exists'&&(!Array.isArray(p.ids)||p.ids.some(v=>typeof v!=='string')))err('条件对象列表无效');if(['inside','movable'].includes(p.type)&&!w.objects.some(e=>e.id===p.objectId))err('条件物体不存在');if(p.type==='inside'&&!w.zones.some(e=>e.id===p.targetId))err('条件区域不存在');walk(n.then,depth+1);walk(n.else,depth+1);continue}
 if(n.kind!=='action'){err('仅允许语义动作或条件节点');continue}keys(n,['kind','id','step','label','source','status']);const s=n.step||{};if(s.type==='joint_pose'){if(plan.constraints?.forbiddenActions?.includes(s.type))err('关节动作与本计划禁止动作冲突');const jv=Joint.validate(s);errors.push(...jv.errors);if(!available.has('pose_arm'))err('身体尚未声明肩肘目标能力');continue;}keys(s,['type','objectId','targetId','relation','referenceFrame','duration']);if(!Object.hasOwn(SKILLS,s.type)&&!['wait','observe'].includes(s.type))err('身体没有该动作：'+s.type);
 if(SKILLS[s.type]&&!available.has(SKILLS[s.type]))err('能力清单缺少：'+SKILLS[s.type]);
 if(['walk','carry','push'].includes(s.type)&&!all.some(e=>e.id===s.targetId))err('目标不存在：'+s.targetId);
 if(['carry','push'].includes(s.type)){const o=w.objects.find(e=>e.id===s.objectId);if(!o)err('操作物体不存在：'+s.objectId);else if(o.movable===false)err(o.name+'是固定环境，不能搬动');if(s.objectId===s.targetId)err('物体与目标不能相同')}
 if(s.relation&&!['inside','near','left','right','front','behind'].includes(s.relation))err('位置关系无效');if(s.referenceFrame&&!['world','self'].includes(s.referenceFrame))err('参考坐标系无效');if(s.duration!=null&&(!Number.isFinite(s.duration)||s.duration<.1||s.duration>30))err('持续时间必须为 0.1 到 30 秒');if(s.type==='wait'&&s.duration==null)err('等待需要时长');if(s.duration!=null&&['wave','greet','salute'].includes(s.type)&&(s.duration<1.2||s.duration>20))err('身体手势支持 1.2 到 20 秒');if(s.duration!=null&&!['wait','wave','greet','salute'].includes(s.type))err('该动作不支持指定持续时间');
 if(Array.isArray(plan.constraints?.forbiddenActions)&&plan.constraints.forbiddenActions.includes(s.type))err('计划违反禁止动作：'+s.type);if(Array.isArray(plan.constraints?.protectedIds)&&plan.constraints.protectedIds.includes(s.objectId))err('计划违反不移动该物体的限制：'+s.objectId);
 }}
 walk(plan.nodes||[]);return{ok:errors.length===0,errors,nodeCount:count,requiredCapabilities:[...new Set(flatten(plan.nodes).map(n=>SKILLS[n.step?.type]).filter(Boolean))]};
}
class Planner{
 constructor(){this.context={lastObject:null,lastTarget:null,position:[0,0,1.75],yaw:0,posture:'standing'};this.pending=null;this.lastPlan=null}
 reset(){this.context={lastObject:null,lastTarget:null,position:[0,0,1.75],yaw:0,posture:'standing'};this.pending=null;this.lastPlan=null}
 accept(plan){this.lastPlan=clone(plan);Object.assign(this.context,plan.contextAfter||{});this.pending=null}
 compile(input,world,capabilities,options={}){
  const w=worldData(world),source=norm(input),ctx={...this.context,...options.context},plan={schema:SCHEMA,id:id(),sourceText:source,worldRevision:w.revision,sceneId:w.sceneId,engine:'local-compositional',status:'ready',mode:options.mode==='append'?'append':'replace',nodes:[],constraints:{protectedIds:[],collisionAvoidance:true,forbiddenActions:[]},grounding:[],assumptions:[],questions:[],control:null,response:'',contextAfter:null};
  let t=normalize(source).replace(/(?:告诉我|说说|汇报)(?:一下)?(?:你)?(?:看到|看见)(?:了)?(?:什么|的东西)/g,'观察周围');const bindings=options.bindings||{};let seq=0;
  const action=s=>({kind:'action',id:'step_'+(++seq),step:s});
  const ref=(s,kind,slot,multi=false,allowNone=false)=>{const chosen=bindings[s];const r=resolveReference(chosen||s,w,ctx,{kind,slot,multiple:multi,allowNone,excludeIds:kind==='object'?plan.constraints.protectedIds:[]});plan.grounding.push({text:s,ids:r.map(e=>e.id),kind,evidence:'current_world_snapshot'});return r};
  const target=(s)=>{if(/^(那里|这里|那儿|这儿)$/.test(s.trim())){const e=ref(s.trim(),'any','target')[0];ctx.lastTarget=e.id;return{targetId:e.id,relation:e.id.startsWith('Z')?'inside':'near',referenceFrame:'world'}}let rel=/左(?:边|侧)/.test(s)?'left':/右(?:边|侧)/.test(s)?'right':/前(?:面|侧|方)/.test(s)?'front':/后(?:面|侧|方)/.test(s)?'behind':/旁边|附近|边上/.test(s)?'near':null;const frame=/人物|自身|身体/.test(s)?'self':'world';const raw=s.replace(/(?:人物|自身|身体)(?:的)?/g,'').replace(/(?:的)?(?:左边|左侧|右边|右侧|前面|前侧|前方|后面|后侧|后方|旁边|附近|边上|里面|里边|之内|内|里|中|去|吧)$/g,'');const e=ref(raw,'any','target')[0];ctx.lastTarget=e.id;return{targetId:e.id,relation:rel||(e.id.startsWith('Z')?'inside':'near'),referenceFrame:frame}};
  const parseCondition=raw=>{let s=raw.trim().replace(/^(?:当前|现在|场景中|场内|场景里)/,'');if(/^(?:有|存在)/.test(s)){const r=ref(s.replace(/^(?:有|存在)/,''),'object','condition',true,true);return{type:'exists',ids:r.map(e=>e.id)}}const m=s.match(/^(.+?)(不在|没有在|在|已经在)(.+?)(?:里面|里|内|中)?$/);if(m){const o=ref(m[1],'object','condition')[0],z=ref(m[3],'zone','condition')[0];return{type:'inside',objectId:o.id,targetId:z.id,negate:/不|没有/.test(m[2])}}if(/坐着|坐下|坐姿/.test(s))return{type:'posture',value:'sitting'};if(/躺着|躺下|躺姿/.test(s))return{type:'posture',value:'lying'};problem('UNKNOWN_CONDITION','这项条件缺少可验证的场景数据，请改用物体是否存在或是否位于区域内。',{raw})};
  const parseSequence=(raw,depth=0)=>{
   if(depth>3)problem('COMPLEXITY','这条指令嵌套太深，请分成几轮说明。');let s=raw.trim();
   const cond=s.match(/^如果(.+?)(?:[，,]\s*)?(?:那么|就)(.+)$/);if(cond){let [yes,no='']=cond[2].split(/[，,;；]?\s*否则/,2);const p=parseCondition(cond[1]);const before={...ctx};const thenNodes=parseSequence(yes,depth+1);Object.assign(ctx,before);const elseNodes=no?parseSequence(no,depth+1):[];Object.assign(ctx,before);return[{kind:'condition',id:'condition_'+(++seq),label:cond[1],predicate:p,then:thenNodes,else:elseNodes}]}
   if(/如果|除非|直到|一边|同时|边走边|明天|后天/.test(s))problem('UNSUPPORTED_COMPOSITION','当前本地理解器尚未覆盖这种条件、并行动作或定时表达，已保留完整原句等待澄清。',{raw:s});
   s=s.replace(/(?:做完(?:当前|这个|这些)?(?:任务|动作)?(?:之后|以后|后)?|完成(?:当前|这个)?任务(?:之后|以后|后)?)/g,'').replace(/(?:之后|以后|完成后|做完后)/g,'，');
   // Separate semantic verbs, not full sentence templates. Each fragment remains validated.
   const verbs='挥手|敬礼|打招呼|起身|坐下|躺下|走到|等待|等候|观察|看看|汇报';
   s=s.replace(new RegExp('([^，,；;。\\s])((?:然后|接着|最后|随后|并且|并|再)?(?:向我|朝我)?(?:'+verbs+'))','g'),(full,a,b,offset,whole)=> /(?:不要|不许|禁止|别|向我|朝我|原地|在地上)$/.test(whole.slice(0,offset+1))?full:a+'，'+b);
   const chunks=s.split(/然后|接着|最后|随后|再(?=把|将|去|走|站|向|朝|坐|躺|打|敬|挥|招|起|推|搬|放|等|观察)|[，,；;。]/).map(x=>x.trim()).filter(Boolean);const out=[];
   for(let chunk of chunks){const againModifier=/^(?:请|帮我|把|将|先|你)*再/.test(chunk);chunk=chunk.replace(/^(?:请|麻烦你|麻烦|帮我|帮忙|能不能|可以帮我|能否帮我|可以|能否|你能|你|先|再|并且|并|把|将|把所有|把全部)+/g,'').replace(/(?:好吗|好不好|可以吗|行吗|吧|一下|呢|啊)$/g,'').trim();if(!chunk)continue;
    if(/^(?:别|不要|不许|禁止)/.test(chunk)){
     const x=chunk.match(/^(?:别|不要|不许|禁止)(?:去)?(?:碰到|撞到|碰|移动|搬动|搬|推|拿)(.+)$/);if(x){const es=ref(x[1],'object','protected',true);plan.constraints.protectedIds.push(...es.map(e=>e.id));continue}
     if(/^(?:别|不要|不许|禁止)(?:坐下|躺下|挥手|敬礼|打招呼|起身)$/.test(chunk)){const verb=chunk.replace(/^(?:别|不要|不许|禁止)/,'');plan.constraints.forbiddenActions.push(({坐下:'sit',躺下:'lie',挥手:'wave',敬礼:'salute',打招呼:'greet',起身:'stand'})[verb]);plan.assumptions.push('已排除动作：'+chunk);continue}
     problem('NEGATION_SCOPE','需要明确禁止的对象或动作，本次没有下发任何新动作。',{raw:chunk})
    }
    if(/^(?:绕过|避开|不要撞到|不要碰到)/.test(chunk)){const es=ref(chunk.replace(/^(?:绕过|避开|不要撞到|不要碰到)/,''),'any','obstacle',true);if(es.some(e=>e.collidable===false))problem('NONCOLLIDING_AVOIDANCE','指定目标尚未启用碰撞，无法保证绕行，请先在训练场编辑器启用碰撞。');plan.assumptions.push('身体导航会避开障碍：'+es.map(e=>e.name).join('、'));continue}
    if(/^(?:原地)?(?:观察|看看|看一下|汇报|描述)(?:一下)?(?:当前|周围|现在|场景|环境|你看到的|有什么|的物体|物体|一下)*$/.test(chunk)){out.push(action({type:'observe'}));continue}
    const joint=Joint?.parse(againModifier?'再'+chunk:chunk,ctx);
    if(joint){if(joint.error)problem(joint.code||'JOINT_UNRESOLVED',joint.error,{slot:joint.slot,raw:chunk,choices:joint.choices,recognizedGoal:joint.recognizedGoal});out.push(action(joint.step));plan.assumptions.push(...(joint.assumptions||[]));plan.grounding.push({text:chunk,kind:'joint_goal',evidence:joint.evidence||[],side:joint.step.side,region:joint.step.region});Object.assign(ctx,joint.contextAfter||{});continue;}
    const wait=chunk.match(/^(?:等待|等候|等)([零一二两三四五六七八九十\d.]+)秒$/);if(wait){out.push(action({type:'wait',duration:num(wait[1])}));continue}
    const basic=chunk.match(/^(?:(?:原地|向我|朝我|给我|在地上|地上)\s*)?(坐下|坐在地上|躺下|躺在地上|起身|站着|站立|挥手|打招呼|敬礼)(?:([一二两三四五六七八九十\d]+)次)?(?:持续)?(?:([零一二两三四五六七八九十\d.]+)秒)?$/);
    if(basic){const type=/坐/.test(basic[1])?'sit':/躺/.test(basic[1])?'lie':/起|站/.test(basic[1])?'stand':/挥/.test(basic[1])?'wave':/招呼/.test(basic[1])?'greet':'salute',repeat=basic[2]?num(basic[2]):1;if(repeat>10||repeat<1)problem('LIMIT','一次最多重复十次。');for(let i=0;i<repeat;i++)out.push(action({type,...(basic[3]?{duration:num(basic[3])}:{})}));continue}
    // A pick-up followed immediately by placement is one continuous carry skill.
    const pickup=chunk.match(/^(?:拿起|抓起|抱起|捡起)(.+)$/);if(pickup){const os=ref(pickup[1],'object','object');ctx.lastObject=os[0].id;out.push({kind:'pickup_pending',objectId:ctx.lastObject});continue}
    let m=chunk.match(/^(.+?)(推到|搬到|放到|放在|推至)(.+)$/),osRaw,type,ts;
    if(m){osRaw=m[1];type=m[2].startsWith('推')?'push':'carry';ts=m[3]}
    else{m=chunk.match(/^(?:把|将)?(?:搬|拿|抱|送|推|放|移动)(.+?)(?:到|至|进|入|在)(.+)$/);if(m){osRaw=m[1];type=/^推/.test(chunk)?'push':'carry';ts=m[2]}}
    if(!m){const imp=chunk.match(/^(放到|搬到|推到|放在)(.+)$/);if(imp){if(!ctx.lastObject)problem('MISSING_CONTEXT','这一步省略了物体，需要先说明要操作什么。',{raw:chunk});osRaw=ctx.lastObject;type=imp[1].startsWith('推')?'push':'carry';ts=imp[2];m=imp}}
    if(m){const multi=/全部|所有|每个|逐个|依次|剩余|其余|其他/.test(osRaw),os=ref(osRaw,'object','object',multi),to=target(ts);for(const o of os){if(o.movable===false)problem('FIXED_OBJECT',`${o.name}是固定环境，当前身体不能搬动它。`,{raw:osRaw});if(o.id===to.targetId)problem('SELF_TARGET','操作物体与目标不能是同一个。');const pending=out.at(-1);if(pending?.kind==='pickup_pending'){if(pending.objectId!==o.id)problem('PICKUP_MISMATCH','先拿起的物体和后续放置的物体不同。');out.pop()}out.push(action({type,objectId:o.id,...to}));ctx.lastObject=o.id}continue}
    const move=chunk.match(/^(?:走到|走|去|到|站到|站在|在)(.+)$/);if(move){out.push(action({type:'walk',...target(move[1])}));continue}
    // Attribute-only correction inherits the last semantic action, never a stale motor task.
    if(/^改(?:成|为)(.+)$/.test(chunk)&&this.lastPlan){const last=flatten(this.lastPlan.nodes).filter(n=>n.step.targetId).at(-1)?.step;const a=chunk.replace(/^改(?:成|为)/,'');if(last?.targetId){out.push(action({...clone(last),...target(a)}));continue}}
    problem('UNRECOGNIZED',`尚未完整理解“${chunk}”。请补充动作、对象和目标；这轮任务尚未执行。`,{raw:chunk})
   }
   if(out.some(n=>n.kind==='pickup_pending'))problem('HOLD_NOT_SUPPORTED','当前身体支持连续抓取、搬运与放置。请补充放置目标，单独持物等待尚未开放。');return out;
  };
  try{
   if(!t)problem('EMPTY','请输入一句话。');if(t.length>2000)problem('LIMIT','单次指令请控制在 2000 字以内。');
   if(/^(?:停止|停下|立刻停下|马上停止|取消|取消任务|取消当前任务|别做了|不用做了|不要继续|先停一下)$/.test(t)){plan.status='control';plan.control='stop';return plan}
   if(/^(?:暂停|先暂停|暂停一下)$/.test(t)){plan.status='control';plan.control='pause';return plan}
   if(/^(?:继续|继续执行|恢复|恢复执行|不要停下[,，]?继续(?:执行)?|别停[,，]?继续(?:执行)?)$/.test(t)){plan.status='control';plan.control='resume';return plan}
   if(Contextual&&!options.skipContextual){
    const prep=Contextual.prepare(source,w,ctx);plan.interpretation={schema:'jarvis/interpretation@1.0',original:source,canonical:prep.text,rules:prep.rules,defaults:prep.defaults,knowledgeSource:'scene_facts_and_conversation',modelUsed:false};
    if(prep.question){plan.status='clarify';plan.questions=[prep.question];plan.response=prep.question.message;plan.validation={ok:false,errors:[plan.response]};return plan;}
    if(prep.text!==source){const next=this.compile(prep.text,w,capabilities,{...options,context:ctx,skipContextual:true});next.sourceText=source;next.interpretation=plan.interpretation;next.assumptions=[...(next.assumptions||[]),...prep.defaults];return next;}
   }
   if(Scene&&!options.skipSceneGrounding){
    const grounded=Scene.compile(source,w,ctx,{...options,capabilities,fallback:(part,context)=>this.compile(part,w,capabilities,{...options,context,skipSceneGrounding:true})});
    if(grounded){Object.assign(plan,grounded);plan.contextAfter=grounded.contextAfter||null;
     if(plan.status==='ready'){const check=validatePlan(plan,w,capabilities);plan.validation=check;if(!check.ok)problem('VALIDATION',check.errors.join('；'));plan.summary=renderSummary(plan.nodes,w);}
     if(plan.status==='clarify')plan.validation={ok:false,errors:[plan.response]};return plan;
    }
   }
   if(!/(?:然后|接着|最后|随后|再把|再去|再走)/.test(t)&&/^(?:记住|请记住|记一下|忘记|删除记忆|你是谁|介绍|你好|谢谢|规则|你叫什么|我喜欢|你记得|还记得|回忆|我说过|我的偏好|记忆里)/.test(t)){plan.status='chat';return plan}
   if(!/(?:然后|接着|最后|随后)/.test(t)&&/(?:能做什么|会做什么|有哪些能力|支持哪些动作)/.test(t)){plan.status='query';plan.response='身体当前可执行：'+(capabilities?.semanticSkills||[]).filter(s=>s.id!=='grasp_object').map(s=>s.label||s.id).join('、')+'。抓取通过搬运与放置流程完成。';return plan}
   if(/^(?:为什么|如何|怎么|怎样|什么是)|(?:是什么意思|是什么动作|有什么区别|能不能执行这句话)$/.test(t)){plan.status='chat';return plan}
   if(!/(?:然后|接着|最后|随后)/.test(t)&&(/^(?:你)?(?:看到|看见|场景中有|场景里有|这里有|周围有|现在有什么)/.test(t)||/现在.*(?:干什么|做什么|在做)|做到哪|进度/.test(t))){plan.status='query';plan.response=/干什么|做什么|在做|做到哪|进度/.test(t)?'当前任务状态：'+(ctx.taskStatus||'等待指令')+'。':'当前场景包含：'+w.objects.map(e=>`${e.name}（${e.id}）`).join('、')+'；目标区域：'+w.zones.map(e=>`${e.name}（${e.id}）`).join('、')+'。这是场景状态数据，尚未接入摄像头视觉识别。';return plan}
   if(!/(?:然后|接着|最后|随后)/.test(t)&&/^(?:我(?:今天|现在|最近|有点|觉得|感觉|很|不太|特别)|心情|难过|开心|有点累|谢谢你|早上好|晚上好|再见)/.test(t)&&!/(?:帮我|请你|我要你|希望你|走到|搬|推|拿|敬礼|挥手|坐下|躺下|去)/.test(t)){plan.status='chat';return plan}
   if(/(?:做完|完成当前|追加|接下来再|继续.*然后)/.test(t)){plan.mode='append';t=t.replace(/^(?:追加(?:任务)?[:：]?|接下来再)/,'')}
   if(/^(?:改为|改成|换成|取消刚才)/.test(t))plan.mode='replace';
   // Declarative correction: replace the latest explicit target in the same utterance.
   const repair=t.match(/^(.*?)[,，](?:改为|改成|换成)(.+)$/);if(repair){const before=parseSequence(repair[1]),last=flatten(before).at(-1);if(!last?.step.targetId)problem('REPAIR_TARGET','没有找到可以更改的目标。');last.step={...last.step,...target(repair[2])};plan.nodes=before;plan.assumptions.push('已采用同一句话中最后的更正');}
   else plan.nodes=parseSequence(t);
   plan.contextAfter={lastObject:ctx.lastObject,lastTarget:ctx.lastTarget,lastMotion:ctx.lastMotion,sceneId:w.sceneId};
   const v=validatePlan(plan,w,capabilities);plan.validation=v;if(!v.ok)problem('VALIDATION',v.errors.join('；'));
   if(!plan.nodes.length){plan.status='noop';plan.response='已理解本次限制，没有新的身体动作。'}
   plan.summary=renderSummary(plan.nodes,w);return plan;
  }catch(e){if(!(e instanceof UnderstandingError))throw e;plan.status='clarify';plan.questions=[{code:e.code,message:e.message,...e.detail}];plan.response=e.message;plan.nodes=[];plan.contextAfter=null;plan.validation={ok:false,errors:[e.message]};return plan}
 }
 fromProposal(input,proposal,world,capabilities,options={}){
  if(proposal?.schema===Scene?.SCHEMA){const w=worldData(world),grounded=Scene.fromProposal(proposal,w,{...this.context,...options.context},{capabilities});
   const p={schema:SCHEMA,id:id(),sourceText:norm(input),worldRevision:w.revision,sceneId:w.sceneId,...grounded};
   if(p.status==='ready'){p.validation=validatePlan(p,w,capabilities);if(!p.validation.ok)throw Error(p.validation.errors.join('；'));p.summary=renderSummary(p.nodes,w);}return p;}
  const allowed=['status','mode','nodes','response','questions','constraints'];for(const k of Object.keys(proposal||{}))if(!allowed.includes(k))throw Error('模型返回了协议外字段：'+k);
  if(!['ready','clarify','chat','noop','blocked'].includes(proposal?.status))throw Error('模型状态无效');if(!['replace','append'].includes(proposal.mode))throw Error('模型任务模式无效');
  const w=worldData(world),p={schema:SCHEMA,id:id(),sourceText:norm(input),worldRevision:w.revision,sceneId:w.sceneId,engine:'model-proposal-validated',requiresConfirmation:true,...clone(proposal),grounding:[],assumptions:['模型语义建议经过独立校验；执行前需要确认'],contextAfter:null};
  if(p.status!=='ready'&&(p.nodes||[]).length)throw Error('非执行结果不得包含动作');if(p.status==='ready'&&!(p.nodes||[]).length)throw Error('执行计划为空');p.constraints={protectedIds:[],collisionAvoidance:true,...p.constraints};
  const v=validatePlan(p,w,capabilities);if(!v.ok)throw Error(v.errors.join('；'));p.validation=v;p.summary=renderSummary(p.nodes,w);const steps=flatten(p.nodes).map(n=>n.step);p.contextAfter={lastObject:steps.filter(s=>s.objectId).at(-1)?.objectId||this.context.lastObject,lastTarget:steps.filter(s=>s.targetId).at(-1)?.targetId||this.context.lastTarget};return p;
 }
}
return{VERSION,SCHEMA,Scene,Joint,Contextual,SKILLS,LABEL,Planner,resolveReference,validatePlan,predicateValue,describeStep,renderSummary,flatten,colorOf,normalize,worldData};
});
