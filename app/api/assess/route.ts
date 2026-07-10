import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    // Step 1: Transcribe the audio
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en',
    });

    const transcript = transcription.text;

    // Step 2: Evaluate the pronunciation and fluency
    const prompt = `You are an expert English pronunciation coach. 
I am going to provide you with the raw transcription of an English language learner's speech. 
Since speech-to-text models often transcribe poor pronunciation as phonetically similar wrong words (e.g., "cat" instead of "cut", or mumbling as weird phrases), you must analyze this text for possible mispronunciations, stumbles, and fluency issues.

Here is the transcript:
"${transcript}"

Analyze this transcript and provide:
1. An overall pronunciation and fluency score out of 100.
2. A list of specific words or short segments that seem mispronounced or indicate a stumble. For each, give the 'word' (as it appears in the text) and a brief 'reason' explaining what the mistake likely was or why it's flagged.

Return ONLY a valid JSON object with the following structure:
{
  "score": 85,
  "mistakes": [
    {
      "word": "wrongword",
      "reason": "Likely a mispronunciation of 'intendedword' or a stumble."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const resultString = completion.choices[0].message.content || '{}';
    const result = JSON.parse(resultString);

    return NextResponse.json({
      transcript: transcript,
      score: result.score || 0,
      mistakes: result.mistakes || [],
    });
  } catch (error: any) {
    console.error('Assessment error:', error);
    return NextResponse.json({ error: 'Failed to process audio', details: error.message }, { status: 500 });
  }
}
