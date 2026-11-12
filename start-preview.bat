@echo off
REM Windows: double-click this file to preview the website.
cd /d "%~dp0"
echo Preview running at http://localhost:8000  (close this window to stop)
start "" http://localhost:8000
python -m http.server 8000
