class Bot {
    constructor(scene, x, y, textureKey, normalSpeed, boostedSpeed, jumpVelocity, botNumber, personality = 'balanced') {
        this.scene = scene;
        this.normalSpeed = normalSpeed;
        this.boostedSpeed = boostedSpeed;
        this.jumpVelocity = jumpVelocity; // Store jump velocity
        this.botNumber = botNumber;
        this.personality = personality; // NEW: Bot personality type
        
        // Set personality-specific traits
        this.personalityTraits = this.getPersonalityTraits(personality);
        this.botId = `${this.personalityTraits.name} ${botNumber}`; // Use personality name
        
        // DEBUG: Log bot creation with personality
        console.log(`🤖 Created ${this.botId} with personality: ${personality}`, this.personalityTraits);

        this.sprite = scene.physics.add.sprite(x, y, textureKey);
        this.sprite.setScale(1);
        this.sprite.body.setSize(64, 64).setOffset(0, 0);
        this.sprite.setCollideWorldBounds(true);
        this.sprite.body.setBounceX(0.05);
        this.sprite.body.setAllowGravity(true); // Gravity is global in the scene

        this.lastSafeX = x;
        this.respawnY = y;
        this.isFalling = false;
        this.lastSafeGroundSegment = null;

        this.activePowerup = null;
        this.powerupTimer = null;
        this.shieldActive = false;
        
        // Apply personality speed modifier
        this.normalSpeed = normalSpeed * this.personalityTraits.speedMultiplier;
        this.boostedSpeed = boostedSpeed * this.personalityTraits.speedMultiplier;
        this.currentSpeed = this.normalSpeed;
        this.glowEffectGraphic = null;
        
        // DEBUG: Log speed modifications
        console.log(`🏃 ${this.botId} speeds - Normal: ${this.normalSpeed.toFixed(1)}, Boosted: ${this.boostedSpeed.toFixed(1)} (multiplier: ${this.personalityTraits.speedMultiplier})`);

        // Personality-specific AI state
        this.mistakeTimer = 0; // For erratic personality
        this.lastJumpTime = 0; // For timing-based decisions

        // Link the sprite back to this Bot instance for easy access in colliders
        this.sprite.botInstance = this;
        
        // Name Tag with personality color
        this.nameTag = this.scene.add.text(this.sprite.x, this.sprite.y - 35, this.botId, { 
            fontFamily: 'Arial', 
            fontSize: '16px', 
            color: this.personalityTraits.nameColor, 
            align: 'center' 
        }).setOrigin(0.5, 1);
        
        // Start running animation
        if (this.sprite.anims) {
            this.sprite.play('bot_running', true);
        }
        
        // When jump animation completes, return to running if on ground
        this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'bot_jumping', () => {
            if (!this.isFalling && this.sprite.body.onFloor()) { 
                this.sprite.play('bot_running', true);
            }
        }, this);
    }

    // NEW: Define personality traits and behaviors
    getPersonalityTraits(personality) {
        const traits = {
            aggressive: {
                name: 'Speedy',
                nameColor: '#ff4444', // Red
                jumpEarlyMultiplier: 1.2, // Jumps 20% earlier (reduced from 30%)
                speedMultiplier: 1.05, // 5% faster base speed (reduced from 10%)
                mistakeChance: 0.15, // 15% chance of poor decisions (increased from 10%)
                reactionTimeMultiplier: 0.9 // 10% faster reactions (reduced from 20%)
            },
            cautious: {
                name: 'Careful',
                nameColor: '#44ff44', // Green
                jumpEarlyMultiplier: 0.8, // Jumps 20% later (reduced from 30%)
                speedMultiplier: 0.95, // 5% slower but more consistent (reduced from 10%)
                mistakeChance: 0.05, // 5% chance of mistakes (increased from 2%)
                reactionTimeMultiplier: 1.1 // 10% slower reactions (reduced from 20%)
            },
            erratic: {
                name: 'Wild',
                nameColor: '#ff44ff', // Magenta
                jumpEarlyMultiplier: 1.0, // Standard timing, but...
                speedMultiplier: 0.98, // 2% slower to compensate for over-jumping
                mistakeChance: 0.20, // 20% chance of mistakes (reduced from 25%)
                reactionTimeMultiplier: 1.0 // Standard reactions
            },
            balanced: {
                name: 'Steady',
                nameColor: '#4444ff', // Blue
                jumpEarlyMultiplier: 1.0, // Standard timing
                speedMultiplier: 1.0, // Standard speed
                mistakeChance: 0.05, // 5% chance of mistakes
                reactionTimeMultiplier: 1.0 // Standard reactions
            }
        };
        
        return traits[personality] || traits.balanced;
    }

    // Main update called from game.js, primarily for movement and glow
    update() {
        if (this.isFalling) return;

        // Continuously apply horizontal speed
        if (this.sprite.body) { // Ensure body exists
            this.sprite.body.setVelocityX(this.currentSpeed);
        }

        // If on floor and not already running (e.g., after landing from a jump), play run animation
        if (this.sprite.body.onFloor() && this.sprite.anims && 
            this.sprite.anims.currentAnim && this.sprite.anims.currentAnim.key !== 'bot_running') {
            this.sprite.play('bot_running', true);
        }

        // Update glow position
        if (this.glowEffectGraphic && this.activePowerup) {
            this.glowEffectGraphic.setPosition(this.sprite.x, this.sprite.y);
        } else if (this.glowEffectGraphic && !this.activePowerup) {
            this.removeGlow();
        }
        
        // Update name tag position
        if (this.nameTag) {
            this.nameTag.setPosition(this.sprite.x, this.sprite.y - (this.sprite.displayHeight / 2) - 5).setDepth(this.sprite.depth + 1);
        }
    }

    // Specific AI update called from game.js
    updateAI(trackSegments, walls, movingObstacles, BOT_JUMP_LOOKAHEAD_WALL, BOT_JUMP_LOOKAHEAD_GAP) {
        if (this.isFalling || !this.sprite.body.onFloor()) return;

        // Update mistake timer for erratic personality
        this.mistakeTimer += this.scene.game.loop.delta;
        
        // DEBUG: Log timer for erratic bots occasionally
        if (this.personality === 'erratic' && this.scene.game.loop.frame % 180 === 0) { // Every 3 seconds at 60fps
            console.log(`⏱️ ${this.botId} timer: ${this.mistakeTimer.toFixed(0)}ms (target: 3000ms)`);
        }

        // Update last safe X position and ground segment
        this.lastSafeX = this.sprite.x; 
        this.lastSafeGroundSegment = null; // Reset before finding current
        if (this.scene.trackSegments) { // Ensure trackSegments exists on the scene (passed as trackSegments argument here, but this.scene.trackSegments is better)
            for (const seg of this.scene.trackSegments) { // Changed to use this.scene.trackSegments
                if (seg.type === 'ground' &&
                    this.sprite.body.right > seg.start &&
                    this.sprite.body.left < seg.end) {
                    this.lastSafeGroundSegment = seg;
                    break;
                }
            }
        }

        let shouldBotJump = false;

        // Apply personality-based lookahead modifications
        const personalizedWallLookahead = BOT_JUMP_LOOKAHEAD_WALL * this.personalityTraits.jumpEarlyMultiplier * this.personalityTraits.reactionTimeMultiplier;
        const personalizedGapLookahead = BOT_JUMP_LOOKAHEAD_GAP * this.personalityTraits.jumpEarlyMultiplier * this.personalityTraits.reactionTimeMultiplier;
        
        // DEBUG: Log lookahead values occasionally (every 60 frames to avoid spam)
        if (this.scene.game.loop.frame % 60 === 0) {
            console.log(`👁️ ${this.botId} lookahead - Wall: ${personalizedWallLookahead.toFixed(1)}, Gap: ${personalizedGapLookahead.toFixed(1)} (base: ${BOT_JUMP_LOOKAHEAD_WALL}/${BOT_JUMP_LOOKAHEAD_GAP})`);
        }

        // 1. Check for Gaps with personality modifications
        if (trackSegments) {
            let onGroundSegment = null;
            for (const seg of trackSegments) {
                if (seg.type === 'ground' && this.sprite.body.right > seg.start && this.sprite.body.left < seg.end) {
                    onGroundSegment = seg;
                    break;
                }
            }
            if (onGroundSegment) {
                const distanceToGapEnd = onGroundSegment.end - this.sprite.body.right;
                if (distanceToGapEnd > 0 && distanceToGapEnd < personalizedGapLookahead) {
                    shouldBotJump = true;
                }
            }
        }

        // 2. Check for Walls with personality modifications (only if not already decided to jump for a gap)
        if (!shouldBotJump && walls) {
            walls.getChildren().forEach(wall => {
                if (wall.active && wall.body) {
                    if (wall.body.left > this.sprite.body.right) {
                        const distanceToWall = wall.body.left - this.sprite.body.right;
                        if (distanceToWall > 0 && distanceToWall < personalizedWallLookahead) {
                            shouldBotJump = true;
                            return; // Exit forEach early if wall found
                        }
                    }
                }
            });
        }

        // 2.5. Check for Moving Obstacles (only if not already decided to jump)
        if (!shouldBotJump && movingObstacles) {
            movingObstacles.getChildren().forEach(platform => {
                if (platform.active && platform.body) {
                    const platformLeft = platform.body.left;
                    const platformRight = platform.body.right;
                    const platformTop = platform.body.top;
                    const platformBottom = platform.body.bottom;
                    
                    const distance = platformLeft - this.sprite.body.right;
                    
                    // Check if platform is in lookahead range
                    if (distance > 0 && distance < personalizedWallLookahead) {
                        // Determine if this is a platform to land on or jump over
                        const characterBottom = this.sprite.body.bottom;
                        
                        // If platform is significantly above character, it might be a landing platform
                        if (platformTop < characterBottom - 30) {
                            // This is a potential landing platform
                            // Bot should try to jump to land on it
                            shouldBotJump = true;
                            console.log(`🎯 ${this.botId} detected landing platform at distance ${distance.toFixed(1)}`);
                            return;
                        } else if (platformBottom > characterBottom - 20) {
                            // Platform is at character level or below - jump over it
                            shouldBotJump = true;
                            console.log(`🚧 ${this.botId} detected obstacle platform at distance ${distance.toFixed(1)}`);
                            return;
                        }
                    }
                }
            });
        }

        // 3. Apply personality-based decision making
        if (shouldBotJump) {
            // Check for mistakes based on personality
            const shouldMakeMistake = Math.random() < this.personalityTraits.mistakeChance;
            
            if (shouldMakeMistake) {
                // DEBUG: Log mistake occurrence
                console.log(`💥 ${this.botId} is making a mistake! (chance: ${(this.personalityTraits.mistakeChance * 100).toFixed(1)}%)`);
                
                // Make a "mistake" - sometimes don't jump, sometimes jump too early/late
                const mistakeType = Math.random();
                if (mistakeType < 0.3) {
                    // Don't jump when should (30% of mistakes)
                    console.log(`🚫 ${this.botId} mistake: NOT jumping when should!`);
                    shouldBotJump = false;
                } else if (mistakeType < 0.6) {
                    // Jump too early (30% of mistakes) - reduce lookahead
                    const earlyJumpChance = Math.random() < 0.7; // 70% chance of early jump
                    console.log(`⏰ ${this.botId} mistake: Jump timing error! Will jump: ${earlyJumpChance}`);
                    shouldBotJump = earlyJumpChance;
                } else {
                    console.log(`🤷 ${this.botId} mistake: Context error but jumping normally`);
                }
                // Otherwise jump normally but it's still considered a "mistake context"
            }
        } else if (this.personality === 'erratic' && this.mistakeTimer > 3000) { // Every 3 seconds, check for random jump (increased from 2)
            // DEBUG: Log erratic bot timer check
            console.log(`🎲 ${this.botId} checking for random jump (timer: ${this.mistakeTimer.toFixed(0)}ms)`);
            
            // Erratic bots sometimes jump randomly
            if (Math.random() < 0.08) { // 8% chance every 3 seconds (reduced from 10% every 2s)
                console.log(`🤪 ${this.botId} RANDOM JUMP!`);
                shouldBotJump = true;
                this.mistakeTimer = 0; // Reset timer
            }
        }

        if (shouldBotJump) {
            // DEBUG: Log jump with reason
            console.log(`🦘 ${this.botId} JUMPING! (personality: ${this.personality})`);
            
            this.sprite.body.setVelocityY(this.jumpVelocity);
            this.lastJumpTime = this.scene.time.now;
            // Play jump animation
            this.sprite.play('bot_jumping', true);
            // Create jump dust
            this.createJumpDust();
        }
    }
    
    // Create dust particle effect when jumping
    createJumpDust() {
        const dust = this.scene.add.sprite(
            this.sprite.x, 
            this.sprite.y + GameConfig.JUMP_DUST_Y_OFFSET, // Position at character's feet
            'jump_dust'
        );
        
        dust.setOrigin(0.5, 0.5);
        dust.play('jump_dust_anim');
        
        // Remove the dust sprite once animation completes
        dust.on('animationcomplete', () => {
            dust.destroy();
        });
    }

    onHitObstacle(_obstacle) {
        if (this.shieldActive) {
            this.shieldActive = false;
            this.activePowerup = null; // Shield consumed
            this.removeGlow();
            return true; // Indicate shield was used
        }
        
        // Attempt to counteract micro-bounce before checking onFloor for the reactive jump
        if (this.sprite.body.blocked.down && Math.abs(this.sprite.body.velocity.y) < 5) {
            this.sprite.body.setVelocityY(0);
        }

        if (this.sprite.body.onFloor()) {
            this.sprite.body.setVelocityY(this.jumpVelocity);
            // Play jump animation
            this.sprite.play('bot_jumping', true);
            // Create jump dust
            this.createJumpDust();
            
            // Add camera shake on hit
            if (this.scene.shakeCamera) {
                this.scene.shakeCamera(GameConfig.BOT_OBSTACLE_SHAKE_INTENSITY, GameConfig.BOT_OBSTACLE_SHAKE_DURATION);
            }
        }
        return false; // Indicate shield was not used
    }

    onFall() {
        if (this.isFalling) return;

        this.isFalling = true;
        this.sprite.setVisible(false);
        this.sprite.body.setEnable(false);
        this.sprite.body.setVelocity(0, 0);
        if (this.nameTag) this.nameTag.setVisible(false);

        this.resetPowerupEffects();
        this.removeGlow();

        this.scene.time.delayedCall(GameConfig.RESPAWN_DELAY, () => {
            let respawnX = this.lastSafeX; // Default to last known X
            if (this.lastSafeGroundSegment && this.sprite.body) {
                const buffer = (this.sprite.body.width / 2) + 5; // Place center 5px + half-body-width from edge
                respawnX = this.lastSafeGroundSegment.end - buffer;
                 // Ensure respawnX is safely within the segment bounds
                respawnX = Math.max(respawnX, this.lastSafeGroundSegment.start + (this.sprite.body.width / 2));
                respawnX = Math.min(respawnX, this.lastSafeGroundSegment.end - (this.sprite.body.width / 2));
            }

            this.sprite.setPosition(respawnX, this.respawnY);
            this.sprite.setVisible(true);
            this.sprite.body.setEnable(true);
            this.sprite.body.setVelocityY(0);
            this.isFalling = false;
            if (this.nameTag) this.nameTag.setVisible(true);
            
            // After respawn, ensure running animation plays if on floor
            if (this.sprite.body.onFloor()) {
                this.sprite.play('bot_running', true);
            }
        }, [], this.scene);
    }

    onFinish() {
        this.sprite.body.setVelocityX(0);
        this.removeGlow();
        // Name tag remains visible
        this.isFinished = true; // Ensure this bot is marked as finished
    }

    collectPowerup(powerupType) {
        this.resetPowerupEffects();
        this.removeGlow();
        
        this.activePowerup = powerupType;

        if (powerupType === 'speed') {
            this.currentSpeed = this.boostedSpeed; // Already personality-modified
            this.applyGlow(GameConfig.SPEED_GLOW_COLOR);

            if (this.powerupTimer) this.powerupTimer.remove();
            this.powerupTimer = this.scene.time.delayedCall(GameConfig.POWERUP_DURATION, () => {
                if (this.activePowerup === 'speed') {
                    this.currentSpeed = this.normalSpeed; // Already personality-modified
                    this.activePowerup = null;
                    this.removeGlow();
                }
            }, [], this.scene);
        } else if (powerupType === 'shield') {
            this.shieldActive = true;
            this.applyGlow(GameConfig.SHIELD_GLOW_COLOR);
        }
    }

    resetPowerupEffects() {
        if (this.powerupTimer) {
            this.powerupTimer.remove(false);
            this.powerupTimer = null;
        }
        this.activePowerup = null;
        this.shieldActive = false;
        this.currentSpeed = this.normalSpeed; // Already personality-modified
    }

    applyGlow(color) {
        if (this.glowEffectGraphic) {
            this.glowEffectGraphic.destroy();
        }
        const glowWidth = this.sprite.displayWidth + 15;
        const glowHeight = this.sprite.displayHeight + 15;
        this.glowEffectGraphic = this.scene.add.graphics();
        this.glowEffectGraphic.fillStyle(color, GameConfig.GLOW_ALPHA);
        this.glowEffectGraphic.fillRoundedRect(-glowWidth / 2, -glowHeight / 2, glowWidth, glowHeight, GameConfig.GLOW_RADIUS);
        this.glowEffectGraphic.setDepth(this.sprite.depth - 1);
        this.glowEffectGraphic.setPosition(this.sprite.x, this.sprite.y); // Initial position
    }

    removeGlow() {
        if (this.glowEffectGraphic) {
            this.glowEffectGraphic.destroy();
            this.glowEffectGraphic = null;
        }
    }

    startMoving() {
        if (this.sprite && this.sprite.body) {
            // Ensure runAnimKey is defined or use a default like 'bot_running'
            const runAnimKey = this.sprite.texture.key.includes('bot') ? 'bot_running' : 'player_running'; // Basic differentiation, though should be 'bot_running'
            this.sprite.body.setVelocityX(this.currentSpeed);
            this.sprite.anims.play(runAnimKey, true);
        }
        if (this.nameTag) {
            this.nameTag.setVisible(true);
        }
    }

    // Call this method when the scene is shutting down or bot is permanently removed
    destroy() {
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
        if (this.nameTag) {
            this.nameTag.destroy();
            this.nameTag = null;
        }
        if (this.glowEffectGraphic) {
            this.glowEffectGraphic.destroy();
            this.glowEffectGraphic = null;
        }
        if (this.powerupTimer) {
            this.powerupTimer.remove();
            this.powerupTimer = null;
        }
    }
}

// Note: BOT_JUMP_LOOKAHEAD constants are passed via updateAI. POWERUP_DURATION is from GameConfig.
// Old comments about global access are no longer accurate.
