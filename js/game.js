// Basic Phaser 3 Game Configuration
const config = {
    type: Phaser.AUTO, // Automatically choose WebGL or Canvas
    width: 800,        // Game width in pixels
    height: 600,       // Game height in pixels
    parent: 'game-container', // ID of the DOM element to parent the canvas to
    backgroundColor: '#000000', // Black background
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // We will set gravity per object or globally as needed later
            debug: true        // Set to false for production
        }
    },
    scene: {
        preload: preload, // Function to load assets
        create: create,   // Function to set up game objects
        update: update    // Function called every frame
    }
};

// Create a new Phaser Game instance
const game = new Phaser.Game(config);

const PLAYER_SPEED_NORMAL = 250;
const PLAYER_SPEED_BOOSTED = 400; // Increased boost
const POWERUP_DURATION = 5000; // 5 seconds
const BOT_SPEED = 249;
const TRACK_WIDTH_MULTIPLIER = 7; // Race track will be 7 times the screen width
const JUMP_VELOCITY = -300; // Negative for upward movement
const BOT_JUMP_LOOKAHEAD_WALL = 95; // How far the bot "looks" ahead for walls (pixels)
const BOT_JUMP_LOOKAHEAD_GAP = 90;  // How far the bot "looks" ahead for gaps (pixels)

// Preload game assets (e.g., images, sounds)
function preload() {
    console.log("Phaser: Preload phase");
    // Example: this.load.image('sky', 'assets/images/sky.png');
    this.load.image("playerPH", "assets/images/player_placeholder.png");
    this.load.image("botPH", "assets/images/bot_placeholder.png");
    // this.load.image("backgroundPH", "assets/images/background_placeholder.png"); // Removed background image loading
    this.load.image("powerupBoxPH", "assets/images/powerup_box_placeholder.png");
    this.load.image("powerupSpeedIconPH", "assets/images/powerup_speed_icon_placeholder.png");
    this.load.image("powerupShieldIconPH", "assets/images/powerup_shield_icon_placeholder.png");
    this.load.image("wall", "assets/images/obstacle_wall.png");
}

