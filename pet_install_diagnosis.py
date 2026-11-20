"""Standalone Windows UI for the source template's read-only preflight."""

import os
from pathlib import Path
import subprocess
import tkinter as tk
from tkinter import messagebox, ttk

from setup_check import BASE, LIB_DIR, MODEL_DIR, asset_report, environment_problems


SECTIONS = (
    ("model", "龙娘模型", MODEL_DIR, "打开模型目录"),
    ("core", "Cubism Core", LIB_DIR, "打开脚本目录"),
    ("renderer", "渲染脚本", LIB_DIR, "打开脚本目录"),
    ("placement", "文件位置", Path(), "打开安装目录"),
    ("environment", "Python 环境", Path(), ""),
)
BACKGROUND = "#f6f8f7"
INK = "#17332d"
MUTED = "#415b52"
READY = "#266247"
ACTION = "#9a481e"
FONT = "Microsoft YaHei UI"


def inspect_installation():
    report = asset_report()
    problems = environment_problems()
    custom = os.environ.get("AGENT_PET_PYTHON")
    if custom and not Path(custom).is_file():
        problems.insert(0, "AGENT_PET_PYTHON 指向的解释器不存在，请修正该路径。")
    elif not custom and not (BASE / ".venv/Scripts/python.exe").is_file():
        problems.insert(0, "启动桌宠所需的 .venv 尚未创建，请双击 安装依赖.cmd。")
    report["environment"] = problems
    return report


class DiagnosisWindow:
    def __init__(self, window):
        self.window = window
        self.status = {}
        window.title("龙娘安装诊断")
        window.configure(bg=BACKGROUND)
        window.minsize(600, 575)
        window.geometry("720x650")
        window.bind("<F5>", lambda event: self.refresh())

        style = ttk.Style(window)
        style.configure("TButton", font=(FONT, 10), padding=(9, 5))
        content = tk.Frame(window, bg=BACKGROUND, padx=26, pady=21)
        content.pack(fill="both", expand=True)
        content.columnconfigure(0, weight=1)
        content.rowconfigure(4, weight=1)

        tk.Label(content, text="龙娘安装诊断", font=(FONT, 20, "bold"),
                 bg=BACKGROUND, fg=INK).grid(row=0, column=0, sticky="w")
        self.summary = tk.Label(content, font=(FONT, 11), bg=BACKGROUND, fg=MUTED, anchor="w")
        self.summary.grid(row=1, column=0, sticky="ew", pady=(4, 14))

        checks = tk.Frame(content, bg="white", highlightbackground="#d5e0da", highlightthickness=1)
        checks.grid(row=2, column=0, sticky="ew")
        checks.columnconfigure(0, weight=1)
        for row, (key, title, directory, action) in enumerate(SECTIONS):
            tk.Label(checks, text=title, font=(FONT, 11), bg="white", fg=INK).grid(
                row=row, column=0, sticky="w", padx=14, pady=7)
            status = tk.Label(checks, font=(FONT, 10, "bold"), bg="white", padx=10)
            status.grid(row=row, column=1, sticky="w")
            self.status[key] = status
            if action:
                ttk.Button(checks, text=action, command=lambda folder=directory: self.open_directory(folder)).grid(
                    row=row, column=2, padx=(4, 12), pady=3, sticky="ew")

        tk.Label(content, text="检查详情", font=(FONT, 11, "bold"), bg=BACKGROUND, fg=INK).grid(
            row=3, column=0, sticky="w", pady=(14, 6))
        details = tk.Frame(content, bg="white", highlightbackground="#d5e0da", highlightthickness=1)
        details.grid(row=4, column=0, sticky="nsew")
        self.details = tk.Text(details, height=8, wrap="char", bg="white", fg=MUTED, relief="flat",
                               font=(FONT, 10), padx=12, pady=9, spacing2=2, highlightthickness=0)
        self.details.tag_configure("section", foreground=INK, font=(FONT, 10, "bold"))
        scrollbar = ttk.Scrollbar(details, orient="vertical", command=self.details.yview)
        self.details.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self.details.pack(side="left", fill="both", expand=True)

        footer = tk.Frame(content, bg=BACKGROUND)
        footer.grid(row=5, column=0, sticky="ew", pady=(12, 0))
        rerun = ttk.Button(footer, text="重新检查", command=self.refresh)
        rerun.pack(side="left")
        ttk.Button(footer, text="安装指南", command=self.open_guide).pack(side="left", padx=8)
        ttk.Button(footer, text="关闭", command=window.destroy).pack(side="right")
        self.refresh()
        rerun.focus_set()

    def refresh(self):
        report = inspect_installation()
        missing = sum(bool(issues) for issues in report.values())
        self.summary.configure(text=(f"有 {missing} 项需要处理，补齐后点击「重新检查」。"
                                     if missing else "启动文件检查通过，可以返回安装目录启动桌宠。"))
        self.details.configure(state="normal")
        self.details.delete("1.0", "end")
        for key, title, _, _ in SECTIONS:
            issues = report[key]
            ready_text = "未发现错放" if key == "placement" else "通过"
            self.status[key].configure(text="待处理" if issues else ready_text, fg=ACTION if issues else READY)
            if issues:
                self.details.insert("end", title + "\n", "section")
                for issue in issues:
                    self.details.insert("end", "• " + issue.replace("\n", "\n  ") + "\n")
                self.details.insert("end", "\n")
        self.details.insert("end", "文件检查通过后，可启动桌宠验证实际渲染。\n"
                                   "打开模型或脚本目录时，会创建尚未存在的目标文件夹。")
        self.details.configure(state="disabled")
        self.details.yview_moveto(0)

    def open_directory(self, relative):
        directory = BASE / relative
        try:
            if not directory.is_dir():
                if not directory.resolve().is_relative_to(BASE):
                    raise OSError("该路径指向安装目录外，请在安装目录内准备文件夹。")
                directory.mkdir(parents=True, exist_ok=True)
            os.startfile(directory)
        except (OSError, RuntimeError) as exc:
            reason = getattr(exc, "strerror", None) or str(exc)
            messagebox.showerror("无法打开目录", f"{directory}\n\n{reason}", parent=self.window)

    def open_guide(self):
        path = BASE / "龙娘桌宠安装指南.md"
        try:
            subprocess.Popen(["notepad.exe", str(path)])
        except OSError as exc:
            messagebox.showerror("无法打开安装指南", f"{path}\n\n{exc}", parent=self.window)


if __name__ == "__main__":
    window = tk.Tk()
    DiagnosisWindow(window)
    window.mainloop()
