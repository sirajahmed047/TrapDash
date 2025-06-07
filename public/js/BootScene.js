class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Load any assets needed for the loading screen or global assets
        // Loading game assets

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

        // Load lightning strike animation
        this.load.spritesheet('lightning_strike', 'assets/images/lightningstrike.png', {
            frameWidth: 64,
            frameHeight: 128 // Lightning is taller, adjust based on your sprite
        });

        // Load droppable trap animation
        this.load.spritesheet('droptrap', 'assets/images/droptrap.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // Load blast effect animation
        this.load.spritesheet('blast', 'assets/images/blast.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // Load shuriken animation (single frame for now - replace with 3x3 grid later)
        this.load.image('shuriken', 'assets/images/shuriken.png');

        console.log('Loading droptrap sprite sheet...');
        console.log('Loading blast sprite sheet...');
        console.log('Loading shuriken sprite sheet...');

        // For example, if you have a logo for a loading bar:
        // this.load.image('logo', 'assets/images/logo.png');
    }

    create() {
        // Creating animations

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

        // Create lightning strike animation
        this.anims.create({
            key: 'lightning_strike_anim',
            frames: this.anims.generateFrameNumbers('lightning_strike', { start: 0, end: 7 }), // Assuming 8 frames (0-7), adjust based on your sprite
            frameRate: 15, // Fast animation for dramatic effect
            repeat: 0 // Play once
        });

        // Create droptrap animations
        this.anims.create({
            key: 'trap_idle',
            frames: this.anims.generateFrameNumbers('droptrap', { start: 0, end: 0 }), // First frame as idle
            frameRate: 1,
            repeat: -1
        });
        console.log('Created trap_idle animation');

        this.anims.create({
            key: 'trap_lighting',
            frames: this.anims.generateFrameNumbers('droptrap', { start: 0, end: 1 }), // Use first 2 frames only
            frameRate: 8,
            repeat: 0
        });
        console.log('Created trap_lighting animation');

        // Create blast animation using new blast.png
        this.anims.create({
            key: 'blast_anim',
            frames: this.anims.generateFrameNumbers('blast', { start: 0, end: 5 }), // Assuming 6 frames (0-5), adjust based on sprite
            frameRate: 15, // Fast blast animation
            repeat: 0 // Play once
        });
        console.log('Created blast_anim animation');

        // Note: Shuriken uses single image (not spritesheet) - rotation handled in physics
        console.log('Shuriken loaded as single frame - rotation handled in game physics');

        // Once assets are loaded, transition to the MainMenuScene
        this.scene.start('MainMenuScene');
    }
} 