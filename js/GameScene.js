class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        // Game state flags, initialized here
        this.gameStarted = false; // Will be set to true after a brief delay or immediately
        this.gameOver = false;
        this.playerWon = null;
        this.isPlayerActuallyFinished = false;
        this.botsFinishedCount = 0;

        // Countdown related
        this.countdownText = null;
        this.countdownTimer = null;
        this.countdownValue = 3; // Start from 3

        // References to game objects
        this.player = null;
        this.bots = [];
        this.groundGroup = null;
        this.trackSegments = null;
        this.wallsGroup = null;
        this.powerupsGroup = null;
        this.finishLine = null;
        
        this.cursors = null;
        this.restartKey = null; // Will be handled by GameOverScene primarily

        this.fallDeathY = 0;
        this.groundTopY = 0;

        // Constants specific to this scene instance
        this.configWidth = this.game.config.width;
        this.configHeight = this.game.config.height;
    }

    preload() {
        // Load game assets
        // Using the animations loaded in BootScene
        this.load.image("powerupSpeedIconPH", "assets/images/powerup_speed_icon_placeholder.png");
        this.load.image("powerupShieldIconPH", "assets/images/powerup_shield_icon_placeholder.png");
        this.load.image("wall", "assets/images/obstacle_wall.png");
    }

    create() {
        // HARDCODED TEMPORARY VALUES FOR DEBUGGING
        const TEMP_DEFAULT_GRAVITY = 400;
        const TEMP_GROUND_Y_OFFSET = 200;
        const TEMP_PLAYER_RESPAWN_Y_OFFSET = -24;
        const TEMP_GROUND_SEGMENT_HEIGHT = 50;

        // this.physics.world.gravity.y = GameConfig.DEFAULT_GRAVITY;
        this.physics.world.gravity.y = TEMP_DEFAULT_GRAVITY;
        this.cameras.main.setBackgroundColor(GameConfig.SKY_COLOR); // Sky color is fine from GameConfig

        // Enable physics debug drawing
        this.physics.world.createDebugGraphic();
        // Make sure debug is drawn for dynamic bodies too
        this.physics.world.drawDebug = true;

        this.groundTopY = this.configHeight - TEMP_GROUND_Y_OFFSET;
        this.fallDeathY = this.groundTopY + TEMP_GROUND_SEGMENT_HEIGHT + GameConfig.FALL_DEATH_Y_BUFFER;

        // Ground Plane and Track Segments (using functions from obstacles.js)
        const groundData = createGroundAndTrack(this, this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER, this.groundTopY, TEMP_GROUND_SEGMENT_HEIGHT);
        this.groundGroup = groundData.groundGroup;
        this.trackSegments = groundData.trackSegments;

        // Ground group created successfully

        // Player Instance
        // Place player directly on the ground to prevent falling through
        const playerInitialY = this.groundTopY - (64/2); // half of sprite height
        this.player = new Player(this, GameConfig.PLAYER_INITIAL_X, playerInitialY, "player_run_anim", GameConfig.PLAYER_SPEED_NORMAL, GameConfig.PLAYER_SPEED_BOOSTED, GameConfig.JUMP_VELOCITY);

        // Player sprite created and configured

        // Bot Instance
        // Place bot directly on the ground to prevent falling through
        const botInitialY = this.groundTopY - (64/2); // half of sprite height
        for (let i = 0; i < 3; i++) {
            const bot = new Bot(this, GameConfig.BOT_INITIAL_X + (i * 50), botInitialY, "bot_run_anim", GameConfig.BOT_SPEED_NORMAL, GameConfig.BOT_SPEED_BOOSTED, GameConfig.JUMP_VELOCITY, i + 1); // Pass i + 1 as botNumber, increased spacing
            this.bots.push(bot);
            // Bot sprite created and configured
        }

        // Power-ups (using functions from powerups.js)
        this.powerupsGroup = createPowerups(this, this.groundTopY);

        // Walls Obstacles (using function from obstacles.js)
        this.wallsGroup = createWalls(this, this.groundTopY);

        // --- Physics Colliders and Overlaps ---
        if (this.groundGroup && this.groundGroup.getChildren().length > 0) {
            const groundChildren = this.groundGroup.getChildren();
            this.physics.add.collider(this.player.sprite, groundChildren);
            this.bots.forEach(bot => {
                this.physics.add.collider(bot.sprite, groundChildren);
            });
            // Player and Bot ground colliders configured
        } else {
            console.error("GameScene: Ground group is empty or not found, cannot set collider with groundGroup!");
        }

        this.physics.add.collider(this.player.sprite, this.wallsGroup, (playerSprite, wall) => {
            playerSprite.playerInstance.onHitObstacle(wall);
        }, null, this);
        this.bots.forEach(bot => {
            this.physics.add.collider(bot.sprite, this.wallsGroup, (botSprite, wall) => {
                botSprite.botInstance.onHitObstacle(wall);
            }, null, this);
        });

        // Power-up Collection
        this.physics.add.overlap(this.player.sprite, this.powerupsGroup, (playerSprite, powerupIcon) => {
            if (!powerupIcon.active) return;
            const type = powerupIcon.getData('type');
            playerSprite.playerInstance.collectPowerup(type);
            powerupIcon.disableBody(true, true);
            // Assuming initiatePowerupRespawn is globally available
            initiatePowerupRespawn(this, powerupIcon);
        }, null, this);

        this.bots.forEach(bot => {
            this.physics.add.overlap(bot.sprite, this.powerupsGroup, (botSprite, powerupIcon) => {
                if (!powerupIcon.active) return;
                const type = powerupIcon.getData('type');
                botSprite.botInstance.collectPowerup(type);
                powerupIcon.disableBody(true, true);
                initiatePowerupRespawn(this, powerupIcon);
            }, null, this);
        });

        // Finish Line
        const finishLineHeight = this.configHeight - GameConfig.FINISH_LINE_HEIGHT_OFFSET;
        // TRACK_WIDTH is already calculated using GameConfig.TRACK_WIDTH_MULTIPLIER
        const finishLineX = (this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER) * GameConfig.FINISH_LINE_X_MULTIPLIER;
        this.finishLine = this.add.rectangle(finishLineX, finishLineHeight / 2, 10, finishLineHeight, 0xffff00);
        this.physics.add.existing(this.finishLine, true); // true for static body

        this.physics.add.overlap(this.player.sprite, this.finishLine, () => this.handleCharacterFinish(this.player), null, this);
        this.bots.forEach(bot => {
            this.physics.add.overlap(bot.sprite, this.finishLine, () => this.handleCharacterFinish(bot), null, this);
        });
        
        // Camera Setup
        // TRACK_WIDTH is already calculated above using GameConfig.TRACK_WIDTH_MULTIPLIER
        this.physics.world.setBounds(0, 0, this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER, this.configHeight);
        this.cameras.main.setBounds(0, 0, this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER, this.configHeight);
        this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);

        // Input cursors
        this.cursors = this.input.keyboard.createCursorKeys();
        // R key for restart is primarily for GameOverScene, but can be listened to here for debugging if needed.
        // this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        // The game effectively starts as soon as this scene is created.
        // MainMenuScene handles the "Press SPACE to start"
        // this.gameStarted = true; 
        
        // Start movement after a small delay to ensure physics bodies are fully set up
        // this.time.delayedCall(100, () => {
        //     console.log("Starting player and bot movement");
        //     if (this.player && this.player.sprite && this.player.sprite.body) {
        //         this.player.sprite.body.setVelocityX(this.player.currentSpeed);
        //     }
        //     this.bots.forEach(bot => {
        //         if (bot && bot.sprite && bot.sprite.body) {
        //             bot.sprite.body.setVelocityX(bot.currentSpeed);
        //         }
        //     });
        // });

        // Countdown Text
        this.countdownText = this.add.text(this.configWidth / 2, this.configHeight / 2, '', { 
            fontFamily: 'Arial Black', 
            fontSize: '128px', 
            color: '#ffff00', 
            stroke: '#000000', 
            strokeThickness: 8,
            align: 'center' 
        }).setOrigin(0.5).setScrollFactor(0); // Centered and fixed to camera

        this.startCountdown();

        // --- Event Listener for Power-up Deployment from UIScene ---
        this.events.on('deployPlayerPowerup', () => {
            if (this.player && !this.gameOver && this.gameStarted) {
                const deployed = this.player.deployCollectedPowerup();
                if (deployed) {
                    // Player power-up deployed via UI
                    // Potentially play a sound effect for power-up deployment here
                }
            }
        }, this);

        // Ensure listener is removed on shutdown
        this.events.on(Phaser.Events.SHUTDOWN, () => {
            this.events.off('deployPlayerPowerup', undefined, this);
        }, this);
    }

    startCountdown() {
        this.gameStarted = false; // Ensure game logic doesn't run
        this.countdownValue = 3; // Reset countdown value
        this.countdownText.setText(this.countdownValue.toString()).setVisible(true);

        // Ensure player and bots are stationary
        if (this.player && this.player.sprite && this.player.sprite.body) {
            this.player.sprite.body.setVelocityX(0);
            this.player.sprite.anims.stop(); // Stop animation
        }
        this.bots.forEach(bot => {
            if (bot && bot.sprite && bot.sprite.body) {
                bot.sprite.body.setVelocityX(0);
                bot.sprite.anims.stop(); // Stop animation
            }
        });
        
        if (this.countdownTimer) {
            this.countdownTimer.remove(false); // Remove existing timer if any
        }
        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateCountdown,
            callbackScope: this,
            loop: true
        });
    }

    updateCountdown() {
        this.countdownValue--;

        if (this.countdownValue > 0) {
            this.countdownText.setText(this.countdownValue.toString());
        } else if (this.countdownValue === 0) {
            this.countdownText.setText('GO!');
        } else { // countdownValue < 0, means GO! was shown, now start game
            if (this.countdownTimer) {
                this.countdownTimer.remove(false);
                this.countdownTimer = null;
            }
            this.startGamePlay();
        }
    }

    startGamePlay() {
        if (this.gameStarted) return; // Prevent multiple starts

        this.gameStarted = true;
        this.countdownText.setVisible(false);

        // Starting player and bot movement
        if (this.player && this.player.sprite && this.player.sprite.body) {
            this.player.startMoving(); // Use method from Player class
        }
        this.bots.forEach(bot => {
            if (bot && bot.sprite && bot.sprite.body) {
                bot.startMoving(); // Use method from Bot class
            }
        });
    }

    // Generic finish handler (moved into GameScene)
    handleCharacterFinish(characterInstance) {
        if (this.gameOver) return; // Already over, or someone else finished in the same frame processing.

        const isPlayer = (characterInstance === this.player);

        if (isPlayer) {
            if (!this.isPlayerActuallyFinished) { // Check if player hasn't finished yet
                this.isPlayerActuallyFinished = true;
                characterInstance.onFinish(); // Call method on Player instance
            }
        } else { // It's a bot
            // Check if this specific bot instance has already finished
            if (!characterInstance.isFinished) {
                 characterInstance.onFinish(); // Call method on Bot instance (sets internal isFinished flag)
                 this.botsFinishedCount++;
            }
        }
        
        let winnerDetermined = null;

        // Check win condition only if not already game over
        if (!this.gameOver) {
            if (this.isPlayerActuallyFinished) {
                winnerDetermined = 'Player';
            } else if (this.botsFinishedCount > 0 && !this.isPlayerActuallyFinished) {
                // If any bot has finished and the player hasn't, find out which bot was first among those finished.
                let firstBotWinner = null;
                for (const bot of this.bots) {
                    if (bot.isFinished) { // isFinished is set in Bot's onFinish()
                        if (!firstBotWinner) { // Take the first one we find that crossed
                            firstBotWinner = bot;
                            break; 
                        }
                        // Potentially add logic here if multiple bots cross nearly simultaneously and you want to check sprite.x
                    }
                }
                if (firstBotWinner) {
                    winnerDetermined = firstBotWinner.botId; // Use the botId (e.g., "Bot 1")
                } else {
                    winnerDetermined = 'Bot'; // Fallback, though should not happen if botsFinishedCount > 0
                }
            }
            // Scenario where multiple bots finish, but player hasn't - firstBotWinner logic handles this.
            // If player and a bot finish in very quick succession, the first one to trigger this will set gameOver.
        }


        if (winnerDetermined && !this.gameOver) { // Ensure gameOver is set only once
            this.gameOver = true;
            this.playerWon = winnerDetermined; // playerWon will be 'Player' or 'Bot'
            // Game Over - transitioning to game over scene

            if (isPlayer) { // If player is the one crossing and winning/triggering game over
                this.cameras.main.stopFollow();
            } else if (this.playerWon === 'Bot' && this.player && this.player.sprite) { 
                // If Bot wins, ensure camera stops following player if it was.
                 this.cameras.main.stopFollow();
            }
            
            // Transition to GameOverScene
            this.scene.stop('UIScene'); // Stop the UI scene
            this.scene.start('GameOverScene', { winner: this.playerWon });
        }
    }


    update(time, delta) {
        if (!this.gameStarted || this.gameOver) { // Added !this.gameStarted check
            // Stop all characters if game is not started or over
            if (this.player && this.player.sprite.body) {
                this.player.sprite.body.setVelocityX(0);
            }
            this.bots.forEach(bot => {
                if (bot && bot.sprite.body) {
                    bot.sprite.body.setVelocityX(0);
                }
            });
            // Transition to GameOverScene (already handled by playerWon being set)
            return;
        }

        // Start Game Logic
        if (!this.gameStarted) {
            // This logic is now mostly handled by MainMenuScene
            // For safety, ensure characters don't move if game hasn't "started" according to this scene
            return;
        }


        // Player Update
        if (this.player && this.player.sprite.active) { // Check if sprite is active
            this.player.update(this.cursors, this.trackSegments, this.wallsGroup, this.fallDeathY, this.groundTopY);
        }


        // Bot Updates
        this.bots.forEach(bot => {
            if (bot && bot.sprite.active) { // Check if sprite is active
                bot.update(); // General update for movement, animations, glow
                // AI decisions based on environment and bot's specific parameters
                bot.updateAI(this.trackSegments, this.wallsGroup, GameConfig.BOT_JUMP_LOOKAHEAD_WALL, GameConfig.BOT_JUMP_LOOKAHEAD_GAP);
            }
        });


        // Position Tracking
        // Fall detection
        if (this.player && !this.player.isFalling && this.player.sprite.y > this.fallDeathY) {
            this.player.onFall();
            // Removed game over logic: Player will respawn via Player.onFall()
            // if (!this.gameOver) {
            //     console.log("Player fell. Bot wins.");
            //     this.gameOver = true;
            //     this.playerWon = 'Bot';
            //     this.cameras.main.stopFollow();
            //     this.scene.stop('UIScene');
            //     this.scene.start('GameOverScene', { winner: 'Bot' });
            // }
        }
        this.bots.forEach(bot => {
            if (bot && !bot.isFalling && bot.sprite.y > this.fallDeathY) {
                bot.onFall();
                // Removed game over logic: Bot will respawn via Bot.onFall()
                //  if (!this.gameOver) {
                //     console.log("Bot fell. Player wins.");
                //     this.gameOver = true;
                //     this.playerWon = 'Player';
                //     this.scene.stop('UIScene');
                //     this.scene.start('GameOverScene', { winner: 'Player' });
                // }
            }
        });
        
    }

    // Add screen shake function
    shakeCamera(intensity = 0.01, duration = 100) {
        if (!this.cameras || !this.cameras.main) return;
        
        this.cameras.main.shake(duration, intensity);
    }

    // Scene shutdown cleanup
    shutdown() {
        // Cleaning up scene resources
        if (this.player && typeof this.player.destroy === 'function') {
            this.player.destroy();
            this.player = null;
        }
        this.bots.forEach(bot => {
            if (bot && typeof bot.destroy === 'function') {
                bot.destroy();
            }
        });
        this.bots = [];

        if (this.countdownTimer) {
            this.countdownTimer.remove(false);
            this.countdownTimer = null;
        }
        // Other group cleanups if necessary (Phaser usually handles children of groups)
        // this.groundGroup.destroy(true); // Example, if not automatically handled or if children need specific cleanup
        // this.wallsGroup.destroy(true);
        // this.powerupsGroup.destroy(true);

        // It's good practice to remove event listeners if any were added manually to scene events
        // this.events.off('shutdown', this.shutdown, this); // This one is tricky, as it's removing itself.
                                                              // The one added above for deployPlayerPowerup is safer.
    }
}