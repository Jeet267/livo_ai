'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { UploadCloud, Mic, FileAudio, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface Mistake {
  word: string;
  reason: string;
}

interface AssessmentResult {
  transcript: string;
  score: number;
  mistakes: Mistake[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    if (!selectedFile.type.startsWith('audio/')) {
      setError('Please upload an audio file.');
      return;
    }

    // Check audio duration
    const audio = new Audio(URL.createObjectURL(selectedFile));
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      if (duration < 30 || duration > 45) {
        setError(`Audio must be between 30 and 45 seconds long. Your audio is ${Math.round(duration)} seconds.`);
        setFile(null);
      } else {
        setFile(selectedFile);
      }
    };
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Please upload an audio file.');
      return;
    }
    if (!consent) {
      setError('You must consent to data processing before continuing.');
      return;
    }

    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('audio', file);

    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Failed to analyze audio');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while processing the audio.');
    } finally {
      setLoading(false);
    }
  };

  const highlightTranscript = (transcript: string, mistakes: Mistake[]) => {
    if (!mistakes || mistakes.length === 0) return <span>{transcript}</span>;
    
    // Sort mistakes by length descending to replace larger chunks first if they overlap
    const sortedMistakes = [...mistakes].sort((a, b) => b.word.length - a.word.length);
    
    let highlightedText = transcript;
    sortedMistakes.forEach((mistake, index) => {
      // Replace only whole words, case-insensitive, replacing with a special token
      const regex = new RegExp(`\\b(${mistake.word})\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `%%MISTAKE_${index}%%$1%%END_MISTAKE%%`);
    });

    const parts = highlightedText.split(/(%%MISTAKE_\d+%%.*?%%END_MISTAKE%%)/g);

    return parts.map((part, i) => {
      const match = part.match(/%%MISTAKE_(\d+)%%(.*?)%%END_MISTAKE%%/);
      if (match) {
        const mistakeIndex = parseInt(match[1]);
        const word = match[2];
        const mistake = sortedMistakes[mistakeIndex];
        return (
          <span key={i} className="relative group inline-block bg-red-500/20 text-red-400 font-medium px-1 rounded mx-0.5 cursor-pointer border border-red-500/30">
            {word}
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded p-2 z-10 shadow-xl border border-gray-700">
              {mistake.reason}
            </span>
          </span>
        );
      }
      return <span key={i} className="text-gray-300">{part}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-purple-500/30 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-purple-500/10 rounded-2xl mb-4 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
            <Mic className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">
            Livo AI Pronunciation Coach
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Upload a 30-45 second English speech recording and get instant, AI-driven pronunciation feedback and scoring.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl border border-gray-800 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
          
          {!result ? (
            <div className="space-y-8">
              {/* Dropzone */}
              <div 
                onClick={handleUploadClick}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 group \${
                  file ? 'border-purple-500 bg-purple-500/5' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'
                }`}
              >
                <input 
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                />
                
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                      <FileAudio className="w-8 h-8 text-purple-400" />
                    </div>
                    <p className="text-xl font-medium text-white mb-1">{file.name}</p>
                    <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyze</p>
                    <button className="mt-6 text-sm text-purple-400 hover:text-purple-300 font-medium bg-purple-500/10 px-4 py-2 rounded-full transition-colors">
                      Change File
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <p className="text-xl font-medium text-gray-200 mb-2">Click to upload audio</p>
                    <p className="text-sm text-gray-500">MP3, WAV, M4A (30 - 45 seconds)</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* DPDP Consent */}
              <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-900"
                  />
                </div>
                <label htmlFor="consent" className="text-sm text-gray-400 cursor-pointer select-none">
                  <span className="text-gray-200 font-medium block mb-1">Data Processing Consent</span>
                  I consent to my audio being processed for pronunciation assessment. I understand that my audio and transcription will be sent to OpenAI for processing and will be immediately discarded. No personal data is stored persistently.
                </label>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!file || !consent || loading}
                className={`w-full py-4 rounded-xl font-medium text-lg transition-all duration-300 flex items-center justify-center gap-2 \${
                  !file || !consent || loading
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transform hover:-translate-y-0.5'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Pronunciation...
                  </>
                ) : (
                  'Analyze Audio'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between mb-8 pb-8 border-b border-gray-800">
                <h2 className="text-2xl font-bold">Assessment Results</h2>
                <button 
                  onClick={() => { setResult(null); setFile(null); setConsent(false); }}
                  className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  Analyze another file
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-8">
                {/* Score Circular Indicator */}
                <div className="sm:col-span-1 flex flex-col items-center justify-center p-6 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                  <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-800" />
                      <circle 
                        cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                        strokeDasharray="283" 
                        strokeDashoffset={283 - (283 * result.score) / 100}
                        strokeLinecap="round"
                        className={`transition-all duration-1000 \${
                          result.score >= 80 ? 'text-green-500' : result.score >= 60 ? 'text-yellow-500' : 'text-red-500'
                        }`} 
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold">{result.score}</span>
                      <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">Score</span>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-400">
                    {result.score >= 80 ? 'Excellent pronunciation!' : result.score >= 60 ? 'Good, but needs work.' : 'Needs significant improvement.'}
                  </p>
                </div>

                {/* Transcript & Mistakes */}
                <div className="sm:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-purple-500" />
                      Transcription Analysis
                    </h3>
                    <div className="p-5 bg-gray-950 rounded-xl border border-gray-800 leading-relaxed text-lg shadow-inner">
                      {highlightTranscript(result.transcript, result.mistakes)}
                    </div>
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                      <span className="inline-block w-3 h-3 bg-red-500/20 border border-red-500/50 rounded-sm"></span>
                      Hover over highlighted words to see what went wrong.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
