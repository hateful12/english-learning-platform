export type ExerciseTypeDef = {
  id: string;
  title: string;
  description: string;
  /** Passed to the model as the focus of the exercise. */
  focus: string;
};

export const EXERCISE_TYPES: ExerciseTypeDef[] = [
  {
    id: "grammar",
    title: "Grammar in use",
    description: "Tenses, prepositions, word order, and sentence patterns.",
    focus: "grammar and sentence structure appropriate to the CEFR level",
  },
  {
    id: "vocabulary",
    title: "Vocabulary builder",
    description: "Word choice, collocations, and natural phrases.",
    focus: "vocabulary, collocations, and phrasal verbs where suitable",
  },
  {
    id: "writing",
    title: "Short writing",
    description: "Mini paragraphs, emails, or opinions in a few sentences.",
    focus: "writing: cohesion, clarity, and register for the level",
  },
  {
    id: "reading",
    title: "Reading & meaning",
    description: "Short texts with questions on gist, detail, and vocabulary.",
    focus: "reading comprehension: gist, detail, and vocabulary in context",
  },
  {
    id: "speaking-prep",
    title: "Speaking prep",
    description: "Speak or type: record your voice, upload audio, or write your answers.",
    focus:
      "spoken English: short prompts the student can answer aloud; they may submit voice recordings (transcribed for feedback) or text",
  },
  {
    id: "mixed",
    title: "Mixed skills",
    description: "A little grammar, vocabulary, and production together.",
    focus: "mixed grammar, vocabulary, and short production tasks",
  },
];
