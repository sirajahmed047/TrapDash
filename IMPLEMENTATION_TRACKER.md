**Project Structure (Reference - Not Checkbox Items):**
```
trapdash/
├── index.html
├── js/
│   └── game.js  // Main game logic, Phaser configuration, and scene management
│   └── Player.js // (Optional, for Player class if using multiple scenes/complex logic)
│   └── Bot.js    // (Optional, for Bot class if using multiple scenes/complex logic)
│   └── ObstacleManager.js // (Optional, for managing obstacle creation/logic)
│   └── PowerupManager.js  // (Optional, for managing powerup creation/logic)
├── css/
│   └── style.css // Basic styles
├── assets/
│   ├── images/
│   ├── sounds/
└── (Phaser.js linked via CDN in index.html)
```
*Note: Refactoring completed (as of last user query). `js/Player.js`, `js/Bot.js`, `js/obstacles.js` (as ObstacleManager), and `js/powerups.js` (as PowerupManager) are now implemented, enhancing modularity and aligning with the optional advanced structure.* 

---

**TrapDash - Implementation Tracker (Checkbox List - Phaser 3 Edition)**

**Phase 0: Common Setup (Pre-Phase 1)**
*   [ ] **Environment Setup:**
    *   [ ] Install/Configure IDE (Visual Studio Code).
    *   [ ] Ensure modern browser (Chrome/Firefox) is available for testing.
    *   [X] Install Node.js & npm (useful for local server, though not strictly required for CDN Phaser).
*   [ ] **Framework Choice:**
    *   [X] Confirm and include **Phaser 3** (via CDN link in `index.html`).
*   [ ] **Initial Project Files:**
    *   [X] Create `index.html` (with a `<div id="game-container"></div>`).
    *   [X] Create `js/game.js`.
    *   [X] Create `css/style.css`.
