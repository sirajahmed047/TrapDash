class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        // NEW: Podium system - expects { finishers: [], totalRacers: number }
        this.finishers = data.finishers || [];
        this.totalRacers = data.totalRacers || 4;
        
        // Legacy support for old winner system
        if (data.winner && this.finishers.length === 0) {
            this.finishers = [{ name: data.winner, position: 1, isPlayer: data.winner === 'Player' }];
        }
    }

    preload() {
        // Load assets for the podium screen if any
    }

    create() {
        this.cameras.main.setBackgroundColor('#001122'); // Dark blue background
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Title
        const titleStyle = { 
            fontSize: '54px', 
            fill: '#FFD700', 
            stroke: '#000000', 
            strokeThickness: 3,
            fontFamily: 'Arial Black',
            align: 'center' 
        };
        this.add.text(centerX, 80, '🏆 RACE RESULTS 🏆', titleStyle).setOrigin(0.5);

        // Create podium display
        this.createPodium(centerX, centerY);

        // Buttons
        const buttonStyle = { 
            fontSize: '28px', 
            fill: '#ffffff', 
            backgroundColor: '#2d5aa0', 
            padding: { x: 20, y: 12 }, 
            borderRadius: 8,
            align: 'center' 
        };
        const buttonHoverStyle = { fill: '#FFD700', backgroundColor: '#1a3d73' };

        // Retry Button
        const retryButton = this.add.text(centerX - 100, centerY + 180, '🔄 Race Again', buttonStyle).setOrigin(0.5).setInteractive();
        retryButton.on('pointerdown', () => {
            this.scene.stop('UIScene');
            this.scene.start('GameScene');
            this.scene.launch('UIScene');
        });
        retryButton.on('pointerover', () => retryButton.setStyle(buttonHoverStyle));
        retryButton.on('pointerout', () => retryButton.setStyle(buttonStyle));

        // Main Menu Button
        const mainMenuButton = this.add.text(centerX + 100, centerY + 180, '🏠 Main Menu', buttonStyle).setOrigin(0.5).setInteractive();
        mainMenuButton.on('pointerdown', () => {
            this.scene.start('MainMenuScene');
        });
        mainMenuButton.on('pointerover', () => mainMenuButton.setStyle(buttonHoverStyle));
        mainMenuButton.on('pointerout', () => mainMenuButton.setStyle(buttonStyle));
    }

    createPodium(centerX, centerY) {
        const podiumY = centerY - 20;
        
        // Podium positions (2nd, 1st, 3rd for visual appeal)
        const positions = [
            { x: centerX - 120, y: podiumY + 40, height: 60, place: 2, medal: '🥈', color: 0xC0C0C0 }, // 2nd place (left)
            { x: centerX, y: podiumY, height: 100, place: 1, medal: '🥇', color: 0xFFD700 },             // 1st place (center, tallest)
            { x: centerX + 120, y: podiumY + 60, height: 40, place: 3, medal: '🥉', color: 0xCD7F32 }   // 3rd place (right)
        ];

        // Draw podium blocks
        positions.forEach(pos => {
            const block = this.add.rectangle(pos.x, pos.y + pos.height/2, 100, pos.height, pos.color);
            block.setStrokeStyle(2, 0x000000);
            
            // Place number on podium
            this.add.text(pos.x, pos.y + pos.height/2, pos.place.toString(), {
                fontSize: '24px',
                fill: '#000000',
                fontFamily: 'Arial Black'
            }).setOrigin(0.5);
        });

        // Display finishers on podium
        positions.forEach(pos => {
            if (this.finishers.length >= pos.place) {
                const finisher = this.finishers[pos.place - 1];
                
                // Medal and name
                const medalStyle = { fontSize: '32px' };
                const nameStyle = {
                    fontSize: '18px',
                    fill: finisher.isPlayer ? '#00FF00' : '#FF6B6B',
                    fontFamily: 'Arial Black',
                    align: 'center',
                    stroke: '#000000',
                    strokeThickness: 1
                };

                this.add.text(pos.x, pos.y - 30, pos.medal, medalStyle).setOrigin(0.5);
                this.add.text(pos.x, pos.y - 5, finisher.name, nameStyle).setOrigin(0.5);
                
                // Add special effects for player
                if (finisher.isPlayer && pos.place === 1) {
                    // Golden glow effect for winning player
                    const glow = this.add.circle(pos.x, pos.y - 30, 25, 0xFFD700, 0.3);
                    
                    // Pulsing animation
                    this.tweens.add({
                        targets: glow,
                        scaleX: 1.2,
                        scaleY: 1.2,
                        alpha: 0.6,
                        duration: 1000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    
                    // Remove glow after 5 seconds
                    this.time.delayedCall(5000, () => {
                        if (glow) {
                            this.tweens.killTweensOf(glow);
                            glow.destroy();
                        }
                    });
                }
            } else {
                // Show "N/A" for empty positions
                this.add.text(pos.x, pos.y - 15, 'N/A', {
                    fontSize: '16px',
                    fill: '#666666',
                    fontFamily: 'Arial'
                }).setOrigin(0.5);
            }
        });

        // Show additional finishers if any (4th place and beyond)
        if (this.finishers.length > 3) {
            let othersText = 'Other Finishers:\n';
            for (let i = 3; i < this.finishers.length; i++) {
                const finisher = this.finishers[i];
                othersText += `${i + 1}. ${finisher.name}\n`;
            }
            
            this.add.text(centerX, centerY + 100, othersText, {
                fontSize: '16px',
                fill: '#CCCCCC',
                align: 'center',
                lineSpacing: 5
            }).setOrigin(0.5);
        }

        // Show player's specific result
        const playerFinisher = this.finishers.find(f => f.isPlayer);
        if (playerFinisher) {
            const playerPlace = playerFinisher.position;
            let resultText = '';
            let resultColor = '#FFFFFF';
            
            if (playerPlace === 1) {
                resultText = '🎉 VICTORY! You won the race! 🎉';
                resultColor = '#FFD700';
            } else if (playerPlace <= 3) {
                resultText = `🏆 Great job! You finished ${playerPlace}${this.getOrdinalSuffix(playerPlace)} place!`;
                resultColor = '#87CEEB';
            } else {
                resultText = `You finished ${playerPlace}${this.getOrdinalSuffix(playerPlace)} place. Keep practicing!`;
                resultColor = '#FF6B6B';
            }
            
            this.add.text(centerX, 140, resultText, {
                fontSize: '20px',
                fill: resultColor,
                align: 'center',
                stroke: '#000000',
                strokeThickness: 1,
                fontFamily: 'Arial Black'
            }).setOrigin(0.5);
        }
    }

    getOrdinalSuffix(number) {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const value = number % 100;
        return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
    }
} 