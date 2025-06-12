class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }

    preload() {
        // Load assets specific to the main menu (e.g., title, start button)
    }

    create() {
        // Set background
        this.cameras.main.setBackgroundColor('#1a1a1a');
        
        // Add title text
        this.add.text(this.cameras.main.width / 2, 120, 'TrapDash!', { 
            fontSize: '48px', 
            fill: GameConfig.UI_FONT_COLOR,
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Create menu buttons container
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Single Player button
        const singlePlayerBtn = this.add.rectangle(centerX, centerY - 40, 300, 50, 0x4CAF50)
            .setInteractive()
            .on('pointerdown', () => this.startSinglePlayer())
            .on('pointerover', () => singlePlayerBtn.setFillStyle(0x66BB6A))
            .on('pointerout', () => singlePlayerBtn.setFillStyle(0x4CAF50));
        
        // Add mobile touch feedback
        this.addMobileTouchFeedback(singlePlayerBtn);
        
        this.add.text(centerX, centerY - 40, 'Single Player', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Multiplayer button (DISABLED - Coming Soon)
        const multiplayerBtn = this.add.rectangle(centerX, centerY + 20, 300, 50, 0x666666) // Gray color for disabled
            .setInteractive()
            .on('pointerdown', () => this.showComingSoonMessage()) // Show message instead of starting multiplayer
            .on('pointerover', () => multiplayerBtn.setFillStyle(0x777777)) // Slightly lighter gray on hover
            .on('pointerout', () => multiplayerBtn.setFillStyle(0x666666));
        
        // Add mobile touch feedback (even for disabled button)
        this.addMobileTouchFeedback(multiplayerBtn);
        
        this.add.text(centerX, centerY + 20, 'Multiplayer', {
            fontSize: '20px',
            fill: '#cccccc', // Lighter text color for disabled appearance
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // "Coming Soon" text below multiplayer button
        this.add.text(centerX, centerY + 45, 'Coming Soon!', {
            fontSize: '14px',
            fill: '#FFD700', // Gold color to make it stand out
            fontFamily: 'Arial',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Legacy space key support for single player
        this.input.keyboard.on('keydown-SPACE', () => {
            this.startSinglePlayer();
        });

        // Instructions text (moved down to accommodate "Coming Soon" text)
        this.add.text(centerX, centerY + 120, 'Use WASD or Arrow Keys to move, Space to jump', {
            fontSize: '16px',
            fill: '#cccccc',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
    }

    startSinglePlayer() {
        this.scene.start('GameScene', { gameMode: 'singleplayer' }); // Pass gameMode
        this.scene.launch('UIScene'); // Launch UI scene alongside GameScene
    }

    showComingSoonMessage() {
        // Create temporary "Coming Soon" message
        const message = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 100, 
            'Multiplayer Coming Soon!', {
            fontSize: '24px',
            fill: '#FFD700',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Fade out the message after 3 seconds
        this.tweens.add({
            targets: message,
            alpha: 0,
            duration: 3000,
            ease: 'Power2',
            onComplete: () => {
                message.destroy();
            }
        });
    }

    // NEW: Add mobile touch feedback to buttons
    addMobileTouchFeedback(button) {
        button.on('pointerdown', () => {
            // Scale down slightly when pressed
            this.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                ease: 'Power2',
                yoyo: true
            });
        });
    }

    update() {
        // Any animations or updates for the main menu can go here
    }
} 