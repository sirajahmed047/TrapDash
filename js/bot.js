class Bot {
    constructor(scene, x, y, textureKey, normalSpeed, boostedSpeed, jumpVelocity, botNumber) {
        this.scene = scene;
        this.normalSpeed = normalSpeed;
        this.boostedSpeed = boostedSpeed;
        this.jumpVelocity = jumpVelocity; // Store jump velocity
        this.botId = `Bot ${botNumber}`; // Store bot ID

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
        this.currentSpeed = normalSpeed;
        this.glowEffectGraphic = null;

        // Link the sprite back to this Bot instance for easy access in colliders
        this.sprite.botInstance = this;
        
        // Name Tag
        this.nameTag = this.scene.add.text(this.sprite.x, this.sprite.y - 35, this.botId, { 
            fontFamily: 'Arial', 
            fontSize: '16px', 
            color: '#ffffff', 
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
    updateAI(trackSegments, walls, BOT_JUMP_LOOKAHEAD_WALL, BOT_JUMP_LOOKAHEAD_GAP) {
        if (this.isFalling || !this.sprite.body.onFloor()) return;

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

        // 1. Check for Gaps
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
                if (distanceToGapEnd > 0 && distanceToGapEnd < BOT_JUMP_LOOKAHEAD_GAP) {
                    shouldBotJump = true;
                }
            }
        }

        // 2. Check for Walls (only if not already decided to jump for a gap)
        if (!shouldBotJump && walls) {
            walls.getChildren().forEach(wall => {
                if (wall.active && wall.body) {
                    if (wall.body.left > this.sprite.body.right) {
                        const distanceToWall = wall.body.left - this.sprite.body.right;
                        if (distanceToWall > 0 && distanceToWall < BOT_JUMP_LOOKAHEAD_WALL) {
                            shouldBotJump = true;
                            return; // Exit forEach early if wall found
                        }
                    }
                }
            });
        }

        if (shouldBotJump) {
            this.sprite.body.setVelocityY(this.jumpVelocity);
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
        this.currentSpeed = this.normalSpeed;
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
