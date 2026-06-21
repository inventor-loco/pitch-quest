import Phaser from 'phaser';
import { AudioPitchDetector, type PitchResult } from '../audio/PitchDetector';
import { type Level, type Note, levels, getNoteClass } from './Levels';

interface NoteEntry {
    data: Note;
    noteClass: number;
    baseX: number;          // x in the scrolling lane (before scroll offset)
    y: number;              // height on the pentagram
    head: Phaser.GameObjects.Arc;
    label: Phaser.GameObjects.Text;
    matchTime: number;      // ms the player has been on-pitch while in the hit window
    judged: 'none' | 'hit' | 'miss';
    pulse?: Phaser.Tweens.Tween;
}

export default class GameScene extends Phaser.Scene {
    private audioDetector!: AudioPitchDetector;
    private currentLevel!: Level;

    private mozartSprite!: Phaser.GameObjects.Sprite;
    private mozartBaseY = 0;
    private mozartBaseScale = 1;

    private staffLines: Phaser.GameObjects.Line[] = [];
    private noteEntries: NoteEntry[] = [];

    private centsTolerance: number = 30;
    private readonly matchHoldRequired = 200; // ms on-pitch in the window to land a note

    // Pentagram layout
    private staffSpacing = 40;
    private staffTopY = 0;

    // Rhythm-highway layout
    private hitLineX = 160;
    private scrollX = 0;
    private readonly beatPx = 170;       // horizontal distance of one beat
    private readonly scrollSpeed = 150;  // px / second
    private readonly leadInPx = 520;     // gap before the first note arrives
    private hitWindow = 85;              // px on each side of the hit line
    private started = false;

    // Vertical pitch indicator (the "tuner" — your sung pitch rides to meet the notes)
    private pitchMarker?: Phaser.GameObjects.Triangle;
    private pitchGuide?: Phaser.GameObjects.Line;
    private hadPitch = false;                       // was the player singing last frame?
    private markerBounceTween?: Phaser.Tweens.Tween; // gentle drop when singing stops

    // Scoring
    private score = 0;
    private combo = 0;
    private maxCombo = 0;
    private hits = 0;
    private judgedCount = 0;
    private scoreText?: Phaser.GameObjects.Text;
    private comboText?: Phaser.GameObjects.Text;
    private targetNoteClass = -1;

    // HUD Elements
    private uiTargetNote = document.getElementById('target-note');
    private uiAccuracy = document.getElementById('accuracy-text');
    private uiProgressFill = document.getElementById('progress-bar-fill');
    private uiSongTitle = document.getElementById('song-title');
    private uiSongProgressText = document.getElementById('song-progress-text');

    constructor() {
        super('GameScene');
    }

    init(data: { levelIndex: number; centsTolerance?: number }) {
        this.currentLevel = levels[data.levelIndex || 0];
        this.centsTolerance = data.centsTolerance ?? 30;
        this.audioDetector = new AudioPitchDetector();

        // reset state (scenes are reused across plays)
        this.staffLines = [];
        this.noteEntries = [];
        this.scrollX = 0;
        this.started = false;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.hits = 0;
        this.judgedCount = 0;
        this.hadPitch = false;
        this.markerBounceTween = undefined;
    }

