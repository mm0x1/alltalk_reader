/**
 * useBufferedPlayback Hook
 *
 * Manages buffered TTS playback - generates audio ahead while playing.
 * Combines the quick start of live mode with the smooth playback of pre-generation.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  GenerationController,
  type BufferedPlaybackState,
  type BufferedPlaybackConfig,
  type BufferStatus,
  type BufferPlaybackStatus,
} from '~/services/generation';
import {
  revokeAudioObjectUrl,
  revokeAllAudioObjectUrls,
} from '~/services/session';
import { getBaseUrl } from '~/config/env';

interface UseBufferedPlaybackProps {
  paragraphs: string[];
  voice: string;
  speed: number;
  pitch: number;
  language: string;
  isServerConnected: boolean;
  // Playback settings (client-side)
  playbackSpeed: number;
  preservesPitch: boolean;
  // Advanced settings (Phase 5)
  temperature?: number;
  repetitionPenalty?: number;
}

interface UseBufferedPlaybackReturn {
  state: BufferedPlaybackState;
  config: BufferedPlaybackConfig;
  start: (fromIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipTo: (index: number) => void;
  updateConfig: (config: Partial<BufferedPlaybackConfig>) => void;
  getAudioUrl: (index: number) => string | null;
  isActive: boolean;
}

const BUFFER_CONFIG_STORAGE_KEY = 'alltalk-buffer-config';

const DEFAULT_CONFIG: BufferedPlaybackConfig = {
  targetBufferSize: 5,
  minBufferSize: 2,
  maxConcurrent: 1, // AllTalk limitation
};

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// Load config from localStorage
const loadStoredConfig = (): BufferedPlaybackConfig => {
  if (!isBrowser) {
    return DEFAULT_CONFIG;
  }
  try {
    const stored = localStorage.getItem(BUFFER_CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('[BufferedPlayback] Failed to load config from localStorage:', e);
  }
  return DEFAULT_CONFIG;
};

// Save config to localStorage
const saveConfig = (config: BufferedPlaybackConfig): void => {
  if (!isBrowser) {
    return;
  }
  try {
    localStorage.setItem(BUFFER_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('[BufferedPlayback] Failed to save config to localStorage:', e);
  }
};

const createInitialBufferStatus = (targetBuffer: number): BufferStatus => ({
  generated: new Set(),
  bufferSize: 0,
  targetBuffer,
  isGenerating: false,
  generatingIndex: -1,
});

const createInitialState = (targetBuffer: number): BufferedPlaybackState => ({
  status: 'idle',
  currentParagraph: 0,
  bufferStatus: createInitialBufferStatus(targetBuffer),
});

export function useBufferedPlayback({
  paragraphs,
  voice,
  speed,
  pitch,
  language,
  isServerConnected,
  playbackSpeed,
  preservesPitch,
  temperature,
  repetitionPenalty,
}: UseBufferedPlaybackProps): UseBufferedPlaybackReturn {
  const [config, setConfig] = useState<BufferedPlaybackConfig>(() => loadStoredConfig());
  const [state, setState] = useState<BufferedPlaybackState>(() =>
    createInitialState(config.targetBufferSize)
  );

  // Refs for mutable state
  const controllerRef = useRef<GenerationController>(new GenerationController());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const isSafariRef = useRef(false);
  const isAudioPrimedRef = useRef(false); // Track if audio has been primed for iOS Safari
  const preloadedAudioRef = useRef<{ index: number; audio: HTMLAudioElement } | null>(null); // Preloaded next audio

  // Store playback settings in refs to avoid stale closures in event handlers
  const playbackSpeedRef = useRef(playbackSpeed);
  const preservesPitchRef = useRef(preservesPitch);

  // Detect Safari/iOS
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isSafariUA = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    isSafariRef.current = isSafariUA || isIOS;

    if (isSafariRef.current) {
      console.log('[BufferedPlayback] Safari/iOS detected');
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.preload = 'metadata';
      }
    }
  }, []);

  // Keep playback setting refs in sync with props
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    preservesPitchRef.current = preservesPitch;
  }, [playbackSpeed, preservesPitch]);

  // Helper function to configure audio playback settings
  // Uses refs to access current values, avoiding stale closures in event handlers
  const configureAudioPlayback = (audio: HTMLAudioElement) => {
    audio.playbackRate = playbackSpeedRef.current;

    // Set preservesPitch with cross-browser support
    if ('preservesPitch' in audio) {
      audio.preservesPitch = preservesPitchRef.current;
    } else if ('mozPreservesPitch' in audio) {
      (audio as any).mozPreservesPitch = preservesPitchRef.current;
    } else if ('webkitPreservesPitch' in audio) {
      (audio as any).webkitPreservesPitch = preservesPitchRef.current;
    }

    console.log(`[BufferedPlayback] Configured playback: ${playbackSpeedRef.current}x, preservesPitch: ${preservesPitchRef.current}`);
  };

  // Update playback rate on existing audio when settings change
  useEffect(() => {
    if (audioRef.current && !audioRef.current.paused) {
      configureAudioPlayback(audioRef.current);
    }
  }, [playbackSpeed, preservesPitch]);

  // Calculate buffer ahead of current playback
  const calculateBufferAhead = useCallback(
    (currentIndex: number, generated: Set<number>): number => {
      let count = 0;
      for (let i = currentIndex + 1; i < paragraphs.length; i++) {
        if (generated.has(i)) {
          count++;
        } else {
          break;
        }
      }
      return count;
    },
    [paragraphs.length]
  );

  // Update buffer status helper
  const updateBufferStatus = useCallback(
    (updates: Partial<BufferStatus>) => {
      setState((prev) => ({
        ...prev,
        bufferStatus: {
          ...prev.bufferStatus,
          ...updates,
        },
      }));
    },
    []
  );

  // Handle successful audio generation
  const handleGenerationProgress = useCallback(
    (index: number, url: string) => {
      setState((prev) => {
        const newGenerated = new Set(prev.bufferStatus.generated);
        newGenerated.add(index);
        const newBufferSize = calculateBufferAhead(prev.currentParagraph, newGenerated);

        console.log(
          `[BufferedPlayback] Generated paragraph ${index + 1}, buffer size: ${newBufferSize}`
        );

        // Check if initial buffer is ready
        const isInitialBuffering = prev.status === 'initial-buffering';
        const hasCurrentParagraph = newGenerated.has(prev.currentParagraph);
        const bufferSufficient = newBufferSize >= config.minBufferSize || index === paragraphs.length - 1;

        let newStatus: BufferPlaybackStatus = prev.status;

        if (isInitialBuffering && hasCurrentParagraph && bufferSufficient) {
          console.log('[BufferedPlayback] Initial buffer ready, starting playback');
          newStatus = 'playing';
        } else if (prev.status === 'buffering' && bufferSufficient) {
          console.log('[BufferedPlayback] Buffer replenished, resuming playback');
          newStatus = 'playing';
        }

        return {
          ...prev,
          status: newStatus,
          bufferStatus: {
            ...prev.bufferStatus,
            generated: newGenerated,
            bufferSize: newBufferSize,
            isGenerating: controllerRef.current.isGenerating(),
            generatingIndex: controllerRef.current.getGeneratingIndex(),
          },
        };
      });
    },
    [calculateBufferAhead, config.minBufferSize, paragraphs.length]
  );

  // Handle generation error
  const handleGenerationError = useCallback((index: number, error: Error) => {
    console.error(`[BufferedPlayback] Generation error for paragraph ${index + 1}:`, error);
    setState((prev) => ({
      ...prev,
      error: `Failed to generate paragraph ${index + 1}: ${error.message}`,
    }));
  }, []);

  // Handle all paragraphs generated
  const handleGenerationComplete = useCallback(() => {
    console.log('[BufferedPlayback] All paragraphs generated');
    updateBufferStatus({ isGenerating: false, generatingIndex: -1 });
  }, [updateBufferStatus]);

  // Ref to hold the latest handleAudioEnded callback (avoids stale closure)
  const handleAudioEndedRef = useRef<(index: number) => void>(() => {});

  // Handle audio ended - progress to next paragraph
  const handleAudioEnded = useCallback(
    (index: number) => {
      const nextIndex = index + 1;
      console.log(`[BufferedPlayback] Audio ended for paragraph ${index + 1}, progressing to ${nextIndex + 1}`);

      if (nextIndex >= paragraphs.length) {
        console.log('[BufferedPlayback] Reached end of content');
        setState((prev) => ({
          ...prev,
          status: 'completed',
          bufferStatus: {
            ...prev.bufferStatus,
            isGenerating: false,
          },
        }));
        return;
      }

      // IMPORTANT: Check the controller directly instead of React state to avoid race conditions.
      // The controller's generatedUrls is the source of truth - React state may be stale
      // due to batched updates when handleGenerationProgress and handleAudioEnded race.
      const isNextReady = controllerRef.current.isReady(nextIndex);
      const newBufferSize = controllerRef.current.getBufferAhead(nextIndex);

      // Check if all remaining paragraphs are already generated (using controller)
      let allRemainingGenerated = true;
      for (let i = nextIndex; i < paragraphs.length; i++) {
        if (!controllerRef.current.isReady(i)) {
          allRemainingGenerated = false;
          break;
        }
      }

      console.log(`[BufferedPlayback] Next paragraph ${nextIndex + 1} ready: ${isNextReady}, buffer size: ${newBufferSize}, all remaining generated: ${allRemainingGenerated}`);

      // Only pause for refill if next isn't ready AND we don't have all remaining paragraphs
      // If we're near the end and all remaining are generated, continue playing
      const needsBuffering = !isNextReady || (newBufferSize < config.minBufferSize && !allRemainingGenerated);

      if (needsBuffering) {
        console.log('[BufferedPlayback] Buffer depleted, pausing for refill');
        setState((prev) => ({
          ...prev,
          status: 'buffering',
          currentParagraph: nextIndex,
          bufferStatus: {
            ...prev.bufferStatus,
            bufferSize: newBufferSize,
            generated: new Set([...prev.bufferStatus.generated, ...Array.from(controllerRef.current.getAllUrls().keys())]),
          },
        }));
        return;
      }

      // Stay in playing status, just update the paragraph
      console.log(`[BufferedPlayback] Continuing to paragraph ${nextIndex + 1}`);
      setState((prev) => ({
        ...prev,
        currentParagraph: nextIndex,
        bufferStatus: {
          ...prev.bufferStatus,
          bufferSize: newBufferSize,
          generated: new Set([...prev.bufferStatus.generated, ...Array.from(controllerRef.current.getAllUrls().keys())]),
        },
      }));
    },
    [paragraphs.length, config.minBufferSize]
  );

  // Keep ref updated with latest handleAudioEnded
  useEffect(() => {
    handleAudioEndedRef.current = handleAudioEnded;
  }, [handleAudioEnded]);

  // Preload the next paragraph's audio for seamless playback
  const preloadNextParagraph = useCallback((currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= paragraphs.length) return;

    const nextPath = controllerRef.current.getUrl(nextIndex);
    if (!nextPath) return;

    // Don't preload if already preloaded for this index
    if (preloadedAudioRef.current?.index === nextIndex) return;

    console.log(`[BufferedPlayback] Preloading paragraph ${nextIndex + 1}`);

    // Resolve relative path to full URL
    const fullUrl = `${getBaseUrl()}${nextPath}`;
    const preloadAudio = new Audio();
    preloadAudio.preload = 'auto';
    preloadAudio.src = fullUrl;
    configureAudioPlayback(preloadAudio);
    preloadAudio.load();

    preloadedAudioRef.current = { index: nextIndex, audio: preloadAudio };
  }, [paragraphs.length]);

  // Play audio for a specific paragraph
  const playParagraph = useCallback(
    async (index: number) => {
      console.log(`[BufferedPlayback] playParagraph called for index ${index + 1}`);
      const path = controllerRef.current.getUrl(index);
      if (!path) {
        console.warn(`[BufferedPlayback] No audio URL for paragraph ${index + 1}`);
        return false;
      }
      // Resolve relative path to full URL
      const fullUrl = `${getBaseUrl()}${path}`;
      console.log(`[BufferedPlayback] Playing URL: ${fullUrl}`);

      // Revoke previous blob URL
      if (currentAudioUrlRef.current) {
        revokeAudioObjectUrl(currentAudioUrlRef.current);
        currentAudioUrlRef.current = null;
      }

      return new Promise<boolean>((resolve) => {
        let audio: HTMLAudioElement;
        let usePreloaded = false;

        // Check if we have this audio preloaded
        if (preloadedAudioRef.current?.index === index) {
          const preloaded = preloadedAudioRef.current.audio;
          // Check if preloaded audio is actually ready (readyState >= 3 means HAVE_FUTURE_DATA)
          if (preloaded.readyState >= 3) {
            console.log(`[BufferedPlayback] Using preloaded audio for paragraph ${index + 1} (readyState: ${preloaded.readyState})`);
            audio = preloaded;
            preloadedAudioRef.current = null;
            usePreloaded = true;
          } else {
            console.log(`[BufferedPlayback] Preloaded audio not ready for paragraph ${index + 1} (readyState: ${preloaded.readyState}), loading fresh`);
            preloaded.src = ''; // Release it
            preloadedAudioRef.current = null;
            // Fall through to load fresh
            if (isSafariRef.current && audioRef.current) {
              audio = audioRef.current;
              audio.oncanplaythrough = null;
              audio.oncanplay = null;
              audio.onended = null;
              audio.onerror = null;
              audio.src = fullUrl;
              configureAudioPlayback(audio);
            } else {
              audio = new Audio(fullUrl);
              configureAudioPlayback(audio);
            }
          }
        } else if (isSafariRef.current && audioRef.current) {
          // Safari: reuse the primed audio element
          audio = audioRef.current;
          audio.oncanplaythrough = null;
          audio.oncanplay = null;
          audio.onended = null;
          audio.onerror = null;
          audio.src = fullUrl;
          configureAudioPlayback(audio);
        } else {
          audio = new Audio(fullUrl);
          configureAudioPlayback(audio);
        }

        let hasStarted = false;

        const startPlayback = () => {
          if (hasStarted) return;
          hasStarted = true;

          // Re-apply playback settings right before play to ensure they haven't been reset by load()
          configureAudioPlayback(audio);

          audio
            .play()
            .then(() => {
              console.log(`[BufferedPlayback] Playing paragraph ${index + 1}`);
              // Start preloading the next paragraph while this one plays
              preloadNextParagraph(index);
              resolve(true);
            })
            .catch((err) => {
              console.error(`[BufferedPlayback] Play failed for paragraph ${index + 1}:`, err);
              resolve(false);
            });
        };

        audio.oncanplaythrough = startPlayback;
        audio.oncanplay = startPlayback;

        audio.onended = () => {
          console.log(`[BufferedPlayback] Paragraph ${index + 1} ended`);
          // Use ref to always get the latest handleAudioEnded (avoids stale closure)
          handleAudioEndedRef.current(index);
        };

        audio.onerror = (e) => {
          console.error(`[BufferedPlayback] Audio error for paragraph ${index + 1}:`, e);
          resolve(false);
        };

        audioRef.current = audio;
        currentAudioUrlRef.current = fullUrl;

        // If using preloaded audio, it should already be loaded
        // If not preloaded, we need to load it
        if (!usePreloaded) {
          audio.preload = 'auto';
          audio.load();
        }

        // If preloaded audio is already ready, start immediately
        if (usePreloaded && audio.readyState >= 3) {
          startPlayback();
        }
      });
    },
    [preloadNextParagraph] // Safe to have minimal deps since we use handleAudioEndedRef
  );

  // Track if we've started playback for the current paragraph to avoid duplicate plays
  const playbackStartedForRef = useRef<number>(-1);

  // Effect to handle state changes that trigger playback
  useEffect(() => {
    if (state.status === 'playing') {
      const path = controllerRef.current.getUrl(state.currentParagraph);
      const url = path ? `${getBaseUrl()}${path}` : null;
      const alreadyStarted = playbackStartedForRef.current === state.currentParagraph;

      // Check if audio is paused/ended and ready for new playback.
      // On Safari, if we just primed the audio (playing silent audio), we should still
      // attempt playback - playParagraph will set a new src which interrupts the primer.
      const audioElement = audioRef.current;
      const audioIsPaused = !audioElement || audioElement.paused || audioElement.ended;

      // On Safari, also consider audio "ready" if we're playing the primer (silent audio)
      // which we detect by checking if the src is a data URL
      const isPlayingPrimer = audioElement &&
        !audioElement.paused &&
        audioElement.src.startsWith('data:');
      const isReadyForPlayback = audioIsPaused || isPlayingPrimer;

      console.log(`[BufferedPlayback] Play effect - paragraph: ${state.currentParagraph + 1}, url: ${!!url}, audioIsPaused: ${audioIsPaused}, isPlayingPrimer: ${isPlayingPrimer}, alreadyStarted: ${alreadyStarted}`);

      if (url && isReadyForPlayback && !alreadyStarted) {
        // Mark as started BEFORE attempting play to prevent duplicate calls
        playbackStartedForRef.current = state.currentParagraph;

        // Attempt playback and handle failure
        playParagraph(state.currentParagraph).then((success) => {
          if (!success) {
            console.warn(`[BufferedPlayback] Playback failed for paragraph ${state.currentParagraph + 1}, will retry on next user interaction`);
            // Reset so we can retry - the user will need to interact (pause/resume) to trigger playback
            // This is necessary because iOS Safari blocks autoplay without user gesture
            playbackStartedForRef.current = -1;
          }
        });
      }

      // Extend generation range as we play
      const targetEnd = Math.min(
        state.currentParagraph + config.targetBufferSize,
        paragraphs.length - 1
      );
      controllerRef.current.extendRange(targetEnd);
      controllerRef.current.updatePlaybackPosition(state.currentParagraph);
    } else if (state.status === 'idle' || state.status === 'completed') {
      // Reset playback tracking when stopped
      playbackStartedForRef.current = -1;
    }
  }, [state.status, state.currentParagraph, config.targetBufferSize, paragraphs.length, playParagraph]);

  // Effect to resume playback when buffer is replenished
  useEffect(() => {
    if (state.status === 'buffering') {
      console.log(`[BufferedPlayback] Buffering check - buffer size: ${state.bufferStatus.bufferSize}, min required: ${config.minBufferSize}`);

      if (state.bufferStatus.bufferSize >= config.minBufferSize) {
        console.log('[BufferedPlayback] Buffer replenished, resuming playback');
        playbackStartedForRef.current = -1; // Reset so we can play the current paragraph
        playParagraph(state.currentParagraph).then((success) => {
          if (success) {
            setState((prev) => ({ ...prev, status: 'playing' }));
          }
        });
      }
    }
  }, [state.status, state.bufferStatus.bufferSize, config.minBufferSize, state.currentParagraph, playParagraph]);

  // Effect to proactively preload next paragraph when it becomes available
  useEffect(() => {
    if (state.status === 'playing' || state.status === 'buffering') {
      const nextIndex = state.currentParagraph + 1;
      // Check if next paragraph is generated and not already preloaded
      if (
        state.bufferStatus.generated.has(nextIndex) &&
        preloadedAudioRef.current?.index !== nextIndex
      ) {
        preloadNextParagraph(state.currentParagraph);
      }
    }
  }, [state.status, state.currentParagraph, state.bufferStatus.generated, preloadNextParagraph]);

  // Page visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[BufferedPlayback] Page hidden, pausing generation');
        controllerRef.current.pause();
      } else {
        if (state.status === 'playing' || state.status === 'buffering') {
          console.log('[BufferedPlayback] Page visible, resuming generation');
          controllerRef.current.resume();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.status]);

  // Cleanup on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      controllerRef.current.stop();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      controllerRef.current.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      revokeAllAudioObjectUrls();
    };
  }, []);

  // Track previous values to detect actual changes
  const prevParagraphsLengthRef = useRef(paragraphs.length);
  const prevVoiceRef = useRef(voice);
  const prevSpeedRef = useRef(speed);
  const prevPitchRef = useRef(pitch);
  const prevLanguageRef = useRef(language);

  // Reset when paragraphs or settings actually change (not on initial mount)
  useEffect(() => {
    const hasChanged =
      prevParagraphsLengthRef.current !== paragraphs.length ||
      prevVoiceRef.current !== voice ||
      prevSpeedRef.current !== speed ||
      prevPitchRef.current !== pitch ||
      prevLanguageRef.current !== language;

    if (hasChanged) {
      controllerRef.current.reset();
      setState(createInitialState(config.targetBufferSize));
    }

    // Update refs
    prevParagraphsLengthRef.current = paragraphs.length;
    prevVoiceRef.current = voice;
    prevSpeedRef.current = speed;
    prevPitchRef.current = pitch;
    prevLanguageRef.current = language;
  }, [paragraphs.length, voice, speed, pitch, language, config.targetBufferSize]);

  // Public methods
  const start = useCallback(
    (fromIndex = 0) => {
      if (!isServerConnected || paragraphs.length === 0) {
        console.warn('[BufferedPlayback] Cannot start - server not connected or no paragraphs');
        return;
      }

      console.log(`[BufferedPlayback] Starting from paragraph ${fromIndex + 1}`);

      // IMPORTANT: Prime audio for iOS Safari by playing silent audio immediately.
      // iOS Safari requires audio.play() to be called synchronously within a user gesture.
      // We prime the MAIN audio element so it becomes "blessed" for future programmatic playback.
      // The isAudioPrimedRef flag tracks completion so the playback effect knows when it's safe.
      if (isSafariRef.current && !isAudioPrimedRef.current) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        // Minimal valid WAV file (44 bytes) - silent audio
        const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audioRef.current.src = silentWav;
        audioRef.current.play()
          .then(() => {
            console.log('[BufferedPlayback] iOS Safari audio primed successfully');
            audioRef.current?.pause();
            isAudioPrimedRef.current = true;
          })
          .catch((err) => {
            console.warn('[BufferedPlayback] Failed to prime audio:', err);
            // Even on failure, mark as primed to avoid repeated attempts
            isAudioPrimedRef.current = true;
          });
      }

      // Initialize controller
      controllerRef.current.initialize(paragraphs, {
        characterVoice: voice,
        language,
        // speed removed - now handled client-side via playbackRate
        pitch,
        temperature,
        repetitionPenalty,
      });

      // Calculate initial buffer range
      const endIndex = Math.min(fromIndex + config.targetBufferSize, paragraphs.length - 1);

      setState({
        status: 'initial-buffering',
        currentParagraph: fromIndex,
        bufferStatus: {
          generated: new Set(),
          bufferSize: 0,
          targetBuffer: config.targetBufferSize,
          isGenerating: true,
          generatingIndex: fromIndex,
        },
      });

      // Start generation
      controllerRef.current.generateRange(fromIndex, endIndex, {
        onProgress: (progress) => handleGenerationProgress(progress.index, progress.url),
        onError: handleGenerationError,
        onComplete: handleGenerationComplete,
      });
    },
    [
      isServerConnected,
      paragraphs,
      voice,
      language,
      speed,
      pitch,
      config.targetBufferSize,
      handleGenerationProgress,
      handleGenerationError,
      handleGenerationComplete,
    ]
  );

  const pause = useCallback(() => {
    console.log('[BufferedPlayback] Pausing');
    if (audioRef.current) {
      audioRef.current.pause();
    }
    controllerRef.current.pause();
    setState((prev) => ({ ...prev, status: 'paused' }));
  }, []);

  const resume = useCallback(() => {
    if (state.status !== 'paused') return;

    console.log('[BufferedPlayback] Resuming');

    const path = controllerRef.current.getUrl(state.currentParagraph);
    const url = path ? `${getBaseUrl()}${path}` : null;
    if (url && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }

    controllerRef.current.resume();
    setState((prev) => ({ ...prev, status: 'playing' }));
  }, [state.status, state.currentParagraph]);

  const stop = useCallback(() => {
    console.log('[BufferedPlayback] Stopping');
    if (audioRef.current) {
      audioRef.current.pause();
    }
    // Clean up preloaded audio
    if (preloadedAudioRef.current) {
      preloadedAudioRef.current.audio.src = '';
      preloadedAudioRef.current = null;
    }
    controllerRef.current.stop();
    setState(createInitialState(config.targetBufferSize));
    // Reset primed flag so next start() will prime audio again (important for iOS Safari)
    isAudioPrimedRef.current = false;
  }, [config.targetBufferSize]);

  const skipTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= paragraphs.length) return;

      console.log(`[BufferedPlayback] Skipping to paragraph ${index + 1}`);

      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Check if target is already generated
      const isReady = controllerRef.current.isReady(index);

      if (isReady) {
        // Can play immediately
        const bufferAhead = controllerRef.current.getBufferAhead(index);
        setState((prev) => ({
          ...prev,
          status: 'playing',
          currentParagraph: index,
          bufferStatus: {
            ...prev.bufferStatus,
            bufferSize: bufferAhead,
          },
        }));

        // Extend generation range
        const targetEnd = Math.min(index + config.targetBufferSize, paragraphs.length - 1);
        controllerRef.current.extendRange(targetEnd);
        controllerRef.current.updatePlaybackPosition(index);
      } else {
        // Need to generate new buffer
        controllerRef.current.stop();
        start(index);
      }
    },
    [paragraphs.length, config.targetBufferSize, start]
  );

  const updateConfig = useCallback((newConfig: Partial<BufferedPlaybackConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      saveConfig(updated);
      return updated;
    });
  }, []);

  const getAudioUrl = useCallback((index: number): string | null => {
    const path = controllerRef.current.getUrl(index);
    return path ? `${getBaseUrl()}${path}` : null;
  }, []);

  const isActive =
    state.status !== 'idle' && state.status !== 'completed' && state.status !== 'error';

  return {
    state,
    config,
    start,
    pause,
    resume,
    stop,
    skipTo,
    updateConfig,
    getAudioUrl,
    isActive,
  };
}
