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

        // Link the sprite back to this Player instance for easy access in colliders
        this.sprite.playerInstance = this;

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

    update(cursors) {
        if (this.isFalling) {
            // Optional: Play a falling animation here if you have one
            // if (this.sprite.anims.currentAnim.key !== 'player_falling') {
            //     this.sprite.play('player_falling', true);
            // }
            return;
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

        // Player jump logic
        if (cursors.space.isDown && this.sprite.body.onFloor()) {
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
    }

    // Create dust particle effect when jumping
    createJumpDust() {
        const dust = this.scene.add.sprite(
            this.sprite.x, 
            this.sprite.y + 32, // Position at character's feet
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
        
        // Add camera shake on hit
        if (this.scene.shakeCamera) {
            this.scene.shakeCamera(0.01, 150);
        }
        
        return false; // Indicate shield was not used
    }

    onFall() {
        if (this.isFalling) return;

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
            this.sprite.body.setVelocityY(0); 
            this.isFalling = false;
            
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
    }

    collectPowerup(powerupType) {
        // console.log(`Player collecting ${powerupType}`); // Removed for general cleanup
        this.resetPowerupEffects(); // Clear existing effects
        this.removeGlow();

        this.activePowerup = powerupType;

        if (powerupType === 'speed') {
            this.currentSpeed = this.boostedSpeed;
            this.applyGlow(0xFFFF00); // Yellow glow
            // console.log("Player Speed Boost activated!"); // Removed for general cleanup

            if (this.powerupTimer) this.powerupTimer.remove();
            this.powerupTimer = this.scene.time.delayedCall(GameConfig.POWERUP_DURATION, () => {
                if (this.activePowerup === 'speed') { 
                    this.currentSpeed = this.normalSpeed;
                    this.activePowerup = null;
                    this.removeGlow();
                    // console.log("Player Speed Boost ended."); // Removed for general cleanup
                }
            }, [], this.scene);
        } else if (powerupType === 'shield') {
            this.shieldActive = true;
            this.applyGlow(0x00FF00); // Green glow
            // console.log("Player Shield activated!"); // Removed for general cleanup
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

// Note: JUMP_VELOCITY is passed via constructor. POWERUP_DURATION is from GameConfig.
// Old comments about global access are no longer accurate.
