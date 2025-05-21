class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene' });
    }

    preload() {
        // Load assets for UI elements if any (e.g., icons for power-ups)
    }

    create() {

        // Position Tracking Text (example, will be populated from GameScene events or registry)
        this.positionText = this.add.text(10, 10, 'Position: -', { 
            fontSize: GameConfig.UI_FONT_SIZE_SMALL, 
            fill: GameConfig.UI_FONT_COLOR, 
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: { left: 5, right: 5, top: 2, bottom: 2 }
        }).setScrollFactor(0);

        // Listen for events from GameScene to update UI
        // For example, the GameScene could emit an event 'updatePosition'
        const gameScene = this.scene.get('GameScene');

        // It's often better to use the Phaser event emitter or registry for cross-scene communication.
        // For now, we can periodically check or have GameScene update a value in the registry.
        // Example of GameScene telling UIScene to update:
        // gameScene.events.on('updatePositionDisplay', (text) => {
        //     this.positionText.setText(text);
        // }, this);
    }

    update() {
        // Update UI elements if needed (e.g., animations, timers)
        // For dynamic text like position, GameScene will likely drive updates either via events or registry.
        // As a simple polling example (less ideal than events for frequent updates):
        const gameScene = this.scene.get('GameScene');
        if (gameScene && gameScene.player && gameScene.bot && gameScene.player.sprite && gameScene.bot.sprite && gameScene.gameStarted && !gameScene.gameOver) {
            if (gameScene.player.sprite.x > gameScene.bot.sprite.x) {
                this.positionText.setText('Position: 1st');
            } else if (gameScene.bot.sprite.x > gameScene.player.sprite.x) {
                this.positionText.setText('Position: 2nd');
            } else {
                this.positionText.setText('Position: Tied'); 
            }
        } else if (gameScene && !gameScene.gameStarted && this.positionText) {
            this.positionText.setText('Position: -');
        }
    }
} 