class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    preload() {
        // Load assets specific to the main menu (e.g., title, start button)
    }

    create() {
        // Add title text and start prompt
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 50, 'TrapDash!', { fontSize: '48px', fill: GameConfig.UI_FONT_COLOR }).setOrigin(0.5);
        this.startText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 20, 'Press SPACE to Start', {
            fontSize: GameConfig.UI_FONT_SIZE_LARGE, fill: GameConfig.UI_FONT_COLOR, backgroundColor: '#0005',
            padding: { left: 15, right: 15, top: 10, bottom: 10 }
        }).setOrigin(0.5);

        // Input listener to start the game
        this.input.keyboard.on('keydown-SPACE', () => {
            this.scene.start('GameScene');
            this.scene.launch('UIScene'); // Launch UI scene alongside GameScene
        });
    }

    update() {
        // Any animations or updates for the main menu can go here
    }
} 