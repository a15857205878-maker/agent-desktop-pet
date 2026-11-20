"""Read-only checks for a relocated public source installation."""

import importlib.util
import json
import ntpath
from pathlib import Path
import sys
from urllib.parse import unquote

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
MODEL_DIR = Path("web/appearances/dragon-live")
LIB_DIR = Path("web/lib")
MODEL_FILES = ("dragon.states.model3.json", "catalog.json", "rig-map.json")
CORE_SCRIPT = "live2dcubismcore.min.js"
RENDERER_SCRIPTS = ("pixi-v6.min.js", "pixi-live2d-display-cubism4.min.js")
SCRIPT_ALIASES = {RENDERER_SCRIPTS[0]: ("pixi.min.js",), RENDERER_SCRIPTS[1]: ("cubism4.min.js",)}
REQUIRED_REACTIONS = ("ReactionNod", "ReactionCurious", "ReactionChuckle", "ReactionShake",
                      "ReactionWink", "ReactionLookAround", "ReactionCheer")


def model_references(data):
    refs = data["FileReferences"]
    moc, textures = refs["Moc"], refs["Textures"]
    if (data.get("Version") != 3 or not isinstance(moc, str) or not moc
            or not isinstance(textures, list) or not textures):
        raise ValueError("需要 Version 为 3，并提供 FileReferences.Moc 和 Textures")
    names = [moc, *textures]
    names.extend(refs[key] for key in ("Physics", "Pose", "DisplayInfo", "UserData") if refs.get(key))
    names.extend(item["File"] for item in refs.get("Expressions", []))
    for entries in refs.get("Motions", {}).values():
        for item in entries:
            names.append(item["File"])
            if item.get("Sound"):
                names.append(item["Sound"])
    return names


def model_problems(base, placement):
    root = base / MODEL_DIR
    problems = []
    for filename in MODEL_FILES:
        path = root / filename
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except FileNotFoundError:
            problems.append(f"缺少角色文件 {(MODEL_DIR / filename).as_posix()}")
            continue
        except json.JSONDecodeError as exc:
            problems.append(f"{filename} 的第 {exc.lineno} 行不是有效的 JSON，请重新解压或检查清单")
            continue
        except (OSError, UnicodeError):
            problems.append(f"无法读取 {filename}，请确认它是可读的 UTF-8 文件")
            continue
        try:
            if filename == MODEL_FILES[0]:
                for name in dict.fromkeys(model_references(data)):
                    if not isinstance(name, str) or not name.strip():
                        raise ValueError("FileReferences 中的路径需要是非空文本")
                    raw_path = unquote(name).replace("\\", "/")
                    relative = Path(raw_path)
                    if (ntpath.splitdrive(raw_path)[0] or raw_path.startswith("/") or
                            "#" in name or "?" in name or any(char in raw_path for char in ':*?"<>|\0')):
                        target = None
                    else:
                        target = (root / relative).resolve()
                    if target is None or not target.is_relative_to(root.resolve()):
                        message = f"模型清单中的 {name} 需要改为龙娘模型目录内的相对路径"
                        problems.append(message)
                        placement.append(message)
                    elif not target.is_file():
                        problems.append(f"模型清单引用的文件缺失 {name}")
                motions = data["FileReferences"].get("Motions", {})
                missing = [group for group in REQUIRED_REACTIONS if not motions.get(group)]
                if missing:
                    problems.append("模型缺少桌宠启动所需动作组 " + "、".join(missing))
            elif filename == "catalog.json":
                if not isinstance(data, list) or not any(
                        isinstance(row, dict) and row.get("id") == "idle" and isinstance(row.get("values"), dict)
                        for row in data):
                    problems.append("catalog.json 需要提供 idle 参数表")
            elif not isinstance(data, dict):
                problems.append("rig-map.json 必须为 JSON 对象")
        except ValueError as exc:
            problems.append(f"{filename} 格式有误：{exc}")
        except (OSError, RuntimeError, TypeError, KeyError, AttributeError):
            problems.append(f"无法读取或解析 {filename}，请核对安装指南中的角色格式")
    return problems


def script_problem(base, filename):
    path = base / LIB_DIR / filename
    label = path.relative_to(base).as_posix()
    try:
        with path.open("rb") as script:
            head = script.read(2048).decode("utf-8-sig", errors="replace").lstrip()
    except FileNotFoundError:
        return f"缺少 {label}"
    except OSError:
        return f"无法读取 {label}，请确认它是可读的文件"
    if not head or head.startswith("<"):
        return f"{label} 为空或保存成了网页，请按安装指南重新保存脚本"
    return None


def placement_problems(base):
    problems = []
    web = base / "web"
    directories = [base, web, base / "lib", base / "dragon-live", web / "dragon-live",
                   web / "appearances", base / MODEL_DIR, base / LIB_DIR,
                   web / "appearances/dragon", web / "appearances/dragon-live/dragon-live"]
    for directory in (web, base / MODEL_DIR.parent, base / MODEL_DIR, base / LIB_DIR):
        label = directory.relative_to(base).as_posix()
        try:
            if directory.exists() and not directory.is_dir():
                problems.append(f"{label} 应为文件夹，请先移开同名文件")
        except OSError:
            problems.append(f"无法访问目录 {label}，请检查读取权限")
    for directory, names in ((MODEL_DIR, MODEL_FILES), (LIB_DIR, (CORE_SCRIPT, *RENDERER_SCRIPTS))):
        for name in names:
            expected = base / directory / name
            label = expected.relative_to(base).as_posix()
            try:
                if expected.is_file():
                    continue
                if expected.is_dir():
                    problems.append(f"{label} 应为文件，请先移开同名文件夹")
            except OSError:
                continue
            alternatives = (name, *SCRIPT_ALIASES.get(name, ()))
            candidates = (*alternatives, *(alias + ext for alias in alternatives for ext in (".txt", ".html")))
            for folder in directories:
                for candidate in candidates:
                    found = folder / candidate
                    try:
                        if found != expected and found.is_file() and found.resolve().is_relative_to(base):
                            problems.append(f"找到 {found.relative_to(base).as_posix()}\n应放在 {label}")
                    except (OSError, RuntimeError):
                        continue
    return problems


def asset_report(base=BASE):
    """Check asset files without importing the host or executing its JavaScript."""
    base = base.resolve()
    placement = placement_problems(base)
    return {
        "model": model_problems(base, placement),
        "core": [issue] if (issue := script_problem(base, CORE_SCRIPT)) else [],
        "renderer": [issue for name in RENDERER_SCRIPTS if (issue := script_problem(base, name))],
        "placement": placement,
    }


def environment_problems():
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
    try:
        from pet_paths import data_dir
        data_dir()
    except (OSError, ValueError) as exc:
        problems.append(str(exc))
    return problems


def check(*, living_space=False):
    problems = environment_problems()
    for issues in asset_report().values():
        problems.extend(problem for problem in issues if problem not in problems)
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
    return problems


if __name__ == "__main__":
    problems = check(living_space="--living-space" in sys.argv)
    print("\n".join(problems) if problems else "启动文件检查通过。系统还需安装 WebView2 Runtime 并具备可用图形驱动。")
    raise SystemExit(2 if problems else 0)
