import Phaser from 'phaser';
import GameScene from './gamesceen';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: true
        }
    },
    scene: GameScene
};

const game = new Phaser.Game(config); 