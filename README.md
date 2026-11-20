# 龙娘桌宠

2026.11.20.2 公开源码模板，面向 Windows x64。桌面 Live2D 角色支持状态表情、鼠标跟随和互动，生活空间包含小屋、院落、广场与果园。启动前请自行准备有权使用的角色模型和 SDK，场景素材按需准备。

## 本版更新

- 新增双击安装诊断，检查模型、Cubism Core、渲染脚本及文件位置，并可直接打开目标目录。
- 主动张望时按角色动作控制视线，暂停时固定在当前表情的视线位置。
- 调整小屋行走时脚下的阴影、坐回书房椅子的落座过渡，以及躺下和起身时的床面变化。广场站定转向时脚底贴地，果园收获后果实从树枝飞入篮子。

## 安装与启动

从发布页的 Assets 下载 `DragonDesktopPet-2026.11.20.2-source.zip` 并完整解压。依赖下载地址、完整目录示例和故障排查见 [龙娘桌宠安装指南](龙娘桌宠安装指南.md)。

1. 安装 Windows x64 版 CPython 3.12 和 Microsoft Edge WebView2 Runtime。
2. 在解压目录双击 `安装依赖.cmd`，将锁定的 Python 依赖安装到 `.venv`。
3. 将 PixiJS 6.5.10 浏览器版、Pixi Live2D Display 的 Cubism 4 版和 Live2D Cubism Core 放进 `web/lib/`，文件名依次为 `pixi-v6.min.js`、`pixi-live2d-display-cubism4.min.js`、`live2dcubismcore.min.js`。
4. 将有权使用且适配龙娘控制器的角色放进 `web/appearances/dragon-live/`。同目录放 `dragon.states.model3.json`、`catalog.json`、`rig-map.json`，并保留清单引用的纹理、模型、动作和表情文件的相对路径。使用普通 Cubism 4 模型需要适配控制器，具体接口见 [素材接口](ASSETS.md)。
5. 双击 `龙娘安装诊断.cmd`，查看模型、Cubism Core、渲染脚本和文件位置。可以直接打开目标目录，补齐后点「重新检查」。检查通过后双击 `启动桌宠.cmd`，需要退出时用 `停止桌宠.cmd`。终端检查仍可运行 `.\诊断.cmd`。

设置、游戏成绩、日志和缓存默认保存在 `%LOCALAPPDATA%\AgentDesktopPet`。同时使用多套安装时，可设置 `AGENT_PET_DATA_DIR` 指定独立的绝对路径，数据目录与源码目录须互不包含。桌面快捷方式、自启项和单实例标识按数据路径区分。`AGENT_PET_PYTHON` 可指定该安装使用的 Python 解释器。

## 构建生活空间

小屋与院落可以在桌面角色启动成功后配置。用 Node.js 24 和 pnpm 11.25.0 在 `living-space/` 执行 `pnpm install --frozen-lockfile`。按 [素材接口](ASSETS.md) 准备有权使用的素材并放到 `living-space/assets/`，然后执行 `pnpm run build`。构建会把场景素材与本版动作代码组装到小屋、院落和小镇院落页面。完整命令、构建路径和分层图检查见 [龙娘桌宠安装指南](龙娘桌宠安装指南.md)。也可以通过 `PET_LIVING_ASSETS` 指定素材目录，通过 `PET_WEB_OUTPUT` 指定构建输出目录。

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
