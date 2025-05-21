// Define power-up locations (x-coordinate) and types
// Y-coordinate will be calculated relative to groundTopY in createPowerups
const POWERUP_DATA = [
    { x: 900, type: 'speed' },
    { x: 1700, type: 'shield' },
    { x: 2600, type: 'speed' },
    { x: 4000, type: 'shield' }
];

function createPowerups(scene, groundTopY) {
    const powerupsGroup = scene.physics.add.group({
        allowGravity: false,
        immovable: true
    });

    const powerupY = groundTopY - 16; // Assumes 32px scaled height (icons are 0.5 scale), origin center

    POWERUP_DATA.forEach(data => {
        const iconKey = (data.type === 'speed') ? "powerupSpeedIconPH" : "powerupShieldIconPH";
        const powerupIcon = powerupsGroup.create(data.x, powerupY, iconKey);
        powerupIcon.setScale(0.5); 
        powerupIcon.setData('type', data.type);
        // Store original position for easy respawn, though x/y are inherent
        powerupIcon.setData('originalX', data.x);
        powerupIcon.setData('originalY', powerupY);
    });

    return powerupsGroup;
}

function initiatePowerupRespawn(scene, powerupIcon) {
    const respawnX = powerupIcon.getData('originalX');
    const respawnY = powerupIcon.getData('originalY');

    scene.time.delayedCall(GameConfig.POWERUP_RESPAWN_DELAY, () => {
        if (powerupIcon && !powerupIcon.active) { // Check if still exists and is inactive
            // Check if another character is currently on the respawn spot (simple bounding box check)
            let canRespawn = true;
            const checkRadius = 16; // Half of a 32px icon
            const respawnBounds = new Phaser.Geom.Rectangle(respawnX - checkRadius, respawnY - checkRadius, checkRadius * 2, checkRadius * 2);

            if (scene.player && scene.player.sprite && scene.player.sprite.active) {
                if (Phaser.Geom.Intersects.RectangleToRectangle(respawnBounds, scene.player.sprite.getBounds())) {
                    canRespawn = false;
                }
            }
            if (canRespawn && scene.bot && scene.bot.sprite && scene.bot.sprite.active) {
                if (Phaser.Geom.Intersects.RectangleToRectangle(respawnBounds, scene.bot.sprite.getBounds())) {
                    canRespawn = false;
                }
            }

            if (canRespawn) {
                powerupIcon.enableBody(true, respawnX, respawnY, true, true);
            } else {
                // If spot is occupied, try again shortly
                scene.time.delayedCall(500, () => {
                     // Re-check before respawning, in case it was collected again or scene changed
                    if (powerupIcon && powerupIcon.scene && !powerupIcon.active ) { 
                        powerupIcon.enableBody(true, respawnX, respawnY, true, true);
                    }
                }, [], scene);
            }
        }
    }, [], scene);
}

// Expose functions if using a module system, otherwise they are global if script-tagged
// For simple script tagging, they become global.
// If using ES6 Modules:
// export { POWERUP_DURATION, POWERUP_RESPAWN_DELAY, POWERUP_DATA, createPowerups, initiatePowerupRespawn };
