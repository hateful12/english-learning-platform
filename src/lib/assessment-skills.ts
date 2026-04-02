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
  reading: "Article- or story-style passages with gist, detail, and vocabulary-in-context — tuned to your CEFR level.",
  writing: "Real-world writing (messages, emails, short opinions) with feedback on clarity, tone, and accuracy.",
  listening: "Play AI-generated audio for each clip, then answer — natural dialogue or monologue at your level.",
  speaking: "Everyday scenarios — you type what you would say aloud; feedback focuses on natural, appropriate phrasing.",
};
