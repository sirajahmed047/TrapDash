// js/GameConfig.js
const GameConfig = {
    GAME_WIDTH: 800,
    GAME_HEIGHT: 600,
    JUMP_VELOCITY: -300,
    TRACK_WIDTH_MULTIPLIER: 10,  // Extended for 8000px track (800 * 10 = 8000)
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
    FINISH_LINE_X_MULTIPLIER: 0.9, // Track width percentage for finish line
    GROUND_Y_OFFSET: 200, // Offset from bottom of the screen for ground
    FALL_DEATH_Y_BUFFER: 20, // Buffer below ground for fall death
    FINISH_LINE_HEIGHT_OFFSET: 50, // Offset from top for finish line height
    SKY_COLOR: '#87CEEB',
    RESPAWN_DELAY: 2000,
    SPEED_GLOW_COLOR: 0xFFFF00,
    SHIELD_GLOW_COLOR: 0x00FF00,
    LIGHTNING_GLOW_COLOR: 0x9932CC,  // Purple/electric color
    GLOW_ALPHA: 0.35,
    GLOW_RADIUS: 8,
    JUMP_DUST_Y_OFFSET: 32,
    PLAYER_ANIM_FRAMERATE: 10,
    BOT_ANIM_FRAMERATE: 10,
    JUMP_DUST_ANIM_FRAMERATE: 12,
    PLAYER_OBSTACLE_SHAKE_INTENSITY: 0.01,
    PLAYER_OBSTACLE_SHAKE_DURATION: 150,
    BOT_OBSTACLE_SHAKE_INTENSITY: 0.005,
    BOT_OBSTACLE_SHAKE_DURATION: 100,
    UI_FONT_SIZE_LARGE: '32px',
    UI_FONT_SIZE_MEDIUM: '24px',
    UI_FONT_SIZE_SMALL: '16px',
    UI_FONT_COLOR: '#FFF',
    UI_BUTTON_COLOR: '#555',
    UI_BUTTON_HOVER_COLOR: '#777',
    POWERUP_ICON_Y_OFFSET: -10,
    
    // Moving Obstacles Configuration
    MOVING_PLATFORM_COLOR_VERTICAL: 0x8B4513,   // Brown for vertical platforms
    MOVING_PLATFORM_COLOR_HORIZONTAL: 0x654321  // Darker brown for horizontal platforms
};
// Make it available globally if not using modules
// window.GameConfig = GameConfig; // Or handle via script loading order
