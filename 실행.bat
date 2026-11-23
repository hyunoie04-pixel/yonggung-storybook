@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 스토리북 서버를 시작합니다. 이 창을 닫으면 서버가 꺼집니다.
start "" "http://127.0.0.1:8765/"
node server.js
pause
