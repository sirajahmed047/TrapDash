# TrapDash - Step-by-Step Development Guide

This guide will walk you through developing the "TrapDash" game, starting with Phase 1 (Core Race MVP).

## Phase 1: Core Race MVP - Development Steps

### Step 1: Setting Up the Project Structure ✅
- Create basic folder structure
- Initialize HTML, CSS, and JavaScript files
- Set up Kaboom.js framework

### Step 2: Creating Game Assets
1. Create simple placeholder sprites for:
   - Player character
   - AI bot
   - Basic obstacles (wall, gap)
   - Power-up box
   - Power-up icons (speed, shield)
   - Simple background

   You can use any image editing software or find free assets online.

2. Place your image files in the `assets/images/` directory.

### Step 3: Building the Game World
1. Create a basic level design:
   - Define ground level
   - Place starting line and finish line
   - Add a few obstacles (walls to jump over, gaps to jump across)

2. Update the `game.js` file to load and display your level.

### Step 4: Implementing Player Movement
1. Create the player character:
   - Auto-running movement
   - Jump mechanic (when SPACE is pressed)
   - Collision detection with ground and obstacles

2. Update the game scene in `game.js` to include player controls.

### Step 5: Creating Basic AI Bot
1. Implement a simple AI bot that:
   - Auto-runs at consistent speed
   - Jumps when approaching obstacles
   - Has basic collision detection

2. Update the game scene to include the AI bot.

### Step 6: Implementing Power-Ups
1. Create power-up boxes that appear randomly on the track
2. Implement collection logic (when player touches a box)
3. Add power-up functionality:
   - Speed Boost: Increases player speed temporarily
   - Shield: Protects player from one obstacle collision

### Step 7: Game States and UI
1. Implement position tracking (1st, 2nd, 3rd, 4th)
2. Create a display for current position and held power-up
3. Implement win/lose conditions (crossing finish line)
4. Connect the start, game, and end scenes

### Step 8: Testing and Refinement
1. Test the game to ensure:
   - Player movement feels responsive
   - AI bot behaves as expected
   - Power-ups work correctly
   - Win/lose conditions trigger properly

2. Make adjustments as needed for game balance and fun factor.

## Resources for Beginners

### Kaboom.js Resources
- [Kaboom.js Documentation](https://kaboomjs.com/doc)
- [Kaboom.js Examples](https://kaboomjs.com/examples)

### Free Game Assets
- [OpenGameArt.org](https://opengameart.org/)
- [Kenney Game Assets](https://kenney.nl/assets)
- [itch.io Free Game Assets](https://itch.io/game-assets/free)

### Sound Effects
- [Freesound](https://freesound.org/)
- [Mixkit Free Sound Effects](https://mixkit.co/free-sound-effects/)

## Development Tips for Beginners

1. **Start Small**: Focus on one feature at a time. Get the basic movement working before adding power-ups.

2. **Use Console Logs**: Add `console.log()` statements to help debug your code and understand what's happening.

3. **Incremental Testing**: Test each feature as you implement it, not just at the end.

4. **Version Control**: If possible, use Git to save your progress at key milestones.

5. **Be Patient**: Game development is complex but rewarding. Take your time to understand each concept.

6. **Have Fun**: Experiment and enjoy the process of creating your game! 