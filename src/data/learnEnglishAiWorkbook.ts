/**
 * Prompt templates adapted from "Learn English with AI" workbook structure (Luke Priddy).
 * For private / licensed use. Replace `{Placeholders}` before sending.
 */

export type LearnEnglishAiPrompt = {
  id: string;
  category: string;
  title: string;
  description?: string;
  template: string;
};

export function placeholdersInTemplate(template: string): string[] {
  const re = /\{[^}]+\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const t = template;
  re.lastIndex = 0;
  while ((m = re.exec(t)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      out.push(m[0]);
    }
  }
  return out;
}

export const LEARN_ENGLISH_AI_PROMPTS: LearnEnglishAiPrompt[] = [
  {
    id: "vocabulary-word-profile",
    category: "Vocabulary & phrases",
    title: "Word profile",
    description: "Forms, meanings (up to five), and example sentences for one word.",
    template: `Act as an English teacher. I will give you English words. For each word, list the forms of the word. Then, give simple explanations for each using basic vocabulary. If there are multiple definitions, do not give more than five. Finally, provide two common example sentences to show the meaning in different contexts. The first word is "{Your Word}".`,
  },
  {
    id: "idiom-phrasal-in-context",
    category: "Vocabulary & phrases",
    title: "Phrasal verb in your sentence",
    description: "Explain a phrasal verb as used in a sentence you provide, plus more examples and other meanings.",
    template: `Using simple language, explain the meaning of "{Your Phrasal Verb}" as it is used in the sentence below.\nThen, give me three more sentences using it in the same sense.\nFinally, if it has other meanings, explain each one with examples.\n\nMy sentence: {Your Sentence}`,
  },
  {
    id: "idiom-deep-dive",
    category: "Vocabulary & phrases",
    title: "Idiom deep dive",
    description: "Meaning, origin, examples, quiz, and how common the idiom is.",
    template: `Explain the idiom "{Your Idiom}" with simple and concise language including the following:\nAn explanation of the meaning or meanings\nThe etymology or origin\n3 unique real-life examples with the idiom in bold\nA challenging multiple-choice quiz to test my understanding (do not give the answers)\nIs this a common idiom in modern English? Does it have any connotations?`,
  },
  {
    id: "grammar-sentence-breakdown",
    category: "Grammar",
    title: "Sentence structure breakdown",
    description: "Simplified version, clause breakdown, and parallel-structure example.",
    template: `Help me understand the grammar and sentence structure of the sentence I provide. Use simple language to explain. Use separate sections with bold headings. Include the following:\n• A simplified version of the sentence using the same structure.\n• A breakdown of the sentence structure into clauses and units.\n• A different sentence with the same grammatical structure but different meaning.\nHere is the sentence: {Your Sentence}`,
  },
  {
    id: "grammar-gerunds-infinitives-overview",
    category: "Grammar",
    title: "Gerunds vs infinitives — overview",
    description: "Explanation, examples, and a practice prompt from the model.",
    template: `Help me understand when to use gerunds and infinitives naturally in sentences. Use simple language to explain. Separate sections with bold headings. Include the following:\n• Simple explanation\n• Clear examples\n• A practice prompt`,
  },
  {
    id: "grammar-interactive-lesson",
    category: "Grammar",
    title: "Interactive grammar lesson (part by part)",
    description: "The model teaches one topic in parts and checks understanding before continuing.",
    template: `Act as an English teacher. Give me a simple and interactive grammar lesson on the topic of {Your Grammar Topic}. Don't explain everything at once. The lesson should be conducted in parts.\nAfter each part, check my understanding before you proceed.\nIf an example I provide is awkward or unnatural, explain why. And, make any corrections. Confirm with me before we proceed to the next part of the lesson.\nIn the lesson, include clear examples, simple explanations, and challenging exercises to test my understanding. Do not teach me outdated or uncommon English grammar.\nAt the end of the lesson, give me a challenging assignment that I can work on after the lesson.`,
  },
  {
    id: "media-tv-quote",
    category: "Media & reading",
    title: "Quote from TV or film",
    description: "Meaning, tone, and pop-culture notes.",
    template: `Please explain the meaning of this quote from an episode of {TV Show Episode}.\nExplain any social connotations, undertones, or pop-culture references.\nHere is the quote: {Your Quote}`,
  },
  {
    id: "media-pop-culture",
    category: "Media & reading",
    title: "Pop-culture reference",
    description: "Meaning, usage, and origin of a reference you heard.",
    template: `I want to understand a pop-culture reference that I heard. Please explain the meaning, connotation, typical usage, and the origin of the reference. Use simple and concise language.\nReference: {Quote or Reference}`,
  },
  {
    id: "media-movie-lines",
    category: "Media & reading",
    title: "Lines from a movie or show",
    description: "Paste lines one at a time; model explains and gives reusable examples.",
    template: `I'm watching {Movie or TV Show Title} and using it to improve my English. I will paste lines from the movie here. For each one, I want you to explain what it means, including the connotations or implied meanings, then give me 3 more examples of how I could use it in different situations. Use simple and clear English. Say "I understand" if you understand.`,
  },
  {
    id: "reading-word-in-context",
    category: "Media & reading",
    title: "Word or phrase in context",
    description: "Meaning in your excerpt plus two new example sentences.",
    template: `In simple and concise language, explain the meaning(s) of "{Your Word or Phrase}" in the context of this sentence. Then, provide two example sentences using it in the same sense, but different situations.\nHere is the excerpt: {Your Excerpt}`,
  },
  {
    id: "reading-dense-quotation",
    category: "Media & reading",
    title: "Dense quotation — plain explanation",
    description: "Paraphrase and analogies for a hard quote.",
    template: `As a patient teacher, use ordinary and concise language to explain the meaning of my quotation. Use analogies or examples to make it more clear.\nHere is my quotation: {Your Quotation}`,
  },
  {
    id: "words-compare-pair",
    category: "Vocabulary & phrases",
    title: "Compare two words",
    description: "Overlap, differences, and two challenge questions.",
    template: `Explain the similarities and differences between the word "{Your Word A}" and the word "{Your Word B}". Start with the overlapping meaning(s) and then explain where they are different. Use simple and concise language to explain.\nFinally, ask two challenging questions to help test my understanding of the differences and similarities.`,
  },
  {
    id: "grammar-which-better",
    category: "Grammar",
    title: "Which phrasing is better?",
    description: "Quick grammar or usage comparison.",
    template: `Is it grammatically better to say "{Your First Text}" or "{Your Second Text}"? Give concise details to explain.`,
  },
  {
    id: "grammar-check-sentence",
    category: "Grammar",
    title: "Check one sentence",
    description: "Correctness, naturalness, structure; bold corrections + simple variation.",
    template: `{Your Sentence}\nCheck this for the following:\n• Grammatical correctness\n• Whether it uses natural and common phrasing\n• Overall sentence structure\nIf any revisions or corrections are needed, mark changes in bold, then explain each revision or correction. Finally, write a simple variation in an ordinary style that matches the original.`,
  },
  {
    id: "grammar-correct-paragraph",
    category: "Grammar",
    title: "Correct grammar & spelling (paragraph)",
    description: "Bold corrections with explanations.",
    template: `Correct the grammar and spelling of the following text, marking changes in bold. Then explain the corrections.\n"{Your Sentence or Paragraph}"`,
  },
  {
    id: "pronunciation-respelling-simple",
    category: "Pronunciation",
    title: "Phonetic respelling (stress in CAPS)",
    description: "No IPA — plain letters.",
    template: `"{Your Word}"\nProvide the phonetic respelling of this word, including the syllable stress in all caps.\nDon't use phonetic symbols.`,
  },
  {
    id: "pronunciation-breakdown",
    category: "Pronunciation",
    title: "Full pronunciation breakdown",
    description: "Sound comparisons, schwa, alternate pronunciations.",
    template: `Provide the phonetic spelling of the word "{Your Word}" including the word stress in all caps. Do not use phonetic symbols. Only common letters. Provide a full breakdown of the word with comparisons of the sounds to other words with the same sounds. Mention any schwa sounds or alternate pronunciations.`,
  },
  {
    id: "pronunciation-strip-quotes",
    category: "Pronunciation",
    title: "Strip quotes for reading practice",
    description: "Clean text for shadowing / TTS.",
    template: `Remove the quotes from the following text. Don't change anything else. Don't say anything else.\n{Your Passage}`,
  },
  {
    id: "phrases-situation",
    category: "Real-world English",
    title: "Useful phrases for a situation",
    description: "Varied lines you can use in meetings, travel, etc.",
    template: `Give me a varied list of useful common English phrases for the following situation.\nSituation: {Your Situation}`,
  },
  {
    id: "interview-questions",
    category: "Real-world English",
    title: "Interview question list",
    description: "Customize role, company, and requirements.",
    template: `I need a list of interview questions to help me prepare for an upcoming job interview with {Company}.\nContext: {Interview Context}\nRequirements: {Clarification and Details}`,
  },
  {
    id: "conversation-partner",
    category: "Practice & exams",
    title: "Conversation practice partner",
    description: "One question at a time; casual, supportive tone.",
    template: `Imagine you are a conversation practice partner. Your goal is to engage in meaningful conversations with me, {Your Name}, to improve my speaking skills. Each prompt should encourage your partner to share their thoughts and opinions. Remember to actively listen and respond appropriately.\nTopic: {Your Topic}\nRole: Conversation Practice Partner\nStyle: Avoid being overly enthusiastic. Communicate using casual yet respectful language. Don't use flowery language or too many exclamations.\nInstructions:\n1. Provide a conversation prompt related to a specific topic.\n2. Wait for my response. Only ask one thing at a time.\n3. Respond to my answers, showing genuine interest and asking follow-up questions but don't give long-winded replies.\n4. Encourage me to express my thoughts and opinions in a friendly and supportive manner.\n5. Aim to have a balanced conversation, allowing both of us to contribute.\nRemember to keep the conversation going in an intuitive way, while helping me practice my speaking skills. After each question, wait for my response.`,
  },
  {
    id: "conversation-interviewer",
    category: "Practice & exams",
    title: "Job interview practice",
    description: "Interviewer mode: one question at a time, professional tone.",
    template: `Imagine you are an interviewer. Your goal is to conduct an interview with me, {Your Name}, to evaluate whether I am a good fit for the position. I am interviewing for the position of {Your Role} at {Company}. You want to test my qualifications, character, and overall culture fit. Ask challenging questions and do not be overly friendly or enthusiastic. Only ask one question at a time and then wait for my reply before asking a follow-up question or moving on to the next topic.\n\nCompany culture (optional context): {Company Culture}\nInstructions:\n1. Provide questions and push for more details if an answer is not detailed enough.\n2. Ask for specific examples of experience and examples that demonstrate character traits.\n3. Ask a wide range of questions to evaluate my character, knowledge, culture fit, and better understand my working experience.\n4. Do not ask more than 10 questions.`,
  },
  {
    id: "class-casual-simple",
    category: "Practice & exams",
    title: "Casual class (simple)",
    description: "Teacher asks about a topic one question at a time; corrects mistakes.",
    template: `I want you to act as an English teacher. I will be the student, and you will ask me questions about the topic of {Your Topic}. I want you to only reply as the teacher. Do not write all the conversation at once. Ask me the questions and wait for my answers. If I make any English mistakes, I want you to correct me and explain the correction. Give a clear explanation of each correction. Ask me the questions one by one and wait for my answers.\nAfter 4 or 5 questions, give me more feedback on the whole discussion.\nLet's begin.`,
  },
  {
    id: "class-casual-alternate",
    category: "Practice & exams",
    title: "Casual class (alternate)",
    description: "Relaxed lesson with vocabulary/idiom upgrades and end recap.",
    template: `Imagine you are an AI-powered English language teacher available on-demand for casual English classes. Your goal is to provide a brief, engaging, and interactive lesson to me ({Your Name}) in order to help me improve my English skills in a relaxed and informal setting. In this lesson, you will create engaging conversation prompts and responses tailored to my individual needs. Remember to be patient, supportive, and encourage me to practice English speaking skills.\nTopic: {Your Topic}\nInstructions:\n1. Respond to my answers naturally, providing general feedback, suggestions, and corrections when necessary.\n2. Only ask one question at a time and wait for my reply.\n3. Encourage me to express myself freely and ask follow-up questions for clarification.\n4. Share any new useful English words or idioms that are relevant to the topic, and that I might not know.\n5. Create a comfortable and friendly learning environment, fostering a relaxed and informal atmosphere.\n6. At the end of the lesson, do a recap of feedback. Be sure to cite specific things I said in your feedback.`,
  },
  {
    id: "class-intensive-prompt1",
    category: "Practice & exams",
    title: "Intensive class — step 1 (confirm)",
    description: "Send this first; wait for “I understand”, then send step 2 in the same chat.",
    template: `Act as a professional ESL teacher with the objective of helping me ({Your Name}) improve my overall English fluency. This will be a back-and-forth lesson in which I will respond to your questions and tasks. You will teach me a comprehensive lesson on the topic below. Push me to practice my English, but emphasize key learnings and clear feedback. Make corrections and always cite specifically what was said in your corrections. Also, give general feedback with improvements I could make to my English in order to help me reach the next level. The lesson should have at least three questions, prompts, or tasks on the topic.\nLesson topic: {Your Topic}\nMy English level: {Your Level}\nIn my next message, I will share in-depth instructions for how to conduct the lesson. If you understand, please say "I understand" and then wait for my instructions.`,
  },
  {
    id: "class-intensive-prompt2",
    category: "Practice & exams",
    title: "Intensive class — step 2 (start lesson)",
    description: "Send after the model says “I understand”.",
    template: `Here are the lesson instructions. Your next message should be a message to begin the lesson based on these instructions, and the topic I have provided.\nInstructions:\n1. Begin the class by introducing the topic or concept that will be covered in the intensive lesson.\n2. Give at least three questions, prompts, or tasks before doing a lesson recap with final feedback.\n3. Don't give too much feedback after each of my answers.\n4. Provide a practice activity or task that allows me to apply the newly learned material.\n5. Respond to my answers, providing detailed explanations, corrections, and improvements to my English.\n6. Encourage me to ask questions and seek clarification on any confusing concepts.\n7. Throughout the lesson, highlight key words or phrases that are relevant to the topic and appropriate for my level.\n8. At the end of the lesson, provide a recap of everything covered, including key words, corrections, and important grammar points.`,
  },
  {
    id: "exercise-grammar-challenges",
    category: "Practice & exams",
    title: "Three grammar challenges",
    description: "Includes an essay-style prompt among exercises.",
    template: `Create three challenges to help me practice my usage of English grammar.\nGrammar I want to practice: {Your Grammar Topic}\nRequirements:\nEach practice exercise should be different and push me to apply my knowledge and understanding.\nInclude an essay prompt as one of the exercises.`,
  },
  {
    id: "exercise-idiom-challenges",
    category: "Practice & exams",
    title: "Three idiom challenges",
    description: "MCQ, examples, synonyms/antonyms, creative prompts.",
    template: `Create three challenges to help me practice my use of English idioms.\nIdioms I want to practice:\n{Idiom 1}\n{Idiom 2}\nRequirements:\nEach practice exercise should be different and push me to apply my knowledge and understanding. Include:\n1. Multiple-choice questions to test my comprehension of the idiom's meaning and usage.\n2. Example sentences that showcase different contexts in which the idiom can be used.\n3. Synonyms and antonyms for the idiom "{Your Idiom}"\n4. Creative writing prompts that incorporate the idiom to help me practice using it in different scenarios.`,
  },
  {
    id: "exercise-vocab-challenges",
    category: "Practice & exams",
    title: "Three vocabulary challenges",
    description: "Fill-in-the-blank (10), multiple choice, separate sections.",
    template: `Create three challenges to help me practice my use of English vocabulary. Create a separate section with a bold heading for each challenge.\nVocabulary I want to practice:\n{Vocabulary 1}\n{Vocabulary 2}\nRequirements:\nEach practice exercise should test my knowledge.\nInclude a fill-in-the-blank challenge with 10 questions that uses the target words in different forms, tenses, and senses.\nInclude multiple-choice questions.`,
  },
  {
    id: "video-transcript-workout",
    category: "Media & reading",
    title: "Video transcript — summary & quiz",
    description: "Paste a transcript; get summary, 10 questions, vocabulary list, discussion questions.",
    template: `Create a bullet point summary based on the transcript. Include specific important information.\nBased on the transcript, create a list of 10 questions to challenge my comprehension of the topic.\nProvide a list of challenging words and phrases mentioned in the video transcript. For each, give a brief definition.\nCreate three open discussion questions based on the summary.\nHere is the transcript:\n{Video Transcript}`,
  },
  {
    id: "ielts-format",
    category: "Practice & exams",
    title: "IELTS speaking — share format",
    description: "First message; model replies “I understand” then you continue with parts.",
    template: `Help me practice for the IELTS speaking exam. First, I am going to provide the exam format. If you understand the format, say "I understand" then let me know when you are ready to begin". Do not say anything else, and wait for my next request.\n\nPart 1 - The examiner will ask you a variety of general questions about your personal life and other common subjects, like your home, family, professional life, academics, and hobbies. This part takes about 5 minutes.\nTask Purpose: This part of the exam is designed to evaluate the examinee's ability to express opinions and share information on everyday topics and common experiences by answering a series of questions.\nPart 2 - You'll be handed a card that prompts you to talk about a specific topic. You will get a minute to organize your thoughts before you speak for up to two minutes. Afterward, the examiner will pose one or two queries related to the same subject.\nTask Purpose: This part of the test examines the examinee's ability to talk at length on a given topic (without further prompts from the examiner), use natural language, and organize their ideas coherently.\nPart 3 - You will be asked additional questions related to the subject matter from Part 2. This segment of the exam lasts about four to five minutes.\nTask Purpose: This part of the examination assesses the examinee's ability to express and justify their opinions, and to analyze, discuss, and speculate about issues.`,
  },
  {
    id: "ielts-part1",
    category: "Practice & exams",
    title: "IELTS Part 1 practice",
    description: "One question at a time; feedback at end of part 1.",
    template: `In the role of IELTS examiner, help me practice IELTS part 1 based on the criteria I have provided. Only ask one question at a time, then wait for my reply. At the end of our part 1 practice, provide some general feedback.`,
  },
  {
    id: "ielts-part2",
    category: "Practice & exams",
    title: "IELTS Part 2 practice",
    description: "Model creates a Part 2 card and gives feedback on your long turn.",
    template: `I want to practice an IELTS part 2 question based on the criteria. As the examiner, create a unique part 2 prompt. Based on my full reply, please give me general and specific feedback based on the scoring criteria of the IELTS speaking exam.`,
  },
  {
    id: "toefl-speaking",
    category: "Practice & exams",
    title: "TOEFL speaking practice",
    description: "Specify question number and topic; feedback on delivery and language use.",
    template: `I want you to help me practice the {Question Number} of the TOEFL speaking exam, focusing on {Your General Topic}. Provide the prompt and wait for my reply.\nBased on my answer, give me feedback using the scoring criteria of the TOEFL independent speaking section, including general description, delivery, language use, and topic development. Cite specific examples of things I said when giving feedback. Also, give broad feedback that would help me improve my response. Try to give specific examples to support any general feedback.`,
  },
  {
    id: "pronunciation-paragraph-drill",
    category: "Pronunciation",
    title: "Paragraph for weak sounds",
    description: "Model writes a paragraph packed with your target sounds.",
    template: `Give me a paragraph to help me work on my weak areas of English pronunciation. The paragraph should include as many of these sounds as possible.\nThese are the sounds I am struggling with:\n1 - The '{Your Sound 1}' sound in words like '{Your Word 1}' and '{Your Word 2}'\n2 - The voiced '{Your Sound 2}' sound in words like 'this' and 'father'\n3 - The '{Your Sound 3}' and '{Your Sound 4}' sounds.`,
  },
  {
    id: "immersion-digest",
    category: "Learning with AI",
    title: "English learning digest",
    description: "Asks for varied recent content; results depend on model web access (may be limited).",
    template: `Generate a fresh English learning digest. Prioritize recent, diverse sources where possible.\n1 - Suggest an interesting grammar or usage point useful for intermediate to advanced learners, with a concise explanation (you may illustrate with a short example).\n2 - Recommend a TED talk: include title, brief summary, and why it helps English learners.\n3 - Suggest two article topics or themes worth reading this week for vocabulary and ideas, with a one-line rationale each.\n4 - Pick one useful idiom or phrasal verb, define it, and give two example sentences.\n5 - Share short reflections or discussion questions based on the above.\nUse clear formatting rather than a wall of words.`,
  },
  {
    id: "feedback-simple-corrections",
    category: "Feedback & level",
    title: "Simple corrections (bold changes)",
    description: "Spelling, grammar, syntax — corrections in bold.",
    template: `I want you to correct the spelling, grammar, syntax, and structure of the text. Show the corrections in bold so that I can see what has been corrected.\nHere is the text:\n{Your Text}`,
  },
  {
    id: "feedback-email-rewrite",
    category: "Feedback & level",
    title: "Rewrite keeping voice",
    description: "Revise an email; maintain style (example: no em dashes).",
    template: `Give me a revised version of the following email to my colleague. Maintain the voice and style. Avoid em dashes.\nHere is the email:\n{Your Email}`,
  },
  {
    id: "feedback-copyeditor",
    category: "Feedback & level",
    title: "Copyeditor + change list",
    description: "Full revision matching tone; list every change with reasons.",
    template: `Act as a copyeditor and correct any spelling, grammar, syntax, and odd phrasing issues in the text I provide. Make a full revision with the improvements you make but match the overall tone and style of the original.\nList every change that you made below the revised version and explain each change that was made, and why you made it.\nHere is the text:\n{Your Text}`,
  },
  {
    id: "feedback-cover-letter",
    category: "Feedback & level",
    title: "In-depth feedback (no rewrite)",
    description: "Strategic feedback on tone, structure, clarity for cover letters or essays.",
    template: `Give me general in-depth feedback on how to improve my text considering that I want to accomplish the following:\nTone: {Adjectives that Describe Your Tone}\nStyle: {Desired Style}\nPurpose: {Main Goal}\nInstructions:\nDo not write a revised version. Only provide specific points of feedback on how to improve my text.\nHere it is:\n{Your Text}`,
  },
  {
    id: "cefr-prompt1",
    category: "Feedback & level",
    title: "CEFR assessment — guidelines",
    description: "Send first; wait for “I understand”, then send your writing sample.",
    template: `I want you to act as an English teacher and professional English level assessor based on CEFR. First, learn the following CEFR guidelines for assessing English fluency. If you understand, say "I understand".\nHere are the guidelines:\nA1 (Beginner)\nA2 (Elementary)\nB1 (Intermediate)\nB2 (Upper Intermediate)\nC1 (Advanced)\nAccuracy: Makes frequent basic grammatical errors, but can still communicate simple ideas. Can construct simple sentences but still makes grammatical errors. Has reasonable control over common structures, but still makes noticeable grammatical errors. Has good control of grammar and syntax, with occasional inaccuracies. Has full operational command of the language, with occasional unsystematic errors.\nCoherence: Can link words or groups of words with basic linear connectors like "and" or "then." Can link groups of words with simple connectors like "and", "but" and "because." Can link sentences together and keep a point of view throughout an extended text. Can use a variety of linking words to connect sentences together into clear, detailed text. Can produce clear, smoothly flowing, complex reports, articles or essays.\nFluency: Can communicate with long pauses and may struggle to find words. Can make themselves understood in short utterances, even though pauses and false starts are frequent. Can keep going comprehensibly, even though pausing for grammatical and lexical planning and repair is very evident. Can express themselves clearly and without much sign of having to restrict what they want to say. Can express themselves fluently and convey finer shades of meaning precisely.\nRange: Can use basic sentence structures and phrases, has a very basic command of the language. Has a limited repertoire of short memorized phrases covering predictable survival situations. Has sufficient vocabulary to express themselves on most familiar topics. Has a good range of vocabulary for matters connected to their field and most general topics. Can use language flexibly and effectively for social, academic, and professional purposes.`,
  },
  {
    id: "cefr-prompt2",
    category: "Feedback & level",
    title: "CEFR assessment — your sample",
    description: "Send after step 1; include 200+ words for best results.",
    template: `I want you to use the guidelines to assess my English. Give an accurate level assessment and a full breakdown of the basis for your assessment. Next, give me specific suggestions for how I can improve and be sure to cite specific examples based on the text.\nThis is what I want you to assess:\n{Your Writing Sample}`,
  },
];
