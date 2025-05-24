class Player {
    constructor(scene, x, y, textureKey, normalSpeed, boostedSpeed, jumpVelocity) {
        this.scene = scene;
        this.normalSpeed = normalSpeed; // This is the player's base speed
        this.boostedSpeed = boostedSpeed;
        this.jumpVelocity = jumpVelocity; // Store jump velocity

        // Use the textureKey passed from GameScene.js
        this.sprite = scene.physics.add.sprite(x, y, textureKey);
        
        // Set appropriate size for the sprite
        this.sprite.setScale(1);
        this.sprite.body.setSize(64, 64).setOffset(0, 0);
        
        this.sprite.setCollideWorldBounds(true);
        this.sprite.body.setBounceX(0.05);
        this.sprite.body.setAllowGravity(true);

        this.lastSafeX = x;
        this.respawnY = y;
        this.isFalling = false;
        this.lastSafeGroundSegment = null;

        this.activePowerup = null;
        this.powerupTimer = null;
        this.shieldActive = false;
        this.currentSpeed = normalSpeed; // Player's current operational speed
        this.glowEffectGraphic = null;
        this.collectedPowerupType = null;
        this.lightningStrikeSprite = null; // For tracking lightning animation
        
        // Moving platform tracking
        this.standingOnPlatform = null;
        this.platformContactTime = 0;

        // Link the sprite back to this Player instance for easy access in colliders
        this.sprite.playerInstance = this;

        // Name Tag
        this.nameTag = this.scene.add.text(this.sprite.x, this.sprite.y - 35, 'Player', { 
            fontFamily: 'Arial', 
            fontSize: '16px', 
            color: '#ffffff', 
            align: 'center' 
        }).setOrigin(0.5, 1);

        // Start playing running animation if available
        if (this.sprite.anims) {
            this.sprite.play('player_running', true);
        }

        // When jump animation completes, return to running if on ground
        this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'player_jumping', () => {
            if (!this.isFalling && this.sprite.body.onFloor()) { 
                this.sprite.play('player_running', true);
            }
        }, this);
    }

    startMoving() {
        if (this.sprite && this.sprite.body) {
            // Ensure runAnimKey is defined or use a default like 'player_running'
            const runAnimKey = this.sprite.texture.key.includes('player') ? 'player_running' : 'bot_running'; // Basic differentiation
            this.sprite.body.setVelocityX(this.currentSpeed);
            this.sprite.anims.play(runAnimKey, true);
        }
        if (this.nameTag) {
            this.nameTag.setVisible(true);
        }
    }

    update(cursors) {
        if (this.isFalling) {
            // Optional: Play a falling animation here if you have one
            // if (this.sprite.anims.currentAnim.key !== 'player_falling') {
            //     this.sprite.play('player_falling', true);
            // }
            return;
        }

        // Check if stunned (by lightning)
        if (this.isStunned) {
            // Stunned player doesn't move
            if (this.sprite.body) {
                this.sprite.body.setVelocityX(0);
            }
            return;
        }

        // Continuously apply horizontal speed
        if (this.sprite.body) { // Ensure body exists
            this.sprite.body.setVelocityX(this.currentSpeed);
        }

        if (this.sprite.body.onFloor()) {
            this.lastSafeX = this.sprite.x;
            this.lastSafeGroundSegment = null;
            if (this.scene.trackSegments) {
                for (const seg of this.scene.trackSegments) {
                    if (seg.type === 'ground' &&
                        this.sprite.body.right > seg.start &&
                        this.sprite.body.left < seg.end) {
                        this.lastSafeGroundSegment = seg;
                        break;
                    }
                }
            }
            // If on floor and not already running (e.g., after landing from a jump), play run animation
            if (this.sprite.anims && this.sprite.anims.currentAnim && this.sprite.anims.currentAnim.key !== 'player_running') {
                this.sprite.play('player_running', true);
            }
        }
        
        // Clear platform reference if player is falling or jumping significantly
        if (this.standingOnPlatform && this.sprite.body.velocity.y < -50) {
            console.log(`🚀 Player left platform - velocity.y: ${this.sprite.body.velocity.y.toFixed(1)}`);
            this.standingOnPlatform = null;
        }

        // Player jump logic - Enhanced for moving platforms
        // Check if player can jump (on floor OR on a moving platform)
        let canJump = this.sprite.body.onFloor() || 
                     (this.sprite.body.blocked.down && Math.abs(this.sprite.body.velocity.y) < 10);
        
        // Check if player is standing on a tracked moving platform
        if (!canJump && this.standingOnPlatform) {
            const timeSinceContact = this.scene.time.now - this.platformContactTime;
            
            // Allow jumping if we've been in contact with the platform recently (within 100ms)
            if (timeSinceContact < 100) {
                const playerBottom = this.sprite.body.bottom;
                const playerCenterX = this.sprite.body.center.x;
                const platformTop = this.standingOnPlatform.body.top;
                const platformLeft = this.standingOnPlatform.body.left;
                const platformRight = this.standingOnPlatform.body.right;
                
                // Verify player is still roughly on the platform
                const isAbovePlatform = playerBottom >= platformTop - 8 && playerBottom <= platformTop + 20;
                const isWithinPlatformWidth = playerCenterX >= platformLeft - 15 && playerCenterX <= platformRight + 15;
                
                if (isAbovePlatform && isWithinPlatformWidth) {
                    canJump = true;
                    console.log(`🏃 Player can jump from tracked platform at (${this.standingOnPlatform.x.toFixed(1)}, ${this.standingOnPlatform.y.toFixed(1)}) - contact time: ${timeSinceContact}ms`);
                }
            } else {
                // Clear old platform reference if too much time has passed
                this.standingOnPlatform = null;
            }
        }
        
        // Debug: Log jump state occasionally when space is pressed
        if (cursors.space.isDown && this.scene.game.loop.frame % 10 === 0) {
            console.log(`🎮 Player jump attempt - onFloor: ${this.sprite.body.onFloor()}, blocked.down: ${this.sprite.body.blocked.down}, velocity.y: ${this.sprite.body.velocity.y.toFixed(1)}, canJump: ${canJump}, onPlatform: ${this.standingOnPlatform ? 'YES' : 'NO'}`);
        }
        
        if (cursors.space.isDown && canJump) {
            this.sprite.body.setVelocityY(this.jumpVelocity);
            
            // Play jump animation
            this.sprite.play('player_jumping', true);
            
            // Create jump dust particle effect
            this.createJumpDust();
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
    }

    // Create dust particle effect when jumping
    createJumpDust() {
        const dust = this.scene.add.sprite(
            this.sprite.x, 
            this.sprite.y + GameConfig.JUMP_DUST_Y_OFFSET, // Position at character's feet
            'jump_dust'
        );
        
        dust.setOrigin(0.5, 0.5);
        dust.play('jump_dust_anim'); // Assumes jump_dust_anim framerate is set in BootScene from GameConfig if needed or is fine as is
        
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
        
        // Add camera shake on hit
        if (this.scene.shakeCamera) {
            this.scene.shakeCamera(GameConfig.PLAYER_OBSTACLE_SHAKE_INTENSITY, GameConfig.PLAYER_OBSTACLE_SHAKE_DURATION);
        }

        // If not shielded and hit a wall, ensure Y velocity is not making onFloor() false due to tiny bounce
        if (this.sprite.body.onFloor() || (this.sprite.body.blocked.down && Math.abs(this.sprite.body.velocity.y) < 5)) {
            this.sprite.body.setVelocityY(0); 
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
                this.sprite.play('player_running', true);
            }
        }, [], this.scene);
    }

    onFinish() {
        this.sprite.body.setVelocity(0,0);
        this.sprite.body.setAcceleration(0,0);
        this.sprite.body.allowGravity = false; // Keep from falling if finish line is mid-air
        this.removeGlow();
        // Name tag remains visible
    }

    collectPowerup(powerupType) {
        // Player now collects the power-up, but doesn't activate it immediately.
        // Activation will happen via a UI button press.
        if (!this.collectedPowerupType) { // Only collect if no power-up is currently held
            this.collectedPowerupType = powerupType;
            // Power-up collected and ready for deployment
            // We'll need to notify the UIScene to enable the button
            this.scene.events.emit('playerCollectedPowerup', powerupType);
        } else {
            // Player already holding a power-up
        }
    }

    // New method to deploy the collected power-up
    deployCollectedPowerup() {
        if (!this.collectedPowerupType) {
            return false;
        }

        this.resetPowerupEffects(); // Clear any previous active effects first
        this.removeGlow();

        this.activePowerup = this.collectedPowerupType; // Set the collected one as active
        const deployedType = this.collectedPowerupType;
        this.collectedPowerupType = null; // Clear collected power-up

        // Power-up deployed

        if (deployedType === 'speed') {
            this.currentSpeed = this.boostedSpeed;
            this.applyGlow(GameConfig.SPEED_GLOW_COLOR);

            if (this.powerupTimer) this.powerupTimer.remove();
            this.powerupTimer = this.scene.time.delayedCall(GameConfig.POWERUP_DURATION, () => {
                if (this.activePowerup === 'speed') { 
                    this.currentSpeed = this.normalSpeed;
                    this.activePowerup = null;
                    this.removeGlow();
                }
            }, [], this.scene);
        } else if (deployedType === 'shield') {
            this.shieldActive = true;
            this.applyGlow(GameConfig.SHIELD_GLOW_COLOR);
            // Shield is one-time use, effect removed on hit in onHitObstacle
        } else if (deployedType === 'lightning') {
            // Lightning power-up: Target a random opponent
            this.activePowerup = null; // Lightning is instant use, not persistent
            this.deployLightningStrike();
        } else if (deployedType === 'trap') {
            // Trap power-up: Place a droppable trap at player's current position
            this.activePowerup = null; // Trap is instant deployment, not persistent
            this.deployTrap();
        } else if (deployedType === 'shuriken') {
            // Shuriken power-up: Throw a shuriken forward
            this.activePowerup = null; // Shuriken is instant deployment, not persistent
            this.deployShuriken();
        }
        
        // Notify UI that power-up has been used
        this.scene.events.emit('playerUsedPowerup');
        return true;
    }

    deployLightningStrike() {
        // Get all valid targets (excluding self)
        const targets = [];
        
        if (this.scene.bots) {
            this.scene.bots.forEach(bot => {
                if (bot && bot.sprite && bot.sprite.active && !bot.isFalling) {
                    targets.push(bot);
                }
            });
        }

        if (targets.length === 0) {
            console.log('⚡ No valid targets for lightning strike');
            return;
        }

        // Select random target
        const randomTarget = targets[Math.floor(Math.random() * targets.length)];
        console.log(`⚡ Lightning targeting ${randomTarget.name || 'Bot'}`);

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
                console.log(`⚡ ${target.name || 'Bot'} recovered from lightning strike`);
            }
        });

        console.log(`⚡ ${target.name || 'Bot'} struck by lightning! Stunned for 1.5 seconds`);
    }

    deployTrap() {
        // Place trap at player's current position on the ground
        const trapX = this.sprite.x;
        const trapY = this.sprite.y + 20; // Place slightly below player (on ground)

        console.log(`💣 ${this.name || 'Player'} deployed a trap at position ${trapX}, ${trapY}`);

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
        trapSprite.setData('deployedBy', this.name || 'Player');
        trapSprite.setData('isArmed', true);
        trapSprite.setData('deploymentTime', this.scene.time.now); // Add deployment timestamp

        // Start trap monitoring in the scene
        this.scene.activateTrapsMonitoring();
    }

    deployShuriken() {
        // Throw shuriken forward from player's position
        const shurikenX = this.sprite.x + 50; // Start slightly ahead of player
        const shurikenY = this.sprite.y - 10; // Center height
        const shurikenSpeed = 400; // Fast forward movement

        console.log(`🌟 ${this.name || 'Player'} deployed a shuriken at position ${shurikenX}, ${shurikenY}`);

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
        shurikenSprite.setData('deployedBy', this.name || 'Player');
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
        this.currentSpeed = this.normalSpeed;
        // Glow is typically removed when effects are reset, or when new one applied
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

    // Call this method when the scene is shutting down or player is permanently removed
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
        if (this.powerupTimer) {
            this.powerupTimer.remove();
            this.powerupTimer = null;
        }
    }
}

// Note: JUMP_VELOCITY is passed via constructor. POWERUP_DURATION is from GameConfig.
// Old comments about global access are no longer accurate.
