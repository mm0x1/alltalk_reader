/**
 * Session Saver Hook
 * 
 * Manages the state and logic for saving audio sessions with offline caching.
 * Extracted from BatchGenerator component for better separation of concerns.
 */

import { useState } from 'react';
import { 
  saveSession, 
  generateSessionId, 
  generateSessionName, 
  cacheAudioBlobsForSession,
  type AudioSession 
} from '~/services/sessionStorage';

export function useSessionSaver() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);

  const saveAudioSession = async (
    text: string,
    paragraphs: string[],
    audioUrls: string[],
    audioBlobs: Record<string, Blob>,
    settings: {
      voice: string;
      speed: number;
      pitch: number;
      language: string;
    }
  ) => {
    if (audioUrls.length === 0 || audioUrls.length !== paragraphs.length) {
      console.error("Cannot save session, invalid URLs:", audioUrls.length, "expected:", paragraphs.length);
      setSaveError('Failed to save session: missing audio files');
      return false;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Create session object
      const sessionId = generateSessionId();
      const session: AudioSession = {
        id: sessionId,
        name: generateSessionName(text),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        text,
        paragraphs,
        audioUrls: audioUrls,
        hasLocalAudio: Object.keys(audioBlobs).length > 0,
        settings
      };
      
      console.log("Saving session:", session.id, "with", audioUrls.length, "audio URLs");
      const success = await saveSession(session);
      
      if (success) {
        // Cache the audio blobs for offline use
        if (Object.keys(audioBlobs).length > 0) {
          console.log("Caching", Object.keys(audioBlobs).length, "audio blobs for offline use");
          await cacheAudioBlobsForSession(sessionId, audioBlobs);
        }
        
        console.log("Session saved successfully");
        setSessionSaved(true);
        return true;
      } else {
        console.error("Server returned failure when saving session");
        setSaveError('Failed to save session data');
        return false;
      }
    } catch (error) {
      console.error('Error saving session:', error);
      setSaveError('An error occurred while saving session');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const resetSaveState = () => {
    setIsSaving(false);
    setSaveError(null);
    setSessionSaved(false);
  };

  return {
    isSaving,
    saveError,
    sessionSaved,
    saveAudioSession,
    resetSaveState
  };
}