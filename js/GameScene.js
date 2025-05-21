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
        this.isBotActuallyFinished = false;

        // References to game objects
        this.player = null;
        this.bot = null;
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
        this.physics.world.gravity.y = GameConfig.DEFAULT_GRAVITY;
        this.cameras.main.setBackgroundColor('#87CEEB');

        const TRACK_WIDTH = this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER;
        this.groundTopY = this.configHeight - 200; // This could be a GameConfig value if it needs to be globally consistent
        this.fallDeathY = this.groundTopY + GameConfig.GROUND_SEGMENT_HEIGHT + 20; // Assuming 20 is a small buffer

        // Ground Plane and Track Segments (using functions from obstacles.js)
        // Assuming createGroundAndTrack is globally available or we import/define it
        const groundData = createGroundAndTrack(this, TRACK_WIDTH, this.groundTopY, GameConfig.GROUND_SEGMENT_HEIGHT);
        this.groundGroup = groundData.groundGroup;
        this.trackSegments = groundData.trackSegments;

        // Player Instance
        const playerInitialY = this.groundTopY + GameConfig.PLAYER_RESPAWN_Y_OFFSET;
        this.player = new Player(this, GameConfig.PLAYER_INITIAL_X, playerInitialY, "player_sprite", GameConfig.PLAYER_SPEED_NORMAL, GameConfig.PLAYER_SPEED_BOOSTED, GameConfig.JUMP_VELOCITY);

        // Bot Instance
        const botInitialY = this.groundTopY + GameConfig.BOT_RESPAWN_Y_OFFSET;
        this.bot = new Bot(this, GameConfig.BOT_INITIAL_X, botInitialY, "bot_sprite", GameConfig.BOT_SPEED_NORMAL, GameConfig.BOT_SPEED_BOOSTED, GameConfig.JUMP_VELOCITY);

        // Power-ups (using functions from powerups.js)
        // Assuming createPowerups is globally available
        this.powerupsGroup = createPowerups(this, this.groundTopY);

        // Walls Obstacles (using function from obstacles.js)
        // Assuming createWalls is globally available
        this.wallsGroup = createWalls(this, this.groundTopY);

        // --- Physics Colliders and Overlaps ---
        this.physics.add.collider(this.player.sprite, this.groundGroup);
        this.physics.add.collider(this.bot.sprite, this.groundGroup);

        this.physics.add.collider(this.player.sprite, this.wallsGroup, (playerSprite, wall) => {
            playerSprite.playerInstance.onHitObstacle(wall);
        }, null, this);
        this.physics.add.collider(this.bot.sprite, this.wallsGroup, (botSprite, wall) => {
            botSprite.botInstance.onHitObstacle(wall);
        }, null, this);

        // Power-up Collection
        this.physics.add.overlap(this.player.sprite, this.powerupsGroup, (playerSprite, powerupIcon) => {
            if (!powerupIcon.active) return;
            const type = powerupIcon.getData('type');
            playerSprite.playerInstance.collectPowerup(type);
            powerupIcon.disableBody(true, true);
            // Assuming initiatePowerupRespawn is globally available
            initiatePowerupRespawn(this, powerupIcon);
        }, null, this);

        this.physics.add.overlap(this.bot.sprite, this.powerupsGroup, (botSprite, powerupIcon) => {
            if (!powerupIcon.active) return;
            const type = powerupIcon.getData('type');
            botSprite.botInstance.collectPowerup(type);
            powerupIcon.disableBody(true, true);
            initiatePowerupRespawn(this, powerupIcon);
        }, null, this);

        // Finish Line
        const finishLineHeight = this.configHeight - 50; // Adjusted to use scene's configHeight
        // TRACK_WIDTH is already calculated using GameConfig.TRACK_WIDTH_MULTIPLIER
        this.finishLine = this.add.rectangle(TRACK_WIDTH * GameConfig.FINISH_LINE_X_MULTIPLIER, finishLineHeight / 2, 10, finishLineHeight, 0xffff00);
        this.physics.add.existing(this.finishLine, true); // true for static body

        this.physics.add.overlap(this.player.sprite, this.finishLine, () => this.handleCharacterFinish(this.player), null, this);
        this.physics.add.overlap(this.bot.sprite, this.finishLine, () => this.handleCharacterFinish(this.bot), null, this);
        
        // Camera Setup
        // TRACK_WIDTH is already calculated above using GameConfig.TRACK_WIDTH_MULTIPLIER
        this.physics.world.setBounds(0, 0, TRACK_WIDTH, this.configHeight);
        this.cameras.main.setBounds(0, 0, TRACK_WIDTH, this.configHeight);
        this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);

        // Input cursors
        this.cursors = this.input.keyboard.createCursorKeys();
        // R key for restart is primarily for GameOverScene, but can be listened to here for debugging if needed.
        // this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        // The game effectively starts as soon as this scene is created.
        // MainMenuScene handles the "Press SPACE to start"
        this.gameStarted = true; 
        if (this.player && this.player.sprite && this.player.sprite.body) {
            this.player.sprite.body.setVelocityX(this.player.currentSpeed);
        }
        if (this.bot && this.bot.sprite && this.bot.sprite.body) {
            this.bot.sprite.body.setVelocityX(this.bot.currentSpeed);
        }
    }

    // Generic finish handler (moved into GameScene)
    handleCharacterFinish(characterInstance) {
        if (this.gameOver) return; // Already over, or someone else finished in the same frame processing.

        const isPlayer = (characterInstance === this.player);

        if (isPlayer) this.isPlayerActuallyFinished = true;
        else this.isBotActuallyFinished = true;

        characterInstance.onFinish(); // Call method on Player/Bot instance

        let winnerDetermined = null;

        if (isPlayer && !this.isBotActuallyFinished) {
            winnerDetermined = 'Player';
        } else if (!isPlayer && !this.isPlayerActuallyFinished) {
            winnerDetermined = 'Bot';
        } else if (this.isPlayerActuallyFinished && this.isBotActuallyFinished) {
            // Both finished, check who crossed *first* based on x position or who triggered this call.
            // For simplicity, if player triggered this and bot also finished, player wins. If bot triggered and player also finished, bot wins.
            // A more robust tie-breaking might be needed if exact simultaneous finish is possible and matters.
            winnerDetermined = isPlayer ? 'Player' : 'Bot'; 
        }


        if (winnerDetermined) {
            this.gameOver = true;
            this.playerWon = winnerDetermined;
            console.log('Game Over. Winner: ' + this.playerWon);

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
        if (this.gameOver || !this.gameStarted) {
            return; 
        }

        // Player update
        if (this.player) {
            this.player.update(this.cursors);
            if (this.player.sprite.body) { // Ensure body exists
                 this.player.sprite.body.setVelocityX(this.player.currentSpeed); // Apply speed, might change due to powerups
            }
        }

        // Bot update
        if (this.bot) {
            this.bot.updateAI(this.trackSegments, this.wallsGroup, GameConfig.BOT_JUMP_LOOKAHEAD_WALL, GameConfig.BOT_JUMP_LOOKAHEAD_GAP);
            this.bot.update(); // For bot's glow
            if (this.bot.sprite.body) { // Ensure body exists
                this.bot.sprite.body.setVelocityX(this.bot.currentSpeed); // Apply speed
            }
        }

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
        if (this.bot && !this.bot.isFalling && this.bot.sprite.y > this.fallDeathY) {
            this.bot.onFall();
            // Removed game over logic: Bot will respawn via Bot.onFall()
            //  if (!this.gameOver) {
            //     console.log("Bot fell. Player wins.");
            //     this.gameOver = true;
            //     this.playerWon = 'Player';
            //     this.scene.stop('UIScene');
            //     this.scene.start('GameOverScene', { winner: 'Player' });
            // }
        }
        
    }

    // Add screen shake function
    shakeCamera(intensity = 0.01, duration = 100) {
        if (!this.cameras || !this.cameras.main) return;
        
        this.cameras.main.shake(duration, intensity);
    }
}