class Bot {
    constructor(scene, x, y, textureKey, normalSpeed, boostedSpeed, jumpVelocity) {
        this.scene = scene;
        this.normalSpeed = normalSpeed;
        this.boostedSpeed = boostedSpeed;
        this.jumpVelocity = jumpVelocity; // Store jump velocity

        this.sprite = scene.physics.add.sprite(x, y, textureKey);
        this.sprite.setScale(2);
        this.sprite.body.setSize(32, 28).setOffset(0, 0); // Assuming texture is 32x32, body 32x28
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
    }

    // Main update called from game.js, primarily for movement and glow
    update() {
        if (this.isFalling) return;

        // Actual velocity setting will be handled by game.js based on gameStarted state
        // this.sprite.body.setVelocityX(this.currentSpeed); 

        // Update glow position
        if (this.glowEffectGraphic && this.activePowerup) {
            this.glowEffectGraphic.setPosition(this.sprite.x, this.sprite.y);
        } else if (this.glowEffectGraphic && !this.activePowerup) {
            this.removeGlow();
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
        }
    }

    onHitObstacle(_obstacle) {
        if (this.shieldActive) {
            this.shieldActive = false;
            this.activePowerup = null; // Shield consumed
            this.removeGlow();
            console.log("Bot shield absorbed obstacle hit!");
            return true; // Indicate shield was used
        }
        console.log("Bot hit obstacle! Attempting reactive jump.");
        if (this.sprite.body.onFloor()) {
            this.sprite.body.setVelocityY(this.jumpVelocity);
        }
        return false; // Indicate shield was not used
    }

    onFall() {
        if (this.isFalling) return;

        console.log("Bot fell!");
        this.isFalling = true;
        this.sprite.setVisible(false);
        this.sprite.body.setEnable(false);
        this.sprite.body.setVelocity(0, 0);

        this.resetPowerupEffects();
        this.removeGlow();

        this.scene.time.delayedCall(2000, () => {
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
            // Speed will be set by game.js
            // this.sprite.body.setVelocityX(this.currentSpeed);
            this.sprite.body.setVelocityY(0);
            this.isFalling = false;
            console.log("Bot respawned at X:", respawnX, "on segment:", this.lastSafeGroundSegment);
        }, [], this.scene);
    }

    onFinish() {
        console.log("Bot instance: onFinish called");
        this.sprite.body.setVelocityX(0);
        this.removeGlow();
    }

    collectPowerup(powerupType) {
        console.log(`Bot collecting ${powerupType}`);
        this.resetPowerupEffects();
        this.removeGlow();
        
        this.activePowerup = powerupType;

        if (powerupType === 'speed') {
            this.currentSpeed = this.boostedSpeed;
            this.applyGlow(0xFFFF00); // Yellow glow
            console.log("Bot Speed Boost activated!");

            if (this.powerupTimer) this.powerupTimer.remove();
            this.powerupTimer = this.scene.time.delayedCall(POWERUP_DURATION, () => {
                if (this.activePowerup === 'speed') {
                    this.currentSpeed = this.normalSpeed;
                    this.activePowerup = null;
                    this.removeGlow();
                    console.log("Bot Speed Boost ended.");
                }
            }, [], this.scene);
        } else if (powerupType === 'shield') {
            this.shieldActive = true;
            this.applyGlow(0x00FF00); // Green glow
            console.log("Bot Shield activated!");
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
        this.glowEffectGraphic.fillStyle(color, 0.35);
        this.glowEffectGraphic.fillRoundedRect(-glowWidth / 2, -glowHeight / 2, glowWidth, glowHeight, 8);
        this.glowEffectGraphic.setDepth(this.sprite.depth - 1);
        this.glowEffectGraphic.setPosition(this.sprite.x, this.sprite.y); // Initial position
    }

    removeGlow() {
        if (this.glowEffectGraphic) {
            this.glowEffectGraphic.destroy();
            this.glowEffectGraphic = null;
        }
    }
}

// Similar to Player.js, BOT_JUMP_LOOKAHEAD_WALL, BOT_JUMP_LOOKAHEAD_GAP
// and POWERUP_DURATION would need to be accessible (e.g. global or passed).
