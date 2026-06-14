import Phaser from 'phaser';
import { AudioPitchDetector, type PitchResult } from '../audio/PitchDetector';
import { type Level, levels, getNoteClass } from './Levels';

export default class GameScene extends Phaser.Scene {
    private audioDetector!: AudioPitchDetector;
    private currentLevel!: Level;
    private currentNoteIndex: number = 0;
    
    private mozartSprite!: Phaser.GameObjects.Sprite;
    private notesGroup!: Phaser.GameObjects.Group;
    private staffLines: Phaser.GameObjects.Line[] = [];
    
    private targetNoteClass: number = 0;
    private heldTime: number = 0;

    private isMatching: boolean = false;
    private matchDurationRequired = 750; // ms

    // HUD Elements
    private uiTargetNote = document.getElementById('target-note');
    private uiCurrentNote = document.getElementById('current-note');
    private uiCents = document.getElementById('cents-value');
    private uiTunerNeedle = document.getElementById('tuner-needle');
    private uiAccuracy = document.getElementById('accuracy-text');
    private uiProgressFill = document.getElementById('progress-bar-fill');
    private uiSongTitle = document.getElementById('song-title');
    private uiSongProgressText = document.getElementById('song-progress-text');

    constructor() {
        super('GameScene');
    }

    init(data: { levelIndex: number }) {
        this.currentLevel = levels[data.levelIndex || 0];
        this.currentNoteIndex = 0;
        this.audioDetector = new AudioPitchDetector();
    }

    async create() {
        // Draw background
        this.cameras.main.setBackgroundColor('#0f172a'); // Match var(--bg-dark)

        // Draw Staff (5 lines)
        const staffSpacing = 40;
        const staffStartY = this.cameras.main.centerY - (staffSpacing * 2);
        const width = this.cameras.main.width;

        for (let i = 0; i < 5; i++) {
            const y = staffStartY + (i * staffSpacing);
            const line = this.add.line(0, 0, 0, y, width, y, 0xffffff, 0.2);
            line.setOrigin(0, 0);
            this.staffLines.push(line);
        }

        // Initialize HUD
        if (this.uiSongTitle) this.uiSongTitle.innerText = this.currentLevel.title;
        this.updateProgressHUD();

        // Create Notes
        this.notesGroup = this.add.group();
        this.drawNotes();

        // Create Mozart Sprite
        this.mozartSprite = this.add.sprite(100, this.getStaffYForNote(this.currentLevel.notes[0].noteString), 'mozart');
        this.mozartSprite.setScale(3); // adjust scale based on the generated pixel art
        
        // Start Audio
        try {
            await this.audioDetector.initialize();
            this.setTargetNote();
        } catch (e) {
            console.error("Audio init failed", e);
            alert("Microphone access is required.");
        }
    }

    drawNotes() {
        this.notesGroup.clear(true, true);
        const startX = 250;
        const spacingX = 150;

        this.currentLevel.notes.forEach((note, i) => {
            const y = this.getStaffYForNote(note.noteString);
            const x = startX + (i * spacingX);
            
            // Draw note head
            const noteObj = this.add.circle(x, y, 15, 0x8b5cf6);
            if (i < this.currentNoteIndex) {
                noteObj.setFillStyle(0x10b981); // green for passed notes
            } else if (i === this.currentNoteIndex) {
                noteObj.setFillStyle(0xf59e0b); // active note
                
                // Pulsing effect
                this.tweens.add({
                    targets: noteObj,
                    scale: 1.2,
                    yoyo: true,
                    repeat: -1,
                    duration: 500
                });
            } else {
                noteObj.setFillStyle(0xffffff, 0.5); // future notes
            }
            this.notesGroup.add(noteObj);
        });
    }

    // Rough mapping of notes to staff positions
    getStaffYForNote(noteString: string): number {
        const staffSpacing = 40;
        const centerY = this.cameras.main.centerY;
        
        // Let's assume Middle C (C4) is below the staff, and map roughly
        // This is a simplified visual mapping, C=0, D=2, E=4 etc.
        const cMajorScaleOffset = { "C": 6, "C#": 6, "D": 5, "D#": 5, "E": 4, "F": 3, "F#": 3, "G": 2, "G#": 2, "A": 1, "A#": 1, "B": 0 };
        const baseNoteStr = noteString.replace(/[0-9]/g, '');
        const offset = cMajorScaleOffset[baseNoteStr as keyof typeof cMajorScaleOffset] ?? 3;
        
        return (centerY - staffSpacing * 2) + (offset * (staffSpacing / 2));
    }

