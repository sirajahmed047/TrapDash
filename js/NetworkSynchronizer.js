// js/NetworkSynchronizer.js
class NetworkSynchronizer {
    constructor() {
        this.isActive = false;
        this.roomId = null;
        this.gameStateRef = null;
        this.lastSyncTime = 0;
        this.syncInterval = null;
        this.networkCallbacks = [];
        
        // Local game state tracking
        this.localPlayerState = null;
        this.remotePlayersState = {};
        this.gameEvents = [];
        
        // Performance tracking
        this.latency = 0;
        this.lastPingTime = 0;
        this.gameStarting = false; // Track if game starting event was processed
        this.gamePlaying = false; // Track if game playing event was processed
    }

    // Initialize synchronization for a room
    async startSynchronization(roomId) {
        if (!roomId || !playerAuth.isUserAuthenticated()) {
            throw new Error('Cannot start sync: no room ID or not authenticated');
        }

        this.roomId = roomId;
        this.isActive = true;
        
        // Set up Firebase references
        this.gameStateRef = firebaseDatabase.ref(`${GameConfig.MULTIPLAYER.ROOMS_PATH}/${roomId}/${GameConfig.MULTIPLAYER.GAME_STATE_PATH}`);
        
        // Initialize game state structure if host (MultiplayerManager now handles initial status update)
        if (multiplayerManager.isHost) {
            await this.initializeGameState();
        }
        
        // Set up listeners
        this.setupGameStateListeners();
        
        // Start periodic sync
        this.startPeriodicSync();
        
        console.log('🔄 Network synchronization started for room:', roomId);
    }

    // Initialize game state structure (host only)
    async initializeGameState() {
        const initialState = {
            status: 'waiting',
            countdown: 3,
            startTime: null,
            players: {},
            gameEvents: [],
            finishers: [],
            lastUpdate: firebase.database.ServerValue.TIMESTAMP // Use server timestamp
        };

        try {
            await this.gameStateRef.set(initialState);
            console.log('🎯 Game state initialized');
        } catch (error) {
            console.error('❌ Failed to initialize game state:', error);
        }
    }

