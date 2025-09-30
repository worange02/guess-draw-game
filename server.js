const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 加载词汇
let words = [
    '苹果', '汽车', '房子', '猫咪', '太阳', '月亮', '树木', '花朵',
    '飞机', '船只', '鸟儿', '鱼儿', '蛋糕', '冰淇淋', '雨伞', '眼镜',
    '电脑', '手机', '书本', '铅笔', '足球', '篮球', '自行车', '钟表',
    '蝴蝶', '兔子', '大象', '狮子', '熊猫', '企鹅', '长颈鹿', '老虎'
];

try {
    const wordsData = JSON.parse(fs.readFileSync('./words.json', 'utf8'));
    words = wordsData.words || words;
    console.log(`已加载 ${words.length} 个词汇`);
} catch (error) {
    console.log('使用默认词汇列表');
}

// 游戏状态管理
const rooms = new Map();

class Room {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.currentDrawer = null;
        this.currentWord = '';
        this.roundStartTime = 0;
        this.roundDuration = 60000; // 60秒
        this.gameState = 'waiting'; // waiting, playing, ended
        this.drawingData = [];
        this.scores = new Map();
        this.roundNumber = 0;
        this.maxRounds = 3;
    }

    addPlayer(playerId, playerName) {
        const player = {
            id: playerId,
            name: playerName,
            score: 0,
            hasGuessed: false
        };
        this.players.set(playerId, player);
        this.scores.set(playerId, 0);
        
        if (this.players.size >= 2 && this.gameState === 'waiting') {
            this.startNextRound();
        }
        
        return player;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        this.scores.delete(playerId);
        
        if (this.currentDrawer === playerId) {
            this.startNextRound();
        }
        
        if (this.players.size < 2) {
            this.gameState = 'waiting';
        }
    }

    startNextRound() {
        if (this.players.size < 2) return;
        
        this.roundNumber++;
        if (this.roundNumber > this.maxRounds) {
            this.gameState = 'ended';
            return;
        }

        // 重置猜词状态
        this.players.forEach(player => {
            player.hasGuessed = false;
        });

        // 选择下一个画家
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentDrawer);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        this.currentDrawer = playerIds[nextIndex];

        // 选择新词汇
        this.currentWord = words[Math.floor(Math.random() * words.length)];
        this.roundStartTime = Date.now();
        this.gameState = 'playing';
        this.drawingData = [];
    }

    checkGuess(playerId, message) {
        const player = this.players.get(playerId);
        if (!player || player.hasGuessed || playerId === this.currentDrawer) {
            return false;
        }

        if (message.trim() === this.currentWord) {
            player.hasGuessed = true;
            const timeBonus = Math.max(0, 10 - Math.floor((Date.now() - this.roundStartTime) / 6000));
            const points = 10 + timeBonus;
            player.score += points;
            this.scores.set(playerId, player.score);

            // 给画家加分
            const drawer = this.players.get(this.currentDrawer);
            if (drawer) {
                drawer.score += 5;
                this.scores.set(this.currentDrawer, drawer.score);
            }

            // 检查是否所有人都猜对了
            const allGuessed = Array.from(this.players.values())
                .filter(p => p.id !== this.currentDrawer)
                .every(p => p.hasGuessed);

            if (allGuessed) {
                setTimeout(() => this.startNextRound(), 3000);
            }

            return true;
        }
        return false;
    }

    getGameState() {
        return {
            roomId: this.id,
            players: Array.from(this.players.values()),
            currentDrawer: this.currentDrawer,
            currentWord: this.currentWord,
            gameState: this.gameState,
            roundNumber: this.roundNumber,
            maxRounds: this.maxRounds,
            timeLeft: Math.max(0, this.roundDuration - (Date.now() - this.roundStartTime))
        };
    }
}

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 加入房间
    socket.on('join-room', (data) => {
        const { roomId, playerName } = data;
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Room(roomId));
        }
        
        const room = rooms.get(roomId);
        const player = room.addPlayer(socket.id, playerName);
        
        socket.join(roomId);
        socket.roomId = roomId;
        
        // 发送当前游戏状态
        io.to(roomId).emit('game-state', room.getGameState());
        io.to(roomId).emit('player-joined', player);
        
        // 发送当前绘画数据
        if (room.drawingData.length > 0) {
            socket.emit('drawing-data', room.drawingData);
        }
        
        console.log(`玩家 ${playerName} 加入房间 ${roomId}`);
    });

    // 开始绘画
    socket.on('start-drawing', (data) => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData.push({ type: 'start', ...data });
            socket.to(socket.roomId).emit('drawing', { type: 'start', ...data });
        }
    });

    // 绘画中
    socket.on('drawing', (data) => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData.push({ type: 'draw', ...data });
            socket.to(socket.roomId).emit('drawing', { type: 'draw', ...data });
        }
    });

    // 结束绘画
    socket.on('end-drawing', () => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData.push({ type: 'end' });
            socket.to(socket.roomId).emit('drawing', { type: 'end' });
        }
    });

    // 清空画布
    socket.on('clear-canvas', () => {
        const room = rooms.get(socket.roomId);
        if (room && room.currentDrawer === socket.id) {
            room.drawingData = [];
            io.to(socket.roomId).emit('clear-canvas');
        }
    });

    // 聊天消息/猜词
    socket.on('chat-message', (message) => {
        const room = rooms.get(socket.roomId);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (!player) return;

        const isCorrect = room.checkGuess(socket.id, message);
        
        if (isCorrect) {
            io.to(socket.roomId).emit('correct-guess', {
                playerId: socket.id,
                playerName: player.name,
                word: room.currentWord
            });
            io.to(socket.roomId).emit('game-state', room.getGameState());
        } else {
            // 只有非画家的消息才会被广播（隐藏答案）
            if (socket.id !== room.currentDrawer) {
                io.to(socket.roomId).emit('chat-message', {
                    playerId: socket.id,
                    playerName: player.name,
                    message: message,
                    timestamp: Date.now()
                });
            }
        }
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);
        
        if (socket.roomId) {
            const room = rooms.get(socket.roomId);
            if (room) {
                const player = room.players.get(socket.id);
                room.removePlayer(socket.id);
                
                if (room.players.size === 0) {
                    rooms.delete(socket.roomId);
                } else {
                    io.to(socket.roomId).emit('player-left', {
                        playerId: socket.id,
                        playerName: player ? player.name : 'Unknown'
                    });
                    io.to(socket.roomId).emit('game-state', room.getGameState());
                }
            }
        }
    });
});

// 定时检查房间状态
setInterval(() => {
    rooms.forEach((room, roomId) => {
        if (room.gameState === 'playing') {
            const timeLeft = room.roundDuration - (Date.now() - room.roundStartTime);
            if (timeLeft <= 0) {
                room.startNextRound();
                io.to(roomId).emit('round-timeout');
                io.to(roomId).emit('game-state', room.getGameState());
            }
        }
    });
}, 1000);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`服务器运行在 ${HOST}:${PORT}`);
    console.log(`本机访问: http://localhost:${PORT}`);
    console.log(`局域网访问: http://[你的IP地址]:${PORT}`);
});