"""One-time migration only. Subsequent builds read canonical R04 sources as edited.
Do not regenerate/overwrite an existing R04 app from historical R03 scripts.
"""
from pathlib import Path
import subprocess,json
r=Path(__file__).resolve().parent;repo=r.parents[1]
if not (r/'app.js').exists():
 for name in ['source_datum_patch.py','upgrade.py','restshape_patch.py','section_patch.py','quarantine.py','qa_expand.py']:
  subprocess.run(['python3',str(r/name)],check=True)
 (r/'SOURCE_AUTHORITY.json').write_text(json.dumps({'authority':['app.js','mother.mjs','surface.mjs','shell.mjs','section.mjs','fit/field.mjs','fit/beanie.mjs','fit/knit.mjs','shell.html'],'historicalMigrationScripts':'upgrade / source_datum_patch / restshape_patch / section_patch / quarantine / qa_expand are NOT automatically reapplied after initial source materialization','acceptedVisualBaseline':'d56bc8498a152ff501ffaf80ec80a109b2ec4865','rejectedFit':'f8c448c1392fd1d51ca1adc51dce819204ec0896','quarantinedCategory':'flatcap','userAcceptedR04':False},ensure_ascii=False,indent=2))
 if not (r/'README.md').exists():(r/'README.md').write_text('''# 帽子 R04：分层厚度与分类戴位候选

本版针对用户否定的R03.1厚度、贴皮变形和礼帽饰带破碎。复刻外观基线为R02，旧页面不改。

权威源码为SOURCE_AUTHORITY.json列出的R04文件。bootstrap.py仅在缺少app.js时进行一次历史迁移；今后直接编辑R04实际源码，构建不得覆盖它们。

针织帽的帽口匹配与自由帽冠分开；保留来源翻折并生成真实内侧及封口。材料标称厚度是工程参数，不是原实物试片测量值。礼帽各层共同变换，不逐点贴皮。复合耳片帽将布料、系带和顶部装饰分开处理。

鸭舌帽的新自动贴合未通过审查，已显式隔离，只展示R02来源基线；不得算作本轮贴合修复完成。其余款也不因可显示就被认证为动态或工业帽样。

右侧可切换厚度、戴位、结构分区及剖开帽体。剖面来自实际内外层三角体，人物头模保持显示。相机、灯光、原织纹、配方导出保留。没有生成图替代真实三维。

执行build.py --source <源码固定SHA> --data fa6e3842b0add398a52b775a1577fc50e31ce31b生成公网轻入口与完整单文件。数据引用的是固定、未改动的已署名帽型控制网和贴图，不是R03的失败拟合输出。

qa.py执行真实浏览器；check_wall_distance.py独立核查三个头形上默认绞花针织帽的实际内层顶点、面中心及最近厚度。测试范围不是连续碰撞、压力或所有滑块组合的证明。原始几何检查转储只放Actions证据，不作为新的生产资产提交。

交付必须读DELIVERY.json，文件不存在或publicVerified不是true时，公网交付未完成。用户认可仍pending。动态布料/纱线、头发压缩、材质标定和手机实机测试未完成。
''')
 for p,addition in [(repo/'WORKBENCH_BUILD_SYSTEM.md','\n\n## 帽子R04厚度与分类承托增补\n\n读取[材料厚度、承托位置和自由造型](docs/workbench-build-system/HAT_R04_THICKNESS_AND_SUPPORT.md)。用户已否定R03.1的贴皮和厚度效果；必须检查实际内外层和戴位，不把程序运行通过当成视觉通过。源材料、设计留空和身体间隙分开，不合格的单款显式隔离。\n'),(repo/'docs/workbench-build-system/RUNBOOK.md','\n\n## 厚度和分类戴位失败回归\n\n[帽子R04案例](HAT_R04_THICKNESS_AND_SUPPORT.md)记录真实用户否定、点投影破坏层次、实际材料内壁检查、头模不变和局部候选隔离。迁移脚本只能初始化一次，后续构建读取实际生产源码，不能覆盖执行者的新修正。\n')]:
  text=p.read_text()
  if 'HAT_R04_THICKNESS_AND_SUPPORT.md' not in text:p.write_text(text+addition)
print('Canonical R04 sources present; no prior version overwritten.')
