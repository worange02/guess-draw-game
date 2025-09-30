#!/bin/bash

echo "🎨 你画我猜 - 本地运行"
echo "==================="

# 获取本机IP
IP=$(hostname -I | cut -d' ' -f1 2>/dev/null || ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)

if [ -z "$IP" ]; then
    # 尝试其他方法获取IP
    IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || echo "未知")
fi

echo "📍 游戏地址："
echo "   本机访问: http://localhost:3000"
echo "   本机访问: http://127.0.0.1:3000"
if [ "$IP" != "未知" ] && [ "$IP" != "localhost" ]; then
    echo "   局域网访问: http://$IP:3000"
    echo ""
    echo "🌐 分享局域网地址给朋友一起玩："
    echo "   👉 http://$IP:3000"
fi
echo ""
echo "🎮 服务器将监听所有网络接口 (0.0.0.0:3000)"
echo "⚠️  按 Ctrl+C 停止服务器"
echo ""

# 启动服务器
node server.js