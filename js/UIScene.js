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

        // Add a small delay to ensure GameScene is fully initialized
        this.time.delayedCall(500, () => {
            this.setupGameSceneConnection();
        });

        // Create initial powerup button
        this.createPowerupButton();
    }

    setupGameSceneConnection() {
        const gameScene = this.scene.get('GameScene');
        
        if (gameScene) {
            // Set up powerup events
            gameScene.events.on('playerCollectedPowerup', (powerupType) => {
                this.updatePowerupButton(`Use ${powerupType.charAt(0).toUpperCase() + powerupType.slice(1)}!`, true);
            }, this);

            gameScene.events.on('playerUsedPowerup', () => {
                this.updatePowerupButton('Power-up: None', false);
            }, this);
            
            console.log('✅ UIScene connected to GameScene for position tracking');
        } else {
            console.warn('⚠️ GameScene not found, retrying connection in 500ms');
            // Retry connection if GameScene isn't ready yet
            this.time.delayedCall(500, () => {
                this.setupGameSceneConnection();
            });
        }

        // Ensure UIScene is cleaned up properly
        this.events.once(Phaser.Events.SHUTDOWN, () => {
            // Clean up event listeners and UI elements
            const gameScene = this.scene.get('GameScene');
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
        // Get GameScene reference with safety check
        const gameScene = this.scene.get('GameScene');
        if (!gameScene) return;
        
        // Only update position during active gameplay
        if (gameScene.gameStarted && !gameScene.gameOver && 
            gameScene.player && gameScene.player.sprite && 
            gameScene.bots && gameScene.bots.length > 0) {
            
            // Calculate player's position by comparing with all active bots
            let playersAhead = 0;
            let validBots = 0;
            
            gameScene.bots.forEach(bot => {
                if (bot && bot.sprite && bot.sprite.active && !bot.isFalling && !bot.isBlasted) {
                    validBots++;
                    if (bot.sprite.x > gameScene.player.sprite.x) {
                        playersAhead++;
                    }
                }
            });
            
            // Player's position is the number of characters ahead + 1
            const playerPosition = playersAhead + 1;
            const totalRacers = validBots + 1; // Valid bots + player
            
            // Update position text with ordinal suffix
            const ordinalSuffix = this.getOrdinalSuffix(playerPosition);
            this.positionText.setText(`Position: ${playerPosition}${ordinalSuffix} / ${totalRacers}`);
            
        } else {
            // Show "Position: -" when game is not active
            this.positionText.setText('Position: -');
        }
    }
    
    // Helper method to get ordinal suffix (1st, 2nd, 3rd, etc.)
    getOrdinalSuffix(number) {
        const lastDigit = number % 10;
        const lastTwoDigits = number % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
            return 'th';
        }
        
        switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }
} 