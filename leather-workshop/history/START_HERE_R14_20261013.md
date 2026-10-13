# 皮革工作台：从这里接续

更新：2026-10-13。当前实现为 `leather-workshop/r14/`，版本 **R14.0-S2A**，状态 `S2A_DELIVERED_AND_MERGED_USER_REVIEW_PENDING`。集成分支 `perf/leather-r10-input-20261011`；PR62已按用户授权合并，提交 `c45a89f7bea818bd6c0a5137ba6ed25e368f1b75`。未推进人物main、未强推。Issue52是统一检索入口。

## 当前可查看网页

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/37178e800a3272575b16e30a0723b3bcf1f29c0a/leather-workshop/r14/public-lite.html

规范源码9d436910d2dfe7c10665a4db6d208f5fa596b7ba；固定构建37178e800a3272575b16e30a0723b3bcf1f29c0a；公网回执68504371cb669707bfc7a784858cdffead355ddc；成功Actions38345375250。HTML3,629,745字节，SHA256120a3772d4384ed375311df1a856e864836ba56e88a24345d0ed72e84f9cc049。

## 恢复顺序

START_HERE → ROADMAP → TASK_STATE → r14/README → r14/DELIVERY → r14/qa/s2/RECOVERY_20261013.json → r14/NEXT_TASK_S2B.md。

不要依据历史PR正文、纯构建时BUILD_RESULT或聊天中的“无法思考”重新判断代码失败。本次恢复发现S2A完整验证和发布已经成功，未完成的是对话交付、状态同步和PR合并。本轮重新下载真实Artifact、核对HTML及11份报告、9组原始像素对照和6款轨迹，然后合并；运行时代码未再次改变。恢复中未重跑浏览器和数值测试，不把存档复核冒充新执行。

## 已完成与下一任务

S1工程收尾已完成，R13记录保留。S2A完成保守零接触势判断和高频标量打包，候选集合、排序、摩擦、连续碰撞和物理预算保持不变。同机52步工作量中位耗时减少：卡包21.91%、菱形皮样2.59%、肩包6.50%；不是帧率或所有设备输入延迟保证。9组画面差0，6款各52步轨迹位置差0mm；45离线及16固定公网浏览器检查通过。

下一步 **S2B主线程与Worker往返等待剖析**：从当前R14分离渲染提交、皮面/DOM更新、消息传输和等待，定位仍然存在的长尾。软件渲染探针不能代表用户真GPU，也不能把传输+等待称为纯队列。先测量一个明确瓶颈，再做独立优化与等效回归；不重新做S1或重复S2A，不加入新皮纹、黏弹或填芯功能。

## 冻结范围

R01–R13和旧固定链接、六款产品、十三外观、六类工艺、已认可皮纹/磨损/厚度/受力保持；不恢复夹克、不启用R11随机场，不减少接触候选、连续碰撞或摩擦贡献，不降低迭代预算、步长或容差。根LICENSE、第三方署名、其他工作台和人物main不改。失败候选保留Draft，通过后按用户授权只合并到皮革集成分支。

## 开发与验收范围

构建 `python leather-workshop/r14/build.py`；复验 `python leather-workshop/r14/verify-s2.py`；性能基准 `node leather-workshop/r14/qa-performance.cjs`（先按源码说明准备独立R13参考）。锁定clang18/lld18和Python/Node依赖；用户打开网页不需编译器。不要运行历史materialize覆盖已编辑规范源码。

S2A已交付合并，完整S2仍未完成；用户视觉认可、材料标定、全部设备实时性能和商业法律放行仍待独立验收。390×844是视口模拟。当前恢复容器HTTP检查遇DNS错误，不能据此推断公网失效；固定公网验收依据为原成功Actions真实Chrome记录。原R13入口逐字归档至history/START_HERE_R13_20261013.md。
