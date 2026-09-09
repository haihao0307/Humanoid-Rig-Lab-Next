/* Local context and goal repair. Rules compose slots; they never invent objects,
 * pretend a model is connected, or silently drop unresolved instruction words. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JarvisContextualUnderstanding=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function prepare(input,world={},ctx={}){
 const original=String(input).normalize('NFKC').trim(),w=world.world||world;let text=original;const rules=[],defaults=[];if(/^(?:谢谢|谢谢你|你好|早上好|晚上好|再见)[。！!]*$/.test(text))return{original,text,rules,defaults};
 const change=(re,replacement,label)=>{const next=text.replace(re,replacement);if(next!==text){rules.push(label);text=next;}};
 change(/^(?:嗯[，,、\s]*|呃[，,、\s]*|贾维斯[，,、\s]*|假维斯[，,、\s]*|jarvis[，,、\s]*)+/i,'','移除称呼和开头的口语停顿');
 change(/^(?:请问你能不能|你能不能|能不能|可不可以|可以不可以|能否|我想让你|我希望你|请你|麻烦你|麻烦|帮我|帮忙|替我|请)+/,'','提取请求中的动作目标');
 change(/(?:好吗|好不好|行不行|行吗|可以吗|谢谢|吧|呀|啊)[。？！?!]*$/,'','移除句尾礼貌成分');
 if(/^(?:为什么|如何|怎么|怎样|什么是|如果|假如|记住|请记住)/.test(text))return{original,text,rules,defaults};
 if(/^(?:让动作|动作|看起来|做得|你做得|你)?(?:更|再)?自然(?:一点|一些|些)?$/.test(text))return{original,text,rules,defaults,question:{code:'STYLE_NEEDS_DIMENSION',message:'你希望幅度小一些、到位慢一些，还是调整某个身体部位？请选一个具体方向。',choices:[{id:'smaller',name:'手臂幅度小一些',text:'手臂放低一点'},{id:'slower',name:'手臂到位慢一些',text:'慢一点'}]}};
 if(/膝|腿|腰|颈|脖子|头|脚踝|手指/.test(text)&&/弯|抬|低|转|扭|伸|张开|握/.test(text)&&!/桌|箱|物|球|地上|头顶/.test(text))return{original,text,rules,defaults,question:{code:'BODY_GOAL_CAPABILITY_GAP',message:'已识别为身体局部姿态调整。当前独立角度控制开放肩臂和肘部，其他部位先保留目标，不擅自映射成不相干动作。',recognizedGoal:original}};
 change(/地面上|地板上/g,'地上','地面支撑关系统一');
 change(/(?:散落在|散落于|散在|零散在)地上(?:的)?/g,'地上的','将散落位置转为地面支撑条件');
 change(/地上(?:的)?(?:零零散散的|散落的|散着的|零散的)?(?:那几样|这几样|那几个|这几个|那几件|这几件|所有东西)/g,'地上的所有物体','地面范围内的口语复数表达转为集合查询');
 change(/地上(?:的)?(?:零零散散的|散落的|散着的|零散的)/g,'地上的','保留实际地面范围');
 change(/圆滚滚的(?:东西|物体|那个)?/g,'球','从几何形状描述构造球体查询');
 change(/方方正正的(?:东西|物体|那个)?/g,'箱子','从几何形状描述构造箱体查询');
 change(/尖尖的(?:东西|物体|那个)?/g,'圆锥','从几何形状描述构造圆锥查询');
 change(/归置|转移|挪动/g,'搬','将转移目标交给搬放规划');
 change(/放过去|搬过去|送过去/g,'搬到那里','目的地省略沿用明确的上一目标');
 change(/都(?:一起)?给我/g,'都','保留集合量词');
 change(/(?:让|使)(左手|右手|双手|左臂|右臂)/g,'$1','提取身体部位');
 change(/(?:用|拿)(左手|右手)(?:去)?(?:打招呼|挥手)/g,'$1挥手','保留明确的左右手约束');
 // The existing gesture skill does not expose side. Never discard that qualifier.
 if(/(?:左|右|双)手(?:挥手|打招呼|敬礼)/.test(text))return{original,text,rules,defaults,question:{code:'GESTURE_SIDE_CAPABILITY_GAP',message:'已理解指定左右手的手势要求。现有挥手技能尚未提供左右侧参数；本版可精确指定左右肩肘姿态，手势侧别仍待身体接口开放。',recognizedGoal:text}};
 if(/^(?:刚才)?(?:(?:左|右|双)(?:手|臂)|手臂)?(?:抬|举)(?:得)?太高了?$/.test(text)){text=text.replace(/(?:抬|举)(?:得)?太高了?$/,'放低一点').replace(/^刚才/,'');rules.push('将明确的高度过大反馈解释为小幅降低，并显示默认步长');}
 if(/^(?:刚才)?(?:(?:左|右|双)(?:手|臂)|手臂)?(?:抬|举)(?:得)?太低了?$/.test(text)){text=text.replace(/(?:抬|举)(?:得)?太低了?$/,'抬高一点').replace(/^刚才/,'');rules.push('将明确的高度不足反馈解释为小幅提高，并显示默认步长');}
 const same=text.match(/^(剩下的|其余的|其他的|它们|这些)(?:也)?(?:照刚才那样|跟刚才一样|一样|照旧|也这样|也照刚才一样)(?:处理|放|搬)?$/);
 if(same){if(ctx.sceneId&&ctx.sceneId!==w.sceneId)return{original,text,rules,defaults,question:{code:'STALE_CONTEXT',message:'场景已经切换，请重新指定对象和目的地。'}};const target=[...(w.objects||[]),...(w.zones||[])].find(e=>e.id===ctx.lastTarget);if(!target)return{original,text,rules,defaults,question:{code:'TARGET_CONTEXT_REQUIRED',message:'缺少可以沿用的上一目的地，请指定一个实际区域或支撑面。'}};
  const relation=ctx.lastRelation||(w.zones||[]).some(z=>z.id===target.id)&&'inside'||'near';text=`把${same[1]}都搬到${target.id}${relation==='on'?'上':relation==='inside'?'里面':'旁边'}`;rules.push('沿用同场景中已明确的目的地与关系');
 }
 const tidy=text.match(/^(?:把|将)?(.+?)(?:收拾|整理|归拢)(?:一下|起来)?$/)||text.match(/^(?:收拾|整理|归拢)(?:一下)?(.+)$/);
 if(tidy&&!/到|至|在/.test(text))return{original,text,rules,defaults,question:{code:'DESTINATION_REQUIRED',slot:'destination',source:tidy[1],message:'已理解需要整理这些物品。希望把它们放到哪里？',choices:[...(w.zones||[]),...(w.objects||[]).filter(o=>o.templateId==='worktable'||o.semanticType==='table')].slice(0,6).map(e=>({id:e.id,name:e.name,text:e.id}))}};
 return{original,text:text.trim(),rules,defaults};
}
return{VERSION:'1.0.0',prepare};
});