    async create() {
        this.cameras.main.setBackgroundColor('#0f172a');

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Pentagram takes up >= 50% of the screen height (5 lines = 4 gaps)
        this.staffSpacing = Math.max(48, height * 0.13);
        this.staffTopY = (height / 2) - (this.staffSpacing * 2);
        this.hitLineX = Math.max(150, width * 0.2);
        this.hitWindow = this.beatPx * 0.5;

        // --- Pentagram (5 lines, full width) ---
        for (let i = 0; i < 5; i++) {
            const y = this.staffTopY + (i * this.staffSpacing);
            const line = this.add.line(0, 0, 0, y, width, y, 0xffffff, 0.22);
            line.setOrigin(0, 0);
            line.setLineWidth(1.5);
            this.staffLines.push(line);
        }

        // --- Note-name scale + the "now" hit line (the graduated vertical tuner) ---
        this.drawTunerScale();

        const top = this.getStaffYForNote('B') - this.staffSpacing;
        const bottom = this.getStaffYForNote('C') + this.staffSpacing;

        // Glowing vertical "now" bar where notes get judged
        this.add.rectangle(this.hitLineX, (top + bottom) / 2, 6, bottom - top, 0x8b5cf6, 0.45)
            .setOrigin(0.5, 0.5).setDepth(3);
        this.add.rectangle(this.hitLineX, (top + bottom) / 2, this.hitWindow * 2, bottom - top, 0x8b5cf6, 0.06)
            .setOrigin(0.5, 0.5).setDepth(2);

        // Horizontal guide showing the player's current sung pitch height
        this.pitchGuide = this.add.line(0, 0, 0, this.getStaffYForNote('E'), width, this.getStaffYForNote('E'), 0x38bdf8, 0.18)
            .setOrigin(0, 0).setLineWidth(1).setDepth(2);

        // The pitch marker rides vertically on the hit line and points at incoming notes
        this.pitchMarker = this.add.triangle(this.hitLineX, this.getStaffYForNote('E'), 0, -12, 0, 12, 18, 0, 0x38bdf8)
            .setDepth(11);

        // --- Notes laid out along the scrolling lane ---
        this.buildNotes();

        // --- Mozart: medium-sized conductor mascot standing at the hit line ---
        this.mozartSprite = this.add.sprite(this.hitLineX - this.staffSpacing * 0.7, 0, 'mozart');
        this.mozartSprite.setOrigin(0.5, 1);
        this.mozartBaseScale = (height * 0.15) / this.mozartSprite.height; // ~15% of screen height
        this.mozartSprite.setScale(this.mozartBaseScale);
        this.mozartBaseY = this.staffTopY + this.staffSpacing * 4.2; // standing just below the staff
        this.mozartSprite.y = this.mozartBaseY;
        this.mozartSprite.setDepth(10);

        // --- Phaser HUD: score + combo (top-right) ---
        this.scoreText = this.add.text(width - 24, 20, '0', {
            fontFamily: 'Outfit, sans-serif', fontSize: '40px', color: '#f8fafc', fontStyle: 'bold'
        }).setOrigin(1, 0).setDepth(30);
        this.comboText = this.add.text(width - 24, 70, '', {
            fontFamily: 'Outfit, sans-serif', fontSize: '22px', color: '#f59e0b', fontStyle: 'bold'
        }).setOrigin(1, 0).setDepth(30);

        // Initialize HTML HUD
        if (this.uiSongTitle) this.uiSongTitle.innerText = this.currentLevel.title;
        this.updateProgressHUD();

        document.getElementById('target-note-panel')?.addEventListener('click', () => this.playHintTone());

        // Start audio, then let the highway scroll
        try {
            await this.audioDetector.initialize();
            this.started = true;
            if (this.uiAccuracy) this.uiAccuracy.innerText = "Sing!";
        } catch (e) {
            console.error("Audio init failed", e);
            alert("Microphone access is required.");
        }
    }

    buildNotes() {
        let beatOffset = 0;
        this.currentLevel.notes.forEach((note) => {
            const y = this.getStaffYForNote(note.noteString);
            const baseX = this.hitLineX + this.leadInPx + beatOffset * this.beatPx;
            const radius = this.staffSpacing * 0.32;

            const head = this.add.circle(baseX, y, radius, 0xffffff, 0.5).setDepth(5);
            const label = this.add.text(baseX, y, note.noteString, {
                fontFamily: 'Outfit, sans-serif', fontSize: `${Math.round(radius)}px`, color: '#0f172a', fontStyle: 'bold'
            }).setOrigin(0.5, 0.5).setDepth(6);

            this.noteEntries.push({
                data: note, noteClass: getNoteClass(note.noteString),
                baseX, y, head, label, matchTime: 0, judged: 'none'
            });

            beatOffset += note.duration;
        });
    }

