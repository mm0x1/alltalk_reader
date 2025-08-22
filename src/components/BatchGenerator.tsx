import React, { useCallback } from 'react';
import { Button } from '~/design-system';
import { useBatchAudioGeneration } from '~/hooks/useBatchAudioGeneration';
import { useSessionSaver } from '~/hooks/useSessionSaver';
import { BatchProgress } from './batch/BatchProgress';
import { BatchError } from './batch/BatchError';
import { BatchStatus } from './batch/BatchStatus';

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
  const {
    isSaving,
    saveError,
    sessionSaved,
    saveAudioSession
  } = useSessionSaver();

  // Memoize the completion callback to prevent infinite re-renders
  const handleGenerationComplete = useCallback((urls: string[], audioBlobs: Record<string, Blob>) => {
    // Auto-save session after generation completes
    if (urls.length === paragraphs.length) {
      saveAudioSession(text, paragraphs, urls, audioBlobs, {
        voice,
        speed,
        pitch,
        language,
      });
    }
    onComplete(urls);
  }, [text, paragraphs, voice, speed, pitch, language, saveAudioSession, onComplete]);

  const {
    progress,
    currentIndex,
    audioUrls,
    audioBlobs,
    error,
    isGenerating,
    cancel: cancelGeneration
  } = useBatchAudioGeneration({
    paragraphs,
    voice,
    speed,
    pitch,
    language,
    onComplete: handleGenerationComplete
  });

  const handleCancel = () => {
    if (isGenerating) {
      cancelGeneration();
    }
    onCancel();
  };

  return (
    <div className="card">
      <h3 className="font-medium text-lg mb-3 text-gray-200">Pre-generating Audio</h3>
      
      <BatchProgress
        progress={progress}
        currentIndex={currentIndex}
        totalParagraphs={paragraphs.length}
        audioUrlsCount={audioUrls.length}
        error={error}
        isGenerating={isGenerating}
      />
      
      {error && <BatchError error={error} />}
      
      {!isGenerating && !error && (
        <BatchStatus
          isSaving={isSaving}
          saveError={saveError}
          sessionSaved={sessionSaved}
        />
      )}
      
      <div className="flex justify-end">
        <Button
          variant={isGenerating ? 'danger' : error ? 'warning' : 'success'}
          onClick={handleCancel}
        >
          {isGenerating ? 'Cancel' : error ? 'Close' : 'Done'}
        </Button>
      </div>
    </div>
  );
}
