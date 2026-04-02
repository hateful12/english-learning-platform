import type { AssessmentSkill } from "@/lib/assessment-skills";

/**
 * Original training methodology for Progress Test question generation.
 * Aligned in spirit with practical AI-tutor workbook practice (active use, real contexts, CEFR calibration)
 * without reproducing third-party prompt text.
 */

export const PROGRESS_TEST_GLOBAL_FRAMEWORK = `
Training approach (apply to everything you generate):
- Prefer realistic, usable English over isolated trivia: situations someone might read, hear, write, or say.
- Where it fits the level, note register (casual vs neutral vs formal) or typical collocations so the learner builds habits, not single answers.
- Calibrate all content to CEFR \${level}: vocabulary range, sentence complexity, discourse length, and tolerance for nuance should match standard descriptors for that band.
- Encourage depth in comprehension (inference, attitude, purpose) when the level allows; at lower levels keep questions concrete and clearly anchored in the text or script.
`.trim();

/** Per-skill addenda; \${level} placeholders are replaced by buildProgressTestFrameworkBlock. */
export const PROGRESS_TEST_SKILL_FRAMEWORK: Record<AssessmentSkill, string> = {
  reading: `
Reading-specific:
- Use one or two coherent passages in an article-like, blog-like, or short narrative style appropriate for \${level}.
- Include a mix of detail, gist, vocabulary-in-context, and (if \${level} allows) light inference or attitude.
- Avoid trick questions; wrong options should be plausible but clearly ruled out by the passage.
`.trim(),

  listening: `
Listening-specific:
- Scripts should sound like spoken English (dialogue or monologue): natural phrasing, contractions, and informal chunks where appropriate for \${level}.
- Questions should test what a listener would reasonably retain (main idea, detail, speaker intent, next step)—not spelling or obscure wording.
`.trim(),

  writing: `
Writing-specific:
- Tasks should mirror real outputs at \${level}: messages, emails, short posts, summaries, or brief opinions with a clear audience and purpose.
- Instructions should make the genre and length obvious; one task may invite a slightly more formal or structured piece if \${level} supports it.
`.trim(),

  speaking: `
Speaking-specific:
- Prompts are spoken scenarios: requests, reactions, plans, service situations, or short discussions—what the learner would say aloud, not an essay.
- Keep role and relationship clear (peer, colleague, stranger, etc.) so answers can be judged for appropriateness at \${level}.
`.trim(),
};

export function buildProgressTestFrameworkBlock(skill: AssessmentSkill, level: string): string {
  const global = PROGRESS_TEST_GLOBAL_FRAMEWORK.replace(/\$\{level\}/g, level);
  const skillPart = PROGRESS_TEST_SKILL_FRAMEWORK[skill].replace(/\$\{level\}/g, level);
  return `${global}\n\n${skillPart}`;
}
