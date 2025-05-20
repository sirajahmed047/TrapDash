// Basic Phaser 3 Game Configuration
const config = {
    type: Phaser.AUTO, // Automatically choose WebGL or Canvas
    width: 800,        // Game width in pixels
    height: 600,       // Game height in pixels
    parent: 'game-container', // ID of the DOM element to parent the canvas to
    backgroundColor: '#000000', // Default background, scenes can override
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Global gravity default, scenes can override (e.g. GameScene sets its own)
            debug: true        // Set to false for production
        }
    },
    scene: [BootScene, MainMenuScene, GameScene, UIScene, GameOverScene] // Scene classes array
};

// Global game constants (consider moving to a dedicated constants file or per-scene if not truly global)
// const JUMP_VELOCITY = -300; // Will be managed by GameScene or Player class
// const TRACK_WIDTH_MULTIPLIER = 7; // Will be managed by GameScene
// const BOT_JUMP_LOOKAHEAD_WALL = 95; // Will be managed by GameScene/Bot class
// const BOT_JUMP_LOOKAHEAD_GAP = 90; // Will be managed by GameScene/Bot class
// const PLAYER_SPEED_NORMAL = 250; // Will be managed by GameScene/Player class
// const PLAYER_SPEED_BOOSTED = 400; // Will be managed by GameScene/Player class
// const BOT_SPEED_NORMAL = 249; // Will be managed by GameScene/Bot class
// const BOT_SPEED_BOOSTED = 390; // Will be managed by GameScene/Bot class

// Create a new Phaser Game instance
const game = new Phaser.Game(config);

// The old global preload, create, and update functions will be removed.
// Their logic will be migrated to the respective Scene classes.
