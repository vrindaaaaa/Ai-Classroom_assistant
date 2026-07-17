import React, { useState } from "react";
import { ScanEye, Image as ImageIcon, Sparkles, FileText, CheckCircle } from "lucide-react";
import ocrService from "../services/ocrService";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";

export default function OCRPage() {
  const { addToast } = useToast();
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [summary, setSummary] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    
    if (selectedFile) {
      // Create preview url if it's an image file
      if (selectedFile.type.startsWith("image/")) {
        const previewUrl = URL.createObjectURL(selectedFile);
        setFilePreview(previewUrl);
      } else {
        setFilePreview(null);
      }
    } else {
      setFilePreview(null);
    }
  };

  const handleOCRSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      addToast("Please select a handwritten notes image file.", "warning");
      return;
    }

    setLoading(true);
    setExtractedText("");
    setSummary("");

    try {
      const data = await ocrService.extractOCR(file);
      setExtractedText(data.text);
      setSummary(data.summary);
      addToast("Text extracted and summarized successfully!", "success");
    } catch (error) {
      console.error("OCR Extraction failed", error);
      addToast("Failed to parse handwritten note image", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <PageHeader
        title="OCR Notes Scan"
        description="Upload photos of handwritten lectures, whiteboard drawings, or whiteboard texts to digitize them."
      />

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        
        {/* Left Side: Photo Upload Board (takes 1 col) */}
        <Card title="Upload Notes Photo">
          <form onSubmit={handleOCRSubmit} className="space-y-4">
            
            {/* Custom file drag and drop area */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Select Board / Notes Image</label>
              <div className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100/50 hover:border-indigo-400 transition group cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                  required
                />
                
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Upload Preview"
                    className="max-h-40 object-contain rounded-lg border border-slate-100 shadow-sm"
                  />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-slate-400 group-hover:text-indigo-500 transition mb-2" />
                    <span className="text-sm font-bold text-slate-700">
                      {file ? file.name : "Select board photo"}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      PNG, JPG, JPEG formats supported
                    </span>
                  </>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full justify-center"
              loading={loading}
              disabled={!file}
            >
              Scan & Extract Text
            </Button>
          </form>
        </Card>

        {/* Right Side: Scan panels (takes 2 cols) */}
        <div className="lg:col-span-2">
          {loading ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4 animate-pulse">
                <ScanEye className="animate-spin" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">Running OCR scan algorithms...</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-1">
                Aligning text elements, executing character recognition, and summarizing.
              </p>
            </Card>
          ) : !extractedText ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-4">
                <ScanEye size={24} />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">No scanned text</h3>
              <p className="text-sm text-slate-500 max-w-xs mt-1">
                Upload your hand-written lecture board snaps on the left to extract summaries.
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Extracted Text */}
              <Card title="Extracted Text" subtitle="Plain text format parsed from image file">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 max-h-[400px] overflow-y-auto">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {extractedText}
                  </p>
                </div>
              </Card>

              {/* Scanned Summary */}
              <Card title="AI Notes Summary" subtitle="Key takeaways compiled from OCR content">
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
