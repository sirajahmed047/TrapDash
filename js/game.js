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
const POWERUP_RESPAWN_DELAY = 3000; // 3 seconds for power-up respawn
const BOT_SPEED = 249;
const BOT_SPEED_BOOSTED = 390; // Slightly less than player's boost
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
    this.player.body.setVelocityX(0); // Initially stationary
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
    this.bot.body.setVelocityX(0); // Initially stationary
    this.bot.lastSafeX = botInitialX;
    this.bot.respawnY = botInitialY;
    this.bot.isFalling = false;
    // Power-up properties for bot
    this.bot.activePowerup = null;
    this.bot.powerupTimer = null;
    this.bot.shieldActive = false;
    this.bot.currentSpeed = BOT_SPEED;
    this.bot.glowEffectGraphic = null;

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
    this.physics.add.overlap(this.bot, this.powerups, collectPowerup, null, this); // Bot can also collect

    // Helper functions for character glow (defined as scene methods)
    this.applyCharacterGlow = function(character, color) {
        if (character.glowEffectGraphic) {
            character.glowEffectGraphic.destroy();
        }
        const glowWidth = character.displayWidth + 15;
        const glowHeight = character.displayHeight + 15;
        character.glowEffectGraphic = this.add.graphics();
        character.glowEffectGraphic.fillStyle(color, 0.35);
        character.glowEffectGraphic.fillRoundedRect(-glowWidth / 2, -glowHeight / 2, glowWidth, glowHeight, 8);
        character.glowEffectGraphic.setDepth(character.depth - 1);
    };

    this.removeCharacterGlow = function(character) {
        if (character.glowEffectGraphic) {
            character.glowEffectGraphic.destroy();
            character.glowEffectGraphic = null;
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
    
    // Game state flags
    this.gameStarted = false;
    this.gameOver = false;
    this.playerWon = null; // true for player, false for bot
    this.isPlayerFinished = false; // Already present, ensure it's initialized for clarity
    this.isBotFinished = false; 

    // Text objects
    this.startText = null;
    this.endGameTextObjects = [];

    // Display "Press SPACE to start"
    // Camera might not be fully initialized here for centerX/Y, so use config width/height for initial placement
    const initialCenterX = this.game.config.width / 2;
    const initialCenterY = this.game.config.height / 2;
    this.startText = this.add.text(initialCenterX, initialCenterY, 'Press SPACE to start game', {
        fontSize: '32px', fill: '#fff', backgroundColor: '#0005',
        padding: { left: 15, right: 15, top: 10, bottom: 10 }
    }).setOrigin(0.5).setScrollFactor(0); // scrollFactor 0 to stay in place

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

// Function to display end-of-game messages
function displayEndOfGameMessage(sceneContext) {
    // Clear previous end game messages if any (Phaser might do this on scene restart, but good for clarity)
    sceneContext.endGameTextObjects.forEach(textObj => textObj.destroy());
    sceneContext.endGameTextObjects = [];

    const cam = sceneContext.cameras.main;
    const centerX = cam.worldView.x + cam.width / 2; // Use camera's current view for messages
    const centerY = cam.worldView.y + cam.height / 2;

    let winnerText = "";
    if (sceneContext.playerWon === true) {
        winnerText = "Player Wins!";
    } else if (sceneContext.playerWon === false) {
        winnerText = "Bot Wins!";
    } else {
        winnerText = "Race Over!"; // Should not happen with current logic
    }

    const textStyle = { fontSize: '32px', fill: '#fff', backgroundColor: '#0008', padding: {left: 10, right: 10, top:5, bottom:5} };
    const restartTextStyle = { fontSize: '24px', fill: '#fff', backgroundColor: '#0008', padding: {left: 10, right: 10, top:5, bottom:5} };

    let msg1 = sceneContext.add.text(centerX, centerY - 40, winnerText, textStyle).setOrigin(0.5);
    let msg2 = sceneContext.add.text(centerX, centerY + 10, 'Press R to Restart', restartTextStyle).setOrigin(0.5);
    
    sceneContext.endGameTextObjects.push(msg1, msg2);
}

function handlePlayerFinish(player, finishLine) {
    if (this.gameOver) return; // Game already decided

    this.isPlayerFinished = true; // Mark player as finished
    player.body.setVelocity(0,0);
    player.body.setAcceleration(0,0);
    player.body.allowGravity = false;
    this.cameras.main.stopFollow();
    if (player.glowEffectGraphic) { this.removeCharacterGlow(player); }

    if (!this.isBotFinished) { // Player is the first to cross (or effectively simultaneous if bot finishes in same frame later)
        this.playerWon = true;
        this.gameOver = true;
        displayEndOfGameMessage(this);
    } else if (this.playerWon === null) { // Bot finished in a previous frame, now player finishes
        // This case implies bot already won if playerWon is still null. Message already displayed by bot.
        // Just ensure player stops correctly. Game is already over.
    }
}

function handleBotFinish(bot, finishLine) {
    if (this.gameOver) return; // Game already decided

    this.isBotFinished = true; // Mark bot as finished
    bot.body.setVelocityX(0); // Stop the bot
    if (bot.glowEffectGraphic) { this.removeCharacterGlow(bot); }

    if (!this.isPlayerFinished) { // Bot is the first to cross
        this.playerWon = false;
        this.gameOver = true;
        displayEndOfGameMessage(this);
    } else if (this.playerWon === null) { // Player finished in a previous frame, now bot finishes
        // This case implies player already won. Message already displayed by player.
        // Just ensure bot stops correctly. Game is already over.
    }
}

function handlePlayerHitObstacle(player, wall) {
    if (player.shieldActive) {
        player.shieldActive = false;
        player.activePowerup = null;
        this.removeCharacterGlow(player); // Correctly uses scene context
        console.log("Player hit obstacle, shield absorbed!");
        return;
    }
    console.log("Player hit obstacle!");
}

function handleBotHitObstacle(bot, wall) {
    if (bot.shieldActive) {
        bot.shieldActive = false;
        bot.activePowerup = null;
        this.removeCharacterGlow(bot);
        console.log("Bot hit obstacle, shield absorbed!");
        return;
    }
    console.log("Bot hit obstacle! Attempting reactive jump.");
    // If the bot is on the floor, make it jump
    if (bot.body.onFloor()) {
        bot.body.setVelocityY(JUMP_VELOCITY);
    }
    // If it hits a wall mid-air, this jump won't trigger, physics will resolve.
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
    this.removeCharacterGlow(player); // Correctly uses scene context

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

    // Reset bot's power-ups on fall
    if (bot.powerupTimer) {
        bot.powerupTimer.remove(false);
        bot.powerupTimer = null;
    }
    bot.activePowerup = null;
    bot.shieldActive = false;
    bot.currentSpeed = BOT_SPEED;
    this.removeCharacterGlow(bot);

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

function collectPowerup(character, powerupIcon) {
    if (!powerupIcon.active) return;
    const type = powerupIcon.getData('type');
    console.log(`${character === this.player ? 'Player' : 'Bot'} collected power-up: ${type}`);
    
    // Store original position for respawn before disabling
    // The powerupIcon object itself retains its x and y unless moved by physics (which it won't be once inactive)
    const respawnX = powerupIcon.x;
    const respawnY = powerupIcon.y;

    powerupIcon.disableBody(true, true);

    this.removeCharacterGlow(character); // Remove existing glow first
    if (character.powerupTimer) {
        character.powerupTimer.remove(false);
        character.powerupTimer = null;
    }
    character.shieldActive = false;
    // Determine normal speed based on character type
    const normalSpeed = (character === this.player) ? PLAYER_SPEED_NORMAL : BOT_SPEED;
    const boostedSpeed = (character === this.player) ? PLAYER_SPEED_BOOSTED : BOT_SPEED_BOOSTED;
    character.currentSpeed = normalSpeed;
    character.activePowerup = type;

    if (type === 'speed') {
        character.currentSpeed = boostedSpeed;
        this.applyCharacterGlow(character, 0xFFFF00); // Yellow glow
        console.log(`${character === this.player ? 'Player' : 'Bot'} Speed Boost activated!`);
        character.powerupTimer = this.time.delayedCall(POWERUP_DURATION, () => {
            if (character.activePowerup === 'speed') {
                character.currentSpeed = normalSpeed;
                character.activePowerup = null;
                this.removeCharacterGlow(character);
                console.log(`${character === this.player ? 'Player' : 'Bot'} Speed Boost ended.`);
            }
        }, [], this);
    } else if (type === 'shield') {
        character.shieldActive = true;
        this.applyCharacterGlow(character, 0x00FF00); // Green glow
        console.log(`${character === this.player ? 'Player' : 'Bot'} Shield activated!`);
    }

    // Schedule respawn
    this.time.delayedCall(POWERUP_RESPAWN_DELAY, () => {
        if (powerupIcon && !powerupIcon.active) { // Check if still exists and is inactive
             // Check if another character is currently on the respawn spot
            let canRespawn = true;
            if (this.player && this.player.active && this.physics.overlap(this.player, {x: respawnX, y: respawnY, getBounds: () => new Phaser.Geom.Rectangle(respawnX - 16, respawnY - 16, 32, 32)})) {
                canRespawn = false;
            }
            if (this.bot && this.bot.active && this.physics.overlap(this.bot, {x: respawnX, y: respawnY, getBounds: () => new Phaser.Geom.Rectangle(respawnX - 16, respawnY - 16, 32, 32)})) {
                canRespawn = false;
            }

            if (canRespawn) {
                powerupIcon.enableBody(true, respawnX, respawnY, true, true);
                console.log(`Power-up respawned at (${respawnX}, ${respawnY})`);
            } else {
                // If spot is occupied, try again shortly
                this.time.delayedCall(500, () => {
                     if (powerupIcon && !powerupIcon.active) { // Re-check before respawning
                        powerupIcon.enableBody(true, respawnX, respawnY, true, true);
                        console.log(`Power-up respawned (delayed) at (${respawnX}, ${respawnY})`);
                     }
                }, [], this);
            }
        }
    }, [], this);
}

function update() {
    if (this.gameOver) {
        if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
            // Phaser's scene.restart() typically handles clearing display objects.
            // Explicit cleanup of endGameTextObjects and startText done in create() upon restart.
            this.scene.restart();
        }
        return; // Don't process game updates if finished
    }

    if (!this.gameStarted) {
        if (this.startText && Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            this.gameStarted = true;
            if(this.startText) this.startText.destroy(); // Destroy if it exists
            this.startText = null; // Clear reference

            // Set initial speeds now that game has started
            this.player.body.setVelocityX(this.player.currentSpeed);
            this.bot.body.setVelocityX(this.bot.currentSpeed);
        } else {
            // Ensure player and bot are stationary before game starts
            if (this.player && this.player.body) {
                 this.player.body.setVelocityX(0);
            }
            if (this.bot && this.bot.body) {
                this.bot.body.setVelocityX(0);
            }
        }
        return; // Don't run game logic until started
    }

    // --- Main game update logic starts here ---
    // (The following code will only run if gameStarted is true and gameOver is false)

    // --- Player Fall/Respawn Logic ---
    if (!this.player.isFalling) { // Only process if not already falling/respawning
        if (this.player.body.onFloor()) {
            this.player.lastSafeX = this.player.x;
        } else {
            if (this.player.y > this.fallDeathY) {
                handlePlayerFall.call(this, this.player);
            }
        }
    }

    if (!this.bot.isFalling) {
        this.bot.body.setVelocityX(this.bot.currentSpeed); // Use bot's current speed
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
            this.removeCharacterGlow(this.player);
        }

        // Update bot glow position if active
        if (this.bot.glowEffectGraphic && this.bot.activePowerup) {
            this.bot.glowEffectGraphic.setPosition(this.bot.x, this.bot.y);
        } else if (this.bot.glowEffectGraphic && !this.bot.activePowerup) {
            this.removeCharacterGlow(this.bot);
        }

        if (this.cursors.space.isDown && this.player.body.onFloor()) {
            this.player.body.setVelocityY(JUMP_VELOCITY);
            if (this.player.body.blocked.right) {
                this.player.body.setVelocityX(this.player.currentSpeed * 0.3);
            }
        }
    }
}
