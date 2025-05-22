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
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        let titleText = "Race Over!";
        let motivationalText = "Better luck next time!";

        if (this.winner) {
            if (this.winner === 'Player') {
                titleText = "Player Wins!";
                motivationalText = "Well Done!";
            } else if (this.winner.startsWith('Bot')) { // Catches "Bot 1", "Bot 2", etc.
                titleText = `${this.winner} Wins!`;
                motivationalText = "Try Again!";
            } else { // Fallback for generic "Bot" or other unhandled cases
                titleText = `${this.winner} Wins!`; // Could be "Bot Wins!" 
                motivationalText = "Try Again!";
            }
        }
        
        const titleStyle = { fontSize: '48px', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 20, y: 10 } };
        const motivationalStyle = { fontSize: '32px', fill: '#dddddd', backgroundColor: '#000000aa', padding: { x: 15, y: 8 } };
        const buttonStyle = { fontSize: '28px', fill: '#ffffff', backgroundColor: '#333333', padding: { x: 15, y: 10 }, align: 'center' };
        const buttonHoverStyle = { fill: '#ffff00' };

        this.add.text(centerX, centerY - 100, titleText, titleStyle).setOrigin(0.5);
        this.add.text(centerX, centerY - 40, motivationalText, motivationalStyle).setOrigin(0.5);

        // Retry Button
        const retryButton = this.add.text(centerX, centerY + 50, 'Retry', buttonStyle).setOrigin(0.5).setInteractive();
        retryButton.on('pointerdown', () => {
            console.log("Retry button clicked, restarting GameScene.");
            // this.scene.stop('UIScene'); // UIScene should be stopped by GameScene before coming here
            this.scene.start('GameScene'); 
        });
        retryButton.on('pointerover', () => retryButton.setStyle(buttonHoverStyle));
        retryButton.on('pointerout', () => retryButton.setStyle(buttonStyle));

        // Main Menu Button
        const mainMenuButton = this.add.text(centerX, centerY + 110, 'Main Menu', buttonStyle).setOrigin(0.5).setInteractive();
        mainMenuButton.on('pointerdown', () => {
            console.log("Main Menu button clicked, going to MainMenuScene.");
            // this.scene.stop('UIScene');
            this.scene.start('MainMenuScene');
        });
        mainMenuButton.on('pointerover', () => mainMenuButton.setStyle(buttonHoverStyle));
        mainMenuButton.on('pointerout', () => mainMenuButton.setStyle(buttonStyle));
    }
} 