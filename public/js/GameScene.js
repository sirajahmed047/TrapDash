class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        // Game mode detection (with defensive check for multiplayer components)
        this.gameMode = data?.gameMode || (window.multiplayerManager ? multiplayerManager.getGameMode() : 'singleplayer') || 'singleplayer';
        this.isMultiplayer = (this.gameMode === 'multiplayer' && window.multiplayerManager);
        this.roomPlayers = (this.isMultiplayer && window.multiplayerManager) ? multiplayerManager.getRoomPlayers() : {};
        
        // Game state flags, initialized here
        this.gameStarted = false; // Will be set to true after a brief delay or immediately
        this.gameOver = false;
        this.playerWon = null;
        this.isPlayerActuallyFinished = false;
        this.botsFinishedCount = 0;

        // NEW: Podium tracking system
        this.finishers = []; // Array to track finishing order for podium
        this.finishersNeeded = 3; // Game ends when 3 characters finish
        
        // Multiplayer-specific properties
        this.networkSynchronizer = null;
        this.remotePlayers = {}; // Store remote player sprites
        this.lastNetworkUpdate = 0;

        // Countdown related
        this.countdownText = null;
        this.countdownTimer = null;
        this.countdownValue = 3; // Start from 3

        // References to game objects
        this.player = null;
        this.bots = [];
        this.groundGroup = null;
        this.trackSegments = null;
        this.wallsGroup = null;
        this.movingObstaclesGroup = null;
        this.powerupsGroup = null;
        this.finishLine = null;
        
        this.cursors = null;
        this.restartKey = null; // Will be handled by GameOverScene primarily

        // Trap monitoring system
        this.traps = null; // Physics group for active traps (now will be static group)
        this.trapMonitoringActive = false;
        this.trapCheckInterval = 100; // Check every 100ms for timer-based detonation
        this.lastTrapCheck = 0;

        // Shuriken monitoring system
        this.shurikens = null; // Physics group for active shurikens
        this.shurikenMonitoringActive = false;
        this.shurikenCheckInterval = 16; // Check every frame (~60fps)
        this.lastShurikenCheck = 0;

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
        this.load.image("powerupLightningIconPH", "assets/images/powerup_lightning_icon_placeholder.png");
        this.load.image("mysteryBox", "assets/images/mysterybox.png");
        this.load.image("wall", "assets/images/obstacle_wall.png");
    }

    async create() {
        // HARDCODED TEMPORARY VALUES FOR DEBUGGING
        const TEMP_DEFAULT_GRAVITY = 400;
        const TEMP_GROUND_Y_OFFSET = 200;
        const TEMP_PLAYER_RESPAWN_Y_OFFSET = -24;
        const TEMP_GROUND_SEGMENT_HEIGHT = 50;

        // this.physics.world.gravity.y = GameConfig.DEFAULT_GRAVITY;
        this.physics.world.gravity.y = TEMP_DEFAULT_GRAVITY;
        this.cameras.main.setBackgroundColor(GameConfig.SKY_COLOR); // Sky color is fine from GameConfig

        this.groundTopY = this.configHeight - TEMP_GROUND_Y_OFFSET;
        this.fallDeathY = this.groundTopY + TEMP_GROUND_SEGMENT_HEIGHT + GameConfig.FALL_DEATH_Y_BUFFER;

        // Create varied track with obstacle patterns/chunks (replaces separate function calls)
        // Use deterministic seed for multiplayer to ensure all players get the same map
        let mapSeed = null;
        if (this.isMultiplayer && window.multiplayerManager && multiplayerManager.getCurrentRoom()) {
            // Use room creation timestamp as seed for consistent maps across all players
            mapSeed = multiplayerManager.getCurrentRoom().created;
            console.log(`🗺️ Using multiplayer map seed: ${mapSeed}`);
        }
        
        const trackData = createVariedTrack(this, this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER, this.groundTopY, TEMP_GROUND_SEGMENT_HEIGHT, mapSeed);
        this.groundGroup = trackData.groundGroup;
        this.trackSegments = trackData.trackSegments;
        this.wallsGroup = trackData.wallsGroup;
        this.movingObstaclesGroup = trackData.movingObstaclesGroup;

        // Track created with varied obstacle patterns/chunks

        // Player Instance
        // Place player directly on the ground to prevent falling through
        const playerInitialY = this.groundTopY - (64/2); // half of sprite height
        this.player = new Player(this, GameConfig.PLAYER_INITIAL_X, playerInitialY, "player_run_anim", GameConfig.PLAYER_SPEED_NORMAL, GameConfig.PLAYER_SPEED_BOOSTED, GameConfig.JUMP_VELOCITY);

        // Player sprite created and configured

        // Character initialization (bots or remote players)
        const characterInitialY = this.groundTopY - (64/2);
        if (this.isMultiplayer) {
            await this.initializeMultiplayerCharacters(characterInitialY);
        } else {
            this.initializeSinglePlayerBots(characterInitialY);
        }

        // Power-ups (using functions from powerups.js) - Create after platforms
        this.powerupsGroup = createPowerups(this, this.groundTopY);
        
        // Attach powerups to moving platforms
        attachPowerupsToMovingPlatforms(this, this.powerupsGroup, this.movingObstaclesGroup);

        // --- Physics Colliders and Overlaps ---
        if (this.groundGroup && this.groundGroup.getChildren().length > 0) {
            const groundChildren = this.groundGroup.getChildren();
            this.physics.add.collider(this.player.sprite, groundChildren);
            this.bots.forEach(bot => {
                this.physics.add.collider(bot.sprite, groundChildren);
            });
            
            // Add ground colliders for remote players in multiplayer
            if (this.isMultiplayer) {
                Object.values(this.remotePlayers).forEach(remotePlayer => {
                    if (remotePlayer.sprite) {
                        this.physics.add.collider(remotePlayer.sprite, groundChildren);
                    }
                });
            }
            // Player and Bot ground colliders configured
        } else {
            console.error("GameScene: Ground group is empty or not found, cannot set collider with groundGroup!");
        }

        this.physics.add.collider(this.player.sprite, this.wallsGroup, (playerSprite, wall) => {
            playerSprite.playerInstance.onHitObstacle(wall);
        }, null, this);
        this.bots.forEach(bot => {
            this.physics.add.collider(bot.sprite, this.wallsGroup, (botSprite, wall) => {
                botSprite.botInstance.onHitObstacle(wall);
            }, null, this);
        });
        
        // Add wall colliders for remote players in multiplayer
        if (this.isMultiplayer) {
            Object.values(this.remotePlayers).forEach(remotePlayer => {
                if (remotePlayer.sprite) {
                    this.physics.add.collider(remotePlayer.sprite, this.wallsGroup);
                }
            });
        }

        // Moving Obstacles Collisions
        this.physics.add.collider(this.player.sprite, this.movingObstaclesGroup, (playerSprite, platform) => {
            // For moving platforms, we can either land on them or hit them
            // If player is above the platform, it's a landing, otherwise it's an obstacle hit
            const playerBottom = playerSprite.body.bottom;
            const platformTop = platform.body.top;
            
            if (playerBottom <= platformTop + 15) {
                // Player is landing on or standing on platform - allow standing
                // Ensure player doesn't sink into the platform
                if (playerBottom > platformTop) {
                    playerSprite.y = platformTop - (playerSprite.body.height / 2);
                    playerSprite.body.updateFromGameObject();
                }
                
                // Track platform contact for jump detection
                const playerInstance = playerSprite.playerInstance;
                playerInstance.standingOnPlatform = platform;
                playerInstance.platformContactTime = this.time.now;
                
                // This collision will naturally stop the player from falling through
                console.log(`🔗 Player standing on moving platform at (${platform.x.toFixed(1)}, ${platform.y.toFixed(1)})`);
            } else {
                // Player hit the side of a moving platform
                playerSprite.playerInstance.onHitObstacle(platform);
            }
        }, null, this);
        
        this.bots.forEach(bot => {
            this.physics.add.collider(bot.sprite, this.movingObstaclesGroup, (botSprite, platform) => {
                // Same logic for bots
                if (botSprite.body.bottom <= platform.body.top + 10) {
                    // Bot is landing on platform
                } else {
                    // Bot hit the side of a moving platform
                    botSprite.botInstance.onHitObstacle(platform);
                }
            }, null, this);
        });

        // Mystery Box Collection - boxes stay active and give powerups to all characters
        this.physics.add.overlap(this.player.sprite, this.powerupsGroup, (playerSprite, mysteryBox) => {
            if (!mysteryBox.active) return;
            
            // Add cooldown to prevent same character from spamming the same box
            const currentTime = this.time.now;
            const characterId = 'player';
            const lastCollectTime = mysteryBox.getData(`lastCollect_${characterId}`) || 0;
            
            if (currentTime - lastCollectTime < 1000) return; // 1 second cooldown
            
            const randomPowerup = getRandomPowerup();
            playerSprite.playerInstance.collectPowerup(randomPowerup);
            mysteryBox.setData(`lastCollect_${characterId}`, currentTime);
            
            // Mystery box stays active for other characters to use
        }, null, this);

        this.bots.forEach((bot, index) => {
            this.physics.add.overlap(bot.sprite, this.powerupsGroup, (botSprite, mysteryBox) => {
                if (!mysteryBox.active) return;
                
                // Add cooldown to prevent same bot from spamming the same box
                const currentTime = this.time.now;
                const characterId = `bot_${index}`;
                const lastCollectTime = mysteryBox.getData(`lastCollect_${characterId}`) || 0;
                
                if (currentTime - lastCollectTime < 1000) return; // 1 second cooldown
                
                const randomPowerup = getRandomPowerup();
                botSprite.botInstance.collectPowerup(randomPowerup);
                mysteryBox.setData(`lastCollect_${characterId}`, currentTime);
                
                // Mystery box stays active for other characters to use
            }, null, this);
        });
        
        // Add powerup collection for remote players in multiplayer
        if (this.isMultiplayer) {
            Object.entries(this.remotePlayers).forEach(([uid, remotePlayer]) => {
                if (remotePlayer.sprite) {
                    this.physics.add.overlap(remotePlayer.sprite, this.powerupsGroup, (remoteSprite, mysteryBox) => {
                        if (!mysteryBox.active) return;
                        
                        // Add cooldown to prevent same remote player from spamming the same box
                        const currentTime = this.time.now;
                        const characterId = `remote_${uid}`;
                        const lastCollectTime = mysteryBox.getData(`lastCollect_${characterId}`) || 0;
                        
                        if (currentTime - lastCollectTime < 1000) return; // 1 second cooldown
                        
                        const randomPowerup = getRandomPowerup();
                        // For remote players, we'll handle powerup collection through network sync
                        // For now, just mark the collection locally
                        mysteryBox.setData(`lastCollect_${characterId}`, currentTime);
                        console.log(`🎁 Remote player ${remotePlayer.playerData.displayName} collected ${randomPowerup}`);
                        
                        // TODO: Send powerup collection event through network
                        if (this.networkSynchronizer) {
                            this.networkSynchronizer.sendGameEvent({
                                type: 'powerup_collected',
                                playerUid: uid,
                                powerupType: randomPowerup,
                                timestamp: currentTime
                            });
                        }
                    }, null, this);
                }
            });
        }

        // Finish Line
        const finishLineHeight = this.configHeight - GameConfig.FINISH_LINE_HEIGHT_OFFSET;
        // TRACK_WIDTH is already calculated using GameConfig.TRACK_WIDTH_MULTIPLIER
        const finishLineX = (this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER) * GameConfig.FINISH_LINE_X_MULTIPLIER;
        this.finishLine = this.add.rectangle(finishLineX, finishLineHeight / 2, 10, finishLineHeight, 0xffff00);
        this.finishLine.setStrokeStyle(0); // Remove outline
        this.physics.add.existing(this.finishLine, true); // true for static body

        this.physics.add.overlap(this.player.sprite, this.finishLine, () => this.handleCharacterFinish(this.player), null, this);
        this.bots.forEach(bot => {
            this.physics.add.overlap(bot.sprite, this.finishLine, () => this.handleCharacterFinish(bot), null, this);
        });
        
        // Add finish line collision for remote players in multiplayer
        if (this.isMultiplayer) {
            Object.values(this.remotePlayers).forEach(remotePlayer => {
                if (remotePlayer.sprite) {
                    this.physics.add.overlap(remotePlayer.sprite, this.finishLine, () => {
                        console.log(`🏁 Remote player ${remotePlayer.playerData.displayName} finished!`);
                        // Handle remote player finish through network sync
                        if (this.networkSynchronizer) {
                            this.networkSynchronizer.sendGameEvent({
                                type: 'character_finished',
                                playerUid: remotePlayer.playerData.uid,
                                timestamp: Date.now()
                            });
                        }
                    }, null, this);
                }
            });
        }
        
        // Camera Setup
        // TRACK_WIDTH is already calculated above using GameConfig.TRACK_WIDTH_MULTIPLIER
        this.physics.world.setBounds(0, 0, this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER, this.configHeight);
        this.cameras.main.setBounds(0, 0, this.configWidth * GameConfig.TRACK_WIDTH_MULTIPLIER, this.configHeight);
        this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);

        // Input cursors
        this.cursors = this.input.keyboard.createCursorKeys();
        // R key for restart is primarily for GameOverScene, but can be listened to here for debugging if needed.
        // this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

        // The game effectively starts as soon as this scene is created.
        // MainMenuScene handles the "Press SPACE to start"
        // this.gameStarted = true; 
        
        // Start movement after a small delay to ensure physics bodies are fully set up
        // this.time.delayedCall(100, () => {
        //     console.log("Starting player and bot movement");
        //     if (this.player && this.player.sprite && this.player.sprite.body) {
        //         this.player.sprite.body.setVelocityX(this.player.currentSpeed);
        //     }
        //     this.bots.forEach(bot => {
        //         if (bot && bot.sprite && bot.sprite.body) {
        //             bot.sprite.body.setVelocityX(bot.currentSpeed);
        //         }
        //     });
        // });

        // Countdown Text
        this.countdownText = this.add.text(this.configWidth / 2, this.configHeight / 2, '', { 
            fontFamily: 'Arial Black', 
            fontSize: '128px', 
            color: '#ffff00', 
            stroke: '#000000', 
            strokeThickness: 8,
            align: 'center' 
        }).setOrigin(0.5).setScrollFactor(0); // Centered and fixed to camera

        this.startCountdown();

        // --- Event Listener for Power-up Deployment from UIScene ---
        this.events.on('deployPlayerPowerup', () => {
            if (this.player && !this.gameOver && this.gameStarted) {
                const deployed = this.player.deployCollectedPowerup();
                if (deployed) {
                    // Player power-up deployed via UI
                    // Potentially play a sound effect for power-up deployment here
                }
            }
        }, this);

        // Ensure listener is removed on shutdown
        this.events.on(Phaser.Events.SHUTDOWN, () => {
            this.events.off('deployPlayerPowerup', undefined, this);
        }, this);
    }

    startCountdown() {
        this.gameStarted = false; // Ensure game logic doesn't run
        this.countdownValue = 3; // Reset countdown value
        this.countdownText.setText(this.countdownValue.toString()).setVisible(true);

        // Ensure player and bots are stationary
        if (this.player && this.player.sprite && this.player.sprite.body) {
            this.player.sprite.body.setVelocityX(0);
            this.player.sprite.anims.stop(); // Stop animation
        }
        this.bots.forEach(bot => {
            if (bot && bot.sprite && bot.sprite.body) {
                bot.sprite.body.setVelocityX(0);
                bot.sprite.anims.stop(); // Stop animation
            }
        });
        
        // Ensure remote players are stationary during countdown
        if (this.isMultiplayer) {
            Object.values(this.remotePlayers).forEach(remotePlayer => {
                if (remotePlayer.sprite && remotePlayer.sprite.body) {
                    remotePlayer.sprite.body.setVelocityX(0);
                    if (remotePlayer.sprite.anims) {
                        remotePlayer.sprite.anims.stop();
                    }
                }
            });
        }
        
        if (this.countdownTimer) {
            this.countdownTimer.remove(false); // Remove existing timer if any
        }
        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: this.updateCountdown,
            callbackScope: this,
            loop: true
        });
    }

    updateCountdown() {
        this.countdownValue--;

        if (this.countdownValue > 0) {
            this.countdownText.setText(this.countdownValue.toString());
        } else if (this.countdownValue === 0) {
            this.countdownText.setText('GO!');
        } else { // countdownValue < 0, means GO! was shown, now start game
            if (this.countdownTimer) {
                this.countdownTimer.remove(false);
                this.countdownTimer = null;
            }
            this.startGamePlay();
        }
    }

    startGamePlay() {
        if (this.gameStarted) return; // Prevent multiple starts

        this.gameStarted = true;
        this.countdownText.setVisible(false);

        // Starting player and bot movement
        if (this.player && this.player.sprite && this.player.sprite.body) {
            this.player.startMoving(); // Use method from Player class
        }
        this.bots.forEach(bot => {
            if (bot && bot.sprite && bot.sprite.body) {
                bot.startMoving(); // Use method from Bot class
            }
        });
        
        // Start remote players movement in multiplayer
        if (this.isMultiplayer) {
            Object.values(this.remotePlayers).forEach(remotePlayer => {
                if (remotePlayer.sprite && remotePlayer.sprite.body) {
                    remotePlayer.sprite.body.setVelocityX(GameConfig.PLAYER_SPEED_NORMAL);
                    if (remotePlayer.sprite.anims) {
                        remotePlayer.sprite.anims.play("player_run_anim", true);
                    }
                }
            });
        }
    }

    // Generic finish handler (moved into GameScene) - UPDATED FOR PODIUM SYSTEM
    handleCharacterFinish(characterInstance) {
        if (this.gameOver) return; // Already over

        const isPlayer = (characterInstance === this.player);
        let characterName;
        let hasAlreadyFinished = false;

        if (isPlayer) {
            characterName = "Player";
            hasAlreadyFinished = this.isPlayerActuallyFinished;
            if (!hasAlreadyFinished) {
                this.isPlayerActuallyFinished = true;
                characterInstance.onFinish(); // Call method on Player instance
            }
        } else { // It's a bot
            characterName = characterInstance.botId; // e.g., "Bot 1", "Bot 2", etc.
            hasAlreadyFinished = characterInstance.isFinished;
            if (!hasAlreadyFinished) {
                characterInstance.onFinish(); // Call method on Bot instance (sets internal isFinished flag)
                this.botsFinishedCount++;
            }
        }

        // Add to finishers array if not already finished
        if (!hasAlreadyFinished) {
            const finishTime = this.time.now;
            const finishPosition = this.finishers.length + 1;
            
            this.finishers.push({
                name: characterName,
                character: characterInstance,
                position: finishPosition,
                time: finishTime,
                isPlayer: isPlayer
            });

            console.log(`🏁 ${characterName} finished in position ${finishPosition}!`);
            
            // Show position feedback to player (temporary text)
            const positionText = ['🥇 1st Place!', '🥈 2nd Place!', '🥉 3rd Place!'][finishPosition - 1] || `${finishPosition}th Place!`;
            const finishFeedback = this.add.text(
                this.cameras.main.scrollX + this.configWidth / 2, 
                this.cameras.main.scrollY + 100, 
                `${characterName}: ${positionText}`, 
                { 
                    fontFamily: 'Arial Black', 
                    fontSize: '32px', 
                    color: '#ffff00', 
                    stroke: '#000000', 
                    strokeThickness: 4,
                    align: 'center' 
                }
            ).setOrigin(0.5).setScrollFactor(0);

            // Remove feedback text after 3 seconds
            this.time.delayedCall(3000, () => {
                if (finishFeedback) {
                    finishFeedback.destroy();
                }
            });
        }

        // Check if we have enough finishers to end the game
        if (this.finishers.length >= this.finishersNeeded && !this.gameOver) {
            this.gameOver = true;
            
            console.log("🏆 Race Complete! Top 3 finishers:");
            this.finishers.forEach((finisher, index) => {
                console.log(`   ${index + 1}. ${finisher.name}`);
            });

            // Stop camera following
            this.cameras.main.stopFollow();
            
            // Stop UI scene and transition to podium scene
            this.scene.stop('UIScene');
            this.scene.start('GameOverScene', { 
                finishers: this.finishers,
                totalRacers: 1 + this.bots.length // Player + bots
            });
        }
    }

    // Trap monitoring system
    activateTrapsMonitoring() {
        if (!this.trapMonitoringActive) {
            this.trapMonitoringActive = true;
            console.log('💣 Trap monitoring system activated');
        }
    }

    // Shuriken monitoring system
    activateShurikenMonitoring() {
        if (!this.shurikenMonitoringActive) {
            this.shurikenMonitoringActive = true;
            console.log('🌟 Shuriken monitoring system activated');
        }
    }

    checkTrapsBlastRadius(time) {
        if (!this.traps || !this.trapMonitoringActive) return;

        const activeTrapChildren = this.traps.getChildren().filter(trap => trap.active && trap.getData('isArmed'));
        
        activeTrapChildren.forEach(trap => {
            const deploymentTime = trap.getData('deploymentTime');
            const timeSinceDeployment = time - deploymentTime;
            
            // Detonate after 2 seconds (2000ms)
            if (timeSinceDeployment >= 2000) {
                this.triggerTrapBlast(trap);
            }
        });
    }

    triggerTrapBlast(trap) {
        if (!trap.getData('isArmed')) return; // Already triggered
        
        const deployedBy = trap.getData('deployedBy') || 'Unknown';
        
        console.log(`💥 Trap deployed by ${deployedBy} exploded after 2 seconds!`);
        
        // Disarm the trap
        trap.setData('isArmed', false);
        
        // Find all characters within blast radius (100 pixels)
        const trapX = trap.x;
        const trapY = trap.y;
        const blastRadius = 100;
        
        const charactersToCheck = [this.player, ...this.bots].filter(char => 
            char && char.sprite && char.sprite.active && !char.isFalling && !char.isBlasted
        );
        
        const charactersHit = [];
        charactersToCheck.forEach(character => {
            const distance = Phaser.Math.Distance.Between(
                character.sprite.x, character.sprite.y,
                trapX, trapY
            );
            
            if (distance <= blastRadius) {
                charactersHit.push(character);
            }
        });
        
        // Play blast animation with error checking
        if (this.anims.exists('trap_lighting')) {
            trap.play('trap_lighting');
            trap.once('animationcomplete', () => {
                if (this.anims.exists('blast_anim')) {
                    trap.play('blast_anim');
                    trap.once('animationcomplete', () => {
                        // Remove trap after blast animation
                        if (trap && trap.active) {
                            trap.destroy();
                        }
                    });
                } else {
                    console.warn('blast_anim animation not found');
                    if (trap && trap.active) {
                        trap.destroy();
                    }
                }
            });
        } else {
            console.warn('trap_lighting animation not found');
            // Skip animations and just destroy the trap
            if (trap && trap.active) {
                trap.destroy();
            }
        }
        
        // Apply blast effect to all hit characters
        charactersHit.forEach(character => {
            this.blastOffCharacter(character);
        });
        
        // Add visual effects
        this.cameras.main.flash(150, 255, 128, 0); // Orange flash
        this.shakeCamera(0.05, 300); // Strong shake for explosions
    }

    blastOffCharacter(character) {
        if (character.isBlasted) return; // Already blasted
        
        // Check if character has shield protection
        if (character.checkShieldProtection && character.checkShieldProtection('bomb')) {
            console.log(`💥 Bomb blast blocked by ${character.name || (character.botId ? `Bot ${character.botId}` : 'Player')}'s shield!`);
            return; // Shield blocked the attack
        }
        
        const characterName = character.name || (character.botId ? `Bot ${character.botId}` : 'Player');
        console.log(`💥 ${characterName} has been blasted off! Will respawn in 2 seconds.`);
        
        // Mark as blasted
        character.isBlasted = true;
        
        // Stop character movement completely
        character.sprite.body.setVelocity(0, 0);
        character.sprite.body.setAcceleration(0, 0);
        character.sprite.body.setEnable(false); // Disable physics body so they can't move
        
        // Try to implement split-in-half animation effect for bomb blast
        try {
            this.createBlastSplitDeathEffect(character);
        } catch (error) {
            console.log('Split animation not available, using simple disappear effect');
            // Fallback: Just make character completely invisible
            character.sprite.setVisible(false);
            if (character.nameTag) character.nameTag.setVisible(false);
        }
        
        // Revive after 2 seconds
        this.time.delayedCall(2000, () => {
            this.respawnCharacterFromGround(character);
        });
    }

    createBlastSplitDeathEffect(character) {
        // Create two halves of the character sprite for blast split effect
        const sprite = character.sprite;
        const spriteTexture = sprite.texture.key;
        
        // Get sprite dimensions
        const width = sprite.width;
        const height = sprite.height;
        
        // Create left half with more violent blast effect
        const leftHalf = this.add.image(sprite.x - width/4, sprite.y, spriteTexture);
        leftHalf.setOrigin(0.5, 0.5);
        leftHalf.setScale(sprite.scaleX, sprite.scaleY);
        leftHalf.setCrop(0, 0, width/2, height); // Show left half only
        leftHalf.setDepth(sprite.depth);
        
        // Create right half with more violent blast effect
        const rightHalf = this.add.image(sprite.x + width/4, sprite.y, spriteTexture);
        rightHalf.setOrigin(0.5, 0.5);
        rightHalf.setScale(sprite.scaleX, sprite.scaleY);
        rightHalf.setCrop(width/2, 0, width/2, height); // Show right half only
        rightHalf.setDepth(sprite.depth);
        
        // Hide original sprite
        sprite.setVisible(false);
        if (character.nameTag) character.nameTag.setVisible(false);
        
        // Apply blast knockback effect to halves - more violent than shuriken
        const blastForceX = Phaser.Math.Between(-300, 300);
        const blastForceY = -400; // Stronger upward force for bomb
        
        // Animate left half with more violent motion
        this.tweens.add({
            targets: leftHalf,
            x: leftHalf.x - 80, // Further apart than shuriken
            y: leftHalf.y + 150,
            rotation: -1.0, // More rotation for violent effect
            alpha: 0,
            scaleX: { from: 1, to: 0.3 }, // Shrink as it flies away
            scaleY: { from: 1, to: 0.3 },
            duration: 1200, // Slightly longer for bomb blast
            ease: 'Quad.easeIn',
            onComplete: () => {
                leftHalf.destroy();
            }
        });
        
        // Animate right half with more violent motion
        this.tweens.add({
            targets: rightHalf,
            x: rightHalf.x + 80, // Further apart than shuriken
            y: rightHalf.y + 150,
            rotation: 1.0, // More rotation for violent effect
            alpha: 0,
            scaleX: { from: 1, to: 0.3 }, // Shrink as it flies away
            scaleY: { from: 1, to: 0.3 },
            duration: 1200, // Slightly longer for bomb blast
            ease: 'Quad.easeIn',
            onComplete: () => {
                rightHalf.destroy();
            }
        });
        
        // Add dramatic visual effects for bomb blast
        this.cameras.main.flash(200, 255, 128, 0); // Orange/yellow flash for explosion
        
        // Create explosion particle effect (simple circle particles)
        for (let i = 0; i < 8; i++) {
            const particle = this.add.circle(sprite.x, sprite.y, Phaser.Math.Between(3, 8), 0xff4400);
            particle.setDepth(sprite.depth + 1);
            
            const angle = (i / 8) * Math.PI * 2;
            const force = Phaser.Math.Between(100, 200);
            
            this.tweens.add({
                targets: particle,
                x: sprite.x + Math.cos(angle) * force,
                y: sprite.y + Math.sin(angle) * force,
                alpha: 0,
                duration: 800,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }

    reviveCharacter(character) {
        if (!character.sprite || !character.sprite.active) return;
        
        const characterName = character.name || (character.botId ? `Bot ${character.botId}` : 'Player');
        console.log(`✨ ${characterName} has been revived!`);
        
        // Remove blasted state
        character.isBlasted = false;
        character.isFalling = false;
        
        // Re-enable physics body (in case it was disabled)
        character.sprite.body.setEnable(true);
        
        // Restore visibility
        character.sprite.setVisible(true);
        if (character.nameTag) character.nameTag.setVisible(true);
        
        this.tweens.add({
            targets: character.sprite,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
        
        // Remove blast glow
        character.removeGlow();
        
        // Position character on ground (prevent falling through)
        character.sprite.y = this.groundTopY - (character.sprite.height / 2);
        character.sprite.body.setVelocity(0, 0);
        
        // Restore normal movement
        if (character === this.player) {
            character.startMoving();
        } else {
            character.startMoving();
        }
        
        console.log(`🏃 ${characterName} is back in the race!`);
    }

    update(time, delta) {
        if (!this.gameStarted || this.gameOver) { // Added !this.gameStarted check
            // Stop all characters if game is not started or over
            if (this.player && this.player.sprite.body) {
                this.player.sprite.body.setVelocityX(0);
            }
            this.bots.forEach(bot => {
                if (bot && bot.sprite.body) {
                    bot.sprite.body.setVelocityX(0);
                }
            });
            // Transition to GameOverScene (already handled by playerWon being set)
            return;
        }

        // Start Game Logic
        if (!this.gameStarted) {
            // This logic is now mostly handled by MainMenuScene
            // For safety, ensure characters don't move if game hasn't "started" according to this scene
            return;
        }

        // Player Update
        if (this.player && this.player.sprite.active) { // Check if sprite is active
            this.player.update(this.cursors, this.trackSegments, this.wallsGroup, this.fallDeathY, this.groundTopY);
        }

        // Bot Updates
        this.bots.forEach(bot => {
            if (bot && bot.sprite.active) { // Check if sprite is active
                bot.update(); // General update for movement, animations, glow
                // AI decisions based on environment and bot's specific parameters
                bot.updateAI(this.trackSegments, this.wallsGroup, this.movingObstaclesGroup, GameConfig.BOT_JUMP_LOOKAHEAD_WALL, GameConfig.BOT_JUMP_LOOKAHEAD_GAP);
            }
        });

        // Update platform powerups to follow their platforms
        updatePlatformPowerups(this.powerupsGroup);

        // Check trap timers periodically for detonation
        if (time - this.lastTrapCheck > this.trapCheckInterval) {
            this.checkTrapsBlastRadius(time);
            this.lastTrapCheck = time;
        }

        // Check shuriken collisions every frame
        if (time - this.lastShurikenCheck > this.shurikenCheckInterval) {
            this.checkShurikenCollisions(time);
            this.lastShurikenCheck = time;
        }

        // Multiplayer synchronization
        this.updateMultiplayer(time, delta);

        // Position Tracking
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
        this.bots.forEach(bot => {
            if (bot && !bot.isFalling && bot.sprite.y > this.fallDeathY) {
                bot.onFall();
                // Removed game over logic: Bot will respawn via Bot.onFall()
                //  if (!this.gameOver) {
                //     console.log("Bot fell. Player wins.");
                //     this.gameOver = true;
                //     this.playerWon = 'Player';
                //     this.scene.stop('UIScene');
                //     this.scene.start('GameOverScene', { winner: 'Player' });
                // }
            }
        });
        
    }

    // Add screen shake function
    shakeCamera(intensity = 0.01, duration = 100) {
        if (!this.cameras || !this.cameras.main) return;
        
        this.cameras.main.shake(duration, intensity);
    }

    // Scene shutdown cleanup
    shutdown() {
        // Cleaning up scene resources
        if (this.player && typeof this.player.destroy === 'function') {
            this.player.destroy();
            this.player = null;
        }
        this.bots.forEach(bot => {
            if (bot && typeof bot.destroy === 'function') {
                bot.destroy();
            }
        });
        this.bots = [];

        if (this.countdownTimer) {
            this.countdownTimer.remove(false);
            this.countdownTimer = null;
        }
        
        // Clean up trap system
        if (this.traps) {
            this.traps.clear(true, true);
            this.traps = null;
        }
        this.trapMonitoringActive = false;
        
        // Clean up shuriken system
        if (this.shurikens) {
            this.shurikens.clear(true, true);
            this.shurikens = null;
        }
        this.shurikenMonitoringActive = false;

        // Clean up multiplayer
        if (this.networkSynchronizer) {
            this.networkSynchronizer.stopSynchronization();
            this.networkSynchronizer = null;
        }
        
        // Clean up remote players
        Object.values(this.remotePlayers).forEach(remotePlayer => {
            if (remotePlayer.sprite) remotePlayer.sprite.destroy();
            if (remotePlayer.nameTag) remotePlayer.nameTag.destroy();
        });
        this.remotePlayers = {};

        // Other group cleanups if necessary (Phaser usually handles children of groups)
        // this.groundGroup.destroy(true); // Example, if not automatically handled or if children need specific cleanup
        // this.wallsGroup.destroy(true);
        // this.powerupsGroup.destroy(true);

        // It's good practice to remove event listeners if any were added manually to scene events
        // this.events.off('shutdown', this.shutdown, this); // This one is tricky, as it's removing itself.
                                                              // The one added above for deployPlayerPowerup is safer.
    }

    checkShurikenCollisions(time) {
        if (!this.shurikens || !this.shurikenMonitoringActive) return;

        const activeShurikens = this.shurikens.getChildren().filter(shuriken => shuriken.active);
        
        activeShurikens.forEach(shuriken => {
            const hasReflected = shuriken.getData('hasReflected');
            const hasHitCharacter = shuriken.getData('hasHitCharacter');
            const direction = shuriken.getData('direction');
            const rotationSpeed = shuriken.getData('rotationSpeed') || 0.3;
            
            // Update rotation for spinning effect
            shuriken.rotation += rotationSpeed;
            
            // Check for character collisions first
            const charactersToCheck = [this.player, ...this.bots].filter(char => 
                char && char.sprite && char.sprite.active && !char.isFalling && !char.isBlasted
            );
            
            let hitCharacter = false;
            charactersToCheck.forEach(character => {
                const distance = Phaser.Math.Distance.Between(
                    character.sprite.x, character.sprite.y,
                    shuriken.x, shuriken.y
                );
                
                // Check collision with 40 pixel radius
                if (distance <= 40) {
                    this.shurikenHitCharacter(shuriken, character);
                    hitCharacter = true;
                }
            });
            
            // If hit a character, destroy shuriken and don't check walls
            if (hitCharacter) {
                return;
            }
            
            // Check for wall collisions only if hasn't hit a character yet
            if (!hasHitCharacter) {
                // Check collision with walls
                if (this.wallsGroup) {
                    this.wallsGroup.getChildren().forEach(wall => {
                        if (wall.active && wall.body) {
                            const distance = Phaser.Math.Distance.Between(
                                wall.x, wall.y,
                                shuriken.x, shuriken.y
                            );
                            
                            // Check collision with wall (30 pixel radius)
                            if (distance <= 30) {
                                this.shurikenHitWall(shuriken, wall);
                            }
                        }
                    });
                }
                
                // Check world bounds for reflection
                if (shuriken.x <= 20 && direction === -1) {
                    // Hit left world bound, reflect right
                    this.shurikenReflect(shuriken, 1);
                } else if (shuriken.x >= this.physics.world.bounds.width - 20 && direction === 1) {
                    // Hit right world bound, reflect left
                    this.shurikenReflect(shuriken, -1);
                }
                
                // Check if shuriken has completed its cycle (reflected and traveled back)
                if (hasReflected) {
                    // If traveling left and has reflected, check if it's gone far enough
                    if (direction === -1 && shuriken.x <= 100) {
                        this.destroyShuriken(shuriken, 'completed cycle');
                    }
                    // If traveling right and has reflected, check if it's gone far enough
                    else if (direction === 1 && shuriken.x >= this.physics.world.bounds.width - 100) {
                        this.destroyShuriken(shuriken, 'completed cycle');
                    }
                }
            }
        });
    }

    shurikenHitCharacter(shuriken, character) {
        const deployedBy = shuriken.getData('deployedBy') || 'Unknown';
        const characterName = character.name || (character.botId ? `Bot ${character.botId}` : 'Player');
        
        console.log(`🌟 ${characterName} was hit by shuriken deployed by ${deployedBy}!`);
        
        // Mark that this shuriken has hit a character
        shuriken.setData('hasHitCharacter', true);
        
        // Kill the character (they will revive in 2 seconds)
        this.shurikenKillCharacter(character);
        
        // Destroy the shuriken immediately when it hits someone
        this.destroyShuriken(shuriken, 'hit character');
    }

    shurikenHitWall(shuriken, wall) {
        const hasReflected = shuriken.getData('hasReflected');
        const hasHitCharacter = shuriken.getData('hasHitCharacter');
        
        // If already hit a character, don't reflect - just destroy
        if (hasHitCharacter) {
            this.destroyShuriken(shuriken, 'hit wall after character');
            return;
        }
        
        // If hasn't reflected yet, reflect off the wall
        if (!hasReflected) {
            const currentDirection = shuriken.getData('direction');
            this.shurikenReflect(shuriken, -currentDirection);
            console.log(`🌟 Shuriken reflected off wall! New direction: ${-currentDirection}`);
        } else {
            // If already reflected, destroy the shuriken
            this.destroyShuriken(shuriken, 'hit wall after reflection');
        }
    }

    shurikenReflect(shuriken, newDirection) {
        shuriken.setData('hasReflected', true);
        shuriken.setData('direction', newDirection);
        shuriken.body.setVelocityX(400 * newDirection); // Same speed, opposite direction
        
        // Add visual effect for reflection
        if (this.shakeCamera) {
            this.shakeCamera(0.01, 100);
        }
    }

    shurikenKillCharacter(character) {
        if (character.isBlasted) return; // Already killed
        
        // Check if character has shield protection
        if (character.checkShieldProtection && character.checkShieldProtection('shuriken')) {
            console.log(`🌟 Shuriken attack blocked by ${character.name || (character.botId ? `Bot ${character.botId}` : 'Player')}'s shield!`);
            return; // Shield blocked the attack
        }
        
        const characterName = character.name || (character.botId ? `Bot ${character.botId}` : 'Player');
        console.log(`💀 ${characterName} was killed by shuriken! Will respawn in 2 seconds.`);
        
        // Mark as killed
        character.isBlasted = true;
        
        // Stop character movement completely
        character.sprite.body.setVelocity(0, 0);
        character.sprite.body.setAcceleration(0, 0);
        character.sprite.body.setEnable(false); // Disable physics body so they can't move
        
        // Try to implement split-in-half animation effect
        try {
            this.createSplitDeathEffect(character);
        } catch (error) {
            console.log('Split animation not available, using simple disappear effect');
            // Fallback: Just make character completely invisible
            character.sprite.setVisible(false);
            if (character.nameTag) character.nameTag.setVisible(false);
        }
        
        // Revive after 2 seconds
        this.time.delayedCall(2000, () => {
            this.respawnCharacterFromGround(character);
        });
    }

    createSplitDeathEffect(character) {
        // Create two halves of the character sprite for split effect
        const sprite = character.sprite;
        const spriteTexture = sprite.texture.key;
        
        // Get sprite dimensions
        const width = sprite.width;
        const height = sprite.height;
        
        // Create left half
        const leftHalf = this.add.image(sprite.x - width/4, sprite.y, spriteTexture);
        leftHalf.setOrigin(0.5, 0.5);
        leftHalf.setScale(sprite.scaleX, sprite.scaleY);
        leftHalf.setCrop(0, 0, width/2, height); // Show left half only
        leftHalf.setDepth(sprite.depth);
        
        // Create right half
        const rightHalf = this.add.image(sprite.x + width/4, sprite.y, spriteTexture);
        rightHalf.setOrigin(0.5, 0.5);
        rightHalf.setScale(sprite.scaleX, sprite.scaleY);
        rightHalf.setCrop(width/2, 0, width/2, height); // Show right half only
        rightHalf.setDepth(sprite.depth);
        
        // Hide original sprite
        sprite.setVisible(false);
        if (character.nameTag) character.nameTag.setVisible(false);
        
        // Animate halves splitting apart and falling
        this.tweens.add({
            targets: leftHalf,
            x: leftHalf.x - 50,
            y: leftHalf.y + 100,
            rotation: -0.5,
            alpha: 0,
            duration: 1000,
            ease: 'Quad.easeIn',
            onComplete: () => {
                leftHalf.destroy();
            }
        });
        
        this.tweens.add({
            targets: rightHalf,
            x: rightHalf.x + 50,
            y: rightHalf.y + 100,
            rotation: 0.5,
            alpha: 0,
            duration: 1000,
            ease: 'Quad.easeIn',
            onComplete: () => {
                rightHalf.destroy();
            }
        });
        
        // Add some particle effects for dramatic effect
        this.cameras.main.flash(100, 255, 0, 0); // Red flash
    }

    respawnCharacterFromGround(character) {
        if (!character.sprite || !character.sprite.scene) return; // Character was destroyed
        
        const characterName = character.name || (character.botId ? `Bot ${character.botId}` : 'Player');
        console.log(`✨ ${characterName} is respawning from the ground!`);
        
        // Remove killed state
        character.isBlasted = false;
        character.isFalling = false;
        
        // Find a safe respawn position on the ground
        let respawnX = character.lastSafeX || character.sprite.x;
        if (character.lastSafeGroundSegment && character.sprite.body) {
            const buffer = (character.sprite.body.width / 2) + 5;
            respawnX = character.lastSafeGroundSegment.end - buffer;
            respawnX = Math.max(respawnX, character.lastSafeGroundSegment.start + (character.sprite.body.width / 2));
            respawnX = Math.min(respawnX, character.lastSafeGroundSegment.end - (character.sprite.body.width / 2));
        }
        
        // Position character on ground
        character.sprite.setPosition(respawnX, this.groundTopY - (character.sprite.height / 2));
        character.sprite.setVisible(true);
        character.sprite.body.setEnable(true);
        character.sprite.body.setVelocity(0, 0);
        if (character.nameTag) character.nameTag.setVisible(true);
        
        // Remove any death effects
        character.removeGlow();
        
        // Start character moving again
        if (character === this.player) {
            character.startMoving();
        } else {
            character.startMoving();
        }
        
        // Play respawn effect
        this.tweens.add({
            targets: character.sprite,
            alpha: { from: 0.3, to: 1 },
            scaleX: { from: 1.2, to: 1 },
            scaleY: { from: 1.2, to: 1 },
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        console.log(`🏃 ${characterName} is back in the race!`);
    }

    destroyShuriken(shuriken, reason) {
        console.log(`🌟 Shuriken destroyed: ${reason}`);
        if (shuriken && shuriken.active) {
            shuriken.destroy();
        }
    }

    // === MULTIPLAYER METHODS ===

    initializeSinglePlayerBots(characterInitialY) {
        // Original single-player bot creation logic
        const personalities = ['aggressive', 'cautious', 'erratic'];
        console.log('🎭 Creating bots with personalities:', personalities);
        
        for (let i = 0; i < 3; i++) {
            const personality = personalities[i] || 'balanced';
            console.log(`🎯 Creating bot ${i + 1} with personality: ${personality}`);
            
            const bot = new Bot(this, GameConfig.BOT_INITIAL_X + (i * 50), characterInitialY, "bot_run_anim", GameConfig.BOT_SPEED_NORMAL, GameConfig.BOT_SPEED_BOOSTED, GameConfig.JUMP_VELOCITY, i + 1, personality);
            this.bots.push(bot);
        }
    }

    async initializeMultiplayerCharacters(characterInitialY) {
        console.log('🌐 Initializing multiplayer characters...');
        console.log('🏠 Room players:', this.roomPlayers);
        
        // Initialize network synchronizer
        try {
            this.networkSynchronizer = new NetworkSynchronizer();
            await this.networkSynchronizer.startSynchronization(multiplayerManager.roomId);
            
            // Set up network event listeners
            this.networkSynchronizer.onNetworkEvent((eventType, data) => {
                this.handleNetworkEvent(eventType, data);
            });
            
            console.log('🔄 Network synchronization started');
        } catch (error) {
            console.error('❌ Failed to start network sync:', error);
        }
        
        // Create remote player sprites for other players in the room
        const currentPlayerUid = playerAuth.getCurrentUser()?.uid;
        let botIndex = 0;
        
        Object.values(this.roomPlayers).forEach((playerData, index) => {
            if (playerData.uid !== currentPlayerUid) {
                // Create remote player sprite
                const remotePlayer = this.createRemotePlayer(playerData, characterInitialY + (index * 10));
                this.remotePlayers[playerData.uid] = remotePlayer;
                console.log(`👥 Created remote player: ${playerData.displayName}`);
            }
        });
        
        // Fill remaining slots with bots if needed
        const totalPlayers = Object.keys(this.roomPlayers).length;
        const botsNeeded = Math.max(0, 4 - totalPlayers); // Ensure 4 total characters
        
        for (let i = 0; i < botsNeeded; i++) {
            const personality = ['aggressive', 'cautious', 'erratic'][botIndex % 3];
            const bot = new Bot(this, GameConfig.BOT_INITIAL_X + ((totalPlayers + i) * 50), characterInitialY, "bot_run_anim", GameConfig.BOT_SPEED_NORMAL, GameConfig.BOT_SPEED_BOOSTED, GameConfig.JUMP_VELOCITY, botIndex + 1, personality);
            this.bots.push(bot);
            botIndex++;
            console.log(`🤖 Created bot ${botIndex} to fill slot`);
        }
    }

    createRemotePlayer(playerData, yPosition) {
        // Create a sprite for the remote player with proper physics
        const remoteSprite = this.physics.add.sprite(GameConfig.PLAYER_INITIAL_X + 100, yPosition, "player_run_anim");
        remoteSprite.setCollideWorldBounds(true);
        remoteSprite.body.setSize(32, 64);
        remoteSprite.body.setGravityY(400); // Same gravity as other characters
        
        // Set initial movement speed (will be overridden by network sync)
        remoteSprite.body.setVelocityX(GameConfig.PLAYER_SPEED_NORMAL);
        
        // Start running animation
        if (remoteSprite.anims) {
            remoteSprite.anims.play("player_run_anim", true);
        }
        
        // Add name tag
        const nameTag = this.add.text(remoteSprite.x, remoteSprite.y - 40, playerData.displayName, {
            fontSize: '12px',
            fill: '#00ff00', // Green for remote players
            fontFamily: 'Arial'
        }).setOrigin(0.5);
        
        // Store player data
        const remotePlayerData = {
            sprite: remoteSprite,
            nameTag: nameTag,
            playerData: playerData,
            lastUpdate: 0,
            isAlive: true,
            collectedPowerupType: null,
            shieldActive: false
        };
        
        console.log(`👥 Created remote player sprite for ${playerData.displayName} with physics body`);
        
        return remotePlayerData;
    }

    handleNetworkEvent(eventType, data) {
        switch (eventType) {
            case 'players_updated':
                this.updateRemotePlayerPositions(data);
                break;
            case 'game_event':
                this.handleRemoteGameEvent(data);
                break;
            case 'game_starting':
                console.log('🎮 Multiplayer game starting!');
                break;
            case 'game_playing':
                console.log('🏁 Multiplayer game now playing!');
                break;
        }
    }

    updateRemotePlayerPositions(playersData) {
        const currentTime = Date.now();
        
        Object.entries(playersData).forEach(([uid, playerState]) => {
            const remotePlayer = this.remotePlayers[uid];
            if (remotePlayer && playerState && currentTime - playerState.timestamp < 5000) {
                // Update position with interpolation for smooth movement
                this.interpolateRemotePlayer(remotePlayer, playerState);
                remotePlayer.lastUpdate = currentTime;
            }
        });
    }

    interpolateRemotePlayer(remotePlayer, targetState) {
        const sprite = remotePlayer.sprite;
        const nameTag = remotePlayer.nameTag;
        
        // Simple interpolation - move towards target position
        const lerpFactor = 0.3; // Adjust for smoothness vs responsiveness
        
        sprite.x = Phaser.Math.Linear(sprite.x, targetState.x, lerpFactor);
        sprite.y = Phaser.Math.Linear(sprite.y, targetState.y, lerpFactor);
        
        // Update name tag position
        nameTag.x = sprite.x;
        nameTag.y = sprite.y - 40;
        
        // Update animation if provided
        if (targetState.animation && sprite.anims) {
            if (!sprite.anims.isPlaying || sprite.anims.currentAnim.key !== targetState.animation) {
                sprite.anims.play(targetState.animation, true);
            }
        }
        
        // Handle alive/dead state
        if (targetState.isAlive !== undefined) {
            sprite.setVisible(targetState.isAlive);
            nameTag.setVisible(targetState.isAlive);
        }
    }

    handleRemoteGameEvent(eventData) {
        console.log('📡 Received remote game event:', eventData.type);
        
        switch (eventData.type) {
            case 'powerup_collected':
                // Handle remote player collecting powerup
                break;
            case 'powerup_deployed':
                // Handle remote player deploying powerup
                break;
            case 'character_finished':
                // Handle remote player finishing race
                break;
        }
    }

    // Override the update method to include multiplayer sync
    updateMultiplayer(time, delta) {
        if (!this.isMultiplayer || !this.networkSynchronizer) return;
        
        // Sync local player position periodically
        if (time - this.lastNetworkUpdate > 50) { // 20 times per second
            const playerState = {
                x: this.player.sprite.x,
                y: this.player.sprite.y,
                velocityX: this.player.sprite.body.velocity.x,
                velocityY: this.player.sprite.body.velocity.y,
                animation: this.player.sprite.anims.currentAnim?.key || 'idle',
                isAlive: !this.player.isBlasted,
                powerupType: this.player.collectedPowerupType,
                shieldActive: this.player.shieldActive
            };
            
            this.networkSynchronizer.updateLocalPlayerState(playerState);
            this.lastNetworkUpdate = time;
        }
    }
}