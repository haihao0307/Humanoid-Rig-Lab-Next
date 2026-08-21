# Character Studio 状态闭环

Character Studio 的状态层位于 `apps/character-studio/`。它不拥有人物几何、骨骼、蒙皮、姿势或动画数据，只编排现有 Character Core、ProjectState、持久化和多窗口同步接口。

## Character Studio v1 页面组合

`character-studio.html` 是唯一页面入口：左栏挂载 Identity、BodyShape、Face、Clothing、Hair、Accessory、Proportion、Pose、Animation 九个面板；中栏只创建一个读取 `simulationRig` 最终姿势的人物视口；右栏只读展示 CharacterProfile、各模块 revision、资源引用和导出入口。

页面级 `CharacterStudioApp` 只创建一个 `ProjectHubClient`，并把它同时交给 panels 与 session。视口、摄像机和 GPU 对象保持窗口私有，Character 数据仍以 ProjectState 为唯一事实来源。

## 统一入口

```js
import { createCharacterStudioSession } from '../apps/character-studio/index.js';

const session = createCharacterStudioSession({ role: 'character-studio' });
await session.initialize();
```

可用窗口角色：

```text
character-studio
main-editor
animation-editor
data-inspector
```

公开操作：

```text
createCharacter
loadCharacter
saveCharacter
restoreCharacter
exportCharacterProfile
saveResource
subscribeCharacterState
flush
close
```

## 正式状态流

创建、切换活动人物、保存和历史恢复都调用 ProjectHub 的 Character 接口：

```text
Panel / Character Studio Session
→ ProjectHubClient
→ Character Core 或现有模块接口
→ CharacterState revision
→ OperationEvent
→ integration ModulePatch
→ ProjectState revision
→ SharedWorker / BroadcastChannel / localStorage 回退
```

`character.load` 只切换活动人物，不改 CharacterProfile version。`character.restore` 从历史快照创建一个新的当前版本，保留原有历史，不覆盖或删除旧版本。

## 保存和刷新恢复

结构化 ProjectState 快照写入 IndexedDB：

```text
projects
snapshots
events
resources
resourceBlobs
```

每个快照同时保存当前 CharacterProfile、CharacterState revision、项目 revision、各人物模块引用和 `appearance_revision` 摘要。刷新后，session 只在 IndexedDB 快照比当前 ProjectHub 状态更新时执行无增量的持久化恢复；恢复历史本身不会伪造新的编辑事件。

大文件通过 `saveResource()` 写入 OPFS：

```text
/humanoid-rig-lab-next/<projectId>/character-resources/<assetId>
```

OPFS 不可用时才回退为 IndexedDB Blob。ProjectState、ModulePatch、OperationEvent 和导出 JSON 都会拒绝 Blob、ArrayBuffer、TypedArray 和内联 base64；普通消息只携带 asset ID、哈希、MIME、字节数和路径摘要。

## 导出

导出协议：

```text
humanoid_rig/character_profile_export@1.0
```

导出内容：

```text
项目和构建版本
CharacterProfile schema 与 profile
CharacterState / ProjectState revision
Proportion、BodyShape、Skin、Face、Clothing、Appearance、Pose、Animation 引用
资源引用摘要
binary_payloads_included: false
```

Schema 位于 `schemas/character-profile-export.schema.json`。

## Shell / Panels 对接

Shell 只需在窗口启动时创建一个 ProjectHubClient 和一个 session，并在关闭前调用 `flush()`。Panels 读取同一个 hub 的快照，并把正式修改交给现有模块接口或 session 方法；不要直接改写快照，也不要建立第二套 CharacterManager。

页面下载按钮可以对 `exportCharacterProfile()` 的返回值执行 `JSON.stringify` 或调用 `serializeCharacterProfileExport()`。资源面板把 Blob 交给 `saveResource()`，只把返回的引用元数据交给具体人物模块保存。

Three.js 视口、摄像机、GPU 资源和面板布局继续属于窗口私有状态，不进入 Character Studio session。
