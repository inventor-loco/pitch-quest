import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        // Show the HTML Menu overlay
        const menu = document.getElementById('start-menu');
        const overlay = document.getElementById('ui-overlay');
        
        if (menu) menu.classList.remove('hidden');
        if (overlay) overlay.classList.add('hidden');

        // Setup button listeners
        const buttons = document.querySelectorAll('.level-btn');
        
        const startLevel = (e: Event) => {
            const target = e.target as HTMLButtonElement;
            const levelIndex = parseInt(target.getAttribute('data-level') || '0', 10);
            
            // Hide menu, show UI overlay
            if (menu) menu.classList.add('hidden');
            if (overlay) overlay.classList.remove('hidden');

            // Remove listeners so they don't stack
            buttons.forEach(btn => btn.removeEventListener('click', startLevel));

            // Start GameScene
            this.scene.start('GameScene', { levelIndex });
        };

        buttons.forEach(btn => {
            btn.addEventListener('click', startLevel);
        });
    }
}
