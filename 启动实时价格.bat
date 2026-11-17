@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 电脑购买大世界 - 实时价格服务
start "" /min cmd /c "node server.mjs"
ping 127.0.0.1 -n 3 >nul
start "" http://127.0.0.1:8787/
echo.
echo 已启动本地实时价格服务并打开页面。
echo 想停止服务：关闭那个最小化的「node server.mjs」窗口即可。
timeout /t 3 >nul
