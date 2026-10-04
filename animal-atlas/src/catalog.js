export const CATEGORIES=[{id:'all',name:'全部动物',en:'COLLECTION',icon:'◈'},{id:'ocean',name:'海洋水域',en:'OCEAN',icon:'≈'},{id:'land',name:'陆地动物',en:'LAND',icon:'♧'},{id:'birds',name:'鸟类天空',en:'BIRDS',icon:'⌁'},{id:'coast',name:'岸滩生物',en:'COAST',icon:'⋒'}];
export const ANIMALS=[
{id:'fish',name:'大型鱼',en:'LARGE FISH',category:'ocean',asset:'fish',adapter:'fish',version:'鱼群 R13',description:'完整鱼体与独立眼球，单体检查和 30 条互动群游。',habitat:'固定灯光展示台',tags:['单体 / 群体','16 种动作'],capability:'鱼体来自已有参考采样；物种及栖息水域尚待核实。'},
{id:'shark',name:'大白鲨',en:'WHITE SHARK',category:'ocean',asset:'life-shark',adapter:'life',life:'shark',version:'生命世界 · 鲨鱼',description:'连续鲨鱼表面，保留原生活活动。',habitat:'固定灯光展示台',tags:['生活动作','连续曲面']},
{id:'pig',name:'家猪',en:'DOMESTIC PIG',category:'land',asset:'life-pig',adapter:'life',life:'pig',version:'生命世界 V3.5',description:'原有函数猪体、分趾蹄和农场生活活动。',habitat:'固定灯光展示台',tags:['生活动作','程序化形体']},
{id:'dog',name:'中华田园犬',en:'VILLAGE DOG',category:'land',asset:'life-bruce',adapter:'life',life:'bruce',version:'生命世界 V3.3',description:'黄褐短毛犬、立耳与连续皮肤，保留犬专用活动。',habitat:'固定灯光展示台',tags:['生活动作','短毛']},
{id:'lihua',name:'中国狸花猫',en:'LI HUA CAT',category:'land',asset:'life-cat',adapter:'life',life:'cat',version:'生命世界 V3.6',description:'狸花外观、尾环和原有猫生活动作。',habitat:'固定灯光展示台',tags:['生活动作','虎斑']},
{id:'cat',name:'家猫 · 动作版',en:'CAT / MOTION',category:'land',asset:'cat-v440',adapter:'cat',version:'Cat V4.40',description:'原有坐卧、行走、视线、耳朵和短毛控制。',habitat:'固定灯光展示台',tags:['坐卧 / 行走','耳眼控制']},
{id:'neutral-dog',name:'短毛犬 · 参数版',en:'DOG / PARAMETRIC',category:'land',asset:'native',adapter:'native',key:'neutralDog',engine:'mammal',version:'哺乳动物 K5',description:'GitHub 中的独立犬谱；可调原始材质、尺寸和躯干丰满度。',habitat:'固定灯光展示台',tags:['参数生成','静态形体']},
{id:'tabby',name:'灰虎斑猫 · 参数版',en:'TABBY / PARAMETRIC',category:'land',asset:'native',adapter:'native',key:'greyTabby',engine:'mammal',version:'哺乳动物 K5',description:'沿用已有猫项目的体态参数及连续曲面。',habitat:'固定灯光展示台',tags:['参数生成','静态形体']},
{id:'wolf',name:'灰狼',en:'GRAY WOLF',category:'land',asset:'native',adapter:'native',key:'grayWolf',engine:'mammal',version:'哺乳动物 K5',description:'GitHub 中的灰狼谱，保留原始毛色与身体比例。',habitat:'固定灯光展示台',tags:['参数生成','静态形体']},
{id:'bear',name:'北极熊',en:'POLAR BEAR',category:'land',asset:'native',adapter:'native',key:'polarBear',engine:'quad',version:'四足动物 K4',description:'原有照片约束试验谱；尺寸及未观察部分为建模假设。',habitat:'固定灯光展示台',tags:['参数生成','静态形体']},
{id:'tortoise',name:'陆龟',en:'TORTOISE',category:'land',asset:'native',adapter:'native',key:'tortoise',engine:'quad',version:'四足动物 K4',description:'原有拱形背甲与四足谱，具体物种尚未确定。',habitat:'固定灯光展示台',tags:['形体检查','静态形体']},
{id:'dove',name:'珠颈斑鸠',en:'SPOTTED DOVE',category:'birds',asset:'life-bird',adapter:'life',life:'bird',version:'生命世界 V3.6',description:'斑鸠骨架、覆羽与长尾，保留林缘生活活动。',habitat:'固定灯光展示台',tags:['生活动作','羽毛分层']},
{id:'eagle',name:'白头海雕',en:'BALD EAGLE',category:'birds',asset:'eagle',adapter:'eagle',version:'海雕 R07',description:'保留全身联动、视线、头嘴动作与巡航生活片段。',habitat:'固定灯光展示台',tags:['飞行 / 观察','头嘴控制']},
{id:'starling',name:'密克罗尼西亚椋鸟',en:'MICRONESIAN STARLING',category:'birds',asset:'palau-source-4',adapter:'palau',key:'source_4',version:'帕劳三鸟 R04',description:'完整参考派生曲面与局部关节，保留飞行动作。',habitat:'固定灯光展示台',tags:['飞行动作','关节检查']},
{id:'fruit-dove',name:'帕劳果鸠',en:'PALAU FRUIT DOVE',category:'birds',asset:'palau-source-2',adapter:'palau',key:'source_2',version:'帕劳三鸟 R04',description:'完整参考派生曲面，原有身体分区和飞行绑定。',habitat:'固定灯光展示台',tags:['飞行动作','关节检查']},
{id:'tern',name:'白燕鸥',en:'WHITE TERN',category:'birds',asset:'palau-source-1',adapter:'palau',key:'source_1',version:'帕劳三鸟 R04',description:'完整参考派生曲面与原有飞行绑定。',habitat:'固定灯光展示台',tags:['飞行动作','关节检查']},
{id:'chicken',name:'家鸡',en:'DOMESTIC CHICKEN',category:'birds',asset:'chicken',adapter:'chicken',version:'家鸡 R9.8.4',description:'从 GitHub 读取的新版头部工作台，保留身体、羽毛和细节参数。',habitat:'固定灯光展示台',tags:['形体参数','静态形体'],capability:'原项目尚未开放骨架与动作；当前可检查形体、羽毛和材质。'},
{id:'crab',name:'普通螃蟹',en:'COASTAL CRAB',category:'coast',asset:'crab',adapter:'crab',key:'ordinary',version:'螃蟹 R11',description:'落脚推进与三套程序化甲壳外观。',habitat:'固定灯光展示台',tags:['海滩动作','3 套外观']},
{id:'coconut',name:'椰子蟹',en:'COCONUT CRAB',category:'coast',asset:'crab',adapter:'crab',key:'coconut',version:'螃蟹 R11',description:'原有独立腿节与表面分区，三套甲壳外观。',habitat:'固定灯光展示台',tags:['海滩动作','3 套外观']}
];
