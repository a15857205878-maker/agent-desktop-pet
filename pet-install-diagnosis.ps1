$diagnosis = Join-Path $PSScriptRoot 'pet_install_diagnosis.py'
$localPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
$python = if ($env:AGENT_PET_PYTHON -and (Test-Path -LiteralPath $env:AGENT_PET_PYTHON -PathType Leaf)) {
    $env:AGENT_PET_PYTHON
} elseif (Test-Path -LiteralPath $localPython -PathType Leaf) {
    $localPython
}

$pythonOptions = @()
if (-not $python) {
    $launcher = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($launcher) {
        & $launcher.Source -3.12 --version *> $null
        if ($LASTEXITCODE -eq 0) {
            $python = $launcher.Source
            $pythonOptions = @('-3.12')
        }
    }
    $systemPython = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $python -and $systemPython -and $systemPython.Source -notlike '*\Microsoft\WindowsApps\*') {
        & $systemPython.Source -c 'import sys; sys.exit(not (sys.version_info[:2] == (3, 12) and sys.maxsize > 2**32))' *> $null
        if ($LASTEXITCODE -eq 0) { $python = $systemPython.Source }
    }
}

if ($python) {
    & $python @pythonOptions -X utf8 -B $diagnosis
    if ($LASTEXITCODE -eq 0) { exit 0 }
    $message = '无法打开诊断窗口。请确认当前 Python 安装包含 Tcl/Tk，或运行 诊断.cmd 查看命令行检查结果。'
} else {
    $message = '需要先安装 Windows x64 版 CPython 3.12（含 Tcl/Tk）。安装后双击 安装依赖.cmd，再打开龙娘安装诊断。'
}

Add-Type -AssemblyName System.Windows.Forms
[void][System.Windows.Forms.MessageBox]::Show($message, '龙娘安装诊断', 'OK', 'Warning')
exit 2
