"""Initialize NEW R08 UI once from exact R07.1. Never replay over edits."""
from pathlib import Path
from hashlib import sha256
r=Path(__file__).resolve().parents[1]
p=r/'src/main.mjs'
if not p.exists():
    old=r.parent/'r07/src/main.mjs'
    assert sha256(old.read_bytes()).hexdigest()=='b7c81ca06f60178884dde081ae189e05d3b1f7404d6a966bb83360768a40f35f'
    s=old.read_text()
    def once(a,b):
        global s
        assert s.count(a)==1,(a[:100],s.count(a))
        s=s.replace(a,b,1)
    once("import {ShoeMaterials,CATALOGUE}","import {ShoeMaterials,CATALOGUE,MATERIAL_SETS}")
    once("import {installRenderGate} from './render-gate.mjs';","import {installRenderGate} from '../../r07/src/render-gate.mjs';\nimport {installShoeDepthRange} from './depth-range.mjs';")
    once(' const presenter=installRenderGate(', ' const depthReport=installShoeDepthRange(A,()=>active);\n const presenter=installRenderGate(')
    once('<button id="formed-laces">鞋带与孔扣</button>','<button id="formed-laces" hidden disabled>鞋带专项暂停</button>')
    once('state.leatherId,state.material,state.wire','state.leatherId,state.materialSet,state.partLeather,state.material,state.wire')
    once('busy=true;materials.select(state.leatherId);clear();','busy=true;clear();materials.prepare(state);materials.select(state.leatherId);')
    once("thread.name='STITCH_'+p.id;", "thread.name='STITCH_'+p.threadId;")
    once('A.camera.near=.04;A.camera.far=12000;','A.camera.near=Math.max(.2,distance*.1);A.camera.far=distance+2000;')
    once("function inspector(){let h=", "function inspector(){let h='<label class=\"material-label\">分片牛皮组合<select id=\"shoe-material-set\">'+Object.entries(MATERIAL_SETS).map(([id,v])=>`<option value=\"${id}\" ${state.materialSet===id?'selected':''}>${v.name}</option>`).join('')+'</select></label>'+(state.selected!=='all'&&state.selected!=='26'?'<label class=\"material-label\">当前 P'+state.selected+' 单片皮料<select id=\"shoe-panel-leather\"><option value=\"auto\">跟随组合</option>'+CATALOGUE.filter(c=>['heritage','wax','tan','nubuck','black','suede'].includes(c.id)).map(c=>`<option value=\"${c.id}\" ${state.partLeather[state.selected]===c.id?'selected':''}>${c.name}</option>`).join('')+'</select></label>':'')+")
    once('指定皮革台 R10 · 皮料','统一皮料对照（选择后切回统一模式）')
    once("state.leatherId=leather.dataset.leather;", "state.leatherId=leather.dataset.leather;state.materialSet='uniform';state.partLeather={};")
    once("if(active&&e.target.id==='shoe-leather'){state.leatherId=e.target.value;rebuild(false);inspector();}","if(!active)return;if(e.target.id==='shoe-material-set'){state.materialSet=e.target.value;state.partLeather={};rebuild(false);inspector();}if(e.target.id==='shoe-panel-leather'){if(e.target.value==='auto')delete state.partLeather[state.selected];else state.partLeather[state.selected]=e.target.value;rebuild(false);inspector();}if(e.target.id==='shoe-leather'){state.leatherId=e.target.value;state.materialSet='uniform';state.partLeather={};rebuild(false);inspector();}")
    once("material:materials.report(),active", "material:materials.report(),depth:depthReport(),active")
    once("ready:true,renderIdle:","ready:true,materialManager:materials,renderIdle:")
    s=s.replace('SHOE_R07','SHOE_R08').replace('shoe-r07','shoe-r08').replace('R07.1','R08.0').replace('R07 · 1','R08 · 0').replace('SHOE_R07_FORMED','SHOE_R08_FORMED')
    s=s.replace('07 / LEATHER · SEWN ASSEMBLY','08 / LAYERED LEATHER · OWNED SEAMS').replace('<b>07</b>','<b>08</b>')
    s=s.replace('裁片收圆，<br>针脚贴入皮革。','分清叠层，<br>再缝合每一针。')
    s=s.replace('保留 R10 牛皮与原鞋楦。按成形尺寸收圆裁片、重排侧缝，针孔与贴皮针路一起重建。鞋带保持原状。','原鞋楦与原裁片继续保留。叠层、削薄、针孔与针路共用一套连接关系；鞋头、鞋帮与后片分别配皮。鞋带暂停显示。')
    s=s.replace('打开未改动的 R06 对照','打开未改动的 R07.1 对照').replace('44293d1a99b41ed4d692303ace4e48218ae89c99/shoe-workshop/r06','2434eb78d5c07db84dcecdee7bd08b8d866ea8e4/shoe-workshop/r07')
    s=s.replace('R10 牛皮 · 完整形态检查候选','分片牛皮 · 叠层与单排车缝').replace('${CATALOGUE.find(c=>c.id===state.leatherId).name} · 9片原厚壳＋1片派生皮垫 · 后跟搭接 ${f(r.rearLapBaseResidualMm,3)} mm 基面残差','${MATERIAL_SETS[state.materialSet].name} · 10片厚皮壳 · 单排针线／底线结构')
    s=s.replace('按最终皮面布置小针孔，连续线跟随曲面与静态压痕。底口沿原杯形鞋底校准；不是 Goodyear 沿条或受力求解。','缝口使用上片／下片归属：一条可见面线，底线在内侧，锁结在叠层内部。研究设置：针距2.8mm、距边2mm、削薄过渡4.5mm；不是生产公差。')
    s=s.replace('本轮精修鞋头、侧缝与底口。线与压痕为共享曲面上的静态绑定，未计算拉力、摩擦或全域碰撞；鞋带冻结。','叠层是接触，不是互相穿透。每排针路只打对应的穿透孔；静态301式结构尚未计算张力、摩擦和全鞋碰撞；鞋带暂停。')
    once("if($('#formed-audit-body'))$('#formed-audit-body').innerHTML=", "if($('#formed-audit-body'))$('#formed-audit-body').innerHTML='<p>目标针距 2.8mm / 距边 2mm / 削薄宽 4.5mm / 静态层间余量 0.045mm。它们是本版研究参数，不是通用制鞋规格。</p>'+r.joinPlan.rows.map(j=>`<p>${j.id}：上片 P${j.top} → 下片 P${j.underlay}，${j.holes}针，单排；${j.transitPunctures||0}个中间层穿孔。</p>`).join('')+")
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
if not (r/'style.css').exists():(r/'style.css').write_bytes((r.parent/'r07/style.css').read_bytes())
print('R08 readable UI initialized; existing files are never replayed or overwritten.')
