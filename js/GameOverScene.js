class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.winner = data.winner; // Expects { winner: 'Player' } or { winner: 'Bot' } or { winner: 'None' }
    }

    preload() {
        // Load assets for the game over screen if any (e.g., special fonts, buttons)
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000'); // Simple black background

        let winnerText = "Race Over!";
        if (this.winner === 'Player') {
            winnerText = "Player Wins!";
        } else if (this.winner === 'Bot') {
            winnerText = "Bot Wins!";
        }
        // If this.winner is 'None' or undefined, it defaults to "Race Over!"

        const textStyle = { fontSize: GameConfig.UI_FONT_SIZE_LARGE, fill: GameConfig.UI_FONT_COLOR, backgroundColor: '#0008', padding: {left: 10, right: 10, top:5, bottom:5} };
        const restartTextStyle = { fontSize: GameConfig.UI_FONT_SIZE_MEDIUM, fill: GameConfig.UI_FONT_COLOR, backgroundColor: '#0008', padding: {left: 10, right: 10, top:5, bottom:5} };

        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 40, winnerText, textStyle).setOrigin(0.5);
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 10, 'Press R to Restart', restartTextStyle).setOrigin(0.5);

        this.input.keyboard.on('keydown-R', () => {
            console.log("R pressed on GameOverScene, restarting to MainMenuScene.");
            this.scene.stop('UIScene'); // Stop the UI scene if it's running
            this.scene.start('MainMenuScene');
        });
    }
} 