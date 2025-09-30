@echo off
chcp 65001 > nul
cls

echo 🎨 你画我猜 - 联机游戏启动器
echo ================================
echo.

echo 正在启动服务器...
echo.

echo 📍 游戏地址：
echo    本机访问: http://localhost:3000
echo    本机访问: http://127.0.0.1:3000
echo    局域网访问: http://[你的IP地址]:3000
echo.

echo 💡 获取你的IP地址命令: ipconfig
echo.

echo 🎮 游戏规则：
echo    1. 输入昵称和房间号（可选）
echo    2. 等待其他玩家加入
echo    3. 轮流画图和猜词
echo    4. 每轮60秒，共3轮
echo.

echo 🌐 服务器监听所有网络接口 (0.0.0.0:3000)
echo ⚠️  按 Ctrl+C 停止服务器
echo.

node server.js

pause