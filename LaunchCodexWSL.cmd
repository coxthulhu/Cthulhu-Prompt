@echo off
setlocal

REM Choose your WSL distro name (see `wsl -l`)
set "WSL_DISTRO=Ubuntu"

REM Use the folder the script lives in (works when double-clicked).
REM If you prefer the caller's working dir when run from a console, use %CD% instead.
set "WIN_DIR=%~dp0"

REM Remove trailing backslash for consistency
if "%WIN_DIR:~-1%"=="\" set "WIN_DIR=%WIN_DIR:~0, -1%"

REM Convert Windows path -> WSL path (e.g., C:\... -> /mnt/c/...)
for /f "usebackq delims=" %%I in (`wsl.exe -d %WSL_DISTRO% wslpath -a "%WIN_DIR%"`) do set "WORK_DIR=%%I"

REM Start Codex in that directory and leave an interactive shell open
wsl.exe -d %WSL_DISTRO% -- bash -lic "cd \"%WORK_DIR%\" && codex; exec bash"

endlocal