    drawTunerScale() {
        const letters = ['B', 'A', 'G', 'F', 'E', 'D', 'C']; // top -> bottom
        letters.forEach(letter => {
            const y = this.getStaffYForNote(letter);
            this.add.text(20, y, letter, {
                fontFamily: 'Outfit, sans-serif', fontSize: '18px', color: '#64748b', fontStyle: 'bold'
            }).setOrigin(0, 0.5).setDepth(4);
        });
    }

    // Shared mapping: a note's height on the pentagram. The tuner/pitch marker use the
    // same function, so a sung note sits at the exact height of its note on the staff.
    getStaffYForNote(noteString: string): number {
        const cMajorScaleOffset = { "C": 6, "C#": 6, "D": 5, "D#": 5, "E": 4, "F": 3, "F#": 3, "G": 2, "G#": 2, "A": 1, "A#": 1, "B": 0 };
        const base = noteString.replace(/[0-9]/g, '');
        const offset = cMajorScaleOffset[base as keyof typeof cMajorScaleOffset] ?? 3;
        return this.staffTopY + (offset * (this.staffSpacing / 2));
    }

    update(_time: number, delta: number) {
        if (!this.started || !this.audioDetector.isInitialized) return;

        // Scroll the highway
        this.scrollX -= this.scrollSpeed * (delta / 1000);

        const pitch = this.audioDetector.getPitch();
        this.updatePitchMarker(pitch);

        // Find the active note: nearest un-judged note inside the hit window
        let active: NoteEntry | null = null;
        let activeDist = Infinity;
        let nextUnjudged: NoteEntry | null = null;

        for (const e of this.noteEntries) {
            const screenX = e.baseX + this.scrollX;
            e.head.x = screenX;
            e.label.x = screenX;

            if (e.judged !== 'none') continue;
            if (!nextUnjudged) nextUnjudged = e;

            const dist = Math.abs(screenX - this.hitLineX);
            if (screenX < this.hitLineX - this.hitWindow) {
                // Slipped past the window without being sung -> miss
                this.judgeMiss(e);
            } else if (dist <= this.hitWindow && dist < activeDist) {
                active = e;
                activeDist = dist;
            }
        }

        // Highlight the active note
        this.refreshNoteVisual(active);

        // Hint-tone target + "Next" panel follow the upcoming note
        const upcoming = active ?? nextUnjudged;
        if (upcoming) {
            this.targetNoteClass = upcoming.noteClass;
            if (this.uiTargetNote) this.uiTargetNote.innerText = upcoming.data.noteString;
        }

        // Judge the active note against the sung pitch
        if (active && pitch && pitch.noteClass === active.noteClass && Math.abs(pitch.cents) <= this.centsTolerance) {
            active.matchTime += delta;
            if (this.uiAccuracy) {
                this.uiAccuracy.innerText = "HOLD IT...";
                this.uiAccuracy.style.color = "var(--warning)";
            }
            if (active.matchTime >= this.matchHoldRequired) {
                this.judgeHit(active, Math.abs(pitch.cents) <= this.centsTolerance / 2);
            }
        } else if (this.uiAccuracy) {
            this.uiAccuracy.innerText = !pitch ? "Listening..." : active ? "ALMOST..." : "Sing!";
            this.uiAccuracy.style.color = "var(--text-main)";
        }

        if (this.judgedCount >= this.noteEntries.length) {
            this.endGame();
        }
    }

