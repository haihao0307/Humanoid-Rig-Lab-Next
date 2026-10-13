# R15 S2B — 已完成姿势消息防积压

当前阶段已通过测试和固定公网验收，并由PR66合并到皮革集成分支。源码8c23de26525afff3ae2280463cd298a28fc07b6c；构建70883deb4659b601faacf5eb49277eee4774b824；正式回执09dcb3af3660629b00e367c06e3c8f46fc87bf98。当前事实以DELIVERY.json及上级TASK_STATE为准，历史迁移/任务锚点只描述各自阶段起点，不覆盖交付回执。

网页：
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/70883deb4659b601faacf5eb49277eee4774b824/leather-workshop/r15/public-lite.html

## 代码关系

生产行为改动仅在src/workers/product-entry.js和client.js。Worker独立计算物理，每个自主姿势包带序号，客户端接收后确认；最多一个未确认自主包。尚未发送的状态不复制成数组队列，而是保留在求解器当前x中，确认后发布最新真实状态。确认不是物理步进时钟，pump/schedule逐字节未变。

明确init/reset/manualStep/test回执不合并，并使旧确认失效；重复确认忽略；销毁后的客户端不应用旧产品位置。输入处理、相机、资源释放、渲染、材质、几何、厚度和C/WASM内核与R14保持一致。没有假跟随模型。

## 构建和验证

普通构建：python leather-workshop/r15/build.py。
开发复验：python leather-workshop/r15/verify-s2b.py。
普通构建只读r15规范输入；差分QA会读取固定历史参考。不要运行旧materialize或s2b-delivery/prepare覆盖编辑后的规范源码。编译链仍锁定clang18/lld18，用户打开网页不需要这些工具。

144源码门禁、45消息协议检查、18数值、25应用接口、25几何及六款52步轨迹通过；45离线和16固定公网浏览器检查通过，九组原始图像差0。核心/离线/计时来源38356482372；该运行发布步骤因case报告忽略规则失败，随后38357446186检查精确相同源和产物后恢复发布并新做公网检查，不冒称第一次运行整体成功。

## 性能范围与接续

PERFORMANCE_OBSERVATIONS.md解释ABBA数据：旧姿势包积压已受控，但绘制间隔没有稳定改善；返回消息等待不等于鼠标到屏幕时间。S2B完成，完整S2未完成，下一任务NEXT_TASK_S2C.md。R11合法算法/许可整理路线独立，不能据此声称制造标定或商用法律放行。

- [x] 实际生产源码、真实物理和三维，不用图片或占位代替。
- [x] 物理独立步进、命令、重置与销毁关系经过差分检查。
- [x] 新版离线与固定公网真实浏览器交互通过。
- [x] PR66按授权合并，R01–R14和旧链接保留。
- [ ] 用户视觉认可、全设备实时性、材料标定和商业法律放行仍未完成。
