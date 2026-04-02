export type ExerciseTypeDef = {
  id: string;
  title: string;
  description: string;
  /** Passed to the model as the focus of the exercise. */
  focus: string;
  /** If true, the card is shown but cannot be started yet. */
  availableSoon?: boolean;
};

/** Types shown in the student AI practice tab (other skills are hidden for now). */
export const EXERCISE_TYPES: ExerciseTypeDef[] = [
  {
    id: "speaking-prep",
    title: "Speaking practice",
    description: "Speak or type: record your voice, upload audio, or write your answers.",
    focus:
      "spoken English: short prompts the student can answer aloud; they may submit voice recordings (transcribed for feedback) or text",
  },
  {
    id: "grammar",
    title: "Grammar in use",
    description: "Tenses, prepositions, word order, and sentence patterns.",
    focus:
      "varied grammar practice: different structures per task (tenses, modals, passive, conditionals, prepositions, clauses, etc.) — not the same transformation drill repeated",
    availableSoon: true,
  },
];