    updatePitchMarker(pitch: PitchResult | null) {
        if (!this.pitchMarker) return;

        if (pitch) {
            // Singing: cancel any drop and snap the marker to the sung pitch height
            if (this.markerBounceTween) { this.markerBounceTween.stop(); this.markerBounceTween = undefined; }

            const baseY = this.getStaffYForNote(pitch.noteString);
            const y = baseY - (pitch.cents / 100) * (this.staffSpacing / 2);
            const clamped = Phaser.Math.Clamp(y, this.staffTopY - this.staffSpacing, this.staffTopY + this.staffSpacing * 4);
            this.pitchMarker.y = clamped;
            this.pitchMarker.setAlpha(1);
            this.syncPitchGuide();

            const abs = Math.abs(pitch.cents);
            const color = abs <= this.centsTolerance / 3 ? 0x10b981 : abs <= this.centsTolerance ? 0xeab308 : 0xef4444;
            this.pitchMarker.setFillStyle(color);
            this.hadPitch = true;
        } else {
            // Silence: keep the last note visible and let it gently bounce down once
            if (this.hadPitch && !this.markerBounceTween) {
                const floorY = this.staffTopY + this.staffSpacing * 4; // bottom of the pentagram
                this.markerBounceTween = this.tweens.add({
                    targets: this.pitchMarker,
                    y: floorY,
                    duration: 1500,
                    ease: 'Bounce.easeOut',
                    onUpdate: () => this.syncPitchGuide()
                });
            }
            this.hadPitch = false;
        }
    }

    private syncPitchGuide() {
        if (this.pitchGuide && this.pitchMarker) {
            this.pitchGuide.setTo(0, this.pitchMarker.y, this.cameras.main.width, this.pitchMarker.y);
        }
    }

    refreshNoteVisual(active: NoteEntry | null) {
        for (const e of this.noteEntries) {
            if (e.judged !== 'none') continue;
            if (e === active) {
                e.head.setFillStyle(0xf59e0b, 1);
                if (!e.pulse) {
                    e.pulse = this.tweens.add({ targets: e.head, scale: 1.2, yoyo: true, repeat: -1, duration: 350 });
                }
            } else {
                e.head.setFillStyle(0xffffff, 0.5);
                if (e.pulse) { e.pulse.stop(); e.pulse = undefined; e.head.setScale(1); }
            }
        }
    }

    judgeHit(e: NoteEntry, perfect: boolean) {
        e.judged = 'hit';
        e.matchTime = 0;
        if (e.pulse) { e.pulse.stop(); e.pulse = undefined; }
        this.judgedCount++;
        this.hits++;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        const multiplier = Math.min(4, 1 + Math.floor(this.combo / 5));
        this.score += (perfect ? 150 : 100) * multiplier;

        // Visuals
        e.head.setFillStyle(0x10b981, 1);
        this.tweens.add({ targets: [e.head, e.label], scale: 1.6, alpha: 0, duration: 400, onComplete: () => { e.head.destroy(); e.label.destroy(); } });
        this.confettiBurst(this.hitLineX, e.y);
        this.cameras.main.flash(120, 16, 185, 129);
        this.mozartCheer();

        if (this.uiAccuracy) {
            this.uiAccuracy.innerText = perfect ? "PERFECT!" : "GOOD!";
            this.uiAccuracy.style.color = perfect ? "var(--success)" : "var(--warning)";
        }
        this.updateScoreHUD();
        this.updateProgressHUD();
    }

    judgeMiss(e: NoteEntry) {
        e.judged = 'miss';
        if (e.pulse) { e.pulse.stop(); e.pulse = undefined; }
        this.judgedCount++;
        this.combo = 0;

        e.head.setFillStyle(0xef4444, 0.4);
        e.label.setAlpha(0.4);
        this.tweens.add({ targets: [e.head, e.label], alpha: 0, x: e.head.x - 40, duration: 350, onComplete: () => { e.head.destroy(); e.label.destroy(); } });
        this.mozartSlump();

        if (this.uiAccuracy) {
            this.uiAccuracy.innerText = "MISS";
            this.uiAccuracy.style.color = "var(--danger)";
        }
        this.updateScoreHUD();
        this.updateProgressHUD();
    }

    // --- Mozart reactions (single sprite, driven by tweens on separate properties) ---
    mozartCheer() {
        this.mozartSprite.setTint(0x86efac);
        this.tweens.add({
            targets: this.mozartSprite,
            scaleX: this.mozartBaseScale * 1.2, scaleY: this.mozartBaseScale * 1.2,
            y: this.mozartBaseY - this.staffSpacing * 0.4,
            yoyo: true, duration: 180, ease: 'Quad.easeOut',
            onComplete: () => { this.mozartSprite.clearTint(); this.mozartSprite.setScale(this.mozartBaseScale); this.mozartSprite.y = this.mozartBaseY; }
        });
    }

