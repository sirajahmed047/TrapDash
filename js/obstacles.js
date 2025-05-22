function createGroundAndTrack(scene, trackWidth, groundTopY, groundSegmentHeight) {
    const groundGroup = scene.physics.add.staticGroup();
    const groundSegmentCenterY = groundTopY + groundSegmentHeight / 2;
    const groundColor = 0x888888;

    // Define specific ground segments and gaps
    const trackSegments = [
        { type: 'ground', start: 0, end: 700 }, { type: 'gap', start: 700, end: 810 },
        { type: 'ground', start: 810, end: 1250 }, { type: 'gap', start: 1250, end: 1360 },
        { type: 'ground', start: 1360, end: 2000 }, { type: 'gap', start: 2000, end: 2150 },
        { type: 'ground', start: 2150, end: 2800 }, { type: 'gap', start: 2800, end: 2920 },
        { type: 'ground', start: 2920, end: 3600 }, { type: 'gap', start: 3600, end: 3750 },
        { type: 'ground', start: 3750, end: 4400 }, { type: 'gap', start: 4400, end: 4500 },
        { type: 'ground', start: 4500, end: trackWidth }
    ];

    trackSegments.forEach(seg => {
        if (seg.type === 'ground') {
            const segmentWidth = seg.end - seg.start;
            if (segmentWidth > 0) {
                const groundRect = scene.add.rectangle(seg.start + segmentWidth / 2, groundSegmentCenterY, segmentWidth, groundSegmentHeight, groundColor);
                scene.physics.add.existing(groundRect, true); // Add static physics body
                groundGroup.add(groundRect); // Add to static group
            }
        }
    });

    return { groundGroup, trackSegments };
}

function createWalls(scene, groundTopY) {
    const wallsGroup = scene.physics.add.staticGroup();
    
    // Wall sprite is assumed to be 96px tall, origin center.
    // So wall center Y = groundTopY - (wallHeight / 2).
    const wallHeight = 96; 
    const wallY = groundTopY - (wallHeight / 2);

    const wallPositionsX = [600, 1000, 1400, 2350, 3350, 4300, 5000];

    wallPositionsX.forEach(x => {
        wallsGroup.create(x, wallY, 'wall');
    });

    return wallsGroup;
}

function createMovingObstacles(scene, groundTopY) {
    // Create a dynamic physics group for moving obstacles
    const movingObstaclesGroup = scene.physics.add.group({
        allowGravity: false // Moving obstacles shouldn't be affected by gravity
    });

    // Define moving obstacle data: platforms and their movement patterns
    const movingObstacleData = [
        // Vertical moving platforms
        {
            x: 1500,
            y: groundTopY - 80,
            width: 120,
            height: 20,
            color: 0x8B4513, // Brown color for platform
            moveType: 'vertical',
            distance: 100, // How far it moves
            speed: 80, // Speed of movement
            startDelay: 0
        },
        {
            x: 3200,
            y: groundTopY - 120,
            width: 120,
            height: 20,
            color: 0x8B4513,
            moveType: 'vertical',
            distance: 80,
            speed: 60,
            startDelay: 1000 // 1 second delay
        },
        // Horizontal moving platforms
        {
            x: 2500,
            y: groundTopY - 100,
            width: 80,
            height: 20,
            color: 0x654321, // Darker brown for horizontal platforms
            moveType: 'horizontal',
            distance: 150,
            speed: 100,
            startDelay: 500
        },
        {
            x: 4800,
            y: groundTopY - 60,
            width: 100,
            height: 20,
            color: 0x654321,
            moveType: 'horizontal',
            distance: 200,
            speed: 120,
            startDelay: 0
        }
    ];

    // Create each moving obstacle
    movingObstacleData.forEach((data, index) => {
        // Create the platform as a rectangle
        const platform = scene.add.rectangle(data.x, data.y, data.width, data.height, data.color);
        
        // Add physics body
        scene.physics.add.existing(platform);
        platform.body.setImmovable(true); // Platform shouldn't be pushed by player/bots
        platform.body.moves = false; // We'll handle movement manually
        
        // Store original position and movement data
        platform.originalX = data.x;
        platform.originalY = data.y;
        platform.moveType = data.moveType;
        platform.distance = data.distance;
        platform.speed = data.speed;
        platform.direction = 1; // 1 for positive direction, -1 for negative
        
        // Add to the group
        movingObstaclesGroup.add(platform);
        
        // Start movement after delay
        scene.time.delayedCall(data.startDelay, () => {
            startPlatformMovement(scene, platform);
        });
    });

    return movingObstaclesGroup;
}

