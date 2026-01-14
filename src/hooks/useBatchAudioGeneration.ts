/**
 * Batch Audio Generation Hook
 * 
 * Manages the state and logic for generating multiple audio files sequentially.
 * Extracted from BatchGenerator component for better separation of concerns.
 */

import { useState, useEffect, useRef } from 'react';
import { ttsService } from '~/services/api';

interface UseBatchAudioGenerationOptions {
  paragraphs: string[];
  voice: string;
  speed: number;
  pitch: number;
  language: string;
  onComplete: (urls: string[], audioBlobs: Record<string, Blob>) => void;
  // Advanced settings (Phase 5)
  temperature?: number;
  repetitionPenalty?: number;
}

export function useBatchAudioGeneration({
  paragraphs,
  voice,
  speed,
  pitch,
  language,
  onComplete,
  temperature,
  repetitionPenalty,
}: UseBatchAudioGenerationOptions) {
  const [progress, setProgress] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState<Record<string, Blob>>({});
  
  // Use ref to store the latest callback to avoid dependency issues
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let isMounted = true;
    let cancelled = false;
    
    const generateAudioSequentially = async () => {
      setIsGenerating(true);
      setError(null);
      const urls: string[] = [];
      const blobs: Record<string, Blob> = {};
      
      // Generate audio for each paragraph sequentially
      for (let i = 0; i < paragraphs.length; i++) {
        if (cancelled || !isMounted) return;
        
        try {
          setCurrentIndex(i);
          // Calculate progress percentage
          setProgress(((i) / paragraphs.length) * 100);
          
          const result = await ttsService.generateTTS(paragraphs[i], {
            characterVoice: voice,
            language,
            speed,
            pitch,
            temperature,
            repetitionPenalty,
            outputFileName: `prebatch_${i}_${Date.now()}`
          });
          
          if (!result) {
            throw new Error(`Failed to generate audio for paragraph ${i+1}`);
          }
          
          urls[i] = result.fullAudioUrl;
          setAudioUrls([...urls]);
          
          // Download and cache the audio blob for offline use
          try {
            const audioResponse = await fetch(result.fullAudioUrl);
            if (audioResponse.ok) {
              const blob = await audioResponse.blob();
              blobs[`audio_${i}`] = blob;
            }
          } catch (blobError) {
            console.warn(`Could not cache audio blob for paragraph ${i+1}:`, blobError);
          }
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
        setAudioBlobs(blobs);
        
        // Complete generation if all URLs are present
        if (urls.length === paragraphs.length && urls.every(url => url !== null && url !== undefined)) {
          console.log("Audio generation complete:", urls.length, "files");
          onCompleteRef.current(urls, blobs);
        } else {
          console.error("Cannot complete generation, missing URLs:", urls.length, "expected:", paragraphs.length);
          setError('Failed to generate all audio files');
        }
      }
    };
    
    generateAudioSequentially();
    
    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [paragraphs, voice, speed, pitch, language]);

  const cancel = () => {
    setIsGenerating(false);
  };

  return {
    progress,
    currentIndex,
    audioUrls,
    audioBlobs,
    error,
    isGenerating,
    cancel
  };
}