import './style.css';
import Phaser from 'phaser';
import BootScene from './game/BootScene';
import MenuScene from './game/MenuScene';
import GameScene from './game/GameScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#0f172a', // matches var(--bg-dark)
    scene: [BootScene, MenuScene, GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

new Phaser.Game(config);
