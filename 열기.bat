@echo off
chcp 65001 >nul
cd /d "%~dp0"
python serve.py
if errorlevel 1 (
  echo.
  echo   [!] 실행하지 못했습니다. Python 이 설치되어 있는지 확인해주세요.
  pause
)