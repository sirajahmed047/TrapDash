class Player {
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

        // Link the sprite back to this Player instance for easy access in colliders
        this.sprite.playerInstance = this;
    }

    update(cursors) {
        if (this.isFalling) return;

        // Update last safe X position and ground segment when on floor
        if (this.sprite.body.onFloor()) {
            this.lastSafeX = this.sprite.x;
            this.lastSafeGroundSegment = null; // Reset before finding current
            if (this.scene.trackSegments) { // Ensure trackSegments exists on the scene
                for (const seg of this.scene.trackSegments) {
                    if (seg.type === 'ground' &&
                        this.sprite.body.right > seg.start &&
                        this.sprite.body.left < seg.end) {
                        this.lastSafeGroundSegment = seg;
                        break;
                    }
                }
            }
        }

        // Apply movement based on currentSpeed (set by game start or power-ups)
        // Actual velocity setting will be handled by game.js based on gameStarted state
        // this.sprite.body.setVelocityX(this.currentSpeed); // Player class itself doesn't control if game has started

        // Player jump logic
        if (cursors.space.isDown && this.sprite.body.onFloor()) {
            this.sprite.body.setVelocityY(this.jumpVelocity); // Use stored jumpVelocity
            if (this.sprite.body.blocked.right) {
                // Temporarily reduce speed if jumping against a wall, main speed applied by game.js
                // this.sprite.body.setVelocityX(this.currentSpeed * 0.3); 
            }
        }

        // Update glow position
        if (this.glowEffectGraphic && this.activePowerup) {
            this.glowEffectGraphic.setPosition(this.sprite.x, this.sprite.y);
        } else if (this.glowEffectGraphic && !this.activePowerup) {
            this.removeGlow();
        }
    }

    onHitObstacle(_obstacle) {
        if (this.shieldActive) {
            this.shieldActive = false;
            this.activePowerup = null; // Shield consumed
            this.removeGlow();
            console.log("Player shield absorbed obstacle hit!");
            return true; // Indicate shield was used
        }
        console.log("Player hit obstacle!");
        return false; // Indicate shield was not used
    }

    onFall() {
        if (this.isFalling) return;

        console.log("Player fell!");
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
            // Speed will be set by game.js based on gameStarted state
            // this.sprite.body.setVelocityX(this.currentSpeed); 
            this.sprite.body.setVelocityY(0); 
            this.isFalling = false;
            console.log("Player respawned at X:", respawnX, "on segment:", this.lastSafeGroundSegment);
        }, [], this.scene);
    }

    onFinish() {
        console.log("Player instance: onFinish called");
        this.sprite.body.setVelocity(0,0);
        this.sprite.body.setAcceleration(0,0);
        this.sprite.body.allowGravity = false; // Keep from falling if finish line is mid-air
        this.removeGlow();
    }

    collectPowerup(powerupType) {
        console.log(`Player collecting ${powerupType}`);
        this.resetPowerupEffects(); // Clear existing effects
        this.removeGlow();

        this.activePowerup = powerupType;

        if (powerupType === 'speed') {
            this.currentSpeed = this.boostedSpeed;
            this.applyGlow(0xFFFF00); // Yellow glow
            console.log("Player Speed Boost activated!");

            if (this.powerupTimer) this.powerupTimer.remove();
            this.powerupTimer = this.scene.time.delayedCall(POWERUP_DURATION, () => {
                if (this.activePowerup === 'speed') { 
                    this.currentSpeed = this.normalSpeed;
                    this.activePowerup = null;
                    this.removeGlow();
                    console.log("Player Speed Boost ended.");
                }
            }, [], this.scene);
        } else if (powerupType === 'shield') {
            this.shieldActive = true;
            this.applyGlow(0x00FF00); // Green glow
            console.log("Player Shield activated!");
            // Shield is one-time use, no timer needed here to remove its active state, only its glow on consumption
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
        // Glow is typically removed when effects are reset, or when new one applied
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

// For JUMP_VELOCITY and POWERUP_DURATION to be accessible here without passing them everywhere,
// they would need to be global or part of a shared config object.
// For now, assume JUMP_VELOCITY is global (defined in game.js)
// and POWERUP_DURATION is from powerups.js (also global via script tag).
