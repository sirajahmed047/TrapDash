class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene' });
        // Track last power-up button state for responsive repositioning
        this.lastPowerupButtonText = 'Power-up: None';
        this.lastPowerupButtonActive = false;
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

        // Listen for game resize events to reposition UI elements
        this.scale.on('resize', this.handleResize, this);
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

        // MOBILE-OPTIMIZED POSITIONING: Bottom-right for thumb accessibility
        const buttonConfig = GameConfig.MOBILE_POWERUP_BUTTON;
        let buttonX = this.cameras.main.width - buttonConfig.WIDTH - buttonConfig.MARGIN_X;
        if (buttonX < buttonConfig.MARGIN_X) buttonX = buttonConfig.MARGIN_X;
        const buttonY = this.cameras.main.height - buttonConfig.HEIGHT - buttonConfig.MARGIN_Y;

        this.powerupButton = this.add.text(buttonX, buttonY, 'Power-up: None', {
            fontFamily: 'Arial',
            fontSize: buttonConfig.FONT_SIZE, // Larger font for mobile
            fill: '#cccccc', // Greyed out initially
            backgroundColor: GameConfig.UI_BUTTON_COLOR,
            padding: { left: 15, right: 15, top: 12, bottom: 12 }, // Larger padding for touch
            align: 'center'
        }).setScrollFactor(0).setOrigin(0, 0);

        // Ensure minimum touch target size
        const minSize = GameConfig.MOBILE_MIN_TOUCH_TARGET;
        if (this.powerupButton.width < minSize) {
            this.powerupButton.setPadding(20, 12, 20, 12);
        }
        if (this.powerupButton.height < minSize) {
            this.powerupButton.setPadding(15, 18, 15, 18);
        }

        // Initially not interactive
        this.powerupButton.disableInteractive();

        console.log(`📱 Mobile power-up button positioned at (${buttonX}, ${buttonY}) with size ${this.powerupButton.width}x${this.powerupButton.height}`);
    }

    // Update powerup button by recreating it (avoids setText issues)
    updatePowerupButton(text, isActive) {
        // Store state for future repositioning (e.g., on resize)
        this.lastPowerupButtonText = text;
        this.lastPowerupButtonActive = isActive;

        // Defensive check: ensure cameras are ready
        if (!this.cameras || !this.cameras.main) {
            console.warn("UIScene: Cameras not ready, delaying button update");
            this.time.delayedCall(100, () => {
                this.updatePowerupButton(text, isActive);
            }, [], this);
            return;
        }

        // MOBILE-OPTIMIZED POSITIONING: Bottom-right for thumb accessibility
        const buttonConfig = GameConfig.MOBILE_POWERUP_BUTTON;
        let buttonX = this.cameras.main.width - buttonConfig.WIDTH - buttonConfig.MARGIN_X;
        if (buttonX < buttonConfig.MARGIN_X) buttonX = buttonConfig.MARGIN_X;
        const buttonY = this.cameras.main.height - buttonConfig.HEIGHT - buttonConfig.MARGIN_Y;

        // Destroy existing button
        if (this.powerupButton) {
            this.powerupButton.destroy();
        }

        // Create new button with updated text and state
        this.powerupButton = this.add.text(buttonX, buttonY, text, {
            fontFamily: 'Arial',
            fontSize: buttonConfig.FONT_SIZE, // Mobile-optimized font size
            fill: isActive ? GameConfig.UI_FONT_COLOR : '#cccccc',
            backgroundColor: isActive ? GameConfig.UI_BUTTON_COLOR : '#444444',
            padding: { left: 15, right: 15, top: 12, bottom: 12 }, // Touch-friendly padding
            align: 'center'
        }).setScrollFactor(0).setOrigin(0, 0);

        // Ensure minimum touch target size
        const minSize = GameConfig.MOBILE_MIN_TOUCH_TARGET;
        if (this.powerupButton.width < minSize) {
            this.powerupButton.setPadding(20, 12, 20, 12);
        }
        if (this.powerupButton.height < minSize) {
            this.powerupButton.setPadding(15, 18, 15, 18);
        }

        if (isActive) {
            this.powerupButton.setInteractive({ useHandCursor: true });
            
            // Add mobile touch feedback for button
            this.addMobileButtonFeedback(this.powerupButton);
            
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

        console.log(`📱 Mobile power-up button updated: "${text}" (active: ${isActive})`);
    }

    // NEW: Add mobile touch feedback to buttons
    addMobileButtonFeedback(button) {
        button.on('pointerdown', () => {
            // Scale down slightly when pressed
            this.tweens.add({
                targets: button,
                scaleX: GameConfig.MOBILE_TOUCH_FEEDBACK.BUTTON_PRESS_SCALE,
                scaleY: GameConfig.MOBILE_TOUCH_FEEDBACK.BUTTON_PRESS_SCALE,
                duration: GameConfig.MOBILE_TOUCH_FEEDBACK.BUTTON_PRESS_DURATION,
                ease: 'Power2',
                yoyo: true
            });
        });
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
            gameScene.player && gameScene.player.sprite) {
            
            // Calculate player's position by comparing with all active characters
            let playersAhead = 0;
            let totalRacers = 1; // Start with 1 for the player
            
            // Count bots ahead of player
            if (gameScene.bots && gameScene.bots.length > 0) {
                gameScene.bots.forEach(bot => {
                    if (bot && bot.sprite && bot.sprite.active && !bot.isFalling && !bot.isBlasted) {
                        totalRacers++;
                        if (bot.sprite.x > gameScene.player.sprite.x) {
                            playersAhead++;
                        }
                    }
                });
            }
            
            // Player's position is the number of characters ahead + 1
            const playerPosition = playersAhead + 1;
            
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

    // Handle game resize events to keep UI correctly positioned
    handleResize(gameSize) {
        if (!gameSize) {
            return;
        }

        // Reposition the position tracking text (fixed offset from top-left)
        this.positionText.setPosition(10, 10);

        // Recreate / reposition the power-up button using the stored state
        this.updatePowerupButton(this.lastPowerupButtonText, this.lastPowerupButtonActive);
    }
} 