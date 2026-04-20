@echo off
setlocal enabledelayedexpansion

rem ===========================================================
rem Build DICT-FaceCheckin.exe with PyInstaller
rem
rem Usage:   build.bat
rem Output:  dist\DICT-FaceCheckin.exe
rem          Also copied to ..\downloads\DICT-FaceCheckin.exe
rem          (served by GET /api/cv-station/download)
rem ===========================================================

cd /d "%~dp0"

echo.
echo ===== [1/4] Checking Python =====
where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python is not on PATH. Install Python 3.10+ first.
  exit /b 1
)
python --version

echo.
echo ===== [2/4] Creating / refreshing virtualenv =====
if not exist .venv (
  python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR: pip install failed
  exit /b 1
)

echo.
echo ===== [3/4] Running PyInstaller =====
rem Clean previous build artefacts
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist DICT-FaceCheckin.spec del /q DICT-FaceCheckin.spec

python -m PyInstaller ^
  --name DICT-FaceCheckin ^
  --onefile ^
  --noconsole ^
  --version-file version.txt ^
  --collect-all cv2 ^
  --hidden-import PIL.ImageTk ^
  --hidden-import PIL._tkinter_finder ^
  main_fixed.py
if errorlevel 1 (
  echo ERROR: PyInstaller build failed
  exit /b 1
)

echo.
echo ===== [4/4] Copying to web app downloads folder =====
set TARGET=..\downloads
if not exist "%TARGET%" mkdir "%TARGET%"
copy /y dist\DICT-FaceCheckin.exe "%TARGET%\DICT-FaceCheckin.exe" >nul
if errorlevel 1 (
  echo WARNING: Could not copy into %TARGET% — you can copy it manually.
) else (
  echo Copied to %TARGET%\DICT-FaceCheckin.exe
)

echo.
echo ===== Build complete =====
echo Output: %CD%\dist\DICT-FaceCheckin.exe
for %%I in ("dist\DICT-FaceCheckin.exe") do echo Size:   %%~zI bytes
echo.
echo The web app will now serve this file from GET /api/cv-station/download
echo (admin auth required).

endlocal
