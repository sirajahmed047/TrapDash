// MYSTERY BOX PLACEMENT - Each box gives a random powerup when touched
// Y-coordinate will be calculated relative to groundTopY in createPowerups
const MYSTERY_BOX_DATA = [
    // === SECTION 1: Opening Sprint ===
    { x: 750, location: 'ground' },           // Standard ground pickup
    { x: 1000, location: 'platform' },        // ON the moving platform!
    
    // === SECTION 2: First Challenge ===
    { x: 1700, location: 'wall' },            // Near wall (requires jump)
    { x: 2275, location: 'gap' },             // Above the gap (risky but rewarding!)
    
    // === SECTION 3: Moving Platform Valley ===
    { x: 2900, location: 'ground' },          // Before platforms
    { x: 3150, location: 'platform' },        // ON moving platform
    { x: 3750, location: 'platform' },        // ON horizontal platform
    
    // === SECTION 4: Wall Corridor ===
    { x: 4300, location: 'wall' },            // Wall-top pickup
    { x: 4700, location: 'platform' },        // ON vertical platform
    { x: 5000, location: 'wall' },            // Wall pickup
    { x: 5500, location: 'ground' },          // Corridor exit reward
    
    // === SECTION 5: Speed Stretch ===
    { x: 6000, location: 'platform' },        // ON fast platform
    { x: 6200, location: 'wall' },            // Wall jump reward
    { x: 6475, location: 'platform' },        // ON gap platform
    
    // === SECTION 6: Final Challenge ===
    { x: 7050, location: 'wall' },            // Pre-gap protection
    { x: 7275, location: 'platform' },        // ON final platform
    
    // === SECTION 7: Victory Lane ===
    { x: 7900, location: 'platform' }         // Final platform bonus
];

// Available powerup types for random selection
const POWERUP_TYPES = ['speed', 'shield', 'lightning', 'trap', 'shuriken'];

function createPowerups(scene, groundTopY) {
    const powerupsGroup = scene.physics.add.group({
        allowGravity: false,
        immovable: true
    });

    MYSTERY_BOX_DATA.forEach(data => {
        // All mystery boxes use the new mysterybox.png
        const iconKey = "mysteryBox";
        let powerupX = data.x;
        let powerupY;
        
        // Position mystery boxes based on their location type
        switch(data.location) {
            case 'ground':
                powerupY = groundTopY + GameConfig.POWERUP_ICON_Y_OFFSET;
                break;
                
            case 'wall':
                // Place mystery box on top of wall (walls are 96px tall)
                powerupY = groundTopY - 96 - 10; // Wall height + small offset
                break;
                
            case 'platform':
                // These will be positioned relative to their moving platforms
                // We'll handle platform mystery boxes specially after platforms are created
                powerupY = groundTopY - 120; // Temporary height, will be adjusted
                break;
                
            case 'gap':
                // Mystery box floating above gap - risky to collect!
                powerupY = groundTopY - 60;
                break;
                
            default:
                powerupY = groundTopY + GameConfig.POWERUP_ICON_Y_OFFSET;
        }
        
        const mysteryBox = powerupsGroup.create(powerupX, powerupY, iconKey);
        mysteryBox.setScale(0.5);
        mysteryBox.setData('location', data.location);
        mysteryBox.setData('originalX', powerupX);
        mysteryBox.setData('originalY', powerupY);
        
        // Special handling for platform mystery boxes
        if (data.location === 'platform') {
            mysteryBox.setData('platformX', data.x); // Store intended platform X
            mysteryBox.isPlatformPowerup = true;
        }
    });

    return powerupsGroup;
}

// NEW: Function to attach mystery boxes to moving platforms
function attachPowerupsToMovingPlatforms(scene, powerupsGroup, movingObstaclesGroup) {
    if (!powerupsGroup || !movingObstaclesGroup) return;
    
    // Find mystery boxes that should be on platforms
    powerupsGroup.getChildren().forEach(mysteryBox => {
        if (mysteryBox.isPlatformPowerup) {
            const targetPlatformX = mysteryBox.getData('platformX');
            
            // Find the closest moving platform
            let closestPlatform = null;
            let closestDistance = Infinity;
            
            movingObstaclesGroup.getChildren().forEach(platform => {
                const distance = Math.abs(platform.originalX - targetPlatformX);
                if (distance < closestDistance && distance < 100) { // Within 100px
                    closestDistance = distance;
                    closestPlatform = platform;
                }
            });
            
            if (closestPlatform) {
                // Attach mystery box to platform
                mysteryBox.attachedPlatform = closestPlatform;
                mysteryBox.platformOffsetX = mysteryBox.x - closestPlatform.x;
                mysteryBox.platformOffsetY = mysteryBox.y - closestPlatform.y;
                
                // Position mystery box on platform
                mysteryBox.setPosition(
                    closestPlatform.x + mysteryBox.platformOffsetX,
                    closestPlatform.y + mysteryBox.platformOffsetY - 15
                );
            }
        }
    });
}

// NEW: Function to update platform mystery box positions
function updatePlatformPowerups(powerupsGroup) {
    if (!powerupsGroup) return;
    
    powerupsGroup.getChildren().forEach(mysteryBox => {
        if (mysteryBox.attachedPlatform && mysteryBox.active) {
            // Update mystery box position to follow its platform
            mysteryBox.setPosition(
                mysteryBox.attachedPlatform.x + (mysteryBox.platformOffsetX || 0),
                mysteryBox.attachedPlatform.y + (mysteryBox.platformOffsetY || -15)
            );
        }
    });
}

// Function to get a random powerup type from the mystery box
function getRandomPowerup() {
    const randomIndex = Math.floor(Math.random() * POWERUP_TYPES.length);
    return POWERUP_TYPES[randomIndex];
}

// Expose functions if using a module system, otherwise they are global if script-tagged
// For simple script tagging, they become global.
// If using ES6 Modules:
// export { MYSTERY_BOX_DATA, createPowerups, attachPowerupsToMovingPlatforms, updatePlatformPowerups, getRandomPowerup };
