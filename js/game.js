// Basic Phaser 3 Game Configuration
const config = {
    type: Phaser.AUTO, // Automatically choose WebGL or Canvas
    width: GameConfig.GAME_WIDTH,
    height: GameConfig.GAME_HEIGHT,
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

// Create a new Phaser Game instance
const game = new Phaser.Game(config);

// The old global preload, create, and update functions will be removed.
// Their logic will be migrated to the respective Scene classes.
