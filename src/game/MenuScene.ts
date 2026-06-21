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

        // Tolerance selector
        let centsTolerance = 30;
        const toleranceBtns = document.querySelectorAll<HTMLButtonElement>('.tolerance-btn');
        toleranceBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toleranceBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                centsTolerance = parseInt(btn.getAttribute('data-cents') || '30', 10);
            });
        });

        // Level buttons
        const levelBtns = document.querySelectorAll('.level-btn');

        const startLevel = (e: Event) => {
            const target = e.target as HTMLButtonElement;
            const levelIndex = parseInt(target.getAttribute('data-level') || '0', 10);

            if (menu) menu.classList.add('hidden');
            if (overlay) overlay.classList.remove('hidden');

            levelBtns.forEach(btn => btn.removeEventListener('click', startLevel));

            this.scene.start('GameScene', { levelIndex, centsTolerance });
        };

        levelBtns.forEach(btn => {
            btn.addEventListener('click', startLevel);
        });
    }
}
