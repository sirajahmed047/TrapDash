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
        this.lightningStrikeSprite = null; // For tracking lightning animation
        this.shieldAnimationSprite = null; // For tracking shield animation
        
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

        // Check if stunned (by lightning)
        if (this.isStunned) {
            // Stunned bots don't move
            if (this.sprite.body) {
                this.sprite.body.setVelocityX(0);
            }
            return;
        }

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

        // Update lightning strike animation position if active
        if (this.lightningStrikeSprite && this.lightningStrikeSprite.active) {
            this.lightningStrikeSprite.setPosition(this.sprite.x, this.sprite.y - 64);
        }

        // Update shield animation position if active
        if (this.shieldAnimationSprite && this.shieldAnimationSprite.active) {
            this.shieldAnimationSprite.setPosition(this.sprite.x, this.sprite.y);
        } else if (this.shieldActive && !this.shieldAnimationSprite) {
            // Shield is active but animation is missing - recreate it
            console.log(`⚠️ Shield active but animation missing for ${this.name || `Bot ${this.botId}`} - recreating`);
            this.createShieldAnimation();
        }
    }

    // Specific AI update called from game.js
    updateAI(trackSegments, walls, movingObstacles, BOT_JUMP_LOOKAHEAD_WALL, BOT_JUMP_LOOKAHEAD_GAP) {
        // Enhanced floor check for moving platforms
        const isOnFloor = this.sprite.body.onFloor() || 
                         (this.sprite.body.blocked.down && Math.abs(this.sprite.body.velocity.y) < 10);
        
        if (this.isFalling || !isOnFloor) return;

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
        // Shield does NOT protect against environmental obstacles like walls
        // Shield only protects against offensive power-ups (lightning, shuriken, bomb)
        
        // Attempt to counteract micro-bounce before checking onFloor for the reactive jump
        if (this.sprite.body.blocked.down && Math.abs(this.sprite.body.velocity.y) < 5) {
            this.sprite.body.setVelocityY(0);
        }

        // Enhanced floor check for moving platforms
        const canReactiveJump = this.sprite.body.onFloor() || 
                              (this.sprite.body.blocked.down && Math.abs(this.sprite.body.velocity.y) < 10);

        if (canReactiveJump) {
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
        return false; // Shield is not consumed by environmental obstacles
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
        if (powerupType === 'speed') {
            this.resetPowerupEffects();
            this.removeGlow();
            
            this.activePowerup = powerupType;
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
            // Special handling for shield - don't reset shield effects first
            if (this.powerupTimer) {
                this.powerupTimer.remove(false);
                this.powerupTimer = null;
            }
            // Only reset non-shield powerups
            if (this.activePowerup && this.activePowerup !== 'shield') {
                this.activePowerup = null;
                this.currentSpeed = this.normalSpeed; // Already personality-modified
                this.removeGlow(); // Remove previous glow only
            }
            
            this.activePowerup = powerupType;
            this.shieldActive = true;
            this.applyGlow(GameConfig.SHIELD_GLOW_COLOR);
            this.createShieldAnimation();
            console.log(`🛡️ ${this.name || `Bot ${this.botId}`} shield deployed successfully! Shield active: ${this.shieldActive}`);
        } else if (powerupType === 'lightning') {
            this.resetPowerupEffects();
            this.removeGlow();
            
            // Lightning power-up: Target a random opponent (instant use)
            this.activePowerup = null; // Lightning is instant use, not persistent
            this.deployLightningStrike();
        } else if (powerupType === 'trap') {
            this.resetPowerupEffects();
            this.removeGlow();
            
            // Trap power-up: Place a droppable trap at bot's current position
            this.activePowerup = null; // Trap is instant deployment, not persistent
            this.deployTrap();
        } else if (powerupType === 'shuriken') {
            this.resetPowerupEffects();
            this.removeGlow();
            
            // Shuriken power-up: Throw a shuriken forward
            this.activePowerup = null; // Shuriken is instant deployment, not persistent
            this.deployShuriken();
        }
    }

    deployLightningStrike() {
        // Get all valid targets (excluding self)
        const targets = [];
        
        // Add player as potential target
        if (this.scene.player && this.scene.player.sprite && this.scene.player.sprite.active && !this.scene.player.isFalling) {
            targets.push(this.scene.player);
        }
        
        // Add other bots as potential targets
        if (this.scene.bots) {
            this.scene.bots.forEach(bot => {
                if (bot !== this && bot.sprite && bot.sprite.active && !bot.isFalling) {
                    targets.push(bot);
                }
            });
        }

        if (targets.length === 0) {
            console.log(`⚡ ${this.name || `Bot ${this.botId}`} - No valid targets for lightning strike`);
            return;
        }

        // Select random target
        const randomTarget = targets[Math.floor(Math.random() * targets.length)];
        console.log(`⚡ ${this.name || `Bot ${this.botId}`} targeting ${randomTarget.name || 'Player'} with lightning`);

        // Create lightning effect
        this.createLightningEffect(randomTarget);

        // Apply lightning effect to target
        this.applyLightningEffect(randomTarget);
    }

    createLightningEffect(target) {
        const targetX = target.sprite.x;
        const targetY = target.sprite.y;
        
        // Create animated lightning strike sprite above the target
        const lightningSprite = this.scene.add.sprite(targetX, targetY - 64, 'lightning_strike');
        lightningSprite.setDepth(100); // High depth to appear above everything
        lightningSprite.setOrigin(0.5, 1); // Bottom center origin so it appears above the character
        
        // Store reference on the target so it can follow them
        target.lightningStrikeSprite = lightningSprite;
        
        // Play the lightning animation
        lightningSprite.play('lightning_strike_anim');
        
        // Flash effect
        this.scene.cameras.main.flash(100, 255, 255, 255);

        // Remove lightning effect when animation completes
        lightningSprite.on('animationcomplete', () => {
            if (lightningSprite) {
                lightningSprite.destroy();
                target.lightningStrikeSprite = null;
            }
        });

        // Add screen shake for dramatic effect
        if (this.scene.shakeCamera) {
            this.scene.shakeCamera(0.02, 200);
        }
    }

    applyLightningEffect(target) {
        // Check if target has shield protection
        if (target.checkShieldProtection && target.checkShieldProtection('lightning')) {
            console.log(`⚡ Lightning strike blocked by ${target.name || 'Target'}'s shield!`);
            return; // Shield blocked the attack
        }
        
        // Apply stunning effect - stop the target briefly
        const originalVelocityX = target.sprite.body.velocity.x;
        
        // Stun the target
        target.sprite.body.setVelocityX(0);
        target.isStunned = true;
        
        // Apply purple glow to show stunning effect
        target.applyGlow(GameConfig.LIGHTNING_GLOW_COLOR);
        
        // Remove stun effect after 1.5 seconds
        this.scene.time.delayedCall(1500, () => {
            if (target.sprite && target.sprite.active) {
                target.isStunned = false;
                target.sprite.body.setVelocityX(originalVelocityX);
                target.removeGlow();
                console.log(`⚡ ${target.name || 'Target'} recovered from lightning strike`);
            }
        });

        console.log(`⚡ ${target.name || 'Target'} struck by lightning! Stunned for 1.5 seconds`);
    }

    deployTrap() {
        // Place trap at bot's current position on the ground
        const trapX = this.sprite.x;
        const trapY = this.sprite.y + 20; // Place slightly below bot (on ground)

        console.log(`💣 ${this.name || `Bot ${this.botId}`} deployed a trap at position ${trapX}, ${trapY}`);

        // Create trap physics group if it doesn't exist
        if (!this.scene.traps) {
            this.scene.traps = this.scene.physics.add.staticGroup();
        }

        // Create trap sprite directly in the physics group
        const trapSprite = this.scene.traps.create(trapX, trapY, 'droptrap');
        trapSprite.setDepth(50); // Below characters but above ground
        trapSprite.setOrigin(0.5, 1); // Bottom center origin
        trapSprite.body.setSize(64, 64); // Set collision box
        
        // Safely play animation with error checking
        if (this.scene.anims.exists('trap_idle')) {
            trapSprite.play('trap_idle');
        } else {
            console.warn('trap_idle animation not found');
        }

        // Add trap data
        trapSprite.setData('trapType', 'bomb');
        trapSprite.setData('deployedBy', this.name || `Bot ${this.botId}`);
        trapSprite.setData('isArmed', true);
        trapSprite.setData('deploymentTime', this.scene.time.now); // Add deployment timestamp

        // Start trap monitoring in the scene
        this.scene.activateTrapsMonitoring();
    }

    deployShuriken() {
        // Throw shuriken forward from bot's position
        const shurikenX = this.sprite.x + 50; // Start slightly ahead of bot
        const shurikenY = this.sprite.y - 10; // Center height
        const shurikenSpeed = 400; // Fast forward movement

        console.log(`🌟 ${this.name || `Bot ${this.botId}`} deployed a shuriken at position ${shurikenX}, ${shurikenY}`);

        // Create shuriken physics group if it doesn't exist
        if (!this.scene.shurikens) {
            this.scene.shurikens = this.scene.physics.add.group();
        }

        // Create shuriken sprite directly in the physics group
        const shurikenSprite = this.scene.shurikens.create(shurikenX, shurikenY, 'shuriken');
        shurikenSprite.setScale(0.3); // Scale down from 192x192 to reasonable size
        shurikenSprite.setDepth(75); // Above ground but below UI
        shurikenSprite.body.setSize(60, 60); // Set collision box smaller than sprite
        shurikenSprite.body.setAllowGravity(false); // Shurikens fly straight
        
        // Set initial velocity forward
        shurikenSprite.body.setVelocityX(shurikenSpeed);
        
        // Use rotation for spinning effect (since we have single frame, not animation)
        shurikenSprite.setRotation(0); // Start at 0 rotation
        
        // Add rotation data for continuous spinning
        shurikenSprite.setData('rotationSpeed', 0.3); // Radians per frame for spinning effect

        // Add shuriken data
        shurikenSprite.setData('deployedBy', this.name || `Bot ${this.botId}`);
        shurikenSprite.setData('hasReflected', false); // Track if it has bounced off a wall
        shurikenSprite.setData('hasHitCharacter', false); // Track if it has hit someone
        shurikenSprite.setData('direction', 1); // 1 for right, -1 for left

        // Start shuriken monitoring in the scene
        this.scene.activateShurikenMonitoring();
    }

    resetPowerupEffects() {
        if (this.powerupTimer) {
            this.powerupTimer.remove(false);
            this.powerupTimer = null;
        }
        this.activePowerup = null;
        this.shieldActive = false;
        this.currentSpeed = this.normalSpeed; // Already personality-modified
        this.removeShieldAnimation();
    }

    applyGlow(color) {
        if (this.glowEffectGraphic) {
            this.glowEffectGraphic.destroy();
        }
        const glowWidth = this.sprite.displayWidth + 15;
        const glowHeight = this.sprite.displayHeight + 15;
        this.glowEffectGraphic = this.scene.add.graphics();
        this.glowEffectGraphic.lineStyle(0); // Remove any stroke/outline
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
        if (this.lightningStrikeSprite) {
            this.lightningStrikeSprite.destroy();
            this.lightningStrikeSprite = null;
        }
        if (this.shieldAnimationSprite) {
            this.shieldAnimationSprite.destroy();
            this.shieldAnimationSprite = null;
        }
        if (this.powerupTimer) {
            this.powerupTimer.remove();
            this.powerupTimer = null;
        }
    }

    // Check if shield protects against attacks (lightning, shuriken, bomb)
    checkShieldProtection(attackType) {
        if (this.shieldActive) {
            console.log(`🛡️ ${this.name || `Bot ${this.botId}`}'s shield protected against ${attackType} attack!`);
            this.deactivateShield();
            return true; // Shield blocked the attack
        }
        return false; // No shield protection
    }

    // Deactivate shield and remove visual effects
    deactivateShield() {
        this.shieldActive = false;
        this.activePowerup = null; // Shield consumed
        this.removeShieldAnimation();
        this.removeGlow();
        console.log(`🛡️ ${this.name || `Bot ${this.botId}`}'s shield has been consumed!`);
    }

    createShieldAnimation() {
        // Remove any existing shield animation
        this.removeShieldAnimation();
        
        // Create a circular shield animation around the bot
        this.shieldAnimationSprite = this.scene.add.graphics();
        this.shieldAnimationSprite.setDepth(this.sprite.depth + 2); // Make sure it's well above bot and glow
        
        // Initial shield parameters
        const shieldRadius = 45;
        const shieldThickness = 3;
        const shieldColor = GameConfig.SHIELD_GLOW_COLOR;
        const shieldAlpha = 0.7;
        
        // Draw the initial shield circle
        this.updateShieldGraphics(shieldRadius, shieldThickness, shieldColor, shieldAlpha);
        this.shieldAnimationSprite.setPosition(this.sprite.x, this.sprite.y);
        
        // Create pulsing animation
        this.scene.tweens.add({
            targets: this.shieldAnimationSprite,
            scaleX: { from: 1, to: 1.1 },
            scaleY: { from: 1, to: 1.1 },
            alpha: { from: 0.7, to: 0.9 },
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1 // Infinite repeat
        });
        
        console.log(`🛡️ Shield animation activated for ${this.name || `Bot ${this.botId}`} at position (${this.sprite.x}, ${this.sprite.y}) with depth ${this.shieldAnimationSprite.depth}`);
    }
    
    updateShieldGraphics(radius, thickness, color, alpha) {
        if (!this.shieldAnimationSprite) return;
        
        this.shieldAnimationSprite.clear();
        this.shieldAnimationSprite.lineStyle(thickness, color, alpha);
        this.shieldAnimationSprite.strokeCircle(0, 0, radius);
        
        // Add some sparkle effects around the shield
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const sparkleX = Math.cos(angle) * (radius + 5);
            const sparkleY = Math.sin(angle) * (radius + 5);
            this.shieldAnimationSprite.fillStyle(color, alpha * 0.8);
            this.shieldAnimationSprite.fillCircle(sparkleX, sparkleY, 2);
        }
        
        console.log(`🛡️ Shield graphics updated for ${this.name || `Bot ${this.botId}`}: radius=${radius}, color=${color.toString(16)}, alpha=${alpha}`);
    }
    
    removeShieldAnimation() {
        if (this.shieldAnimationSprite) {
            // Stop any active tweens on the shield animation
            this.scene.tweens.killTweensOf(this.shieldAnimationSprite);
            this.shieldAnimationSprite.destroy();
            this.shieldAnimationSprite = null;
            console.log(`🛡️ Shield animation removed for ${this.name || `Bot ${this.botId}`}`);
        }
    }
}

// Note: BOT_JUMP_LOOKAHEAD constants are passed via updateAI. POWERUP_DURATION is from GameConfig.
// Old comments about global access are no longer accurate.
