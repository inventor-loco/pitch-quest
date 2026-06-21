export type Note = {
    noteString: string; // e.g., "C", "D", "E"
    duration: number; // relative duration (e.g., 1 = quarter note, 2 = half note)
};

export type Level = {
    title: string;
    notes: Note[];
};

export const levels: Level[] = [
    {
        title: "Hot Cross Buns",
        notes: [
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 2 },
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 2 },
            { noteString: "C", duration: 0.5 },
            { noteString: "C", duration: 0.5 },
            { noteString: "C", duration: 0.5 },
            { noteString: "C", duration: 0.5 },
            { noteString: "D", duration: 0.5 },
            { noteString: "D", duration: 0.5 },
            { noteString: "D", duration: 0.5 },
            { noteString: "D", duration: 0.5 },
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 2 },
        ]
    },
    {
        title: "Mary Had a Little Lamb",
        notes: [
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "E", duration: 2 },
            { noteString: "D", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "D", duration: 2 },
            { noteString: "E", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "G", duration: 2 },
        ]
    },
    {
        title: "Ode to Joy",
        notes: [
            { noteString: "E", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "F", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "F", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 1 },
            { noteString: "C", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "E", duration: 1.5 },
            { noteString: "D", duration: 0.5 },
            { noteString: "D", duration: 2 },
        ]
    },
    {
        title: "C Major Scale",
        notes: [
            { noteString: "C", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "F", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "A", duration: 1 },
            { noteString: "B", duration: 1 },
            { noteString: "C", duration: 2 },
            { noteString: "B", duration: 1 },
            { noteString: "A", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "F", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 2 },
        ]
    },
    {
        title: "A Minor Scale",
        notes: [
            { noteString: "A", duration: 1 },
            { noteString: "B", duration: 1 },
            { noteString: "C", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "F", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "A", duration: 2 },
            { noteString: "G", duration: 1 },
            { noteString: "F", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 1 },
            { noteString: "B", duration: 1 },
            { noteString: "A", duration: 2 },
        ]
    },
    {
        title: "C Major Pentatonic Scale",
        notes: [
            { noteString: "C", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "A", duration: 1 },
            { noteString: "C", duration: 2 },
            { noteString: "A", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "C", duration: 2 },
        ]
    },
    {
        title: "Chromatic Scale",
        notes: [
            { noteString: "C", duration: 1 },
            { noteString: "C#", duration: 1 },
            { noteString: "D", duration: 1 },
            { noteString: "D#", duration: 1 },
            { noteString: "E", duration: 1 },
            { noteString: "F", duration: 1 },
            { noteString: "F#", duration: 1 },
            { noteString: "G", duration: 1 },
            { noteString: "G#", duration: 1 },
            { noteString: "A", duration: 1 },
            { noteString: "A#", duration: 1 },
            { noteString: "B", duration: 1 },
            { noteString: "C", duration: 2 },
        ]
    }
];

// Helper to get note class number from noteString
const noteMap: Record<string, number> = {
    "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11
};

export function getNoteClass(noteString: string): number {
    return noteMap[noteString] ?? -1;
}
