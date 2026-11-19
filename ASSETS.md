# 素材接口

## 桌面角色

角色目录为 `web/appearances/dragon-live/`。`dragon.states.model3.json` 使用 Cubism 4 的 model3 格式，`FileReferences` 中列出的文件相对于此目录。控制器读取以下配置。

| 文件或内容 | 用途 |
| --- | --- |
| `catalog.json` | 一组带 `id`、`type` 和 `values` 的对象。需要 `idle`，表情项使用 `type: "expression"`，`values` 包含与模型一致的数值参数。 |
| `rig-map.json` | 模型对应的 JSON 参数映射对象。 |
| `Idle`、`Blink`、`ReactionNod` 等动作组 | 供模型按状态播放。完整组名和参数名见 `web/pet-dragon-live.js`。 |
| `web/appearances/dragon/01-idle.png` | 可选设置预览图和网页图标。 |

替换角色时，需为自己的 rig 调整控制器参数、动作组和表情映射。预检校验文件和配置结构，实际显示效果由模型参数和纹理决定。

## 生活空间

| `living-space/assets/` 中的文件 | 用途 |
| --- | --- |
| `room.glb`、`yard.glb` | 室内和院落基础模型。源代码按节点名找门、灯和交互家具，替换模型时要相应匹配这些节点。 |
| `actor.png`、`armchair.png` | 室内角色和扶手椅素材。 |
| `front.png`、`back.png`、`sit.png` | 户外角色三种姿态。锚点按 `outdoor-actor.mjs` 中的 1024 像素坐标配置。 |
| `room-walk.png` | 可选走路帧表，室内外共用。与 `bedroom-walk.mjs` 中的裁切边界匹配。 |
| `room-bed-sit.png`、`room-lying.png`、`room-rise.png`、`room-stretch.png` | 可选室内姿态素材。 |

分层小屋另从 `web/home/` 读取日间和夜间的 `day-background.png`、`day-foreground.png`、`night-background.png`、`night-foreground.png`。构图应匹配 `room-layers.json` 中的尺寸和角色位置。
