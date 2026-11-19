# 龙娘桌宠

2026.11.20 公开源码模板，面向 Windows x64。桌面 Live2D 角色支持状态表情、鼠标跟随和互动，生活空间包含小屋、院落、广场与果园。此下载需要自行准备有权使用的模型、SDK 和场景素材。

## 本版更新

- 龙娘为默认角色。动作切换从当前姿势平滑接续，表情、眨眼与反应结束后恢复待机。
- 更新悬浮菜单、设置和桌面提醒。配置工作站联动后，任务提醒可打开对应任务。
- 更新广场长椅坐下、果园采果的过渡与朝向，更新小屋和户外区域切换时的动画恢复及资源清理。

## 安装与启动

1. 安装 Windows x64 版 CPython 3.12 和 Microsoft Edge WebView2 Runtime。
2. 将 ZIP 解压到自己的目录。在解压出的根目录双击 `安装依赖.cmd`，或在 PowerShell 中运行下面两行。

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
   ```

3. 按原许可获取 PixiJS 6.5.10、Pixi Live2D Display 的 Cubism 4 版本和 Live2D Cubism Core，将它们分别放入 `web/lib/pixi-v6.min.js`、`web/lib/pixi-live2d-display-cubism4.min.js`、`web/lib/live2dcubismcore.min.js`。
4. 将与控制器兼容的角色文件放入 `web/appearances/dragon-live/`。入口为 `dragon.states.model3.json`，同目录需提供 `catalog.json`、`rig-map.json`，以及 model3 清单引用的 moc3、纹理、动作和表情文件。兼容要求见 [素材接口](ASSETS.md)。
5. 双击 `诊断.cmd` 检查。资源缺失时会列出缺项并返回退出码 2。检查通过后双击 `启动桌宠.cmd`。可用 `停止桌宠.cmd` 让该数据目录下的桌宠正常退出。

设置、游戏成绩、日志和缓存默认保存在 `%LOCALAPPDATA%/AgentDesktopPet`。可设置 `AGENT_PET_DATA_DIR` 指定独立的绝对路径。此路径与源码目录须分别存放。桌面快捷方式、自启项和单实例标识按数据路径区分。另有 `AGENT_PET_PYTHON` 可指定该安装使用的 Python 解释器。

## 构建生活空间

1. 在 `living-space/` 下用 Node.js 24 和 pnpm 11.25.0 执行 `pnpm install --frozen-lockfile`。
2. 将有权使用的素材放入 `living-space/assets/`，或让环境变量 `PET_LIVING_ASSETS` 指向素材目录。文件名和用途见 [素材接口](ASSETS.md)。
3. 执行 `pnpm run build`。构建结果写入本安装的 `web/home/room3d.html`、`web/home/yard/index.html` 和 `web/home/town/yard/index.html`。设置 `PET_WEB_OUTPUT` 可指定输出位置。
4. 额外提供分层素材后，运行 `.\.venv\Scripts\python.exe -X utf8 -B setup_check.py --living-space` 检查小屋与院落。有素材前，包内的审查用 HTML 可查看生产逻辑。

## 可选联动

工作站入口在数据目录内的 `workbench_link.json` 配置，字段为 `workbench_root`，值是工作站的绝对路径。可选的 `app_link.json` 和 `assistant_tools.json` 也放在这个数据目录。首次启动会创建一个空工具列表，余额模式默认为关闭。

如需完整小镇功能，独立构建有权使用的小镇前端，再把其入口和静态文件放入 `web/home/town/`，并保留 `town/yard/`。果园、工作站任务等跨应用功能依赖对应服务。移动端观察由工作站的远程模块配置，桌宠提供带有效期的本地 `pet-activity.status.json`。

## 测试与许可

```powershell
python -X utf8 -B -m unittest discover -s tests
node --test "tests/*.test.cjs"
cd living-space
pnpm test
```

测试使用合成素材或模拟模型接口。原始角色表情测试可在具备匹配资源时设置 `DRAGON_TEST_WEB` 指向相应的 `web/` 后运行。原许可、第三方及素材声明见 [LICENSE](LICENSE)、[THIRD-PARTY.md](THIRD-PARTY.md) 和 `licenses/`。本包范围及验证见 [EXCLUSIONS.md](EXCLUSIONS.md) 与 [RELEASE-AUDIT.md](RELEASE-AUDIT.md)。
