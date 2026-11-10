# Agent 桌宠

这是从现用桌宠白名单导出的可审查源码模板，包含管家、小屋、院落、小镇接入、自动生活及手机观察所需的公开活动状态。不是完整安装包。没有角色、Live2D Core、场景图、GLB、运行环境或私人资料；缺资源时预检非零退出，不打开 GUI。角色和SDK需按以下说明自行准备。

## 安装与预检

Windows x64、CPython 3.12。新位置解压后在 PowerShell 运行：

```powershell
py -3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.lock.txt
.venv/Scripts/python.exe -X utf8 -B setup_check.py
```

自行按各自许可获取 `web/lib/pixi-v6.min.js` (6.5.10)、`pixi-live2d-display-cubism4.min.js` 与 `live2dcubismcore.min.js`；不提供免除 SDK 条款的下载镜像。将自己有权使用的 Cubism4 模型放到 `web/model/`，提供 Live2D model3 格式的 `settings.json`，含 Moc/Textures/Motions/Expressions 引用。原角色说明仅作为来源证据保留在 licenses。角色映射/动作名称需要匹配你自己的模型。

系统另需 Microsoft Edge WebView2 Runtime 与可用图形驱动。Python 安装后由 pywebview 包定位 WebView2 SDK DLL，不复用其他软件的 vendor。预检通过后运行 `启动桌宠.cmd`。`诊断.cmd` 只预检；`停止桌宠.cmd` 只写本公开 profile 的正常停止请求。

状态默认写 `%LOCALAPPDATA%/AgentDesktopPet`，可设绝对路径 `AGENT_PET_DATA_DIR`，禁止与源码互相包含。安装脚本采用自己的 `.venv`；可用 `AGENT_PET_PYTHON` 指定解释器。公开 profile 的 mutex/桌面和自启快捷方式按数据目录计算标识，与原安装分开。默认额度模式 off，不自动配置真实账户。

## 生活空间源码与构建

`living-space/src` 保存当前小屋/院落 47 个模块、模板、样式和纯逻辑测试；`web/home/*.html` 是当前生产代码移除内嵌图像/模型后的审查副本，未补素材前不能呈现正常画面。

在 living-space 目录先用 pnpm 11.25.0 执行 `pnpm install --frozen-lockfile`，再 `pnpm run build`；已附 pnpm-lock.yaml。three 固定 0.187.0、esbuild 固定 0.28.2。将已确认权利的 room.glb、actor.png、armchair.png、yard.glb、front.png、back.png、sit.png、home.png、plaza.png、orchard.png 放到 living-space/assets，或设置 `PET_LIVING_ASSETS`。脚本输出本仓库 web/home/room3d.html、yard/index.html、town/yard/index.html，不部署到现用应用。需要原分层小屋入口时还需自行提供 web/home/day-background.png、day-foreground.png、night-background.png、night-foreground.png，并匹配 room-layers.json。龙娘桌面形象资源也未包含。

小镇业务和原小镇源码归工作站所有。同次本地交付的 `../personal-workstation/components/宝可梦小镇新版/frontend` 含其源码/锁文件，运行 `node scripts/build.mjs`，仅把经权利核实后的 dist/index.html 和 dist/assets 复制到桌宠 `web/home/town/`；保留 town/yard。原小镇树果、收藏、计时不另建第二份数据。桌宠独立启动不要求安装工作站；小镇业务连接未配置时显示离线/不可用。

在公开数据目录自行添加 `workbench_link.json`，仅含绝对 `workbench_root`，工作站凭据仍由其所有者保管；`app_link.json` 为可选应用联动，未配置不阻塞桌宠。`assistant_tools.json` 首次生成为空列表，显式配置工具入口后使用。手机 Proxy/配对程序归工作站远程模块，桌宠只发布带 TTL 的 pet-activity.status.json；不复制 pairing.json、不开放新路由或公网端口。若外部适配器仍以旧安装目录找状态，须更新到公开数据目录。

## 权利与验收

LICENSE 与 THIRD-PARTY.md 逐字节保留，包括历史作者占位行；不把工作站 MIT 署名套给桌宠。原文件来源分类见来源与依赖清单.json（历史快照），本次准确导出哈希见 SOURCE-MANIFEST.json 与 SHA256SUMS。后续新增不等于已证明原创。Three MIT 及原房间 CC0 说明保留；未知图片、角色、SDK 不随包分发。详见 EXCLUSIONS.md、RELEASE-AUDIT.md。

可额外运行 `python -X utf8 -B setup_check.py --living-space` 检查可选生活空间资源。普通桌宠预检不强制要求工作站/小镇服务。

## 当前菜单

四个紫色线条图标靠近可见角色排列；鼠标接近或键盘选中时显示名称，移开后延迟120毫秒收起。互动横向三项，更多先六项，再展开其他入口；名称和子项向外展开，主列开合不跳位。使用逐像素alpha保持无可见圆底与足够点击范围，目标间隙穿透。

菜单按角色可见边界定位并垂直居中，未获得角色尺寸时回退窗口边界；屏幕侧边不足时尝试上下避让。极小工作区无法容纳全部内容时以屏幕内可达为兜底。按Tab/方向键选择、Enter/空格触发、Esc收起。

本地公开副本的Python测试59项、卡片协议Node测试3项通过；原生透明命中、键盘预处理、快速切换与资源释放已有隔离验证。完整角色视觉、所有真实显示器/DPI、休眠恢复、手机跨网与整夜运行仍未全部验收。详见RELEASE-AUDIT.md；这个源码模板需要自行补齐合法素材和SDK。
