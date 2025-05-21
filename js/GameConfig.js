// js/GameConfig.js
const GameConfig = {
    JUMP_VELOCITY: -300,
    TRACK_WIDTH_MULTIPLIER: 7,
    BOT_JUMP_LOOKAHEAD_WALL: 95,
    BOT_JUMP_LOOKAHEAD_GAP: 90,
    PLAYER_SPEED_NORMAL: 250,
    PLAYER_SPEED_BOOSTED: 400,
    BOT_SPEED_NORMAL: 249,
    BOT_SPEED_BOOSTED: 390,
    POWERUP_DURATION: 5000,
    POWERUP_RESPAWN_DELAY: 3000,
    // Add any other constants that might be global, e.g., gravity if it becomes configurable
    DEFAULT_GRAVITY: 400,
    PLAYER_INITIAL_X: 100,
    BOT_INITIAL_X: 50,
    GROUND_SEGMENT_HEIGHT: 50,
    PLAYER_RESPAWN_Y_OFFSET: -24, // Relative to groundTopY
    BOT_RESPAWN_Y_OFFSET: -24,    // Relative to groundTopY
    FINISH_LINE_X_MULTIPLIER: 0.9 // Track width percentage for finish line
};
// Make it available globally if not using modules
// window.GameConfig = GameConfig; // Or handle via script loading order
