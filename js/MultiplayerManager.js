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
        
        // Set up cleanup on page unload
        this.setupPageUnloadCleanup();
        
        // Set up periodic cleanup every 5 minutes
        this.setupPeriodicCleanup();
    }

    // Set up cleanup when page is closed/refreshed
    setupPageUnloadCleanup() {
        // Enhanced page unload cleanup
        const cleanup = () => {
            if (this.roomId && playerAuth.isUserAuthenticated()) {
                const playerData = playerAuth.getPlayerData();
                const playerPath = `${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/players/${playerData.uid}`;
                
                console.log('🧹 Page unload cleanup: removing player from room');
                
                // Try immediate Firebase cleanup (may not complete but worth trying)
                try {
                    firebaseDatabase.ref(playerPath).remove();
                    
                    // If this is the host and there are other players, transfer host
                    if (this.isHost && this.currentRoom && Object.keys(this.currentRoom.players || {}).length > 1) {
                        const otherPlayers = Object.keys(this.currentRoom.players).filter(uid => uid !== playerData.uid);
                        if (otherPlayers.length > 0) {
                            firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/host`).set(otherPlayers[0]);
                            firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/players/${otherPlayers[0]}/isHost`).set(true);
                        }
                    }
                    // If this is the last player or host with no others, mark room for cleanup
                    else if (this.currentRoom && Object.keys(this.currentRoom.players || {}).length <= 1) {
                        firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/status`).set('abandoned');
                        firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/abandonedAt`).set(Date.now());
                    }
                } catch (error) {
                    console.warn('Failed to cleanup room on page unload:', error);
                }
            }
        };

        // Listen for multiple unload events
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);
        window.addEventListener('pagehide', cleanup);
        
        // Also cleanup on visibility change (mobile browsers)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                cleanup();
            }
        });
    }

    // Set up periodic cleanup to run every 5 minutes
    setupPeriodicCleanup() {
        // Run cleanup every 5 minutes
        setInterval(() => {
            this.cleanupStaleRooms();
        }, 5 * 60 * 1000); // 5 minutes
        
        // Also run initial cleanup after 30 seconds
        setTimeout(() => {
            this.cleanupStaleRooms();
        }, 30000);
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

        // Force cleanup orphaned rooms before starting Quick Match
        await this.forceCleanupOrphanedRooms();

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
                // Try joining each room with retry logic for concurrent access
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        console.log(`🚪 Attempting to join room ${room.code} (attempt ${attempt}/2)...`);
                        await this.joinRoom(room.code);
                        console.log(`✅ Successfully joined room ${room.code}`);
                        return { success: true, roomCode: room.code };
                    } catch (error) {
                        console.log(`⚠️ Failed to join room ${room.code} (attempt ${attempt}/2):`, error.message);
                        
                        // If it's a concurrent access error and we have another attempt, wait and retry
                        if (error.message.includes('concurrent access') && attempt < 2) {
                            console.log('⏳ Waiting 200ms before retry due to concurrent access...');
                            await this.delay(200);
                            continue;
                        }
                        
                        // Otherwise break and try next room
                        break;
                    }
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
            
            // First, clean up stale rooms to improve performance
            await this.cleanupStaleRooms();
            
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
    monitorAutoStart(roomCode, initialAutoStartTime) {
        const checkInterval = setInterval(async () => {
            try {
                // Check if we're still in this room and it's still waiting
                if (this.roomId !== roomCode || !this.currentRoom || this.currentRoom.status !== 'waiting') {
                    clearInterval(checkInterval);
                    return;
                }

                // Use the current room's autoStartTime (may have been extended)
                const currentAutoStartTime = this.currentRoom.autoStartTime || initialAutoStartTime;
                const timeRemaining = currentAutoStartTime - Date.now();
                
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

    // Join an existing room (with atomic transaction and retry logic)
    async joinRoom(roomCode) {
        if (!playerAuth.isUserAuthenticated()) {
            throw new Error('Must be authenticated to join room');
        }

        // Retry up to 2 times to handle race conditions (reduced for faster response)
        const maxRetries = 2;
        let lastError = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Join room attempt ${attempt}/${maxRetries} for room ${roomCode}`);
                
                const playerData = playerAuth.getPlayerData();
                const roomRef = firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`);
                
                // First, verify the room exists and get its current state
                const preCheckSnapshot = await roomRef.once('value');
                if (!preCheckSnapshot.exists()) {
                    throw new Error('Room not found');
                }
                
                const preCheckData = preCheckSnapshot.val();
                console.log(`🔍 Pre-transaction room check for ${roomCode}:`, {
                    status: preCheckData.status,
                    playerCount: Object.keys(preCheckData.players || {}).length,
                    hasRequiredFields: !!(preCheckData.status && preCheckData.created && preCheckData.players)
                });

                // Skip if room is corrupted/orphaned
                if (!preCheckData.status || !preCheckData.created || !preCheckData.players) {
                    throw new Error('Room is corrupted or orphaned');
                }
                
                // Use atomic update approach instead of transaction (more reliable for this use case)
                console.log(`🔄 Using atomic update to join room ${roomCode}...`);
                
                // Get current room data again to ensure freshness
                const currentSnapshot = await roomRef.once('value');
                if (!currentSnapshot.exists()) {
                    throw new Error('Room not found during join attempt');
                }
                
                const currentRoomData = currentSnapshot.val();
                console.log(`🔍 Current room data for atomic update:`, {
                    status: currentRoomData.status,
                    playerCount: Object.keys(currentRoomData.players || {}).length,
                    maxPlayers: GameConfig.MULTIPLAYER.MAX_PLAYERS
                });

                // Validate room state
                if (currentRoomData.status !== 'waiting') {
                    // Allow joining if room just started (within 3 seconds grace period)
                    if (currentRoomData.status === 'starting' && currentRoomData.isQuickMatch) {
                        const statusChangeTime = currentRoomData.statusChangedAt || currentRoomData.created;
                        const timeSinceStatusChange = Date.now() - statusChangeTime;
                        
                        if (timeSinceStatusChange > 3000) { // 3 second grace period
                            throw new Error('Too late to join - game already starting');
                        }
                        console.log('🚪 Allowing late join during grace period');
                    } else {
                        throw new Error(`Game already in progress (status: ${currentRoomData.status})`);
                    }
                }

                const currentPlayers = currentRoomData.players || {};
                const playerCount = Object.keys(currentPlayers).length;

                // Check if room is full
                if (playerCount >= GameConfig.MULTIPLAYER.MAX_PLAYERS) {
                    throw new Error('Room is full');
                }

                // Check if player is already in room
                if (currentPlayers[playerData.uid]) {
                    console.log('✅ Player already in room, setting up local state');
                    this.roomId = roomCode;
                    this.currentRoom = currentRoomData;
                    this.isHost = currentPlayers[playerData.uid].isHost || false;
                    this.gameMode = 'multiplayer';
                    this.setupRoomListeners(roomCode);
                    return roomCode;
                }

                console.log(`✅ Adding player ${playerData.displayName} to room ${roomCode}`);

                // Prepare update data
                const updates = {};
                const playerPath = `players/${playerData.uid}`;
                
                updates[playerPath] = {
                    ...playerData,
                    isReady: false,
                    isHost: false,
                    joinedAt: Date.now()
                };

                // If this is a Quick Match room, extend the auto-start timer to give new player time
                if (currentRoomData.isQuickMatch && currentRoomData.autoStartTime) {
                    const currentTime = Date.now();
                    const timeRemaining = currentRoomData.autoStartTime - currentTime;
                    
                    // If less than 10 seconds remaining, extend to 10 seconds
                    if (timeRemaining < 10000) {
                        updates['autoStartTime'] = currentTime + 10000;
                        console.log('⏰ Extended auto-start timer for new player joining');
                    }
                }

                // Perform atomic update
                await roomRef.update(updates);
                console.log(`✅ Successfully added player to room ${roomCode}`);

                // Get final room data
                const finalSnapshot = await roomRef.once('value');
                const finalRoomData = finalSnapshot.val();
            
            this.roomId = roomCode;
            this.currentRoom = finalRoomData;
            this.isHost = false;
            this.gameMode = 'multiplayer';
            
            // Set up room listeners
            this.setupRoomListeners(roomCode);
            
            console.log('🚪 Joined room successfully:', roomCode);
            return roomCode;
        } catch (error) {
            console.error(`❌ Join room attempt ${attempt}/${maxRetries} failed:`, error.message);
            lastError = error;
            
            // If this is the last attempt, try a simple direct approach
            if (attempt === maxRetries) {
                console.log('🔄 Trying simple direct join as last resort...');
                try {
                    const directResult = await this.simpleDirectJoin(roomCode);
                    if (directResult) {
                        return directResult;
                    }
                } catch (directError) {
                    console.error('❌ Direct join also failed:', directError.message);
                }
                break;
            }
            
            // Wait before retrying (shorter delay for faster response)
            await this.delay(50 * attempt);
        }
    }
    
    // If we get here, all attempts failed
    console.error('❌ All join room attempts failed');
    throw lastError || new Error('Failed to join room after multiple attempts');
}

    // Simple direct join method as fallback
    async simpleDirectJoin(roomCode) {
        console.log(`🔄 Attempting simple direct join to room ${roomCode}...`);
        
        const playerData = playerAuth.getPlayerData();
        const playerPath = `${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}/players/${playerData.uid}`;
        
        try {
            // Simply add the player directly
            await firebaseDatabase.ref(playerPath).set({
                ...playerData,
                isReady: false,
                isHost: false,
                joinedAt: Date.now()
            });
            
            // Get room data
            const roomSnapshot = await firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`).once('value');
            if (!roomSnapshot.exists()) {
                throw new Error('Room not found after direct join');
            }
            
            const roomData = roomSnapshot.val();
            
            // Set up local state
            this.roomId = roomCode;
            this.currentRoom = roomData;
            this.isHost = false;
            this.gameMode = 'multiplayer';
            this.setupRoomListeners(roomCode);
            
            console.log('✅ Simple direct join successful');
            return roomCode;
            
        } catch (error) {
            console.error('❌ Simple direct join failed:', error);
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
                
                // Update local isHost status
                const localPlayerUid = playerAuth.getCurrentUser()?.uid;
                if (localPlayerUid && this.currentRoom.host === localPlayerUid) {
                    this.isHost = true;
                }

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

            // Update room status and record timestamp
            const updates = {
                [`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/status`]: 'starting',
                [`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/statusChangedAt`]: Date.now()
            };
            await firebaseDatabase.ref().update(updates);
            
            // Add countdown logic here if needed
            console.log('🎮 Game starting...');
            
            // Notify game scenes
            this.gameStateCallbacks.forEach(callback => {
                callback('game_starting', this.currentRoom);
            });

            // Also notify network synchronizer to update game status
            window.networkSynchronizer.updateGameStatus('starting', { 
                startTime: Date.now() + (this.currentRoom.gameSettings.countdown * 1000) 
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

    // NEW: Proper exit function for players leaving the game
    async exitGame() {
        console.log('🚪 Player exiting game...');
        
        try {
            // Leave current room if in one
            if (this.roomId) {
                await this.leaveRoom();
            }
            
            // Clean up any listeners
            this.cleanup();
            
            // Force cleanup orphaned rooms
            await this.forceCleanupOrphanedRooms();
            
            console.log('✅ Successfully exited game');
        } catch (error) {
            console.error('❌ Error during game exit:', error);
        }
    }

    // NEW: Destroy current room completely (for game end cleanup)
    async destroyCurrentRoom() {
        if (!this.roomId) {
            console.log('🗑️ No room to destroy');
            return;
        }

        try {
            console.log(`🗑️ Destroying room ${this.roomId}...`);
            
            // Remove the entire room from Firebase
            await firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}`).remove();
            
            // Clean up local state
            if (this.roomListener) {
                this.roomListener.off();
                this.roomListener = null;
            }
            
            this.currentRoom = null;
            this.roomId = null;
            this.isHost = false;
            this.gameMode = 'singleplayer';
            this.roomPlayers = {};
            
            console.log('✅ Room destroyed successfully');
        } catch (error) {
            console.error('❌ Failed to destroy room:', error);
        }
    }

    // NEW: Clean up stale rooms from database
    async cleanupStaleRooms() {
        try {
            console.log('🧹 Starting stale room cleanup...');
            const roomsRef = firebaseDatabase.ref(GameConfig.MULTIPLAYER.ROOMS_PATH);
            const snapshot = await roomsRef.once('value');
            
            if (!snapshot.exists()) {
                console.log('📭 No rooms to clean up');
                return;
            }

            const rooms = snapshot.val();
            const currentTime = Date.now();
            const staleThreshold = 10 * 60 * 1000; // 10 minutes
            const emptyRoomThreshold = 2 * 60 * 1000; // 2 minutes for empty rooms
            const abandonedThreshold = 30 * 1000; // 30 seconds for abandoned rooms
            
            let cleanedCount = 0;
            const cleanupPromises = [];

            Object.entries(rooms).forEach(([roomCode, roomData]) => {
                let shouldCleanup = false;
                let reason = '';

                // Handle orphaned/corrupted rooms (missing required fields)
                if (!roomData || typeof roomData !== 'object') {
                    shouldCleanup = true;
                    reason = 'corrupted data';
                }
                else if (!roomData.created || !roomData.status || !roomData.players) {
                    shouldCleanup = true;
                    reason = 'missing required fields (orphaned)';
                }
                else {
                    const roomAge = currentTime - roomData.created;
                    const playerCount = Object.keys(roomData.players || {}).length;
                    
                    // Clean up very old rooms regardless of status
                    if (roomAge > staleThreshold) {
                        shouldCleanup = true;
                        reason = `old (${Math.round(roomAge / 60000)}min)`;
                    }
                    // Clean up empty rooms that are older than 2 minutes
                    else if (playerCount === 0 && roomAge > emptyRoomThreshold) {
                        shouldCleanup = true;
                        reason = `empty (${Math.round(roomAge / 60000)}min)`;
                    }
                    // Clean up finished games older than 1 minute
                    else if (roomData.status === 'finished' && roomAge > 60000) {
                        shouldCleanup = true;
                        reason = 'finished game';
                    }
                    // Clean up abandoned rooms quickly
                    else if (roomData.status === 'abandoned' && roomData.abandonedAt && (currentTime - roomData.abandonedAt) > abandonedThreshold) {
                        shouldCleanup = true;
                        reason = 'abandoned';
                    }
                    // Clean up rooms with undefined status (common issue from logs)
                    else if (roomData.status === undefined || roomData.status === null) {
                        shouldCleanup = true;
                        reason = 'undefined status';
                    }
                }

                if (shouldCleanup) {
                    console.log(`🗑️ Cleaning up stale room ${roomCode}: ${reason}`);
                    cleanupPromises.push(
                        firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`).remove()
                    );
                    cleanedCount++;
                }
            });

            if (cleanupPromises.length > 0) {
                await Promise.all(cleanupPromises);
                console.log(`✅ Cleaned up ${cleanedCount} stale rooms`);
            } else {
                console.log('✨ No stale rooms found to clean up');
            }
        } catch (error) {
            console.error('❌ Failed to cleanup stale rooms:', error);
        }
    }

    // NEW: Mark room as finished when game ends
    async markRoomAsFinished() {
        if (!this.roomId || !this.isHost) {
            return;
        }

        try {
            console.log(`🏁 Marking room ${this.roomId} as finished`);
            const statusPath = `${GameConfig.MULTIPLAYER.ROOMS_PATH}/${this.roomId}/status`;
            await firebaseDatabase.ref(statusPath).set('finished');
            
            // Schedule room destruction after 30 seconds
            setTimeout(() => {
                this.destroyCurrentRoom();
            }, 30000);
            
        } catch (error) {
            console.error('❌ Failed to mark room as finished:', error);
        }
    }

    // NEW: Manual cleanup function for immediate orphaned room removal
    async forceCleanupOrphanedRooms() {
        try {
            console.log('🧹 Force cleaning orphaned rooms...');
            const roomsRef = firebaseDatabase.ref(GameConfig.MULTIPLAYER.ROOMS_PATH);
            const snapshot = await roomsRef.once('value');
            
            if (!snapshot.exists()) {
                console.log('📭 No rooms to clean up');
                return;
            }

            const rooms = snapshot.val();
            let cleanedCount = 0;
            const cleanupPromises = [];

            Object.entries(rooms).forEach(([roomCode, roomData]) => {
                // Aggressively clean up any room with missing fields or undefined status
                if (!roomData || 
                    typeof roomData !== 'object' ||
                    !roomData.created || 
                    !roomData.status || 
                    !roomData.players ||
                    roomData.status === undefined ||
                    roomData.status === null) {
                    
                    console.log(`🗑️ Force cleaning orphaned room ${roomCode}`);
                    cleanupPromises.push(
                        firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomCode}`).remove()
                    );
                    cleanedCount++;
                }
            });

            if (cleanupPromises.length > 0) {
                await Promise.all(cleanupPromises);
                console.log(`✅ Force cleaned ${cleanedCount} orphaned rooms`);
            } else {
                console.log('✨ No orphaned rooms found to clean up');
            }
        } catch (error) {
            console.error('❌ Failed to force cleanup orphaned rooms:', error);
        }
    }
}

// Create global instance
window.multiplayerManager = new MultiplayerManager();

console.log('🌐 MultiplayerManager initialized'); 