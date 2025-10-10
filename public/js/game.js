class GuessDrawGame {
    constructor() {
        this.socket = null;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentColor = '#000000';
        this.currentBrushSize = 3;
        this.roomId = '';
        this.playerId = '';
        this.playerName = '';
        this.isCurrentDrawer = false;
        this.gameState = {};
    // 本地倒计时（用于显示，每秒更新一次）
    this.timerInterval = null;
    this.localTimeLeftMs = 0;
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // 屏幕元素
        this.loginScreen = document.getElementById('login-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.endScreen = document.getElementById('end-screen');
        
        // 登录界面
        this.playerNameInput = document.getElementById('player-name');
        this.roomIdInput = document.getElementById('room-id');
        this.joinButton = document.getElementById('join-button');
        
        // 游戏界面
        this.currentRoomId = document.getElementById('current-room-id');
        this.currentRound = document.getElementById('current-round');
        this.maxRounds = document.getElementById('max-rounds');
        this.timeLeft = document.getElementById('time-left');
        this.currentWordDisplay = document.getElementById('current-word-display');
        this.gameMessage = document.getElementById('game-message');
    // 房主控制
    this.hostControls = document.getElementById('host-controls');
    this.inputMaxRounds = document.getElementById('input-max-rounds');
    this.btnSetRounds = document.getElementById('btn-set-rounds');
        
        // 画布和工具
        this.canvas = document.getElementById('drawing-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.brushSizeSlider = document.getElementById('brush-size');
        this.brushSizeDisplay = document.getElementById('brush-size-display');
        this.colorOptions = document.querySelectorAll('.color-option');
        this.clearCanvasButton = document.getElementById('clear-canvas');
        
        // 玩家和聊天
        this.playerCount = document.getElementById('player-count');
        this.playersList = document.getElementById('players-list');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        
        // 结束界面
        this.finalScores = document.getElementById('final-scores');
        this.newGameButton = document.getElementById('new-game-button');
    }

    bindEvents() {
        // 登录事件
        this.joinButton.addEventListener('click', () => this.joinGame());
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        // 画布事件
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // 触摸事件（移动端支持）
        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(this.getTouchPos(e)));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(this.getTouchPos(e));
        });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());

        // 工具事件
        this.brushSizeSlider.addEventListener('input', (e) => {
            this.currentBrushSize = e.target.value;
            this.brushSizeDisplay.textContent = e.target.value;
        });

        this.colorOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                this.colorOptions.forEach(opt => opt.classList.remove('active'));
                e.target.classList.add('active');
                this.currentColor = e.target.dataset.color;
            });
        });

        this.clearCanvasButton.addEventListener('click', () => {
            if (this.isCurrentDrawer && this.socket) {
                this.clearCanvas();
                this.socket.emit('clear-canvas');
            }
        });

        // 聊天事件
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // 新游戏事件
        this.newGameButton.addEventListener('click', () => this.startNewGame());

    // 房主设置轮数
    this.btnSetRounds.addEventListener('click', () => this.setMaxRounds());
    }

    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY
        };
    }

    joinGame() {
        const playerName = this.playerNameInput.value.trim();
        if (!playerName) {
            alert('请输入昵称');
            return;
        }

        const roomId = this.roomIdInput.value.trim() || this.generateRoomId();
        
        this.playerName = playerName;
        this.roomId = roomId;
        
        this.connectToServer(roomId, playerName);
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    connectToServer(roomId, playerName) {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.playerId = this.socket.id;
            this.socket.emit('join-room', { roomId, playerName });
        });

        this.socket.on('game-state', (gameState) => {
            this.updateGameState(gameState);
        });

        this.socket.on('player-joined', (player) => {
            this.addChatMessage(`${player.name} 加入了游戏`, 'system');
        });

        this.socket.on('player-left', (data) => {
            this.addChatMessage(`${data.playerName} 离开了游戏`, 'system');
        });

        this.socket.on('drawing', (data) => {
            this.handleRemoteDrawing(data);
        });

        this.socket.on('drawing-data', (drawingData) => {
            this.replayDrawing(drawingData);
        });

        this.socket.on('clear-canvas', () => {
            this.clearCanvas();
        });

        this.socket.on('chat-message', (data) => {
            this.addChatMessage(`${data.playerName}: ${data.message}`, 'user');
        });

        this.socket.on('correct-guess', (data) => {
            this.addChatMessage(`🎉 ${data.playerName} 猜对了！答案是："${data.word}"`, 'correct');
        });

        this.socket.on('round-timeout', () => {
            this.addChatMessage('⏰ 时间到！开始下一轮', 'system');
        });

        this.socket.on('disconnect', () => {
            this.addChatMessage('连接断开', 'system');
        });

        // 显示游戏界面
        this.loginScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
    }

    updateGameState(gameState) {
        this.gameState = gameState;
        this.isCurrentDrawer = gameState.currentDrawer === this.playerId;
        
        // 更新界面
        this.currentRoomId.textContent = gameState.roomId;
        this.currentRound.textContent = gameState.roundNumber;
        this.maxRounds.textContent = gameState.maxRounds;
    // 房主控制显示与输入值同步
    const isHost = gameState.hostId === this.playerId;
    this.toggleHostControls(isHost, gameState.maxRounds);
        
    // 更新/启动本地倒计时显示
    this.setupLocalTimer(gameState);
        
        // 更新玩家列表
        this.updatePlayersList(gameState.players);
        
        // 更新当前词汇显示
        this.updateWordDisplay(gameState);
        
        // 更新画布状态
        this.updateCanvasState();
        
        // 检查游戏状态
        if (gameState.gameState === 'ended') {
            setTimeout(() => this.showEndScreen(), 2000);
        } else if (gameState.gameState === 'waiting') {
            this.gameMessage.textContent = '等待更多玩家加入...';
        } else if (gameState.gameState === 'playing') {
            if (this.isCurrentDrawer) {
                this.gameMessage.textContent = '轮到你画图了！';
            } else {
                this.gameMessage.textContent = '猜猜画家在画什么？';
            }
        }
    }

    toggleHostControls(isHost, maxRounds) {
        if (!this.hostControls) return;
        if (isHost) {
            this.hostControls.classList.remove('hidden');
            if (typeof maxRounds === 'number') {
                this.inputMaxRounds.value = maxRounds;
            }
        } else {
            this.hostControls.classList.add('hidden');
        }
    }

    setMaxRounds() {
        if (!this.socket) return;
        const value = parseInt(this.inputMaxRounds.value, 10);
        if (isNaN(value)) return;
        this.socket.emit('set-max-rounds', { maxRounds: value });
    }

    setupLocalTimer(gameState) {
        // 每次收到服务端状态都重置一次本地计时，避免不同步
        this.clearLocalTimer();
        if (gameState.gameState === 'playing') {
            // 以服务端给的剩余毫秒为准启动本地倒计时
            this.localTimeLeftMs = Math.max(0, gameState.timeLeft | 0);
            // 立即刷新一次显示
            this.updateTimeDisplay(this.localTimeLeftMs);
            // 每秒递减并更新显示，直到归零
            this.timerInterval = setInterval(() => {
                this.localTimeLeftMs = Math.max(0, this.localTimeLeftMs - 1000);
                this.updateTimeDisplay(this.localTimeLeftMs);
                if (this.localTimeLeftMs <= 0) {
                    this.clearLocalTimer();
                }
            }, 1000);
        } else {
            // 非进行中状态显示0或保持
            this.updateTimeDisplay(0);
        }
    }

    clearLocalTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateTimeDisplay(timeLeft) {
    const seconds = Math.ceil(timeLeft / 1000);
        this.timeLeft.textContent = Math.max(0, seconds);
        
        if (seconds <= 10 && seconds > 0) {
            this.timeLeft.style.color = '#f56565';
        } else {
            this.timeLeft.style.color = '#333';
        }
    }

    updatePlayersList(players) {
        this.playerCount.textContent = players.length;
        this.playersList.innerHTML = '';
        
        players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            
            if (player.id === this.gameState.currentDrawer) {
                playerDiv.classList.add('current-drawer');
            }
            if (player.id === this.playerId) {
                playerDiv.classList.add('self');
            }
            
            playerDiv.innerHTML = `
                <span class="player-name">${player.name}</span>
                <span class="player-score">${player.score}分</span>
            `;
            
            this.playersList.appendChild(playerDiv);
        });
    }

    updateWordDisplay(gameState) {
        if (gameState.gameState === 'playing') {
            if (this.isCurrentDrawer) {
                this.currentWordDisplay.textContent = `请画：${gameState.currentWord}`;
                this.currentWordDisplay.style.color = '#f56565';
            } else {
                const wordLength = gameState.currentWord.length;
                const hiddenWord = '？'.repeat(wordLength);
                this.currentWordDisplay.textContent = `猜词：${hiddenWord}`;
                this.currentWordDisplay.style.color = '#667eea';
            }
        } else {
            this.currentWordDisplay.textContent = '';
        }
    }

    updateCanvasState() {
        if (this.isCurrentDrawer && this.gameState.gameState === 'playing') {
            this.canvas.classList.remove('disabled');
            this.clearCanvasButton.disabled = false;
        } else {
            this.canvas.classList.add('disabled');
            this.clearCanvasButton.disabled = true;
        }
    }

    startDrawing(e) {
        if (!this.isCurrentDrawer || this.gameState.gameState !== 'playing') return;
        
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        
        this.socket.emit('start-drawing', {
            x: pos.x,
            y: pos.y,
            color: this.currentColor,
            size: this.currentBrushSize
        });
    }

    draw(e) {
        if (!this.isDrawing || !this.isCurrentDrawer || this.gameState.gameState !== 'playing') return;
        
        const pos = this.getMousePos(e);
        
        this.drawLine(pos.x, pos.y, this.currentColor, this.currentBrushSize);
        
        this.socket.emit('drawing', {
            x: pos.x,
            y: pos.y
        });
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.ctx.beginPath();
        
        if (this.socket) {
            this.socket.emit('end-drawing');
        }
    }

    drawLine(x, y, color, size) {
        this.ctx.lineWidth = size;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = color;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }

    handleRemoteDrawing(data) {
        if (data.type === 'start') {
            this.ctx.beginPath();
            this.ctx.moveTo(data.x, data.y);
            this.ctx.lineWidth = data.size;
            this.ctx.lineCap = 'round';
            this.ctx.strokeStyle = data.color;
        } else if (data.type === 'draw') {
            this.ctx.lineTo(data.x, data.y);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.moveTo(data.x, data.y);
        } else if (data.type === 'end') {
            this.ctx.beginPath();
        }
    }

    replayDrawing(drawingData) {
        this.clearCanvas();
        drawingData.forEach(data => {
            this.handleRemoteDrawing(data);
        });
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.socket) return;
        
        this.socket.emit('chat-message', message);
        this.chatInput.value = '';
    }

    addChatMessage(content, type = 'user') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        messageDiv.innerHTML = content;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showEndScreen() {
        this.gameScreen.classList.add('hidden');
        this.endScreen.classList.remove('hidden');
        
        // 显示最终分数
        const sortedPlayers = [...this.gameState.players].sort((a, b) => b.score - a.score);
        
        this.finalScores.innerHTML = '';
        sortedPlayers.forEach((player, index) => {
            const scoreDiv = document.createElement('div');
            scoreDiv.className = 'final-score-item';
            if (index === 0) scoreDiv.classList.add('winner');
            
            scoreDiv.innerHTML = `
                <span class="final-score-name">${index + 1}. ${player.name}</span>
                <span class="final-score-points">${player.score}分</span>
            `;
            
            this.finalScores.appendChild(scoreDiv);
        });
    }

    startNewGame() {
        this.endScreen.classList.add('hidden');
        this.loginScreen.classList.remove('hidden');
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // 重置状态
        this.clearCanvas();
        this.chatMessages.innerHTML = '';
        this.playerNameInput.value = this.playerName;
        this.roomIdInput.value = '';
    }
}

// 启动游戏
document.addEventListener('DOMContentLoaded', () => {
    new GuessDrawGame();
});