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

// If using ES6 Modules in the future:
// export { createGroundAndTrack, createWalls };
