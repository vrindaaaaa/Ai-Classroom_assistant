import React, { useState } from "react";
import { Mic, Sparkles, FileText, Calendar, Music } from "lucide-react";
import transcriptionService from "../services/transcriptionService";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";

export default function TranscriptionPage() {
  const { addToast } = useToast();
  
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleTranscriptionSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      addToast("Please select an audio file to transcribe.", "warning");
      return;
    }

    setLoading(true);
    setTranscript("");
    setSummary("");

    try {
      const data = await transcriptionService.transcribeAudio(file);
      setTranscript(data.transcript);
      setSummary(data.summary);
      addToast("Lecture transcribed and summarized successfully!", "success");
    } catch (error) {
      console.error("Transcription failed", error);
      addToast("Failed to transcribe audio file", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <PageHeader
        title="Lecture Transcription"
        description="Upload your lecture audio recordings (MP3, WAV) to transcribe speech into text summaries."
      />

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        
        {/* Left Side: Audio File Selector Form (takes 1 col) */}
        <Card title="Upload Lecture Audio">
          <form onSubmit={handleTranscriptionSubmit} className="space-y-4">
            
            {/* Custom file selector design */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Select Audio File</label>
              <div className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100/50 hover:border-indigo-400 transition group cursor-pointer">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                  required
                />
                <Mic className="h-8 w-8 text-slate-400 group-hover:text-indigo-500 transition mb-2" />
                <span className="text-sm font-bold text-slate-700">
                  {file ? file.name : "Select lecture file"}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "MP3, WAV, M4A formats"}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              loading={loading}
              disabled={!file}
            >
              Transcribe Audio
            </Button>
          </form>
        </Card>

        {/* Right Side: Transcription Board (takes 2 cols) */}
        <div className="lg:col-span-2">
          {loading ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4 animate-pulse">
                <Mic className="animate-bounce" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">Transcribing audio speech...</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                Parsing voice frequencies, transcribing sentences, and generating outlines.
              </p>
            </Card>
          ) : !transcript ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-4">
                <Mic size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">No active transcript</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-1">
                Upload your class audio recorder files on the left to review transcribed texts.
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Transcribed text */}
              <Card title="Lecture Script" subtitle="Full audio-to-text transcript output">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 max-h-[400px] overflow-y-auto">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {transcript}
                  </p>
                </div>
              </Card>

              {/* Lecture Summary */}
              <Card title="AI Notes Outline" subtitle="Key discussion points summarized">
                <div className="p-4 rounded-xl border border-indigo-100/50 bg-indigo-50/10 max-h-[400px] overflow-y-auto">
                  <div className="flex items-center gap-2 text-indigo-600 mb-3">
                    <Sparkles size={16} />
                    <span className="font-bold text-xs uppercase tracking-wide">Key Points</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {summary}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