*   [ ] **Basic Phaser 3 Initialization (`js/game.js`):**
    *   [X] Define Phaser game `config` object (type, width, height, parent, physics, scene).
    *   [X] Create main game scene object with `preload`, `create`, and `update` methods.
    *   [X] Instantiate `new Phaser.Game(config)`.
    *   [X] Set up basic world physics (e.g., `this.physics.world.gravity.y = VALUE;` in scene's `create` if global gravity is desired).

**Phase 1: Shape-Only Race — minimal rectangle-only prototype (using Phaser Graphics)**
*   [X] **Player Rectangle (using Phaser Graphics):**
    *   [X] Create player as a `Phaser.GameObjects.Graphics` rectangle: `this.add.graphics()`, draw a filled rectangle.
    *   [X] Enable Arcade Physics for the graphics object: `this.physics.add.existing(playerGraphicsObject)`.
    *   [X] Set player physics properties (e.g., `player.body.setSize()`, `player.body.setCollideWorldBounds(true)`).
    *   [X] Implement auto-run logic: `player.body.setVelocityX(PLAYER_SPEED);` in scene's `update` or on creation.
*   [X] **Bot Rectangle (using Phaser Graphics):**
    *   [X] Create bot as a `Phaser.GameObjects.Graphics` rectangle.
    *   [X] Enable Arcade Physics for the bot.
    *   [X] Set bot physics properties.
    *   [X] Implement auto-run logic: `bot.body.setVelocityX(BOT_SPEED);`.
*   [X] **Ground Plane (using Phaser Graphics or Rectangle Shape):**
    *   [X] Create a long `Phaser.GameObjects.Rectangle` or `Graphics` object at the bottom.
    *   [X] Enable Arcade Physics for the ground: `this.physics.add.existing(groundObject, true);` (true for static).
    *   [X] Ensure player and bot collide with the ground: `this.physics.add.collider(player, ground);`.
*   [X] **Finish Line (using Phaser Graphics or Rectangle Shape):**
    *   [X] Create a vertical `Phaser.GameObjects.Rectangle` or `Graphics` object.
    *   [X] Enable Arcade Physics for the finish line (can be a sensor/trigger: `finishLine.body.isSensor = true;`).
    *   [X] Set physics properties.
*   [X] **Basic Collision Detection (Overlap):**
    *   [X] Player overlaps with "finish": `this.physics.add.overlap(player, finishLine, handlePlayerFinish, null, this);`.
    *   [X] Bot overlaps with "finish": `this.physics.add.overlap(bot, finishLine, handleBotFinish, null, this);`.
*   [X] **Camera (Optional, if track longer than screen):**
    *   [X] Implement basic camera follow for the player: `this.cameras.main.startFollow(player);`.
    *   [X] Set world bounds: `this.physics.world.setBounds(0, 0, TRACK_WIDTH, game.config.height);`.
    *   [X] Set camera bounds: `this.cameras.main.setBounds(0, 0, TRACK_WIDTH, game.config.height);`.

**Phase 2: Swap Shapes for Placeholder Sprites — placeholder 32×32 PNGs**
*   [X] **Asset Preparation:**
    *   [X] Create/obtain `player_placeholder.png` and place in `assets/images/`.
    *   [X] Create/obtain `bot_placeholder.png` and place in `assets/images/`.
    *   [X] Create/obtain `background_placeholder.png` (simple repeating pattern or solid color for now) and place in `assets/images/`.
    *   [X] Create/obtain `powerup_box_placeholder.png` and place in `assets/images/`.
    *   [X] Create/obtain `powerup_speed_icon_placeholder.png` and place in `assets/images/`.
    *   [X] Create/obtain `powerup_shield_icon_placeholder.png` and place in `assets/images/`.
*   [X] **Load Sprites in Phaser (in scene's `preload` method):**
    *   [X] `this.load.image("playerPH", "assets/images/player_placeholder.png");`
    *   [X] `this.load.image("botPH", "assets/images/bot_placeholder.png");`
    *   [X] `this.load.image("backgroundPH", "assets/images/background_placeholder.png");` (And implement its display as `this.add.image()` or `this.add.tileSprite()` in `create`).
    *   [X] `this.load.image("powerupBoxPH", "assets/images/powerup_box_placeholder.png");`
    *   [X] `this.load.image("powerupSpeedIconPH", "assets/images/powerup_speed_icon_placeholder.png");`
    *   [X] `this.load.image("powerupShieldIconPH", "assets/images/powerup_shield_icon_placeholder.png");`
*   [X] **Player Sprite Implementation (in scene's `create` method):**
    *   [X] Replace player `Graphics` with a `Phaser.Physics.Arcade.Sprite`: `this.player = this.physics.add.sprite(x, y, "playerPH");`.
    *   [X] Player already has physics body from `this.physics.add.sprite()`. Adjust body size/offset if needed: `this.player.body.setSize(width, height).setOffset(x, y);`.
    *   [X] Implement jump for player on key press (e.g., "space"), checking `this.player.body.onFloor()`: `if (cursors.space.isDown && this.player.body.onFloor()) { this.player.body.setVelocityY(JUMP_VELOCITY); }`.
*   [X] **Bot Sprite Implementation:**
    *   [X] Replace bot `Graphics` with `this.bot = this.physics.add.sprite(x, y, "botPH");`.
    *   [X] Bot already has physics. (Bot does not jump yet).
*   [X] **Ground Check:**
    *   [X] Ensure ground object is a static physics body and player/bot collide with it (`this.physics.add.collider(this.player, groundObject);`). `this.player.body.onFloor()` will work.

**Phase 3: Add Simple Obstacles & AI Bot (Jump Logic)**
*   [X] **Asset Preparation (Obstacles):**
    *   [X] Create/obtain `obstacle_wall.png` (placeholder) and place in `assets/images/`.
    *   [ ] Create/obtain `obstacle_gap_visual_cue.png` (optional) and place in `assets/images/`.
*   [X] **Load Obstacle Sprite (in `preload`):**
    *   [X] `this.load.image("wall", "assets/images/obstacle_wall.png");`
*   [X] **Obstacle Implementation (Walls - in `create` or a spawning function):**
    *   [X] Create a static physics group for walls: `this.walls = this.physics.add.staticGroup();`.
    *   [X] Add "wall" sprites to the group: `this.walls.create(x, y, "wall");`.
    *   [X] Manually place a few "wall" obstacles.
    *   [X] Player/Bot collides with walls: `this.physics.add.collider(this.player, this.walls);`.
*   [X] **Obstacle Implementation (Gaps):**
    *   [X] Design track sections with gaps (no ground object in these areas). Player/bot must jump.
*   [X] **Player-Obstacle Collision Response:**
    *   [X] Implement collision callback when player hits a "wall": `this.physics.add.collider(this.player, this.walls, handlePlayerHitObstacle, null, this);`.
*   [X] **Bot-Obstacle Interaction Response:**
    *   [X] Implement collision callback when bot hits a "wall": `this.physics.add.collider(this.bot, this.walls, handleBotHitObstacle, null, this);`.
*   [X] **AI Bot Jump Logic (in scene's `update` or Bot class):**
    *   [X] Implement logic to detect upcoming obstacles (e.g., raycasting, checking distance to nearest obstacle).
    *   [X] If obstacle detected and bot is on floor, make bot jump: `if (shouldJump && this.bot.body.onFloor()) { this.bot.body.setVelocityY(JUMP_VELOCITY); }`.

**Phase 4: Implementing Power-Ups (Corresponds to Guide Step 6)**
*   [X] **Power-Up Asset Preparation (Final assets, if different from placeholders):**
    *   [X] (If using placeholders) Create/obtain final `powerup_box.png`. (Using existing placeholders)
    *   [X] (If using placeholders) Create/obtain final `powerup_speed_icon.png`. (Using existing placeholders)
    *   [X] (If using placeholders) Create/obtain final `powerup_shield_icon.png`. (Using existing placeholders)
*   [X] **Load Final Power-Up Sprites (in `preload`, if new):**
    *   [X] (If applicable) `this.load.image("powerupBox", "assets/images/powerup_box.png");` (Using existing powerupBoxPH)
    *   [X] (If applicable) `this.load.image("powerupSpeedIcon", "assets/images/powerup_speed_icon.png");` (Using existing powerupSpeedIconPH)
    *   [X] (If applicable) `this.load.image("powerupShieldIcon", "assets/images/powerup_shield_icon.png");` (Using existing powerupShieldIconPH)
*   [X] **Power-Up Box Implementation:**
    *   [X] Create a physics group for power-up boxes: `this.powerups = this.physics.add.group({ allowGravity: false });`.
    *   [X] Spawn power-up boxes: `this.powerups.create(x, y, "powerupBoxPH" or "powerupBox");`.
    *   [X] Implement collection logic: `this.physics.add.overlap(this.player, this.powerups, collectPowerup, null, this);`.
*   [X] **Power-Up Effects:**
    *   [X] Implement Speed Boost power-up logic (e.g., temporarily increase `PLAYER_SPEED` or `player.body.velocity.x`).
    *   [X] Implement Shield power-up logic (e.g., set a flag to ignore next obstacle collision).

**Phase 5: Game States and UI (Corresponds to Guide Step 7)**
*   [ ] **UI Elements (Using Phaser Text or DOM elements):**
    *   [X] Implement Start Game prompt (e.g., 'Press Space to Start').
    *   [X] Implement End Game prompt (e.g., 'Player/Bot Wins! Press R to Restart').
    *   [X] Implement position tracking display (e.g., `this.add.text(x, y, "Position: 1st", { fontSize: '16px', fill: '#fff' }).setScrollFactor(0);`).
*   [X] **Game Flow & Scene Management (Using Phaser Scenes):**
    *   [X] Create separate scenes for Start Menu, Game Over, etc. (`class MainMenu extends Phaser.Scene { ... }`).
    *   [X] Add scenes to game config: `scene: [BootScene, MainMenuScene, GameScene, UIScene, GameOverScene]`.
    *   [X] Transition between scenes: `this.scene.start('GameOverScene');`.
    *   [X] Refine win/lose conditions and trigger scene transitions or UI updates.
*   [ ] **Sound Effects (Basic - using Phaser Audio):**
    *   [ ] Load sounds in `preload`: `this.load.audio('jumpSound', 'assets/sounds/jump.wav');`.
    *   [ ] Play sounds: `this.sound.play('jumpSound');`.
    *   [ ] Add sound for jump, power-up collection, collision.
    *   *(User preference: Defer sound implementation for later)*

---
(Optional sections for more advanced features like different bot levels, more power-ups, detailed scoring, etc., can be added later)

**Phase 6: Visual Polish - Animations & Effects (Corresponds to update1.md - Step 1)**
*   [ ] **Character Animations:**
    *   [ ] Implement smooth run animation.
    *   [ ] Implement jump animation.
    *   [ ] Implement fall animation.
    *   [ ] Implement hit animation (optional).
*   [ ] **Particle Effects:**
    *   [ ] Jump Dust.
    *   [ ] Landing Dust/Impact.
    *   [ ] Speed Boost Trail.
    *   [ ] Shield Activation/Break visual.
    *   [ ] Power-Up Collection burst.
*   [ ] **Screen Shake:**
    *   [ ] Implement subtle screen shake on obstacle hit or major events.

**Phase 7: UI/UX Enhancements (Corresponds to update1.md - Step 2)**
*   [ ] **Power-Up Indication:**
    *   [ ] Implement timer bar or visual effect on player for active power-up duration.
*   [ ] **Start Countdown:**
    *   [ ] Implement "3... 2... 1... GO!" visual countdown.
*   [ ] **Engaging Game Over Screen:**
    *   [ ] Display final score/time.
    *   [ ] Add clear "Retry" and "Main Menu" buttons.
    *   [ ] Add "Well Done!" or "Try Again!" messages.

**Phase 8: Scoring & Leaderboard (Corresponds to update1.md - Step 6)**
*   [ ] **Refined Scoring System:**
    *   [ ] Implement scoring based on distance, power-ups collected, opponents overtaken, time to finish.
*   [ ] **Local Leaderboard:**
    *   [ ] Prompt for name (3 initials) on high score.
    *   [ ] Save top scores using browser `localStorage`.
    *   [ ] Display leaderboard (Main Menu or separate scene).

**Phase 9: Advanced Gameplay - Bot AI & Obstacles (Corresponds to update1.md - Steps 3 & 4)**
*   [ ] **Advanced Bot AI:**
    *   [ ] Implement smarter power-up usage strategy.
    *   [ ] Refine obstacle avoidance (better timing, "mistakes").
    *   [ ] Implement simple bot "personalities" (optional).
*   [ ] **Dynamic Obstacles & Level Variety:**
    *   [ ] Add moving obstacles (e.g., moving platforms).
    *   [ ] Add "destructible" obstacles (visual effect only).
    *   [ ] Implement varied obstacle patterns/chunks.
    *   [ ] Add visual cues for gaps (e.g., using `obstacle_gap_visual_cue.png` - formerly in Phase 3).

**Phase 10: New Power-Ups (Corresponds to update1.md - Step 5)**
*   [ ] **Offensive Power-Up (Choose one or both):**
    *   [ ] Implement Lightning Zap (Targeted).
    *   [ ] Implement Droppable Trap.
*   [ ] **Utility Power-Up:**
    *   [ ] Implement Shuriken (bounces off walls).

---
*The "Mobile Wrapper (CapacitorJS)" consideration from update1.md can be reviewed after these phases progress.*
