/* HAT10: newly authored category grammar. No imported control meshes or recipes. */
(function(G){
'use strict';
const H=G.HAT10=G.HAT10||{};
H.schema='kaopu.hat-spectrum/1';H.version='HAT-R11.0';
H.categories=[
 {id:'braid',name:'绞花针织帽',design:'岚线 · 八束错位绞花',family:'knit',color:'#667367',trim:'#444f47',height:.155,thickness:.0048,shape:'soft',slouch:.020,braids:8,brim:0,band:.038,roughness:.89,seed:1041,summary:'八束双股绞花，后倾松量，独立双层罗纹翻边。'},
 {id:'bucket',name:'宽檐渔夫帽',design:'野渡 · 非对称下垂檐',family:'canvas',color:'#968771',trim:'#625a4c',height:.113,thickness:.0019,shape:'bucket',brim:.064,drop:.034,band:.012,roughness:.87,seed:2173,summary:'紧凑筒冠，前长后短软檐，四道同心压线。'},
 {id:'news',name:'人字纹鸭舌帽',design:'石径 · 六片斜落冠',family:'tweed',color:'#605e57',trim:'#45433e',height:.106,thickness:.0025,shape:'flat',brim:.062,drop:.017,band:.015,roughness:.90,seed:3257,summary:'前移斜冠、六片结构线、封闭弧形檐芯与新织纹。'},
 {id:'pinch',name:'窄檐礼帽',design:'秋岚 · 偏心凹冠',family:'felt',color:'#71685b',trim:'#44443d',height:.129,thickness:.0030,shape:'pinch',brim:.040,drop:.005,band:.024,roughness:.94,seed:4339,summary:'偏心冠槽与前侧收捏，后檐微翘，不复制旧冠线。'},
 {id:'ear',name:'护耳针织帽',design:'北麓 · 连体垂耳',family:'knit',color:'#807768',trim:'#4b504b',height:.142,thickness:.0044,shape:'ear',brim:0,band:.022,roughness:.92,seed:5431,summary:'拱顶与下垂耳片连生，细密罗纹、对比包边。'},
 {id:'field',name:'平顶便帽',design:'原野 · 软裁片便帽',family:'canvas',color:'#596047',trim:'#39463b',height:.103,thickness:.0020,shape:'field',brim:.062,drop:.021,band:.010,roughness:.87,seed:6521,summary:'低冠裁片与顶片连接，受缝线约束的松量，曲面夹层帽檐、翻折包边与三毫米锁式缝线。'},
 {id:'round',name:'卷檐圆顶帽',design:'穹石 · 宽肩椭圆冠',family:'felt',color:'#474a46',trim:'#353a36',height:.142,thickness:.0031,shape:'round',brim:.048,drop:-.009,band:.019,roughness:.93,seed:7639,summary:'椭圆宽肩圆冠，分向卷檐与同系窄带。'},
 {id:'high',name:'高顶礼帽',design:'衡线 · 微收腰高冠',family:'felt',color:'#484b52',trim:'#333940',height:.201,thickness:.0027,shape:'high',brim:.047,drop:-.005,band:.033,roughness:.79,seed:8741,summary:'微收腰高冠、圆角顶缘、非等宽椭圆檐。'},
 {id:'sport',name:'空顶运动帽',design:'弧光 · 长弧空顶',family:'sport',color:'#c7c2b4',trim:'#586961',height:.035,thickness:.0022,shape:'visor',brim:.083,drop:.024,band:.035,roughness:.76,seed:9857,summary:'空顶额带、分区织物、实体夹层长弧檐。'},
 {id:'bell',name:'钟形礼帽',design:'垂叶 · 斜向钟口',family:'felt',color:'#81716b',trim:'#61504c',height:.146,thickness:.0026,shape:'bell',brim:.039,drop:.032,band:.013,roughness:.91,seed:10973,summary:'下探钟口、偏侧褶量与窄条结饰，冠壁连续。'},
 {id:'pleat',name:'褶裥厨师帽',design:'云褶 · 二十道收束',family:'cotton',color:'#e1ded4',trim:'#c4c2b8',height:.235,thickness:.0013,shape:'pleat',brim:0,band:.051,roughness:.88,seed:11981,summary:'二十道渐变褶裥、偏后膨量与圆拱收顶。'}
];
H.heads=[{id:'oval',name:'标准椭圆',ratio:1.24},{id:'long',name:'长窄头形',ratio:1.37},{id:'broad',name:'短宽头形',ratio:1.10}];
H.parameters={circumference:[52,64,57.5],height:[.75,1.25,1],brim:[.65,1.35,1],fullness:[.85,1.15,1],thickness:[.6,1.6,1],ease:[1,6,2.5],detail:[0,1.5,1]};
H.defaults=(id='pinch')=>({schema:H.schema,id,head:'oval',circumference:57.5,height:1,brim:1,fullness:1,thickness:1,ease:2.5,detail:1,seed:0,color:null});
H.sanitize=function(raw){
 if(!raw||raw.schema!==H.schema)throw Error('不支持的配方格式；旧参考网格配方不能混入自有谱。');
 if(!H.categories.some(c=>c.id===raw.id))throw Error('未知帽子品类');
 const s=H.defaults(raw.id);s.head=H.heads.some(h=>h.id===raw.head)?raw.head:'oval';
 for(const[k,r] of Object.entries(H.parameters)){const v=Number(raw[k]??r[2]);if(!Number.isFinite(v))throw Error('参数不是有限数值：'+k);s[k]=Math.max(r[0],Math.min(r[1],v));}
 s.seed=Math.max(0,Math.min(999999,Math.floor(Number(raw.seed)||0)));
 if(raw.color!==null&&raw.color!==undefined){if(!/^#[\da-fA-F]{6}$/.test(raw.color))throw Error('颜色必须是六位十六进制');s.color=raw.color;}
 return s;
};
H.key=s=>JSON.stringify(H.sanitize(s));
})(globalThis);
