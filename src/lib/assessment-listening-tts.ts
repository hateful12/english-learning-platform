import fs from "fs/promises";
import path from "path";
import type OpenAI from "openai";

const MAX_TTS_CHARS = 4096;

/**
 * Writes MP3 files to public/assessment-audio/{questionId}.mp3 via OpenAI speech API.
 * Returns map questionId -> public URL path (e.g. /assessment-audio/cuid.mp3).
 */
export async function generateListeningAudioFiles(
  openai: OpenAI,
  rows: { id: string; listeningTranscript: string | null }[]
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const dir = path.join(process.cwd(), "public", "assessment-audio");
  await fs.mkdir(dir, { recursive: true });

  for (const row of rows) {
    const text = row.listeningTranscript?.trim();
    if (!text) continue;
    const input = text.slice(0, MAX_TTS_CHARS);
    try {
      const speech = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input,
        response_format: "mp3",
      });
      const buf = Buffer.from(await speech.arrayBuffer());
      const filename = `${row.id}.mp3`;
      await fs.writeFile(path.join(dir, filename), buf);
      urls.set(row.id, `/assessment-audio/${filename}`);
    } catch (err) {
      console.error("OpenAI TTS failed for question", row.id, err);
    }
  }

  return urls;
}
