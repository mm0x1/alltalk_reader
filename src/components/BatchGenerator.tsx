import React, { useState, useEffect } from 'react';
import { generateTTS } from '~/services/alltalkApi';
import ProgressBarIndicator from './ProgressBarIndicator';
import { saveSession, generateSessionId, generateSessionName, AudioSession } from '~/services/sessionStorage';

interface BatchGeneratorProps {
  paragraphs: string[];
  text: string; // Add original text to save with session
  voice: string;
  speed: number;
  pitch: number;
  language: string;
  onComplete: (audioUrls: string[]) => void;
  onCancel: () => void;
}

export default function BatchGenerator({
  paragraphs,
  text,
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);

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
        
        // Save the completed session - make sure all URLs are present
        if (urls.length === paragraphs.length && urls.every(url => url !== null && url !== undefined)) {
          console.log("Saving session with all audio URLs:", urls.length);
          await saveAudioSession(urls);
        } else {
          console.error("Cannot save session, missing URLs:", urls.length, "expected:", paragraphs.length);
          setSaveError('Failed to save session: missing audio files');
        }
        
        onComplete(urls);
      }
    };
    
    generateAudioSequentially();
    
    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [paragraphs, voice, speed, pitch, language, onComplete, text]);

  const saveAudioSession = async (urls: string[]) => {
    if (urls.length === 0 || urls.length !== paragraphs.length) {
      console.error("Cannot save session, invalid URLs:", urls.length, "expected:", paragraphs.length);
      setSaveError('Failed to save session: missing audio files');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Create session object
      const session: AudioSession = {
        id: generateSessionId(),
        name: generateSessionName(text),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        text,
        paragraphs,
        audioUrls: urls,
        settings: {
          voice,
          speed,
          pitch,
          language,
        }
      };
      
      console.log("Saving session:", session.id, "with", urls.length, "audio URLs");
      const success = await saveSession(session);
      
      if (success) {
        console.log("Session saved successfully");
        setSessionSaved(true);
      } else {
        console.error("Server returned failure when saving session");
        setSaveError('Failed to save session data');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      setSaveError('An error occurred while saving session');
    } finally {
      setIsSaving(false);
    }
  };

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
      
      {!isGenerating && !error && (
        <div className="mb-4 p-3 rounded-lg border flex items-center" 
             style={{ 
               backgroundColor: sessionSaved ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
               borderColor: sessionSaved ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)',
               color: sessionSaved ? 'rgb(34, 197, 94)' : 'rgb(59, 130, 246)'
             }}>
          {isSaving ? (
            <>
              <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving session...</span>
            </>
          ) : saveError ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-accent-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-accent-danger">{saveError}</span>
            </>
          ) : sessionSaved ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Session saved successfully</span>
            </>
          ) : null}
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
