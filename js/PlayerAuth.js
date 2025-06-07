// js/PlayerAuth.js
class PlayerAuth {
    constructor() {
        this.currentUser = null;
        this.playerData = null;
        this.isAuthenticated = false;
        this.authCallbacks = [];
        
        // Initialize authentication state listener
        this.initAuthListener();
    }

    initAuthListener() {
        firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.isAuthenticated = true;
                this.setupPlayerData(user);
                console.log('👤 User authenticated:', user.uid);
            } else {
                this.currentUser = null;
                this.isAuthenticated = false;
                this.playerData = null;
                console.log('🚪 User signed out');
            }
            
            // Notify all callbacks about auth state change
            this.authCallbacks.forEach(callback => callback(this.isAuthenticated, this.playerData));
        });
    }

    async signInAnonymously() {
        try {
            console.log('🔐 Attempting anonymous sign-in...');
            const result = await firebaseAuth.signInAnonymously();
            console.log('✅ Anonymous sign-in successful');
            return result.user;
        } catch (error) {
            console.error('❌ Anonymous sign-in failed:', error);
            throw error;
        }
    }

    setupPlayerData(user) {
        // Get or create player display name
        const storedName = localStorage.getItem('trapdash_player_name');
        const displayName = storedName || this.generatePlayerName();
        
        this.playerData = {
            uid: user.uid,
            displayName: displayName,
            joinedAt: Date.now(),
            gamesPlayed: parseInt(localStorage.getItem('trapdash_games_played') || '0'),
            wins: parseInt(localStorage.getItem('trapdash_wins') || '0')
        };

        // Store display name if it's new
        if (!storedName) {
            localStorage.setItem('trapdash_player_name', displayName);
        }
    }

    generatePlayerName() {
        const randomNum = Math.floor(Math.random() * 9999) + 1;
        return `${GameConfig.MULTIPLAYER.DEFAULT_PLAYER_NAME_PREFIX}${randomNum}`;
    }

    updatePlayerName(newName) {
        if (newName && newName.length <= GameConfig.MULTIPLAYER.MAX_USERNAME_LENGTH) {
            this.playerData.displayName = newName;
            localStorage.setItem('trapdash_player_name', newName);
            return true;
        }
        return false;
    }

    onAuthStateChange(callback) {
        this.authCallbacks.push(callback);
        
        // Immediately call with current state if already initialized
        if (this.currentUser !== null || this.isAuthenticated === false) {
            callback(this.isAuthenticated, this.playerData);
        }
    }

    removeAuthStateListener(callback) {
        const index = this.authCallbacks.indexOf(callback);
        if (index > -1) {
            this.authCallbacks.splice(index, 1);
        }
    }

    async signOut() {
        try {
            await firebaseAuth.signOut();
            console.log('👋 User signed out successfully');
        } catch (error) {
            console.error('❌ Sign out failed:', error);
            throw error;
        }
    }

    getPlayerData() {
        return this.playerData;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Update player statistics
    updateStats(gameResult) {
        if (!this.playerData) return;

        this.playerData.gamesPlayed++;
        localStorage.setItem('trapdash_games_played', this.playerData.gamesPlayed.toString());

        if (gameResult.won) {
            this.playerData.wins++;
            localStorage.setItem('trapdash_wins', this.playerData.wins.toString());
        }

        console.log('📊 Player stats updated:', {
            gamesPlayed: this.playerData.gamesPlayed,
            wins: this.playerData.wins
        });
    }
}

// Create global instance
window.playerAuth = new PlayerAuth();

console.log('🎮 PlayerAuth initialized'); 