// Create game objects and set up the initial state
function create() {
    console.log("Phaser: Create phase");
    this.physics.world.gravity.y = 400; // Global gravity

    // Calculate track width based on config and multiplier
    const TRACK_WIDTH = config.width * TRACK_WIDTH_MULTIPLIER;

    // Store groundTopY for global access (e.g., in update for fall detection)
    this.groundTopY = config.height - 200; // Raised by 100px
    const groundSegmentHeight = 50; // Defined here for clarity in calculating fallDeathY
    this.fallDeathY = this.groundTopY + groundSegmentHeight + 20; // Y-coord threshold to trigger fall

    // Set a solid background color for the camera
    this.cameras.main.setBackgroundColor('#87CEEB'); // Light sky blue color

    // Ground Plane with Gaps
    this.groundGroup = this.physics.add.staticGroup();
    const groundSegmentCenterY = this.groundTopY + groundSegmentHeight / 2;
    const groundColor = 0x888888;
    const segments = [
        { type: 'ground', start: 0, end: 700 },
        { type: 'gap', start: 700, end: 810 },
        { type: 'ground', start: 810, end: 1250 },
        { type: 'gap', start: 1250, end: 1360 },
        { type: 'ground', start: 1360, end: 2000 },
        { type: 'gap', start: 2000, end: 2150 },
        { type: 'ground', start: 2150, end: 2800 },
        { type: 'gap', start: 2800, end: 2920 },
        { type: 'ground', start: 2920, end: 3600 },
        { type: 'gap', start: 3600, end: 3750 },
        { type: 'ground', start: 3750, end: 4400 },
        { type: 'gap', start: 4400, end: 4500 },
        { type: 'ground', start: 4500, end: TRACK_WIDTH }
    ];
    this.trackSegments = segments;
    segments.forEach(seg => {
        if (seg.type === 'ground') {
            const segmentWidth = seg.end - seg.start;
            const segmentCenterX = seg.start + segmentWidth / 2;
            if (segmentWidth > 0) {
                const groundRect = this.add.rectangle(segmentCenterX, groundSegmentCenterY, segmentWidth, groundSegmentHeight, groundColor);
                this.groundGroup.add(groundRect);
            }
        }
    });

    // Player Sprite
    const playerInitialX = 100;
    const playerInitialY = config.height - 200 - 24;
    this.player = this.physics.add.sprite(playerInitialX, playerInitialY, "playerPH");
    this.player.setScale(2);
    this.player.body.setSize(32, 28).setOffset(0, 0);
    this.player.setCollideWorldBounds(true);
    this.player.body.setBounceX(0.05);
    this.player.body.setVelocityX(PLAYER_SPEED_NORMAL);
    this.player.lastSafeX = playerInitialX;
    this.player.respawnY = playerInitialY;
    this.player.isFalling = false;
    this.player.activePowerup = null;
    this.player.powerupTimer = null;
    this.player.shieldActive = false;
    this.player.currentSpeed = PLAYER_SPEED_NORMAL;
    this.player.glowEffectGraphic = null; // For visual glow effect

    // Bot Sprite
    const botInitialX = 50;
    const botInitialY = config.height - 200 - 24;
    this.bot = this.physics.add.sprite(botInitialX, botInitialY, "botPH");
    this.bot.setScale(2);
    this.bot.body.setSize(32, 28).setOffset(0, 0);
    this.bot.setCollideWorldBounds(true);
    this.bot.body.setBounceX(0.05);
    this.bot.body.setVelocityX(BOT_SPEED);
    this.bot.lastSafeX = botInitialX;
    this.bot.respawnY = botInitialY;
    this.bot.isFalling = false;

    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.bot, this.groundGroup);

    // Power-Up Icons
    this.powerups = this.physics.add.group({
        allowGravity: false,
        immovable: true
    });
    const powerupY = this.groundTopY - 16; // Assumes 32px scaled height, origin center
    const powerupData = [
        { x: 900, type: 'speed' },
        { x: 1700, type: 'shield' },
        { x: 2600, type: 'speed' },
        { x: 4000, type: 'shield' }
    ];
    powerupData.forEach(data => {
        const iconKey = (data.type === 'speed') ? "powerupSpeedIconPH" : "powerupShieldIconPH";
        const powerupIcon = this.powerups.create(data.x, powerupY, iconKey);
        powerupIcon.setScale(0.5); // Assuming icons are large like the box placeholder
        powerupIcon.setData('type', data.type);
    });
    this.physics.add.overlap(this.player, this.powerups, collectPowerup, null, this);

    // Helper functions for player glow (defined as scene methods)
    this.applyPlayerGlow = function(player, color) {
        if (player.glowEffectGraphic) {
            player.glowEffectGraphic.destroy();
        }
        const glowWidth = player.displayWidth + 15; 
        const glowHeight = player.displayHeight + 15;
        player.glowEffectGraphic = this.add.graphics();
        player.glowEffectGraphic.fillStyle(color, 0.35); 
        player.glowEffectGraphic.fillRoundedRect(-glowWidth / 2, -glowHeight / 2, glowWidth, glowHeight, 8);
        player.glowEffectGraphic.setDepth(player.depth - 1); 
    };

    this.removePlayerGlow = function(player) {
        if (player.glowEffectGraphic) {
            player.glowEffectGraphic.destroy();
            player.glowEffectGraphic = null;
        }
    };

    // Finish Line
    const finishLineHeight = config.height - 50;
    this.finishLine = this.add.rectangle(TRACK_WIDTH * 0.9, finishLineHeight / 2, 10, finishLineHeight, 0xffff00);
    this.physics.add.existing(this.finishLine, true);
    this.physics.add.overlap(this.player, this.finishLine, handlePlayerFinish, null, this);
    this.physics.add.overlap(this.bot, this.finishLine, handleBotFinish, null, this);

    // Camera Setup
    this.physics.world.setBounds(0, 0, TRACK_WIDTH, config.height);
    this.cameras.main.setBounds(0, 0, TRACK_WIDTH, config.height);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.isPlayerFinished = false;

    // Walls Obstacles
    this.walls = this.physics.add.staticGroup();
    const wallY = config.height - 200 - (96 / 2);
    this.walls.create(600, wallY, 'wall');
    this.walls.create(1000, wallY, 'wall');
    this.walls.create(1400, wallY, 'wall');
    this.walls.create(2350, wallY, 'wall');
    this.walls.create(3350, wallY, 'wall');
    this.walls.create(4300, wallY, 'wall');
    this.walls.create(5000, wallY, 'wall');
    this.physics.add.collider(this.player, this.walls, handlePlayerHitObstacle, null, this);
    this.physics.add.collider(this.bot, this.walls, handleBotHitObstacle, null, this);
}