    // Set up real-time listeners
    setupGameStateListeners() {
        // Listen to game state changes
        this.gameStateRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const gameState = snapshot.val();
                if (gameState) { // Ensure gameState is not null
                    this.handleGameStateUpdate(gameState);
                }
            }
        });

        // Listen to player positions specifically
        const playersRef = this.gameStateRef.child('players'); // Path to players within gameState
        playersRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                this.remotePlayersState = snapshot.val();
                this.notifyCallbacks('players_updated', this.remotePlayersState);
            }
        });

        // Listen to game events
        const eventsRef = this.gameStateRef.child('gameEvents');
        eventsRef.on('child_added', (snapshot) => {
            const event = snapshot.val();
            // Process event if it's not from the local player OR if it's a critical event all should see
            if (event && (event.playerId !== playerAuth.getCurrentUser()?.uid || event.isCritical)) {
                this.notifyCallbacks('game_event', event);
            }
        });
    }

    // Handle game state updates
    handleGameStateUpdate(gameState) {
        // Update local tracking
        this.calculateLatency();
        
        // Notify callbacks about state changes
        this.notifyCallbacks('game_state_updated', gameState);
        
        // Handle specific state changes (ensure these are only triggered once)
        if (gameState.status === 'starting' && !this.gameStarting && gameState.startTime) {
            this.gameStarting = true;
            this.notifyCallbacks('game_starting', gameState);
        }

        if (gameState.status === 'playing' && !this.gamePlaying) {
            this.gamePlaying = true;
            this.notifyCallbacks('game_playing', gameState);
        }
    }

    // Start periodic position sync
    startPeriodicSync() {
        const syncRate = this.calculateOptimalSyncRate();
        
        this.syncInterval = setInterval(() => {
            if (this.isActive && this.localPlayerState) {
                this.syncPlayerPosition();
            }
        }, 1000 / syncRate);
    }

    // Calculate optimal sync rate based on network conditions
    calculateOptimalSyncRate() {
        if (this.latency > GameConfig.MULTIPLAYER.ADAPTIVE_SYNC_THRESHOLD) {
            return GameConfig.MULTIPLAYER.MOBILE_SYNC_RATE_LOW;
        }
        return GameConfig.MULTIPLAYER.MOBILE_SYNC_RATE_HIGH;
    }

    // Sync local player position to Firebase
    async syncPlayerPosition() {
        if (!this.localPlayerState || !this.gameStateRef) return;

        const playerData = playerAuth.getPlayerData();
        if (!playerData) return;

        const positionUpdate = {
            ...this.localPlayerState,
            timestamp: firebase.database.ServerValue.TIMESTAMP, // Use server timestamp for consistency
            uid: playerData.uid
        };

        try {
            await this.gameStateRef.child(`players/${playerData.uid}`).set(positionUpdate);
        } catch (error) {
            console.error('❌ Failed to sync player position:', error);
        }
    }

    // Update local player state (called by game scene)
    updateLocalPlayerState(playerState) {
        this.localPlayerState = {
            x: Math.round(playerState.x),
            y: Math.round(playerState.y),
            velocityX: Math.round(playerState.velocityX || 0),
            velocityY: Math.round(playerState.velocityY || 0),
            animation: playerState.animation || 'idle',
            isAlive: playerState.isAlive !== false,
            powerupType: playerState.powerupType || null,
            shieldActive: playerState.shieldActive || false
        };
    }

    // Send game event to all players
    async sendGameEvent(eventType, eventData) {
        if (!this.gameStateRef) return;

        const playerData = playerAuth.getPlayerData();
        const event = {
            type: eventType,
            data: eventData,
            playerId: playerData?.uid,
            playerName: playerData?.displayName,
            timestamp: Date.now(),
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        try {
            const eventsRef = this.gameStateRef.child('gameEvents');
            await eventsRef.push(event);
            console.log('📡 Game event sent:', eventType);
        } catch (error) {
            console.error('❌ Failed to send game event:', error);
        }
    }

    // Get remote player states
    getRemotePlayerStates() {
        return this.remotePlayersState;
    }

    // Calculate network latency
    calculateLatency() {
        if (this.lastPingTime > 0) {
            this.latency = Date.now() - this.lastPingTime;
        }
        this.lastPingTime = Date.now();
    }

    // Get current latency
    getLatency() {
        return this.latency;
    }

    // Register callback for network events
    onNetworkEvent(callback) {
        this.networkCallbacks.push(callback);
    }

    // Remove network event listener
    removeNetworkEventListener(callback) {
        const index = this.networkCallbacks.indexOf(callback);
        if (index > -1) {
            this.networkCallbacks.splice(index, 1);
        }
    }

    // Notify all callbacks
    notifyCallbacks(eventType, data) {
        this.networkCallbacks.forEach(callback => {
            try {
                callback(eventType, data);
            } catch (error) {
                console.error('❌ Error in network callback:', error);
            }
        });
    }

    // Update game status (host only)
    async updateGameStatus(status, additionalData = {}) {
        if (!multiplayerManager.isHost || !this.gameStateRef) {
            return;
        }

        try {
            const update = {
                status: status,
                lastUpdate: Date.now(),
                ...additionalData
            };
            
            await this.gameStateRef.update(update);
            console.log('🎮 Game status updated:', status);
        } catch (error) {
            console.error('❌ Failed to update game status:', error);
        }
    }

    // Record finish position
    async recordFinisher(playerData, position, time) {
        if (!this.gameStateRef) return;

        const finisher = {
            uid: playerData.uid,
            displayName: playerData.displayName,
            position: position,
            finishTime: time,
            timestamp: Date.now()
        };

        try {
            const finishersRef = this.gameStateRef.child('finishers');
            await finishersRef.push(finisher);
            console.log(`🏁 Finish recorded: ${playerData.displayName} - Position ${position}`);
        } catch (error) {
            console.error('❌ Failed to record finish:', error);
        }
    }

    // Stop synchronization
    stopSynchronization() {
        this.isActive = false;
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        if (this.gameStateRef) {
            this.gameStateRef.off();
            this.gameStateRef = null;
        }
        
        // Reset state
        this.roomId = null;
        this.localPlayerState = null;
        this.remotePlayersState = {};
        this.gameEvents = [];
        this.gameStarting = false;
        this.gamePlaying = false;
        
        console.log('⏹️ Network synchronization stopped');
    }

    // Check if sync is active
    isSync() {
        return this.isActive;
    }

    // Get connection quality info
    getConnectionInfo() {
        return {
            latency: this.latency,
            isConnected: this.isActive && !!this.gameStateRef,
            syncRate: this.calculateOptimalSyncRate(),
            quality: this.latency < 100 ? 'good' : this.latency < 250 ? 'fair' : 'poor'
        };
    }
}

// Create global instance
window.networkSynchronizer = new NetworkSynchronizer();

console.log('📡 NetworkSynchronizer initialized'); 