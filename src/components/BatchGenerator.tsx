import React, { useState, useEffect } from 'react';
import { generateTTS } from '~/services/alltalkApi';
import ProgressBarIndicator from './ProgressBarIndicator';

interface BatchGeneratorProps {
  paragraphs: string[];
  voice: string;
  speed: number;
  pitch: number;
  language: string;
  onComplete: (audioUrls: string[]) => void;
  onCancel: () => void;
}

export default function BatchGenerator({
  paragraphs,
  voice,
  speed,
  pitch,
  language,
  onComplete,
  onCancel
}: BatchGeneratorProps) {
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let cancelled = false;
    
    const generateAudioSequentially = async () => {
      setIsGenerating(true);
      const urls: string[] = [];
      
      // Generate audio for each paragraph sequentially
      for (let i = 0; i < paragraphs.length; i++) {
        if (cancelled || !isMounted) return;
        
        try {
          setCurrentIndex(i);
          // Calculate progress percentage
          setProgress(((i) / paragraphs.length) * 100);
          
          const result = await generateTTS(paragraphs[i], {
            characterVoice: voice,
            language,
            speed,
            pitch,
            outputFileName: `prebatch_${i}_${Date.now()}`
          });
          
          if (!result) {
            throw new Error(`Failed to generate audio for paragraph ${i+1}`);
          }
          
          urls[i] = result.fullAudioUrl;
          setAudioUrls([...urls]);
        } catch (err) {
          if (isMounted) {
            console.error(`Error generating audio for paragraph ${i+1}:`, err);
            setError(`Failed at paragraph ${i+1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setIsGenerating(false);
            return;
          }
        }
      }
      
      if (isMounted) {
        setProgress(100);
        setIsGenerating(false);
        onComplete(urls);
      }
    };
    
    generateAudioSequentially();
    
    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [paragraphs, voice, speed, pitch, language, onComplete]);

  const handleCancel = () => {
    setIsGenerating(false);
    onCancel();
  };

  return (
    <div className="card">
      <h3 className="font-medium text-lg mb-3 text-gray-200">Pre-generating Audio</h3>
      
      <div className="mb-4">
        <ProgressBarIndicator 
          progress={progress}
          label="Overall Progress"
          colorClass={error ? 'bg-accent-danger' : 'bg-accent-primary'}
        />
        
        <div className="mt-1 flex justify-between text-sm text-gray-400">
          <span>Paragraph {currentIndex + 1} of {paragraphs.length}</span>
          <span>{error ? 'Error' : isGenerating ? 'Generating...' : 'Complete'}</span>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
          <p className="font-medium">Generation Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">
          {audioUrls.length} of {paragraphs.length} paragraphs generated
        </span>
        <button
          className={`px-4 py-2 rounded ${
            isGenerating 
              ? 'bg-accent-danger hover:bg-accent-danger/80 text-white' 
              : error 
                ? 'bg-accent-warning hover:bg-accent-warning/80 text-white' 
                : 'bg-accent-success hover:bg-accent-success/80 text-white'
          }`}
          onClick={isGenerating ? handleCancel : onCancel}
        >
          {isGenerating ? 'Cancel' : error ? 'Close' : 'Done'}
        </button>
      </div>
    </div>
  );
}
