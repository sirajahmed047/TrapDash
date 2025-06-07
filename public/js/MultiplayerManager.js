// js/MultiplayerManager.js
class MultiplayerManager {
    constructor() {
        this.currentRoom = null;
        this.roomId = null;
        this.isHost = false;
        this.gameMode = 'singleplayer'; // 'singleplayer' or 'multiplayer'
        this.roomPlayers = {};
        this.roomCallbacks = [];
        this.gameStateCallbacks = [];
        
        // Room state listeners
        this.roomListener = null;
        this.playersListener = null;
        this.lastLoggedStatus = null;
    }

    // Generate a unique room code
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < GameConfig.MULTIPLAYER.ROOM_CODE_LENGTH; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }



    // Quick match - find existing room or create new one (with race condition protection)
    async quickMatch() {
        if (!playerAuth.isUserAuthenticated()) {
            throw new Error('Must be authenticated for quick match');
        }

        console.log('🚀 Starting Quick Match process...');
        console.log('👤 Player authenticated:', playerAuth.isUserAuthenticated());
        console.log('🔧 Using Firebase path:', GameConfig.MULTIPLAYER.ROOMS_PATH);
        console.log('👥 Max players per room:', GameConfig.MULTIPLAYER.MAX_PLAYERS);

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                attempt++;
                console.log(`🎯 Quick match attempt ${attempt}/${maxRetries}`);

                // Try to join an existing room atomically
                const joinResult = await this.tryJoinAvailableRoom();
                
                if (joinResult.success) {
                    console.log('✅ Successfully joined existing room:', joinResult.roomCode);
                    return joinResult.roomCode;
                }

                console.log('🏠 No rooms to join, reason:', joinResult.reason);

                // If no room available, try to create one atomically
                const createResult = await this.tryCreateQuickMatchRoom();
                
                if (createResult.success) {
                    console.log('✅ Successfully created new quick match room:', createResult.roomCode);
                    return createResult.roomCode;
                }

                // If creation failed due to race condition, retry
                console.log('⚠️ Room creation failed, reason:', createResult.reason, 'retrying...');
                await this.delay(100 * attempt); // Exponential backoff
                
            } catch (error) {
                console.error(`❌ Quick match attempt ${attempt} failed:`, error);
                
                if (attempt === maxRetries) {
                    throw new Error('Quick match failed after multiple attempts');
                }
                
                await this.delay(200 * attempt);
            }
        }

        throw new Error('Quick match failed: maximum retries exceeded');
    }

    // Try to join an available room atomically
    async tryJoinAvailableRoom() {
        try {
            console.log('🎯 Attempting to join available room...');
            const availableRooms = await this.findAvailableRoomsDetailed();
            
            if (availableRooms.length === 0) {
                console.log('❌ No available rooms found');
                return { success: false, reason: 'no_rooms_available' };
            }

            console.log(`🎯 Found ${availableRooms.length} available rooms, trying to join...`);

            // Try to join rooms in order (oldest first)
            for (const room of availableRooms) {
                try {
                    console.log(`🚪 Attempting to join room ${room.code}...`);
                    await this.joinRoom(room.code);
                    console.log(`✅ Successfully joined room ${room.code}`);
                    return { success: true, roomCode: room.code };
                } catch (error) {
                    console.log(`⚠️ Failed to join room ${room.code}:`, error.message);
                    // Continue to next room
                }
            }

            console.log('❌ Failed to join any available rooms');
            return { success: false, reason: 'all_rooms_full_or_unavailable' };
        } catch (error) {
            console.error('❌ Error trying to join available room:', error);
            return { success: false, reason: 'error', error };
        }
    }

    // Try to create a quick match room atomically
    async tryCreateQuickMatchRoom() {
        try {
            // Use a transaction to ensure atomic room creation
            const roomCode = this.generateRoomCode();
            const playerData = playerAuth.getPlayerData();
            
            const roomRef = firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`);
            
            // Use transaction to ensure room doesn't already exist
            const transactionResult = await roomRef.transaction((currentData) => {
                if (currentData !== null) {
                    // Room already exists, abort transaction
                    return undefined;
                }

                // Create new room data
                return {
                    code: roomCode,
                    host: playerData.uid,
                    created: Date.now(),
                    status: 'waiting',
                    maxPlayers: GameConfig.MULTIPLAYER.MAX_PLAYERS,
                    isQuickMatch: true,
                    autoStartTime: Date.now() + (20 * 1000), // 20 seconds
                    players: {
                        [playerData.uid]: {
                            ...playerData,
                            isReady: false,
                            isHost: true,
                            joinedAt: Date.now()
                        }
                    },
                    gameSettings: {
                        botFillEnabled: true,
                        countdown: 3
                    }
                };
            });

            if (transactionResult.committed) {
                // Successfully created room
                this.roomId = roomCode;
                this.currentRoom = transactionResult.snapshot.val();
                this.isHost = true;
                this.gameMode = 'multiplayer';
                
                // Set up room listeners
                this.setupRoomListeners(roomCode);
                
                // Start auto-start monitoring
                this.monitorAutoStart(roomCode, this.currentRoom.autoStartTime);
                
                console.log('🏠 Quick match room created successfully:', roomCode);
                return { success: true, roomCode };
            } else {
                // Transaction was aborted (room already existed)
                return { success: false, reason: 'room_code_collision' };
            }
        } catch (error) {
            console.error('❌ Error creating quick match room:', error);
            return { success: false, reason: 'error', error };
        }
    }

    // Enhanced room finding with detailed info
    async findAvailableRoomsDetailed() {
        try {
            console.log('🔍 Searching for available rooms...');
            const roomsRef = firebaseDatabase.ref(GameConfig.MULTIPLAYER.ROOMS_PATH);
            const snapshot = await roomsRef.once('value');
            
            console.log('📊 Firebase snapshot exists:', snapshot.exists());
            
            if (!snapshot.exists()) {
                console.log('📭 No rooms found in database');
                return [];
            }

            const rooms = snapshot.val();
            console.log('🏠 All rooms in database:', Object.keys(rooms));
            
            const availableRooms = [];
            const currentTime = Date.now();

            Object.entries(rooms).forEach(([roomCode, roomData]) => {
                console.log(`🔍 Checking room ${roomCode}:`, {
                    status: roomData.status,
                    playerCount: Object.keys(roomData.players || {}).length,
                    maxPlayers: GameConfig.MULTIPLAYER.MAX_PLAYERS,
                    created: roomData.created,
                    age: Math.round((currentTime - roomData.created) / 1000) + 's',
                    isQuickMatch: roomData.isQuickMatch,
                    hasValidPlayers: roomData.players && Object.keys(roomData.players).length > 0
                });

                const playerCount = Object.keys(roomData.players || {}).length;
                const isWaiting = roomData.status === 'waiting';
                const hasSpace = playerCount < GameConfig.MULTIPLAYER.MAX_PLAYERS;
                const isRecent = (currentTime - roomData.created) < (5 * 60 * 1000);
                
                // Additional check: if room has 0 players and is older than 1 minute, skip it (likely stale)
                const isStale = playerCount === 0 && (currentTime - roomData.created) > (60 * 1000);
                
                // Only include rooms that have at least 1 player OR are very recent (< 1 minute old)
                const isViable = !isStale && (playerCount > 0 || (currentTime - roomData.created) < (60 * 1000));

                console.log(`📋 Room ${roomCode} eligibility:`, {
                    isWaiting,
                    hasSpace,
                    isRecent,
                    isViable,
                    isStale,
                    eligible: isWaiting && hasSpace && isRecent && isViable
                });

                if (isWaiting && hasSpace && isRecent && isViable) {
                    availableRooms.push({
                        code: roomCode,
                        playerCount: playerCount,
                        created: roomData.created,
                        isQuickMatch: roomData.isQuickMatch || false
                    });
                }
            });

            // Sort by creation time (oldest first) and prioritize quick match rooms
            availableRooms.sort((a, b) => {
                // Prioritize quick match rooms
                if (a.isQuickMatch && !b.isQuickMatch) return -1;
                if (!a.isQuickMatch && b.isQuickMatch) return 1;
                
                // Then sort by creation time (oldest first)
                return a.created - b.created;
            });

            console.log('✅ Found available rooms:', availableRooms.length, availableRooms);
            return availableRooms;
        } catch (error) {
            console.error('❌ Failed to find available rooms:', error);
            return [];
        }
    }

    // Utility function for delays
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }



    // Monitor auto-start timer for quick match rooms
    monitorAutoStart(roomCode, autoStartTime) {
        const checkInterval = setInterval(async () => {
            try {
                // Check if we're still in this room and it's still waiting
                if (this.roomId !== roomCode || !this.currentRoom || this.currentRoom.status !== 'waiting') {
                    clearInterval(checkInterval);
                    return;
                }

                const timeRemaining = autoStartTime - Date.now();
                
                if (timeRemaining <= 0) {
                    clearInterval(checkInterval);
                    
                    // Auto-start the game if we're the host
                    if (this.isHost) {
                        console.log('⏰ Auto-starting quick match game');
                        await this.startGame();
                    }
                } else {
                    // Notify UI about countdown (optional)
                    const secondsRemaining = Math.ceil(timeRemaining / 1000);
                    this.roomCallbacks.forEach(callback => {
                        callback('auto_start_countdown', { secondsRemaining });
                    });
                }
            } catch (error) {
                console.error('❌ Error in auto-start monitor:', error);
                clearInterval(checkInterval);
            }
        }, 1000); // Check every second
    }

    // Create a new multiplayer room
    async createRoom() {
        if (!playerAuth.isUserAuthenticated()) {
            throw new Error('Must be authenticated to create room');
        }

        const roomCode = this.generateRoomCode();
        const playerData = playerAuth.getPlayerData();
        
        const roomData = {
            code: roomCode,
            host: playerData.uid,
            created: Date.now(),
            status: 'waiting', // 'waiting', 'starting', 'playing', 'finished'
            maxPlayers: GameConfig.MULTIPLAYER.MAX_PLAYERS,
            players: {
                [playerData.uid]: {
                    ...playerData,
                    isReady: false,
                    isHost: true,
                    joinedAt: Date.now()
                }
            },
            gameSettings: {
                botFillEnabled: true,
                countdown: 3
            }
        };

        try {
            const roomRef = firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`);
            await roomRef.set(roomData);
            
            this.roomId = roomCode;
            this.currentRoom = roomData;
            this.isHost = true;
            this.gameMode = 'multiplayer';
            
            // Set up room listeners
            this.setupRoomListeners(roomCode);
            
            console.log('🏠 Room created successfully:', roomCode);
            return roomCode;
        } catch (error) {
            console.error('❌ Failed to create room:', error);
            throw error;
        }
    }

    // Join an existing room (with atomic transaction)
    async joinRoom(roomCode) {
        if (!playerAuth.isUserAuthenticated()) {
            throw new Error('Must be authenticated to join room');
        }

        try {
            const playerData = playerAuth.getPlayerData();
            const roomRef = firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`);
            
            // Use transaction to atomically add player to room
            const transactionResult = await roomRef.transaction((currentRoomData) => {
                if (!currentRoomData) {
                    // Room doesn't exist
                    return undefined;
                }

                // Check if room is in valid state for joining
                if (currentRoomData.status !== 'waiting') {
                    // Room is not in waiting state, abort
                    return undefined;
                }

                const currentPlayers = currentRoomData.players || {};
                const playerCount = Object.keys(currentPlayers).length;

                // Check if room is full
                if (playerCount >= GameConfig.MULTIPLAYER.MAX_PLAYERS) {
                    // Room is full, abort
                    return undefined;
                }

                // Check if player is already in room
                if (currentPlayers[playerData.uid]) {
                    // Player already in room, just return current data
                    return currentRoomData;
                }

                // Add player to room
                const updatedRoomData = {
                    ...currentRoomData,
                    players: {
                        ...currentPlayers,
                        [playerData.uid]: {
                            ...playerData,
                            isReady: false,
                            isHost: false,
                            joinedAt: Date.now()
                        }
                    }
                };

                return updatedRoomData;
            });

            if (!transactionResult.committed) {
                // Transaction was aborted - get fresh room data to determine why
                const snapshot = await roomRef.once('value');
                if (!snapshot.exists()) {
                    throw new Error('Room not found');
                }
                
                const roomData = snapshot.val();
                const playerCount = Object.keys(roomData.players || {}).length;
                
                console.log(`🔍 Transaction failed for room ${roomCode}. Current state:`, {
                    status: roomData.status,
                    playerCount: playerCount,
                    maxPlayers: GameConfig.MULTIPLAYER.MAX_PLAYERS,
                    players: Object.keys(roomData.players || {})
                });
                
                if (playerCount >= GameConfig.MULTIPLAYER.MAX_PLAYERS) {
                    throw new Error('Room is full');
                }
                
                if (roomData.status !== 'waiting') {
                    throw new Error('Game already in progress');
                }
                
                // Check if player is already in the room
                const playerData = playerAuth.getPlayerData();
                if (roomData.players && roomData.players[playerData.uid]) {
                    console.log('✅ Player already in room, setting up local state');
                    // Player is already in room, just set up local state
                    this.roomId = roomCode;
                    this.currentRoom = roomData;
                    this.isHost = roomData.players[playerData.uid].isHost || false;
                    this.gameMode = 'multiplayer';
                    this.setupRoomListeners(roomCode);
                    return roomCode;
                }
                
                throw new Error('Failed to join room due to concurrent access');
            }

            // Successfully joined room
            const finalRoomData = transactionResult.snapshot.val();
            
            this.roomId = roomCode;
            this.currentRoom = finalRoomData;
            this.isHost = false;
            this.gameMode = 'multiplayer';
            
            // Set up room listeners
            this.setupRoomListeners(roomCode);
            
            console.log('🚪 Joined room successfully:', roomCode);
            return roomCode;
        } catch (error) {
            console.error('❌ Failed to join room:', error);
            throw error;
        }
    }

    // Set up room state listeners
    setupRoomListeners(roomCode) {
        // Listen to room changes
        this.roomListener = firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`);
        this.roomListener.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.currentRoom = snapshot.val();
                this.roomPlayers = this.currentRoom.players || {};
                
                // Notify listeners
                this.roomCallbacks.forEach(callback => {
                    callback('room_updated', this.currentRoom);
                });
                
                // Only log room state changes, not every update
                if (!this.lastLoggedStatus || this.lastLoggedStatus !== this.currentRoom.status) {
                    console.log('📡 Room state changed:', this.currentRoom.status);
                    this.lastLoggedStatus = this.currentRoom.status;
                }
            } else {
                // Room was deleted
                this.handleRoomDeleted();
            }
        });
    }

    // Handle room deletion/cleanup
    handleRoomDeleted() {
        console.log('🗑️ Room was deleted');
        this.leaveRoom();
        this.roomCallbacks.forEach(callback => {
            callback('room_deleted', null);
        });
    }

    // Set player ready status
    async setPlayerReady(isReady = true) {
        if (!this.roomId || !playerAuth.isUserAuthenticated()) {
            throw new Error('Not in a room or not authenticated');
        }

        const playerData = playerAuth.getPlayerData();
        const readyPath = `${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/players/${playerData.uid}/isReady`;
        
        try {
            await firebaseDatabase.ref(readyPath).set(isReady);
            console.log(`✅ Player ready status set to: ${isReady}`);
        } catch (error) {
            console.error('❌ Failed to set ready status:', error);
            throw error;
        }
    }

    // Start the game (host only)
    async startGame() {
        if (!this.isHost || !this.roomId) {
            throw new Error('Only host can start the game');
        }

        try {
            // Fill empty slots with bots if this is a quick match room
            if (this.currentRoom.isQuickMatch) {
                await this.fillWithBots();
            }

            // Update room status
            const statusPath = `${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/status`;
            await firebaseDatabase.ref(statusPath).set('starting');
            
            // Add countdown logic here if needed
            console.log('🎮 Game starting...');
            
            // Notify game scenes
            this.gameStateCallbacks.forEach(callback => {
                callback('game_starting', this.currentRoom);
            });
            
        } catch (error) {
            console.error('❌ Failed to start game:', error);
            throw error;
        }
    }

    // Fill empty slots with bots for quick match
    async fillWithBots() {
        if (!this.currentRoom || !this.roomId) return;

        const currentPlayerCount = Object.keys(this.currentRoom.players).length;
        const maxPlayers = GameConfig.MULTIPLAYER.MAX_PLAYERS;
        const botsNeeded = maxPlayers - currentPlayerCount;

        if (botsNeeded <= 0) return;

        console.log(`🤖 Adding ${botsNeeded} bots to fill the room`);

        const botNames = ['SpeedBot', 'JumpBot', 'TrapBot', 'RushBot'];
        const botPersonalities = ['aggressive', 'cautious', 'balanced', 'reckless'];

        for (let i = 0; i < botsNeeded; i++) {
            const botId = `bot_${Date.now()}_${i}`;
            const botName = botNames[i % botNames.length];
            const botPersonality = botPersonalities[i % botPersonalities.length];

            const botData = {
                uid: botId,
                displayName: botName,
                isBot: true,
                isReady: true,
                isHost: false,
                joinedAt: Date.now(),
                personality: botPersonality
            };

            // Add bot to room
            const botPath = `${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/players/${botId}`;
            await firebaseDatabase.ref(botPath).set(botData);
        }

        console.log(`✅ Added ${botsNeeded} bots successfully`);
    }

    // Leave current room
    async leaveRoom() {
        if (!this.roomId || !playerAuth.isUserAuthenticated()) {
            return;
        }

        try {
            const playerData = playerAuth.getPlayerData();
            const playerPath = `${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/players/${playerData.uid}`;
            
            // Remove player from room
            await firebaseDatabase.ref(playerPath).remove();
            
            // If this was the host and there are other players, transfer host
            if (this.isHost && this.currentRoom && Object.keys(this.currentRoom.players).length > 1) {
                await this.transferHost();
            }
            
            // Clean up listeners
            if (this.roomListener) {
                this.roomListener.off();
                this.roomListener = null;
            }
            
            // Reset state
            this.currentRoom = null;
            this.roomId = null;
            this.isHost = false;
            this.gameMode = 'singleplayer';
            this.roomPlayers = {};
            
            console.log('👋 Left room successfully');
        } catch (error) {
            console.error('❌ Failed to leave room:', error);
        }
    }

    // Transfer host to another player
    async transferHost() {
        if (!this.currentRoom || !this.roomId) return;

        const playerData = playerAuth.getPlayerData();
        const otherPlayers = Object.keys(this.currentRoom.players).filter(uid => uid !== playerData.uid);
        
        if (otherPlayers.length > 0) {
            const newHostUid = otherPlayers[0];
            
            // Update host
            await firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/host`).set(newHostUid);
            
            // Update new host's isHost flag
            await firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/players/${newHostUid}/isHost`).set(true);
            
            console.log('👑 Host transferred to:', newHostUid);
        } else {
            // No other players, delete the room
            await firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}`).remove();
            console.log('🗑️ Room deleted (no players left)');
        }
    }

    // Get current room players
    getRoomPlayers() {
        return this.roomPlayers;
    }

    // Get room info
    getCurrentRoom() {
        return this.currentRoom;
    }

    // Check if player is in a room
    isInRoom() {
        return this.roomId !== null;
    }

    // Register callbacks for room events
    onRoomEvent(callback) {
        this.roomCallbacks.push(callback);
    }

    // Register callbacks for game state events
    onGameStateEvent(callback) {
        this.gameStateCallbacks.push(callback);
    }

    // Remove event listeners
    removeRoomEventListener(callback) {
        const index = this.roomCallbacks.indexOf(callback);
        if (index > -1) {
            this.roomCallbacks.splice(index, 1);
        }
    }

    removeGameStateEventListener(callback) {
        const index = this.gameStateCallbacks.indexOf(callback);
        if (index > -1) {
            this.gameStateCallbacks.splice(index, 1);
        }
    }

    // Get game mode
    getGameMode() {
        return this.gameMode;
    }

    // Switch to single player mode
    setSinglePlayerMode() {
        this.gameMode = 'singleplayer';
        this.leaveRoom();
    }

    // Clean up when the game is closing
    cleanup() {
        if (this.roomListener) {
            this.roomListener.off();
        }
        this.leaveRoom();
    }
}

// Create global instance
window.multiplayerManager = new MultiplayerManager();

console.log('🌐 MultiplayerManager initialized'); 