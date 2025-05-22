class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene' });
    }

    preload() {
        // Load assets for UI elements if any (e.g., icons for power-ups)
    }

    create() {
        this.powerupButton = null; // Initialize property

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

        // Create initial powerup button
        this.createPowerupButton();

        if (gameScene) {
            gameScene.events.on('playerCollectedPowerup', (powerupType) => {
                this.updatePowerupButton(`Use ${powerupType.charAt(0).toUpperCase() + powerupType.slice(1)}!`, true);
            }, this);

            gameScene.events.on('playerUsedPowerup', () => {
                this.updatePowerupButton('Power-up: None', false);
            }, this);
        }

        // Ensure UIScene is cleaned up properly
        this.events.on(Phaser.Events.SHUTDOWN, () => {
            // Clean up event listeners and UI elements
            if (gameScene) {
                gameScene.events.off('playerCollectedPowerup', undefined, this);
                gameScene.events.off('playerUsedPowerup', undefined, this);
            }
            if (this.powerupButton) {
                this.powerupButton.destroy();
                this.powerupButton = null;
            }
        });
    }

    // Create the initial powerup button
    createPowerupButton() {
        // Defensive check: ensure cameras are ready
        if (!this.cameras || !this.cameras.main) {
            console.warn("UIScene: Cameras not ready, delaying button creation");
            this.time.delayedCall(100, () => {
                this.createPowerupButton();
            }, [], this);
            return;
        }

        if (this.powerupButton) {
            this.powerupButton.destroy();
        }

        this.powerupButton = this.add.text(this.cameras.main.width - 150, 10, 'Power-up: None', {
            fontFamily: 'Arial',
            fontSize: GameConfig.UI_FONT_SIZE_SMALL,
            fill: '#cccccc', // Greyed out initially
            backgroundColor: GameConfig.UI_BUTTON_COLOR,
            padding: { left: 10, right: 10, top: 5, bottom: 5 }
        }).setScrollFactor(0).setOrigin(0, 0);

        // Initially not interactive
        this.powerupButton.disableInteractive();

        // Initial powerup button created
    }

    // Update powerup button by recreating it (avoids setText issues)
    updatePowerupButton(text, isActive) {
        // Defensive check: ensure cameras are ready
        if (!this.cameras || !this.cameras.main) {
            console.warn("UIScene: Cameras not ready, delaying button update");
            this.time.delayedCall(100, () => {
                this.updatePowerupButton(text, isActive);
            }, [], this);
            return;
        }

        const buttonX = this.cameras.main.width - 150;
        const buttonY = 10;

        // Destroy existing button
        if (this.powerupButton) {
            this.powerupButton.destroy();
        }

        // Create new button with updated text and state
        this.powerupButton = this.add.text(buttonX, buttonY, text, {
            fontFamily: 'Arial',
            fontSize: GameConfig.UI_FONT_SIZE_SMALL,
            fill: isActive ? GameConfig.UI_FONT_COLOR : '#cccccc',
            backgroundColor: GameConfig.UI_BUTTON_COLOR,
            padding: { left: 10, right: 10, top: 5, bottom: 5 }
        }).setScrollFactor(0).setOrigin(0, 0);

        if (isActive) {
            this.powerupButton.setInteractive({ useHandCursor: true });
            
            // Add event handlers for active button
            const gameScene = this.scene.get('GameScene');
            if (gameScene) {
                this.powerupButton.on('pointerdown', () => {
                    gameScene.events.emit('deployPlayerPowerup');
                });

                this.powerupButton.on('pointerover', () => {
                    this.powerupButton.setBackgroundColor(GameConfig.UI_BUTTON_HOVER_COLOR);
                });
                
                this.powerupButton.on('pointerout', () => {
                    this.powerupButton.setBackgroundColor(GameConfig.UI_BUTTON_COLOR);
                });
            }
        } else {
            this.powerupButton.disableInteractive();
        }

        // Button updated successfully
    }

    // Helper method to recreate the button if needed (keeping for backward compatibility)
    recreatePowerupButton(powerupType) {
        this.updatePowerupButton(`Use ${powerupType.charAt(0).toUpperCase() + powerupType.slice(1)}!`, true);
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