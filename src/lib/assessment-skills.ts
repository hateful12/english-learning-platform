export const ASSESSMENT_SKILLS = ["reading", "writing", "listening", "speaking"] as const;
export type AssessmentSkill = (typeof ASSESSMENT_SKILLS)[number];

export function isAssessmentSkill(s: string): s is AssessmentSkill {
  return (ASSESSMENT_SKILLS as readonly string[]).includes(s);
}

export const SKILL_LABELS: Record<AssessmentSkill, string> = {
  reading: "Reading",
  writing: "Writing",
  listening: "Listening",
  speaking: "Speaking",
};

export const SKILL_ICONS: Record<AssessmentSkill, string> = {
  reading: "📖",
  writing: "✍️",
  listening: "🎧",
  speaking: "🗣️",
};

export const SKILL_BLURBS: Record<AssessmentSkill, string> = {
  reading: "Short passages and comprehension questions matched to your level.",
  writing: "Short writing tasks — AI feedback on grammar, vocabulary, and structure.",
  listening: "Short scripts (as if you heard them) plus comprehension questions.",
  speaking: "Role-play prompts — type what you would say aloud; AI comments on naturalness and clarity.",
};
