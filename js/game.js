// Basic Phaser 3 Game Configuration
const config = {
    type: Phaser.AUTO, // Automatically choose WebGL or Canvas
    parent: 'game-container', // ID of the DOM element to parent the canvas to
    backgroundColor: '#000000', // Default background, scenes can override
    // Use Phaser Scale Manager for responsive sizing
    scale: {
        mode: Phaser.Scale.RESIZE,          // Automatically resize to fill parent
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GameConfig.GAME_WIDTH,       // Base game width (logical coordinate system)
        height: GameConfig.GAME_HEIGHT      // Base game height (logical coordinate system)
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Global gravity default, scenes can override (e.g. GameScene sets its own)
            debug: false        // Set to false for production
        }
    },
    scene: [BootScene, MainMenuScene, /* LobbyScene, */ GameScene, UIScene, GameOverScene] // LobbyScene temporarily disabled for single-player release
};

// Create a new Phaser Game instance
const game = new Phaser.Game(config);

// === MOBILE BACKGROUND/FOREGROUND HANDLING ===
function pauseAllScenes() {
    game.scene.getScenes(true).forEach(sc => sc.scene.pause());
    console.log('[AppState] Game paused (background)');
}

function resumeAllScenes() {
    game.scene.getScenes(false).forEach(sc => {
        if (sc.scene.isPaused()) sc.scene.resume();
    });
    console.log('[AppState] Game resumed (foreground)');
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        pauseAllScenes();
    } else {
        resumeAllScenes();
    }
});

window.addEventListener('blur', pauseAllScenes);
window.addEventListener('focus', resumeAllScenes);

// Handle browser resize to keep game full-screen
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});

// The old global preload, create, and update functions will be removed.
// Their logic will be migrated to the respective Scene classes.