function startPlatformMovement(scene, platform) {
    // Create movement tween based on platform type
    if (platform.moveType === 'vertical') {
        // Vertical movement
        scene.tweens.add({
            targets: platform,
            y: platform.originalY - platform.distance,
            duration: (platform.distance / platform.speed) * 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1 // Infinite repeat
        });
    } else if (platform.moveType === 'horizontal') {
        // Horizontal movement
        scene.tweens.add({
            targets: platform,
            x: platform.originalX + platform.distance,
            duration: (platform.distance / platform.speed) * 1000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1 // Infinite repeat
        });
    }
}

// Enhanced obstacle detection for bots (includes moving obstacles)
function detectUpcomingObstacles(character, trackSegments, walls, movingObstacles, lookaheadDistance) {
    const obstacles = [];
    const characterX = character.sprite.x;
    const characterRight = character.sprite.body.right;
    
    // Check walls (existing functionality)
    if (walls) {
        walls.getChildren().forEach(wall => {
            if (wall.active && wall.body) {
                if (wall.body.left > characterRight) {
                    const distance = wall.body.left - characterRight;
                    if (distance > 0 && distance < lookaheadDistance) {
                        obstacles.push({
                            type: 'wall',
                            distance: distance,
                            object: wall,
                            x: wall.body.left,
                            requiresJump: true
                        });
                    }
                }
            }
        });
    }
    
    // Check moving obstacles
    if (movingObstacles) {
        movingObstacles.getChildren().forEach(platform => {
            if (platform.active && platform.body) {
                const platformLeft = platform.body.left;
                const platformRight = platform.body.right;
                const distance = platformLeft - characterRight;
                
                // Check if platform is in lookahead range
                if (distance > 0 && distance < lookaheadDistance) {
                    // For moving platforms, we might want to jump ON them or jump OVER them
                    // depending on their height and position
                    const platformTop = platform.body.top;
                    const characterBottom = character.sprite.body.bottom;
                    
                    // If platform is above character, it might be a platform to land on
                    if (platformTop < characterBottom - 20) {
                        obstacles.push({
                            type: 'moving_platform',
                            distance: distance,
                            object: platform,
                            x: platformLeft,
                            requiresJump: true,
                            isLandingPlatform: true
                        });
                    } else {
                        // Platform might be an obstacle to jump over
                        obstacles.push({
                            type: 'moving_platform',
                            distance: distance,
                            object: platform,
                            x: platformLeft,
                            requiresJump: true,
                            isLandingPlatform: false
                        });
                    }
                }
            }
        });
    }
    
    // Check gaps (existing functionality with enhancement)
    if (trackSegments) {
        let onGroundSegment = null;
        for (const seg of trackSegments) {
            if (seg.type === 'ground' && characterRight > seg.start && character.sprite.body.left < seg.end) {
                onGroundSegment = seg;
                break;
            }
        }
        if (onGroundSegment) {
            const distanceToGapEnd = onGroundSegment.end - characterRight;
            if (distanceToGapEnd > 0 && distanceToGapEnd < lookaheadDistance) {
                obstacles.push({
                    type: 'gap',
                    distance: distanceToGapEnd,
                    object: null,
                    x: onGroundSegment.end,
                    requiresJump: true
                });
            }
        }
    }
    
    // Sort obstacles by distance (closest first)
    obstacles.sort((a, b) => a.distance - b.distance);
    
    return obstacles;
}

// If using ES6 Modules in the future:
// export { createGroundAndTrack, createWalls, createMovingObstacles, startPlatformMovement, detectUpcomingObstacles };
