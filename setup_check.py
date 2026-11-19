"""Read-only checks for a relocated public source installation."""

import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent


def model_references(model):
    data = json.loads(model.read_text(encoding="utf-8-sig"))
    refs = data["FileReferences"]
    moc, textures = refs["Moc"], refs["Textures"]
    if (data.get("Version") != 3 or not isinstance(moc, str) or not moc
            or not isinstance(textures, list) or not textures):
        raise ValueError("Cubism 4 / Moc / Textures")
    names = [moc, *textures]
    names.extend(refs[key] for key in ("Physics", "Pose", "DisplayInfo", "UserData") if refs.get(key))
    names.extend(item["File"] for item in refs.get("Expressions", []))
    for entries in refs.get("Motions", {}).values():
        for item in entries:
            names.append(item["File"])
            if item.get("Sound"):
                names.append(item["Sound"])
    return names


def model_problems():
    root = BASE / "web/appearances/dragon-live"
    model = root / "dragon.states.model3.json"
    required = (model, root / "catalog.json", root / "rig-map.json")
    missing = [f"缺少角色文件 {p.relative_to(BASE).as_posix()}，请按 README 补齐素材" for p in required
               if not p.is_file()]
    if missing:
        return missing
    try:
        problems = []
        for name in model_references(model):
            if not isinstance(name, str) or not name:
                raise ValueError("Model file reference")
            relative = Path(name)
            target = (root / relative).resolve()
            if (relative.is_absolute() or not target.is_relative_to(root.resolve()) or not target.is_file()):
                problems.append("模型引用无效或文件缺失 " + name)
        catalog = json.loads(required[1].read_text(encoding="utf-8-sig"))
        if not isinstance(catalog, list) or not any(
                isinstance(row, dict) and row.get("id") == "idle" and isinstance(row.get("values"), dict)
                for row in catalog):
            problems.append("catalog.json 需要提供 idle 参数表")
        if not isinstance(json.loads(required[2].read_text(encoding="utf-8-sig")), dict):
            problems.append("rig-map.json 必须为 JSON 对象")
        return problems
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        return ["角色配置或模型清单有误 " + type(exc).__name__]


def check(*, living_space=False):
    problems = []
    if sys.platform != "win32" or sys.maxsize <= 2**32:
        problems.append("仅支持 Windows x64")
    for module in ("clr", "webview"):
        if importlib.util.find_spec(module) is None:
            problems.append(f"缺少 Python 依赖 {module}，请运行 安装依赖.cmd")
    spec = importlib.util.find_spec("webview")
    if spec and spec.origin:
        lib = Path(spec.origin).parent / "lib"
        for name in ("Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll",
                     "runtimes/win-x64/native/WebView2Loader.dll"):
            if not (lib / name).is_file():
                problems.append("pywebview 缺少运行库 " + name)
    for name in ("pixi-v6.min.js", "pixi-live2d-display-cubism4.min.js", "live2dcubismcore.min.js"):
        if not (BASE / "web/lib" / name).is_file():
            problems.append(f"缺少 web/lib/{name}，请按 README 安装第三方组件")
    problems.extend(model_problems())
    if living_space:
        for name in ("day-background.png", "day-foreground.png", "night-background.png", "night-foreground.png"):
            if not (BASE / "web/home" / name).is_file():
                problems.append("缺少小屋分层素材 web/home/" + name)
        for name, marker in (("room3d.html", "window.poseAssets="),
                             ("yard/index.html", "window.yardData="),
                             ("town/yard/index.html", "window.yardData=")):
            page = BASE / "web/home" / name
            if not page.is_file() or "data:model/gltf-binary;base64," not in page.read_text(
                    encoding="utf-8").split(marker, 1)[-1].partition("</script>")[0]:
                problems.append(f"请用已获授权素材构建 web/home/{name}")
    try:
        from pet_paths import data_dir
        data_dir()
    except (OSError, ValueError) as exc:
        problems.append(str(exc))
    return problems


if __name__ == "__main__":
    problems = check(living_space="--living-space" in sys.argv)
    print("\n".join(problems) if problems else "启动文件检查通过。系统还需安装 WebView2 Runtime 并具备可用图形驱动。")
    raise SystemExit(2 if problems else 0)
