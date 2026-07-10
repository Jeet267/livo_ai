# System Architecture: Livo AI Pronunciation Coach

## 1. Components and Architecture

The application is built using a modern, serverless architecture optimized for speed, ease of deployment, and minimal operational overhead.

### Flow Diagram
1. **Client (Next.js Frontend)**: Collects audio via a drag-and-drop interface, strictly enforcing the 30-45s duration limit using `HTMLAudioElement` metadata. It also captures explicit DPDP consent.
2. **Next.js Serverless API (`/api/assess`)**: Acts as a secure proxy and orchestration layer. It receives the multipart form-data, extracts the audio, and communicates with external AI services.
3. **OpenAI Whisper API**: The audio is streamed directly from the Next.js API to OpenAI's Whisper model (`whisper-1`) to generate an accurate transcription.
4. **OpenAI GPT-4o-mini**: The resulting transcription is passed to a Large Language Model (LLM) with a specialized prompt to analyze the text for phonetic anomalies and fluency issues, returning structured JSON containing the score and highlighted mistakes.

## 2. Models and APIs Used

- **OpenAI Whisper (`whisper-1`)**: Chosen over alternatives (like Deepgram or Azure Speech) for its state-of-the-art accuracy across various accents, its simplicity of integration via the standard `openai` Node SDK, and its ability to handle noisy audio effectively.
- **OpenAI GPT-4o-mini**: Chosen for the evaluation phase because it provides excellent reasoning capabilities at a fraction of the cost and latency of GPT-4. It excels at parsing unstructured text (the transcript) and identifying contextual anomalies (like "cat" transcribed instead of "cut") and returning reliable JSON outputs.

## 3. Scoring and Highlighting Mechanism

Since we are evaluating "unscripted" speech without a reference text, we rely on a novel heuristic combining STT anomalies and LLM reasoning:
1. **Transcription Anomalies**: When a non-native speaker mispronounces a word, Whisper typically transcribes it as a phonetically similar English word (e.g., trying to say "think" but it gets transcribed as "sink"). If they mumble, it might transcribe a disjointed phrase.
2. **LLM Evaluation**: We provide GPT-4o-mini with the raw transcript and instruct it to act as a pronunciation coach. It looks for grammatical impossibilities, phonetic substitutions, and stumbles.
3. **Scoring**: The LLM assigns a holistic score (0-100) based on the frequency of stumbles, filler words, and likely mispronunciations relative to the length of the transcript.
4. **Highlighting**: The LLM returns an array of specific words it flagged, along with a reason. The frontend maps these words back to the transcript string and wraps them in an interactive, highlighted UI element with hover-tooltips.

## 4. DPDP Compliance Posture

The application is designed with "Privacy by Design" principles to comply with India's Digital Personal Data Protection (DPDP) Act 2023.

- **Explicit Consent**: Before any data leaves the user's device, the user must actively check a consent box acknowledging that their audio will be processed.
- **Data Minimization & Storage**: No user data is ever written to a persistent database or disk. The audio file is received in-memory by the Next.js API route, streamed to OpenAI, and immediately discarded.
- **Data Retention (Zero Data Policy)**: We rely on OpenAI's enterprise privacy commitments (when configured properly) which state that data sent via the API is not used to train their models and is retained for a maximum of 30 days solely for abuse monitoring, after which it is permanently deleted.
- **Data Residency**: While data is processed in the US (via OpenAI), cross-border data transfers are permitted under the DPDP Act unless specifically restricted by the government. The lack of persistent storage mitigates the primary risks of cross-border data residency.

## 5. Trade-offs and Future Work

### Trade-offs Made
- **LLM Heuristic vs. Acoustic Scoring**: Because we use an LLM analyzing a transcript rather than an acoustic model analyzing phonemes (like Azure Pronunciation Assessment), we lose the ability to score subtle intonation or prosody issues that Whisper manages to transcribe correctly anyway. The trade-off was made for simplicity, lack of reliance on complex Azure enterprise setups, and speed of delivery.
- **Serverless API Limits**: Next.js serverless functions on Vercel's free tier have a 10-second timeout limit. A 45-second audio transcription via Whisper + GPT-4o-mini usually takes 3-6 seconds, which is safe, but during high latency periods, it could theoretically time out.

### What I would build next (with an extra week)
1. **Direct Acoustic Analysis**: Integrate a dedicated pronunciation assessment API (like Azure Speech Services or Speechmatics) which aligns phonemes against the audio wave for sub-word level scoring (accuracy, fluency, completeness, and prosody).
2. **Streaming Response**: Implement Server-Sent Events (SSE) or WebSockets to stream the transcription back to the user in real-time before the LLM evaluation finishes, drastically improving perceived performance.
3. **Reference Text Input**: Allow the user to optionally input a text they are trying to read, which would allow for exact diffing and much more accurate mispronunciation detection.
