import { PitchDetector } from "pitchy";

export type PitchResult = {
    frequency: number;
    clarity: number;
    noteString: string;
    noteClass: number; // 0-11 (C=0, C#=1, etc.)
    cents: number;
};

// Map MIDI note number to string representation
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export class AudioPitchDetector {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private micStream: MediaStream | null = null;
    private detector: PitchDetector<Float32Array> | null = null;
    private inputBuffer: any = new Float32Array(0);

    public isInitialized = false;

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;

            const source = this.audioContext.createMediaStreamSource(this.micStream);
            source.connect(this.analyser);

            this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize);
            this.inputBuffer = new Float32Array(this.detector.inputLength);

            // AudioContext might be suspended if not started by user interaction
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.isInitialized = true;
        } catch (err) {
            console.error("Failed to initialize audio or microphone:", err);
            throw err;
        }
    }

    getPitch(): PitchResult | null {
        if (!this.isInitialized || !this.analyser || !this.detector || !this.audioContext) return null;

        this.analyser.getFloatTimeDomainData(this.inputBuffer);
        // @ts-ignore
        const [pitch, clarity] = this.detector.findPitch(this.inputBuffer, this.audioContext.sampleRate);

        if (clarity < 0.8 || pitch < 40 || pitch > 2000) {
            return null; // Not clear enough or out of range
        }

        // MIDI formula: 69 + 12 * log2(freq / 440)
        const midiExact = 69 + 12 * Math.log2(pitch / 440);
        const midiRounded = Math.round(midiExact);
        const cents = Math.round((midiExact - midiRounded) * 100);
        
        const noteClass = ((midiRounded % 12) + 12) % 12; // ensure positive modulo
        const noteString = noteStrings[noteClass];

        return {
            frequency: pitch,
            clarity,
            noteString,
            noteClass,
            cents
        };
    }

    stop() {
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.isInitialized = false;
    }
}