    setTargetNote() {
        if (this.currentNoteIndex >= this.currentLevel.notes.length) {
            this.winGame();
            return;
        }

        const note = this.currentLevel.notes[this.currentNoteIndex];
        this.targetNoteClass = getNoteClass(note.noteString);
        
        if (this.uiTargetNote) this.uiTargetNote.innerText = note.noteString;
        this.drawNotes(); // refresh colors

        // Move Mozart
        const targetX = 250 + (this.currentNoteIndex * 150);
        const targetY = this.getStaffYForNote(note.noteString) - 30; // stand on the note
        
        this.tweens.add({
            targets: this.mozartSprite,
            x: targetX,
            y: targetY,
            duration: 500,
            ease: 'Power2'
        });

        // Pan camera to follow Mozart
        this.cameras.main.pan(targetX, this.cameras.main.centerY, 500, 'Power2');
    }

    winGame() {
        this.audioDetector.stop();
        if (this.uiAccuracy) {
            this.uiAccuracy.innerText = "SONG COMPLETE!";
            this.uiAccuracy.style.color = "var(--success)";
        }
        
        // Show fireworks or return to menu after delay
        this.time.delayedCall(3000, () => {
            document.getElementById('ui-overlay')?.classList.add('hidden');
            document.getElementById('start-menu')?.classList.remove('hidden');
            this.scene.start('MenuScene');
        });
    }

    updateProgressHUD() {
        if (this.uiProgressFill && this.uiSongProgressText) {
            const pct = Math.floor((this.currentNoteIndex / this.currentLevel.notes.length) * 100);
            this.uiProgressFill.style.width = `${pct}%`;
            this.uiSongProgressText.innerText = `${pct}%`;
        }
    }

    update(_time: number, delta: number) {
        if (!this.audioDetector.isInitialized) return;

        const pitch = this.audioDetector.getPitch();

        if (pitch) {
            this.updateTunerHUD(pitch);

            // Check if pitch matches target (octave independent)
            if (pitch.noteClass === this.targetNoteClass && Math.abs(pitch.cents) <= 30) {
                if (!this.isMatching) {
                    this.isMatching = true;
                    this.heldTime = 0;
                }
                this.heldTime += delta;
                
                if (this.uiAccuracy) {
                    this.uiAccuracy.innerText = "HOLD IT...";
                    this.uiAccuracy.style.color = "var(--warning)";
                }

                if (this.heldTime >= this.matchDurationRequired) {
                    // Note successful!
                    this.isMatching = false;
                    this.heldTime = 0;
                    this.currentNoteIndex++;
                    this.updateProgressHUD();
                    
                    if (this.uiAccuracy) {
                        this.uiAccuracy.innerText = "PERFECT!";
                        this.uiAccuracy.style.color = "var(--success)";
                    }
                    
                    // Sparkle effect
                    const sparkle = this.add.circle(this.mozartSprite.x, this.mozartSprite.y, 50, 0x10b981, 0.5);
                    this.tweens.add({
                        targets: sparkle,
                        scale: 2,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => sparkle.destroy()
                    });

                    this.setTargetNote();
                }
            } else {
                this.isMatching = false;
                this.heldTime = 0;
                if (this.uiAccuracy) {
                    if (pitch.noteClass !== this.targetNoteClass) {
                        this.uiAccuracy.innerText = "WRONG NOTE";
                        this.uiAccuracy.style.color = "var(--danger)";
                    } else if (pitch.cents > 30) {
                        this.uiAccuracy.innerText = "TOO SHARP";
                        this.uiAccuracy.style.color = "var(--danger)";
                    } else {
                        this.uiAccuracy.innerText = "TOO FLAT";
                        this.uiAccuracy.style.color = "var(--danger)";
                    }
                }
            }
        } else {
            this.isMatching = false;
            this.heldTime = 0;
            // No clear pitch
            if (this.uiCurrentNote) this.uiCurrentNote.innerText = "--";
            if (this.uiTunerNeedle) this.uiTunerNeedle.style.left = "50%";
            if (this.uiTunerNeedle) this.uiTunerNeedle.style.backgroundColor = "var(--text-main)";
            if (this.uiAccuracy) {
                this.uiAccuracy.innerText = "Listening...";
                this.uiAccuracy.style.color = "var(--text-main)";
            }
            if (this.uiCents) this.uiCents.innerText = "0";
        }
    }

    updateTunerHUD(pitch: PitchResult) {
        if (this.uiCurrentNote) this.uiCurrentNote.innerText = pitch.noteString;
        if (this.uiCents) this.uiCents.innerText = pitch.cents.toString();
        
        if (this.uiTunerNeedle) {
            // Map -50 to 50 cents to 0% to 100% left position
            const pct = Math.max(0, Math.min(100, (pitch.cents + 50)));
            this.uiTunerNeedle.style.left = `${pct}%`;
            
            // Color coding
            if (Math.abs(pitch.cents) <= 10) {
                this.uiTunerNeedle.style.backgroundColor = "var(--success)";
            } else if (Math.abs(pitch.cents) <= 30) {
                this.uiTunerNeedle.style.backgroundColor = "var(--warning)";
            } else {
                this.uiTunerNeedle.style.backgroundColor = "var(--danger)";
            }
        }
    }
}