function handlePlayerFinish(player, finishLine) {
    if (this.isPlayerFinished) return;
    console.log("Player finished!");
    this.isPlayerFinished = true;
    player.body.setVelocity(0,0);
    player.body.setAcceleration(0,0);
    player.body.allowGravity = false;
    this.cameras.main.stopFollow();
    if (player.glowEffectGraphic) { // Stop glow on finish
        this.removePlayerGlow(player);
    }
    const centerX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
    const centerY = this.cameras.main.worldView.y + this.cameras.main.height / 2;
    this.add.text(centerX, centerY - 50, 'You Finished!', { fontSize: '32px', fill: '#fff', backgroundColor: '#0008' }).setOrigin(0.5);
    this.add.text(centerX, centerY + 0, 'Press R to Restart', { fontSize: '24px', fill: '#fff', backgroundColor: '#0008' }).setOrigin(0.5);
}

function handleBotFinish(bot, finishLine) {
    console.log("Bot finished!");
    bot.body.setVelocityX(0);
}

function handlePlayerHitObstacle(player, wall) {
    if (player.shieldActive) {
        player.shieldActive = false;
        player.activePowerup = null;
        this.removePlayerGlow(player); // Correctly uses scene context
        console.log("Player hit obstacle, shield absorbed!");
        return;
    }
    console.log("Player hit obstacle!");
}

function handleBotHitObstacle(bot, wall) {
    console.log("Bot hit obstacle!");
}

function handlePlayerFall(player) {
    if (player.isFalling) return;
    console.log("Player fell!");
    player.isFalling = true;
    player.setVisible(false);
    player.body.setEnable(false);
    player.body.setVelocity(0, 0);

    if (player.powerupTimer) {
        player.powerupTimer.remove(false);
        player.powerupTimer = null;
    }
    player.activePowerup = null;
    player.shieldActive = false;
    player.currentSpeed = PLAYER_SPEED_NORMAL;
    this.removePlayerGlow(player); // Correctly uses scene context

    this.time.delayedCall(2000, () => {
        player.setPosition(player.lastSafeX, player.respawnY);
        player.setVisible(true);
        player.body.setEnable(true);
        player.body.setVelocityX(player.currentSpeed);
        player.body.setVelocityY(0);
        player.isFalling = false;
        console.log("Player respawned");
    }, [], this);
}

function handleBotFall(bot) {
    if (bot.isFalling) return;
    console.log("Bot fell!");
    bot.isFalling = true;
    bot.setVisible(false);
    bot.body.setEnable(false);
    bot.body.setVelocity(0, 0);
    this.time.delayedCall(2000, () => {
        bot.setPosition(bot.lastSafeX, bot.respawnY);
        bot.setVisible(true);
        bot.body.setEnable(true);
        bot.body.setVelocityX(BOT_SPEED);
        bot.body.setVelocityY(0);
        bot.isFalling = false;
        console.log("Bot respawned");
    }, [], this);
}

