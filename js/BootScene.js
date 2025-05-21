class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Load any assets needed for the loading screen or global assets
        // For example, if you have a logo for a loading bar:
        // this.load.image('logo', 'assets/images/logo.png');
    }

    create() {
        // Once assets are loaded, transition to the MainMenuScene
        this.scene.start('MainMenuScene');
    }
} 