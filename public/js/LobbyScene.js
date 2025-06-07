// js/LobbyScene.js
class LobbyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LobbyScene' });
    }

    init() {
        this.roomElements = {};
        this.currentRoomCode = null;
        this.isInRoom = false;
        this.roomEventCallback = null;
        this.authEventCallback = null;
    }

    create() {
        // Set background
        this.cameras.main.setBackgroundColor('#1a1a1a');
        
        // Title
        this.add.text(this.game.config.width / 2, 60, 'TrapDash Multiplayer', {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Player name display
        this.playerNameText = this.add.text(this.game.config.width / 2, 100, '', {
            fontSize: '16px',
            fill: '#cccccc',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Main menu container
        this.createMainMenu();
        
        // Room interface container (hidden initially)
        this.createRoomInterface();
        
        // Set up authentication listener
        this.setupAuthListener();
        
        // Set up room event listener
        this.setupRoomEventListener();
        
        // Auto-authenticate
        this.authenticatePlayer();
    }

    createMainMenu() {
        this.mainMenuContainer = this.add.container(this.game.config.width / 2, this.game.config.height / 2);
        
        // Quick Match button
        const quickMatchBtn = this.add.rectangle(0, -60, 300, 50, 0x4CAF50)
            .setInteractive()
            .on('pointerdown', () => this.quickMatch())
            .on('pointerover', () => quickMatchBtn.setFillStyle(0x66BB6A))
            .on('pointerout', () => quickMatchBtn.setFillStyle(0x4CAF50));
        
        const quickMatchText = this.add.text(0, -60, 'Quick Match', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Create Room button
        const createRoomBtn = this.add.rectangle(0, 0, 300, 50, 0x2196F3)
            .setInteractive()
            .on('pointerdown', () => this.createRoom())
            .on('pointerover', () => createRoomBtn.setFillStyle(0x42A5F5))
            .on('pointerout', () => createRoomBtn.setFillStyle(0x2196F3));
        
        const createRoomText = this.add.text(0, 0, 'Create Room', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Join Room button
        const joinRoomBtn = this.add.rectangle(0, 60, 300, 50, 0xFF9800)
            .setInteractive()
            .on('pointerdown', () => this.showJoinRoomInput())
            .on('pointerover', () => joinRoomBtn.setFillStyle(0xFFB74D))
            .on('pointerout', () => joinRoomBtn.setFillStyle(0xFF9800));
        
        const joinRoomText = this.add.text(0, 60, 'Join Room', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Single Player button
        const singlePlayerBtn = this.add.rectangle(0, 120, 300, 50, 0x9E9E9E)
            .setInteractive()
            .on('pointerdown', () => this.startSinglePlayer())
            .on('pointerover', () => singlePlayerBtn.setFillStyle(0xBDBDBD))
            .on('pointerout', () => singlePlayerBtn.setFillStyle(0x9E9E9E));
        
        const singlePlayerText = this.add.text(0, 120, 'Single Player', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Add all elements to the container
        this.mainMenuContainer.add([
            quickMatchBtn, quickMatchText,
            createRoomBtn, createRoomText,
            joinRoomBtn, joinRoomText,
            singlePlayerBtn, singlePlayerText
        ]);
    }

    createRoomInterface() {
        this.roomContainer = this.add.container(this.game.config.width / 2, this.game.config.height / 2);
        this.roomContainer.setVisible(false);
        
        // Room code display
        this.roomCodeText = this.add.text(0, -150, '', {
            fontSize: '24px',
            fill: '#ffff00',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Players list
        this.playersListText = this.add.text(0, -100, '', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Auto-start countdown (for quick match rooms)
        this.autoStartText = this.add.text(0, -50, '', {
            fontSize: '18px',
            fill: '#ffff00',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Ready button
        this.readyBtn = this.add.rectangle(0, 20, 200, 50, 0x4CAF50)
            .setInteractive()
            .on('pointerdown', () => this.toggleReady());
        
        this.readyBtnText = this.add.text(0, 20, 'Ready', {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Start Game button (host only)
        this.startGameBtn = this.add.rectangle(0, 80, 200, 50, 0x2196F3)
            .setInteractive()
            .on('pointerdown', () => this.startGame());
        
        this.startGameBtnText = this.add.text(0, 80, 'Start Game', {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Leave Room button
        this.leaveBtn = this.add.rectangle(0, 140, 200, 50, 0xF44336)
            .setInteractive()
            .on('pointerdown', () => this.leaveRoom());
        
        this.leaveBtnText = this.add.text(0, 140, 'Leave Room', {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Add all elements to the room container
        this.roomContainer.add([
            this.roomCodeText, this.playersListText, this.autoStartText,
            this.readyBtn, this.readyBtnText,
            this.startGameBtn, this.startGameBtnText, 
            this.leaveBtn, this.leaveBtnText
        ]);
    }

    setupAuthListener() {
        this.authEventCallback = (isAuthenticated, playerData) => {
            if (isAuthenticated && playerData) {
                this.playerNameText.setText(`Welcome, ${playerData.displayName}!`);
            } else {
                this.playerNameText.setText('Authenticating...');
            }
        };
        
        playerAuth.onAuthStateChange(this.authEventCallback);
    }

    setupRoomEventListener() {
        this.roomEventCallback = (eventType, data) => {
            switch (eventType) {
                case 'room_updated':
                    this.updateRoomDisplay(data);
                    break;
                case 'room_deleted':
                    this.handleRoomDeleted();
                    break;
                case 'auto_start_countdown':
                    this.updateAutoStartCountdown(data.secondsRemaining);
                    break;
            }
        };
        
        multiplayerManager.onRoomEvent(this.roomEventCallback);
    }

    async authenticatePlayer() {
        try {
            if (!playerAuth.isUserAuthenticated()) {
                await playerAuth.signInAnonymously();
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            // Show error message to user
            this.showMessage('Authentication failed. Please refresh.', 0xFF5722);
        }
    }

    async quickMatch() {
        try {
            this.showMessage('Finding match...', 0x2196F3);
            const roomCode = await multiplayerManager.quickMatch();
            this.currentRoomCode = roomCode;
            this.showRoomInterface();
            
            // Show appropriate message based on whether we joined or created
            const roomData = multiplayerManager.getCurrentRoom();
            const playerCount = Object.keys(roomData.players || {}).length;
            
            if (playerCount > 1) {
                this.showMessage('Joined existing match!', 0x4CAF50);
            } else {
                this.showMessage('Room created! Waiting for players...', 0x4CAF50);
            }
        } catch (error) {
            console.error('Failed to quick match:', error);
            this.showMessage('Quick match failed', 0xF44336);
        }
    }

    async createRoom() {
        try {
            this.showMessage('Creating room...', 0x2196F3);
            const roomCode = await multiplayerManager.createRoom();
            this.currentRoomCode = roomCode;
            this.showRoomInterface();
            this.showMessage('Room created!', 0x4CAF50);
        } catch (error) {
            console.error('Failed to create room:', error);
            this.showMessage('Failed to create room', 0xF44336);
        }
    }

    showJoinRoomInput() {
        // Simple prompt for room code (in production, use proper UI)
        const roomCode = prompt('Enter room code:');
        if (roomCode) {
            this.joinRoom(roomCode.toUpperCase());
        }
    }

    async joinRoom(roomCode) {
        try {
            this.showMessage('Joining room...', 0x2196F3);
            await multiplayerManager.joinRoom(roomCode);
            this.currentRoomCode = roomCode;
            this.showRoomInterface();
            this.showMessage('Joined room!', 0x4CAF50);
        } catch (error) {
            console.error('Failed to join room:', error);
            this.showMessage(error.message, 0xF44336);
        }
    }

    showRoomInterface() {
        this.mainMenuContainer.setVisible(false);
        this.roomContainer.setVisible(true);
        this.isInRoom = true;
        
        // Update room code display
        this.roomCodeText.setText(`Room: ${this.currentRoomCode}`);
        
        // Update host-specific buttons
        this.updateHostButtons();
    }

    updateRoomDisplay(roomData) {
        if (!roomData || !this.isInRoom) return;
        
        // Update players list
        const players = Object.values(roomData.players || {});
        let playersText = `Players (${players.length}/${GameConfig.MULTIPLAYER.MAX_PLAYERS}):\n`;
        
        players.forEach(player => {
            const readyStatus = player.isReady ? '✓' : '○';
            const hostStatus = player.isHost ? '👑' : '';
            playersText += `${readyStatus} ${player.displayName} ${hostStatus}\n`;
        });
        
        this.playersListText.setText(playersText);
        
        // Update ready button state
        const currentPlayer = playerAuth.getPlayerData();
        const playerInRoom = players.find(p => p.uid === currentPlayer?.uid);
        if (playerInRoom) {
            this.updateReadyButton(playerInRoom.isReady);
        }
        
        // Show quick match indicator if applicable
        if (roomData.isQuickMatch && roomData.autoStartTime) {
            const timeRemaining = Math.max(0, roomData.autoStartTime - Date.now());
            const secondsRemaining = Math.ceil(timeRemaining / 1000);
            if (secondsRemaining > 0) {
                this.updateAutoStartCountdown(secondsRemaining);
            } else {
                this.autoStartText.setText('');
            }
        } else {
            this.autoStartText.setText('');
        }
        
        // Check if game is starting
        if (roomData.status === 'starting') {
            this.handleGameStarting();
        }
    }

    updateAutoStartCountdown(secondsRemaining) {
        if (secondsRemaining > 0) {
            this.autoStartText.setText(`Auto-start in ${secondsRemaining}s`);
        } else {
            this.autoStartText.setText('');
        }
    }

    updateHostButtons() {
        const isHost = multiplayerManager.isHost;
        this.startGameBtn.setVisible(isHost);
        this.startGameBtnText.setVisible(isHost);
    }

    updateReadyButton(isReady) {
        if (isReady) {
            this.readyBtn.setFillStyle(0xFF9800);
            this.readyBtnText.setText('Not Ready');
        } else {
            this.readyBtn.setFillStyle(0x4CAF50);
            this.readyBtnText.setText('Ready');
        }
    }

    async toggleReady() {
        try {
            const currentPlayer = playerAuth.getPlayerData();
            const roomData = multiplayerManager.getCurrentRoom();
            const playerInRoom = roomData?.players?.[currentPlayer?.uid];
            
            if (playerInRoom) {
                await multiplayerManager.setPlayerReady(!playerInRoom.isReady);
            }
        } catch (error) {
            console.error('Failed to toggle ready:', error);
            this.showMessage('Failed to update ready status', 0xF44336);
        }
    }

    async startGame() {
        try {
            await multiplayerManager.startGame();
        } catch (error) {
            console.error('Failed to start game:', error);
            this.showMessage('Failed to start game', 0xF44336);
        }
    }

    handleGameStarting() {
        this.showMessage('Game starting...', 0x4CAF50);
        
        // Transition to game scene after short delay
        this.time.delayedCall(2000, () => {
            this.scene.start('GameScene', { gameMode: 'multiplayer' });
            this.scene.launch('UIScene'); // Launch UI scene alongside GameScene for multiplayer
        });
    }

    async leaveRoom() {
        try {
            await multiplayerManager.leaveRoom();
            this.currentRoomCode = null;
            this.isInRoom = false;
            this.roomContainer.setVisible(false);
            this.mainMenuContainer.setVisible(true);
            this.showMessage('Left room', 0x9E9E9E);
        } catch (error) {
            console.error('Failed to leave room:', error);
        }
    }

    handleRoomDeleted() {
        this.showMessage('Room was closed', 0xF44336);
        this.leaveRoom();
    }

    startSinglePlayer() {
        multiplayerManager.setSinglePlayerMode();
        this.scene.start('GameScene', { gameMode: 'singleplayer' });
    }

    showMessage(text, color = 0xFFFFFF) {
        // Remove existing message
        if (this.messageText) {
            this.messageText.destroy();
        }
        
        // Create new message
        this.messageText = this.add.text(this.game.config.width / 2, 30, text, {
            fontSize: '16px',
            fill: `#${color.toString(16).padStart(6, '0')}`,
            fontFamily: 'Arial'
        }).setOrigin(0.5);
        
        // Auto-remove after 3 seconds
        this.time.delayedCall(3000, () => {
            if (this.messageText) {
                this.messageText.destroy();
                this.messageText = null;
            }
        });
    }

    shutdown() {
        // Clean up listeners
        if (this.roomEventCallback) {
            multiplayerManager.removeRoomEventListener(this.roomEventCallback);
        }
        if (this.authEventCallback) {
            playerAuth.removeAuthStateListener(this.authEventCallback);
        }
    }
}

console.log('🏛️ LobbyScene loaded'); 