function collectPowerup(player, powerupIcon) {
    if (!powerupIcon.active) return;
    const type = powerupIcon.getData('type');
    console.log(`Power-up collected: ${type}`);
    powerupIcon.disableBody(true, true);

    this.removePlayerGlow(player); // Remove existing glow first
    if (player.powerupTimer) {
        player.powerupTimer.remove(false);
        player.powerupTimer = null;
    }
    player.shieldActive = false;
    player.currentSpeed = PLAYER_SPEED_NORMAL;
    player.activePowerup = type;

    if (type === 'speed') {
        player.currentSpeed = PLAYER_SPEED_BOOSTED;
        this.applyPlayerGlow(player, 0xFFFF00); // Yellow glow. Uses scene context.
        console.log("Speed Boost activated!");
        player.powerupTimer = this.time.delayedCall(POWERUP_DURATION, () => {
            if (player.activePowerup === 'speed') {
                player.currentSpeed = PLAYER_SPEED_NORMAL;
                player.activePowerup = null;
                this.removePlayerGlow(player); // Uses scene context.
                console.log("Speed Boost ended.");
            }
        }, [], this);
    } else if (type === 'shield') {
        player.shieldActive = true;
        this.applyPlayerGlow(player, 0x00FF00); // Green glow. Uses scene context.
        console.log("Shield activated!");
    }
}

function update() {
    if (this.isPlayerFinished) {
        if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
            this.isPlayerFinished = false;
            this.scene.restart();
        }
        return;
    }

    if (!this.player.isFalling) {
        if (this.player.body.onFloor()) {
            this.player.lastSafeX = this.player.x;
        } else {
            if (this.player.y > this.fallDeathY) {
                handlePlayerFall.call(this, this.player);
            }
        }
    }

    if (!this.bot.isFalling) {
        this.bot.body.setVelocityX(BOT_SPEED);
        if (this.bot.body.onFloor()) {
            this.bot.lastSafeX = this.bot.x;
            let shouldBotJump = false;
            if (this.trackSegments) {
                let onGroundSegment = null;
                for (const seg of this.trackSegments) {
                    if (seg.type === 'ground' && this.bot.body.right > seg.start && this.bot.body.left < seg.end) {
                        onGroundSegment = seg;
                        break;
                    }
                }
                if (onGroundSegment) {
                    const distanceToGapEnd = onGroundSegment.end - this.bot.body.right;
                    if (distanceToGapEnd > 0 && distanceToGapEnd < BOT_JUMP_LOOKAHEAD_GAP) {
                        shouldBotJump = true;
                    }
                }
            }
            if (!shouldBotJump) {
                this.walls.getChildren().forEach(wall => {
                    if (wall.active && wall.body) {
                        if (wall.body.left > this.bot.body.right) {
                            const distanceToWall = wall.body.left - this.bot.body.right;
                            if (distanceToWall > 0 && distanceToWall < BOT_JUMP_LOOKAHEAD_WALL) {
                                shouldBotJump = true;
                                return;
                            }
                        }
                    }
                });
            }
            if (shouldBotJump) {
                this.bot.body.setVelocityY(JUMP_VELOCITY);
            }
        } else {
            if (this.bot.y > this.fallDeathY) {
                handleBotFall.call(this, this.bot);
            }
        }
    }

    if (!this.player.isFalling) {
        this.player.body.setVelocityX(this.player.currentSpeed);

        // Update glow position if active
        if (this.player.glowEffectGraphic && this.player.activePowerup) {
            this.player.glowEffectGraphic.setPosition(this.player.x, this.player.y);
        } else if (this.player.glowEffectGraphic && !this.player.activePowerup) {
            // Ensure glow is removed if powerup became null by other means 
            // (e.g. shield consumed and activePowerup set to null, then this frame runs)
            this.removePlayerGlow(this.player); // Uses scene context.
        }

        if (this.cursors.space.isDown && this.player.body.onFloor()) {
            this.player.body.setVelocityY(JUMP_VELOCITY);
            if (this.player.body.blocked.right) {
                this.player.body.setVelocityX(this.player.currentSpeed * 0.3);
            }
        }
    }
}
