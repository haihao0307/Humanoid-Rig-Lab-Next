from pathlib import Path
r=Path(__file__).resolve().parents[1]
p=r/'app.mjs';s=p.read_text();anchor='function studio(){'
inside="""function inspectInside(){if(!items.length)return;physics?.pause();lighting?.pause();viewer.mesh.visible=false;$('body-visible').checked=false;const box=new THREE.Box3().setFromObject(items[0].mesh),c=box.getCenter(new THREE.Vector3());viewer.camera.position.copy(c);viewer.orbit.target.set(c.x,c.y,box.max.z);viewer.camera.near=.002;viewer.orbit.minDistance=.015;viewer.camera.updateProjectionMatrix();viewer.orbit.update();lighting?.dirty();viewer.render();}
"""
assert s.count(anchor)==1;s=s.replace(anchor,inside+anchor)
s=s.replace("$('body-visible').onchange=", "$('inspect-inside').onclick=inspectInside;\n $('body-visible').onchange=")
s=s.replace('window.__MP04__=window.__MP03__=window.__MP02__={audit,select,frame,macro,', 'window.__MP04__=window.__MP03__=window.__MP02__={audit,select,frame,macro,inspectInside,')
p.write_text(s)
p=r/'index.html';s=p.read_text().replace('<button id="light-studio">恢复棚拍</button>', '<button id="light-studio">恢复棚拍</button><button id="inspect-inside">查看衣物内侧</button>').replace('抬起衣摆后松手','衣摆扰动测试');p.write_text(s)
p=r/'README.md';s=p.read_text().replace('MP04.1','MP04.3')+'\n\n## 断点接续 MP04.3\n\n从 44ee0e6286161893678df41e74bd4181e0dc8d99 的 MP04.2 构建继续。修正针织股线的局部截面朝向；牛仔远景按像素覆盖范围积分 3:1 组织的颜色与法线，仍然保留实体经纬纱，没有以平板或照片代替。增加衣物内侧观察按钮，将瞬时衣摆扰动与真正人物动作区分。\n\n动作仍使用未改变的 MP04.2 物理协议与九组真实求解缓存。缓存回放不是每秒实时解算三十帧的承诺；改变材料参数后重新计算六秒动作可能需要数分钟。来源与物理文件一致性记录于 FINISH_SCOPE.json、PHYSICS_REUSE.json，发布证据以同分支 PUBLIC_DELIVERY.json 为准。\n\n此目录已保存完整可读源码和固定资产，不需要依赖会过期的 Actions 产物恢复。旧 _build 迁移脚本仅保留历史来源，不要对冻结目录反复执行迁移。\n'
p.write_text(s)