    mozartSlump() {
        this.mozartSprite.setTint(0xfca5a5);
        this.tweens.add({
            targets: this.mozartSprite, angle: 6, yoyo: true, repeat: 1, duration: 90,
            onComplete: () => { this.mozartSprite.clearTint(); this.mozartSprite.angle = 0; }
        });
    }

    confettiBurst(x: number, y: number) {
        const colors = [0x10b981, 0xf59e0b, 0x8b5cf6, 0xeab308, 0xffffff];
        for (let i = 0; i < 16; i++) {
            const p = this.add.rectangle(x, y, Phaser.Math.Between(4, 9), Phaser.Math.Between(4, 9),
                colors[Phaser.Math.Between(0, colors.length - 1)]).setDepth(20);
            const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const dist = Phaser.Math.Between(50, 140);
            this.tweens.add({
                targets: p,
                x: x + Math.cos(ang) * dist,
                y: y + Math.sin(ang) * dist + 70, // gravity bias
                angle: Phaser.Math.Between(-180, 180),
                alpha: 0, scale: 0.2,
                duration: Phaser.Math.Between(500, 950), ease: 'Cubic.easeOut',
                onComplete: () => p.destroy()
            });
        }
    }

    updateScoreHUD() {
        if (this.scoreText) this.scoreText.setText(`${this.score}`);
        if (this.comboText) {
            const multiplier = Math.min(4, 1 + Math.floor(this.combo / 5));
            this.comboText.setText(this.combo >= 2 ? `${this.combo} combo  x${multiplier}` : '');
        }
    }

    updateProgressHUD() {
        if (this.uiProgressFill && this.uiSongProgressText) {
            const pct = Math.floor((this.judgedCount / this.noteEntries.length) * 100);
            this.uiProgressFill.style.width = `${pct}%`;
            this.uiSongProgressText.innerText = `${pct}%`;
        }
    }

    endGame() {
        if (!this.started) return;
        this.started = false;
        this.audioDetector.stop();

        const total = this.noteEntries.length;
        const pct = Math.round((this.hits / total) * 100);
        const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0;

        const w = this.cameras.main.width;
        const h = this.cameras.main.height;
        this.add.rectangle(w / 2, h / 2, w, h, 0x0f172a, 0.7).setDepth(40);
        this.add.text(w / 2, h / 2 - 80, '★'.repeat(stars) + '☆'.repeat(3 - stars), {
            fontFamily: 'Outfit, sans-serif', fontSize: '64px', color: '#f59e0b'
        }).setOrigin(0.5).setDepth(41);
        this.add.text(w / 2, h / 2, `${pct}% hit  •  ${this.score} pts`, {
            fontFamily: 'Outfit, sans-serif', fontSize: '36px', color: '#f8fafc', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(41);
        this.add.text(w / 2, h / 2 + 50, `Best combo: ${this.maxCombo}`, {
            fontFamily: 'Outfit, sans-serif', fontSize: '22px', color: '#94a3b8'
        }).setOrigin(0.5).setDepth(41);

        if (this.uiAccuracy) {
            this.uiAccuracy.innerText = "SONG COMPLETE!";
            this.uiAccuracy.style.color = "var(--success)";
        }

        this.time.delayedCall(4000, () => {
            document.getElementById('ui-overlay')?.classList.add('hidden');
            document.getElementById('start-menu')?.classList.remove('hidden');
            this.scene.start('MenuScene');
        });
    }

    playHintTone() {
        if (this.targetNoteClass < 0) return;
        const freq = 440 * Math.pow(2, (this.targetNoteClass - 9) / 12);
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.5, ctx.currentTime + 0.7);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.0);
        osc.onended = () => ctx.close();

        const panel = document.getElementById('target-note-panel');
        if (panel) {
            panel.classList.add('playing');
            setTimeout(() => panel.classList.remove('playing'), 1000);
        }
    }
}
