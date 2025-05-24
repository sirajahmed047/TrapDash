function createGroundAndTrack(scene, trackWidth, groundTopY, groundSegmentHeight) {
    const groundGroup = scene.physics.add.staticGroup();
    const groundSegmentCenterY = groundTopY + groundSegmentHeight / 2;
    const groundColor = 0x888888;

    // REDESIGNED STRATEGIC TRACK - 8000px long with FEWER gaps, more flow
    const trackSegments = [
        // === SECTION 1: OPENING SPRINT (0-1500) - Continuous ground for momentum ===
        { type: 'ground', start: 0, end: 1500 },
        
        // === SECTION 2: FIRST CHALLENGE (1500-2800) - Single strategic gap ===
        { type: 'ground', start: 1500, end: 2200 },
        { type: 'gap', start: 2200, end: 2350 },      // One meaningful gap
        { type: 'ground', start: 2350, end: 2800 },
        
        // === SECTION 3: MOVING PLATFORM VALLEY (2800-4200) - Platform navigation ===
        { type: 'ground', start: 2800, end: 3000 },
        { type: 'gap', start: 3000, end: 3300 },      // Platform-assisted crossing
        { type: 'ground', start: 3300, end: 3600 },
        { type: 'gap', start: 3600, end: 3900 },      // Another platform crossing
        { type: 'ground', start: 3900, end: 4200 },
        
        // === SECTION 4: WALL CORRIDOR (4200-5800) - Continuous wall challenges ===
        { type: 'ground', start: 4200, end: 5800 },
        
        // === SECTION 5: SPEED STRETCH (5800-7000) - Long continuous section ===
        { type: 'ground', start: 5800, end: 6400 },
        { type: 'gap', start: 6400, end: 6550 },      // One speed gap
        { type: 'ground', start: 6550, end: 7000 },
        
        // === SECTION 6: FINAL CHALLENGE (7000-7600) - Last gap ===
        { type: 'ground', start: 7000, end: 7200 },
        { type: 'gap', start: 7200, end: 7350 },      // Final strategic gap
        { type: 'ground', start: 7350, end: 7600 },
        
        // === SECTION 7: VICTORY LANE (7600-8000) - Final sprint ===
        { type: 'ground', start: 7600, end: trackWidth }
    ];

    trackSegments.forEach(seg => {
        if (seg.type === 'ground') {
            const segmentWidth = seg.end - seg.start;
            if (segmentWidth > 0) {
                const groundRect = scene.add.rectangle(seg.start + segmentWidth / 2, groundSegmentCenterY, segmentWidth, groundSegmentHeight, groundColor);
                groundRect.setStrokeStyle(0); // Remove outline
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

    // STRATEGIC WALL PLACEMENT - More walls, fewer gaps
    const wallPositionsX = [
        // Section 1: Opening Sprint - Build rhythm
        600, 900, 1200,
        
        // Section 2: First Challenge - Pre-gap walls
        1700, 1950, 2450, 2650,
        
        // Section 3: Moving Platform Valley - Platform coordination
        2850, 3450, 4050,
        
        // Section 4: Wall Corridor - Dense wall section (main challenge)
        4400, 4600, 4800, 5000, 5200, 5400, 5600,
        
        // Section 5: Speed Stretch - Spaced for speed
        6000, 6200, 6700, 6900,
        
        // Section 6: Final Challenge - Last wall sequence
        7050, 7400, 7550,
        
        // Section 7: Victory Lane - Final wall
        7850
    ];

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

    // REDESIGNED MOVING PLATFORMS - Better spacing and strategic placement
    const movingObstacleData = [
        // === SECTION 1: Opening Sprint - Learning platform ===
        {
            x: 1000, y: groundTopY - 100, width: 100, height: 20,
            color: 0x8B4513, moveType: 'vertical', distance: 60, speed: 50, startDelay: 0
        },
        
        // === SECTION 3: Moving Platform Valley - Core platforms ===
        // First gap crossing
        {
            x: 3150, y: groundTopY - 80, width: 120, height: 20,
            color: 0x8B4513, moveType: 'vertical', distance: 90, speed: 60, startDelay: 0
        },
        // Alternative high route
        {
            x: 3100, y: groundTopY - 160, width: 90, height: 15,
            color: 0x654321, moveType: 'horizontal', distance: 100, speed: 80, startDelay: 1000
        },
        
        // Second gap crossing
        {
            x: 3750, y: groundTopY - 70, width: 110, height: 20,
            color: 0x654321, moveType: 'horizontal', distance: 130, speed: 70, startDelay: 500
        },
        
        // === SECTION 4: Wall Corridor - Escape routes ===
        {
            x: 4700, y: groundTopY - 130, width: 100, height: 20,
            color: 0x8B4513, moveType: 'vertical', distance: 80, speed: 45, startDelay: 2000
        },
        {
            x: 5100, y: groundTopY - 90, width: 95, height: 20,
            color: 0x654321, moveType: 'horizontal', distance: 120, speed: 85, startDelay: 0
        },
        
        // === SECTION 5: Speed Stretch - Fast platforms ===
        {
            x: 6000, y: groundTopY - 110, width: 90, height: 15,
            color: 0x654321, moveType: 'horizontal', distance: 140, speed: 120, startDelay: 0
        },
        {
            x: 6475, y: groundTopY - 50, width: 100, height: 20,
            color: 0x8B4513, moveType: 'vertical', distance: 70, speed: 100, startDelay: 800
        },
        
        // === SECTION 6: Final Challenge - Last platforms ===
        {
            x: 7275, y: groundTopY - 100, width: 105, height: 20,
            color: 0x8B4513, moveType: 'vertical', distance: 85, speed: 65, startDelay: 400
        },
        
        // === SECTION 7: Victory Lane - Bonus platform ===
        {
            x: 7900, y: groundTopY - 120, width: 80, height: 15,
            color: 0x654321, moveType: 'horizontal', distance: 80, speed: 90, startDelay: 0
        }
    ];

    // Create each moving obstacle
    movingObstacleData.forEach((data, index) => {
        // Create the platform as a rectangle
        const platform = scene.add.rectangle(data.x, data.y, data.width, data.height, data.color);
        platform.setStrokeStyle(0); // Remove outline
        
        // Add physics body
        scene.physics.add.existing(platform);
        platform.body.setImmovable(true); // Platform shouldn't be pushed by player/bots
        platform.body.moves = false; // Let tweens handle movement, not physics
        
        // Store original position and movement data
        platform.originalX = data.x;
        platform.originalY = data.y;
        platform.moveType = data.moveType;
        platform.distance = data.distance;
        platform.speed = data.speed;
        platform.direction = 1; // 1 for positive direction, -1 for negative
        
        // Debug: Log platform creation
        console.log(`🛠️ Created ${data.moveType} platform at (${data.x}, ${data.y}) - Index: ${index}`);
        
        // Add to the group
        movingObstaclesGroup.add(platform);
        
        // Start movement after delay
        scene.time.delayedCall(data.startDelay, () => {
            console.log(`🎬 Starting movement for ${platform.moveType} platform at (${platform.originalX}, ${platform.originalY})`);
            startPlatformMovement(scene, platform);
        });
    });

    return movingObstaclesGroup;
}

function startPlatformMovement(scene, platform) {
    // Create movement tween based on platform type
    if (platform.moveType === 'vertical') {
        // Vertical movement - move up and down only
        scene.tweens.add({
            targets: platform,
            y: platform.originalY - platform.distance, // Move UP by distance amount
            duration: (platform.distance / platform.speed) * 1000,
            ease: 'Sine.easeInOut',
            yoyo: true, // Return to original position
            repeat: -1, // Infinite repeat
            onUpdate: function() {
                // Ensure X position stays constant for vertical platforms
                if (platform.body) {
                    platform.x = platform.originalX; // Lock X position
                    platform.body.updateFromGameObject();
                    
                    // Force body position synchronization
                    platform.body.center.setTo(platform.x, platform.y);
                }
            }
        });
    } else if (platform.moveType === 'horizontal') {
        // Horizontal movement - move left and right only
        scene.tweens.add({
            targets: platform,
            x: platform.originalX + platform.distance, // Move RIGHT by distance amount
            duration: (platform.distance / platform.speed) * 1000,
            ease: 'Sine.easeInOut',
            yoyo: true, // Return to original position
            repeat: -1, // Infinite repeat
            onUpdate: function() {
                // Ensure Y position stays constant for horizontal platforms
                if (platform.body) {
                    platform.y = platform.originalY; // Lock Y position
                    platform.body.updateFromGameObject();
                    
                    // Force body position synchronization
                    platform.body.center.setTo(platform.x, platform.y);
                }
            }
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

// =============================================================================
// OBSTACLE PATTERNS/CHUNKS SYSTEM
// =============================================================================

// Define reusable obstacle patterns/chunks
const OBSTACLE_PATTERNS = {
    // Basic patterns for different difficulty levels
    EASY_RHYTHM: {
        name: "Easy Rhythm",
        width: 400,
        obstacles: [
            { type: 'wall', x: 100 },
            { type: 'wall', x: 250 }
        ]
    },
    
    WALL_RUSH: {
        name: "Wall Rush",
        width: 600,
        obstacles: [
            { type: 'wall', x: 80 },
            { type: 'wall', x: 180 },
            { type: 'wall', x: 280 },
            { type: 'wall', x: 420 },
            { type: 'wall', x: 520 }
        ]
    },
    
    GAP_CHALLENGE: {
        name: "Gap Challenge",
        width: 500,
        track: [
            { type: 'ground', start: 0, end: 200 },
            { type: 'gap', start: 200, end: 350 },
            { type: 'ground', start: 350, end: 500 }
        ],
        obstacles: [
            { type: 'wall', x: 120 },
            { type: 'wall', x: 400 }
        ]
    },
    
    PLATFORM_VALLEY: {
        name: "Platform Valley",
        width: 600,
        track: [
            { type: 'ground', start: 0, end: 150 },
            { type: 'gap', start: 150, end: 450 },
            { type: 'ground', start: 450, end: 600 }
        ],
        obstacles: [
            { type: 'wall', x: 100 }
        ],
        movingObstacles: [
            { 
                x: 300, y: -80, width: 120, height: 20, 
                color: 0x8B4513, moveType: 'vertical', distance: 90, speed: 60, startDelay: 0
            },
            { 
                x: 250, y: -160, width: 90, height: 15, 
                color: 0x654321, moveType: 'horizontal', distance: 100, speed: 80, startDelay: 1000
            }
        ]
    },
    
    SPEED_SECTION: {
        name: "Speed Section",
        width: 800,
        obstacles: [
            { type: 'wall', x: 200 },
            { type: 'wall', x: 500 },
            { type: 'wall', x: 700 }
        ]
    },
    
    MIXED_CHAOS: {
        name: "Mixed Chaos",
        width: 700,
        track: [
            { type: 'ground', start: 0, end: 250 },
            { type: 'gap', start: 250, end: 350 },
            { type: 'ground', start: 350, end: 700 }
        ],
        obstacles: [
            { type: 'wall', x: 150 },
            { type: 'wall', x: 400 },
            { type: 'wall', x: 550 },
            { type: 'wall', x: 650 }
        ],
        movingObstacles: [
            { 
                x: 300, y: -70, width: 100, height: 20, 
                color: 0x654321, moveType: 'horizontal', distance: 120, speed: 70, startDelay: 500
            }
        ]
    }
};

// Pattern difficulty categories
const PATTERN_CATEGORIES = {
    EASY: ['EASY_RHYTHM'],
    MEDIUM: ['GAP_CHALLENGE', 'SPEED_SECTION'],
    HARD: ['WALL_RUSH', 'PLATFORM_VALLEY', 'MIXED_CHAOS']
};

function createChunkedTrack(scene, trackWidth, groundTopY, groundSegmentHeight) {
    const groundGroup = scene.physics.add.staticGroup();
    const wallsGroup = scene.physics.add.staticGroup();
    const movingObstaclesGroup = scene.physics.add.group({ allowGravity: false });
    
    const groundSegmentCenterY = groundTopY + groundSegmentHeight / 2;
    const groundColor = 0x888888;
    const wallHeight = 96;
    const wallY = groundTopY - (wallHeight / 2);
    
    // Track generation using chunks
    let currentX = 0;
    const allTrackSegments = [];
    
    // Starting safe zone (always present)
    const startZoneWidth = 800;
    allTrackSegments.push({ type: 'ground', start: 0, end: startZoneWidth });
    currentX = startZoneWidth;
    
    // Generate varied chunks for the main track
    while (currentX < trackWidth - 1000) { // Leave space for finish zone
        // Select pattern based on progression
        let difficulty;
        const progressRatio = currentX / trackWidth;
        
        if (progressRatio < 0.3) {
            difficulty = 'EASY';
        } else if (progressRatio < 0.7) {
            difficulty = 'MEDIUM';
        } else {
            difficulty = 'HARD';
        }
        
        // Pick a random pattern from the difficulty category
        const availablePatterns = PATTERN_CATEGORIES[difficulty];
        const patternKey = availablePatterns[Math.floor(Math.random() * availablePatterns.length)];
        const pattern = OBSTACLE_PATTERNS[patternKey];
        
        console.log(`🎯 Placing pattern "${pattern.name}" at x: ${currentX} (difficulty: ${difficulty})`);
        
        // Place the pattern
        const chunkResult = placeObstacleChunk(scene, pattern, currentX, groundTopY, wallsGroup, movingObstaclesGroup);
        
        // Add pattern's track segments to our overall track
        if (pattern.track) {
            pattern.track.forEach(seg => {
                allTrackSegments.push({
                    type: seg.type,
                    start: currentX + seg.start,
                    end: currentX + seg.end
                });
            });
        } else {
            // Default ground for patterns without custom track
            allTrackSegments.push({
                type: 'ground',
                start: currentX,
                end: currentX + pattern.width
            });
        }
        
        currentX += pattern.width;
        
        // Add small buffer between chunks
        const bufferWidth = 50 + Math.random() * 100; // 50-150px buffer
        allTrackSegments.push({
            type: 'ground',
            start: currentX,
            end: currentX + bufferWidth
        });
        currentX += bufferWidth;
    }
    
    // Finish zone (always safe)
    allTrackSegments.push({ type: 'ground', start: currentX, end: trackWidth });
    
    // Create ground segments based on our track layout
    allTrackSegments.forEach(seg => {
        if (seg.type === 'ground') {
            const segmentWidth = seg.end - seg.start;
            if (segmentWidth > 0) {
                const groundRect = scene.add.rectangle(
                    seg.start + segmentWidth / 2, 
                    groundSegmentCenterY, 
                    segmentWidth, 
                    groundSegmentHeight, 
                    groundColor
                );
                groundRect.setStrokeStyle(0); // Remove outline
                scene.physics.add.existing(groundRect, true);
                groundGroup.add(groundRect);
            }
        }
    });
    
    return { 
        groundGroup, 
        trackSegments: allTrackSegments, 
        wallsGroup, 
        movingObstaclesGroup 
    };
}

function placeObstacleChunk(scene, pattern, offsetX, groundTopY, wallsGroup, movingObstaclesGroup) {
    const wallHeight = 96;
    const wallY = groundTopY - (wallHeight / 2);
    
    // Place static obstacles (walls)
    if (pattern.obstacles) {
        pattern.obstacles.forEach(obstacle => {
            if (obstacle.type === 'wall') {
                const wall = wallsGroup.create(offsetX + obstacle.x, wallY, 'wall');
            }
        });
    }
    
    // Place moving obstacles
    if (pattern.movingObstacles) {
        pattern.movingObstacles.forEach((data, index) => {
            const platform = scene.add.rectangle(
                offsetX + data.x, 
                groundTopY + data.y, // data.y is relative offset from ground
                data.width, 
                data.height, 
                data.color
            );
            platform.setStrokeStyle(0); // Remove outline
            
            scene.physics.add.existing(platform);
            platform.body.setImmovable(true);
            platform.body.moves = false;
            
            // Store movement data
            platform.originalX = offsetX + data.x;
            platform.originalY = groundTopY + data.y;
            platform.moveType = data.moveType;
            platform.distance = data.distance;
            platform.speed = data.speed;
            platform.direction = 1;
            
            movingObstaclesGroup.add(platform);
            
            // Start movement after delay
            scene.time.delayedCall(data.startDelay, () => {
                startPlatformMovement(scene, platform);
            });
        });
    }
    
    return { success: true };
}

// Alternative function to use chunked track generation
function createVariedTrack(scene, trackWidth, groundTopY, groundSegmentHeight) {
    console.log("🏗️ Creating varied track with obstacle patterns/chunks");
    return createChunkedTrack(scene, trackWidth, groundTopY, groundSegmentHeight);
}

// If using ES6 Modules in the future:
// export { createGroundAndTrack, createWalls, createMovingObstacles, startPlatformMovement, detectUpcomingObstacles };
