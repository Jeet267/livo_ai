import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

// Export dynamic to prevent static generation failure when API key is missing
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as File;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key is missing on the server.' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert File to a format OpenAI SDK can handle
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const openaiFile = await toFile(buffer, file.name || 'audio.mp3', { type: file.type || 'audio/mpeg' });

    // Step 1: Transcribe the audio
    const transcription = await openai.audio.transcriptions.create({
      file: openaiFile,
      model: 'whisper-1',
      language: 'en',
    });

    const transcript = transcription.text;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json({
        error: 'Could not transcribe audio. Please ensure the audio contains clear English speech.',
      }, { status: 400 });
    }

    // Step 2: Evaluate the pronunciation and fluency
    // NOTE: We do NOT use response_format: json_object here because that can cause
    // the model to output an empty response on short transcripts, causing an API error.
    // Instead we ask the model to return JSON within a markdown code block and parse it out.
    const prompt = `You are an expert English pronunciation coach analyzing a transcript produced by a speech-to-text model (Whisper) from a learner's audio recording.

When a non-native speaker mispronounces a word, Whisper often transcribes it as a phonetically similar wrong word (e.g., "sink" instead of "think", "cat" instead of "cut"). Mumbling may produce disjointed or nonsensical phrases. Your job is to spot these issues.

Transcript to analyze:
"${transcript}"

Instructions:
1. Give an overall pronunciation and fluency score from 0 to 100.
2. List up to 10 words or short phrases from the transcript that are likely mispronounced, stumbled, or unclear. For each, give the exact word as it appears and a brief reason.
3. If the transcript sounds perfectly fluent with no issues, return an empty mistakes array and a high score.

You MUST respond with ONLY a raw JSON object (no markdown, no code blocks, just JSON):
{"score": 85, "mistakes": [{"word": "sink", "reason": "Likely mispronunciation of 'think' — /θ/ vs /s/ confusion."}]}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a pronunciation coach. Always respond with valid raw JSON only. Never output empty content.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const resultString = completion.choices[0]?.message?.content?.trim() || '';

    if (!resultString) {
      // Fallback: return a default response if model output was empty
      return NextResponse.json({
        transcript,
        score: 75,
        mistakes: [],
      });
    }

    // Extract JSON — handle cases where model wraps in code block anyway
    const jsonMatch = resultString.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : resultString;

    let result: { score: number; mistakes: Array<{ word: string; reason: string }> };
    try {
      result = JSON.parse(jsonString);
    } catch {
      result = { score: 70, mistakes: [] };
    }

    return NextResponse.json({
      transcript,
      score: result.score ?? 70,
      mistakes: result.mistakes ?? [],
    });
  } catch (error: any) {
    console.error('Assessment error:', error);
    return NextResponse.json({ error: 'Failed to process audio', details: error.message }, { status: 500 });
  }
}
