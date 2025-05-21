class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Load any assets needed for the loading screen or global assets
        console.log("BootScene: Preload");

        // Load run animation spritesheet
        this.load.spritesheet('player_run_anim', 'assets/images/player_run_sprite.png', {
            frameWidth: 64, // Updated from placeholder
            frameHeight: 64 // Updated from placeholder
        });

        // Load jump animation spritesheet
        this.load.spritesheet('player_jump_anim', 'assets/images/player_jump_sprite.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // Load bot animations
        this.load.spritesheet('bot_run_anim', 'assets/images/bot_running_sprite.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        this.load.spritesheet('bot_jump_anim', 'assets/images/bot_jump_sprite.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // Load particle effects
        this.load.spritesheet('jump_dust', 'assets/images/jump_dust.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // For example, if you have a logo for a loading bar:
        // this.load.image('logo', 'assets/images/logo.png');
    }

    create() {
        console.log("BootScene: Create");

        // Create player running animation
        this.anims.create({
            key: 'player_running',
            frames: this.anims.generateFrameNumbers('player_run_anim', { start: 0, end: 2 }), // Assuming 3 frames (0-2), VERIFY THIS
            frameRate: GameConfig.PLAYER_ANIM_FRAMERATE,
            repeat: -1 // Loop running animation
        });

        // Create player jumping animation
        this.anims.create({
            key: 'player_jumping',
            frames: this.anims.generateFrameNumbers('player_jump_anim', { start: 0, end: 2 }), // Assuming 3 frames (0-2), VERIFY THIS
            frameRate: GameConfig.PLAYER_ANIM_FRAMERATE,
            repeat: 0  // Play once
        });

        // Create bot running animation
        this.anims.create({
            key: 'bot_running',
            frames: this.anims.generateFrameNumbers('bot_run_anim', { start: 0, end: 2 }), // Assuming 3 frames (0-2), VERIFY THIS
            frameRate: GameConfig.BOT_ANIM_FRAMERATE,
            repeat: -1 // Loop running animation
        });

        // Create bot jumping animation
        this.anims.create({
            key: 'bot_jumping',
            frames: this.anims.generateFrameNumbers('bot_jump_anim', { start: 0, end: 2 }), // Corrected based on error, assuming 3 frames (0-2)
            frameRate: GameConfig.BOT_ANIM_FRAMERATE,
            repeat: 0  // Play once
        });

        // Create jump dust animation
        this.anims.create({
            key: 'jump_dust_anim',
            frames: this.anims.generateFrameNumbers('jump_dust', { start: 0, end: 2 }), // Corrected based on error, assuming 3 frames (0-2)
            frameRate: GameConfig.JUMP_DUST_ANIM_FRAMERATE,
            repeat: 0 // Play once
        });

        // Once assets are loaded, transition to the MainMenuScene
        this.scene.start('MainMenuScene');
    }
} 