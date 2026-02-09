import { useState, useRef, useEffect, useCallback } from 'react'
import { ttsService } from '~/services/api'
import {
  type AudioSession,
  getAudioUrlForPlayback,
  revokeAudioObjectUrl,
  revokeAllAudioObjectUrls,
  updateSessionPosition
} from '~/services/session'
import { getBaseUrl } from '~/config/env'

interface UseAudioPlayerProps {
  paragraphs: string[]
  selectedVoice: string
  speed: number
  pitch: number
  language: string
  isServerConnected: boolean
  preGeneratedAudio: string[]
  isPreGenerated: boolean
  currentSession: AudioSession | null
  // Playback settings (client-side)
  playbackSpeed: number
  preservesPitch: boolean
  // Advanced settings (Phase 5)
  temperature?: number
  repetitionPenalty?: number
}

export function useAudioPlayer({
  paragraphs,
  selectedVoice,
  speed,
  pitch,
  language,
  isServerConnected,
  preGeneratedAudio,
  isPreGenerated,
  currentSession,
  playbackSpeed,
  preservesPitch,
  temperature,
  repetitionPenalty,
}: UseAudioPlayerProps) {
  const [currentParagraph, setCurrentParagraph] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isAutoProgressing, setIsAutoProgressing] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const autoProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)

  // Store playback settings in refs to avoid stale closures in event handlers
  const playbackSpeedRef = useRef(playbackSpeed)
  const preservesPitchRef = useRef(preservesPitch)

  // Keep playback setting refs in sync with props
  useEffect(() => {
    console.log(`[AudioPlayer] Updating refs - playbackSpeed: ${playbackSpeed}, preservesPitch: ${preservesPitch}`)
    playbackSpeedRef.current = playbackSpeed
    preservesPitchRef.current = preservesPitch
  }, [playbackSpeed, preservesPitch])

  // Detect Safari/iOS
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    const isSafariUA = /safari/.test(userAgent) && !/chrome/.test(userAgent)
    const isIOS = /iphone|ipad|ipod/.test(userAgent)
    setIsSafari(isSafariUA || isIOS)

    if (isSafariUA || isIOS) {
      console.log('🍎 Safari/iOS detected - using compatible audio handling')
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.preload = 'metadata'
      }
    }
  }, [])

  // Helper function to configure audio playback settings
  // Uses refs to access current values, avoiding stale closures in event handlers
  const configureAudioPlayback = (audio: HTMLAudioElement) => {
    console.log(`[AudioPlayer] configureAudioPlayback called - playbackSpeedRef.current: ${playbackSpeedRef.current}, preservesPitchRef.current: ${preservesPitchRef.current}`)
    audio.playbackRate = playbackSpeedRef.current;

    // Set preservesPitch with cross-browser support
    if ('preservesPitch' in audio) {
      audio.preservesPitch = preservesPitchRef.current;
    } else if ('mozPreservesPitch' in audio) {
      (audio as any).mozPreservesPitch = preservesPitchRef.current;
    } else if ('webkitPreservesPitch' in audio) {
      (audio as any).webkitPreservesPitch = preservesPitchRef.current;
    }

    console.log(`[AudioPlayer] Configured playback: ${playbackSpeedRef.current}x, preservesPitch: ${preservesPitchRef.current}, actual audio.playbackRate: ${audio.playbackRate}`);
  };

  // Update playback rate on existing audio when settings change
  useEffect(() => {
    if (audioRef.current && !audioRef.current.paused) {
      configureAudioPlayback(audioRef.current);
    }
  }, [playbackSpeed, preservesPitch]);

  // Auto-save playback position (debounced)
  const savePositionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only save position for saved sessions with a valid paragraph index
    if (currentSession?.id && currentParagraph !== null && currentParagraph >= 0) {
      // Clear any existing debounce
      if (savePositionTimeoutRef.current) {
        clearTimeout(savePositionTimeoutRef.current)
      }

      // Debounce position save (1 second delay)
      savePositionTimeoutRef.current = setTimeout(() => {
        updateSessionPosition(currentSession.id, currentParagraph).then(success => {
          if (success) {
            console.log(`📍 Saved playback position: paragraph ${currentParagraph + 1}`)
          }
        })
      }, 1000)
    }

    return () => {
      if (savePositionTimeoutRef.current) {
        clearTimeout(savePositionTimeoutRef.current)
      }
    }
  }, [currentParagraph, currentSession?.id])

  // Handle auto-progression to next paragraph with error handling
  const handleAutoProgression = async (currentIndex: number) => {
    const nextIndex = currentIndex + 1
    
    if (nextIndex >= paragraphs.length) {
      setIsPlaying(false)
      setCurrentParagraph(null)
      setIsLoadingAudio(false)
      setIsAutoProgressing(false)
      setErrorMessage(null)
      console.log('Reached end of book')
      return
    }

    setIsAutoProgressing(true)
    
    autoProgressTimeoutRef.current = setTimeout(() => {
      console.warn(`Auto-progression timeout for paragraph ${nextIndex + 1}`)
      setIsAutoProgressing(false)
      setIsLoadingAudio(false)
      setErrorMessage(`Auto-progression timed out. Click paragraph ${nextIndex + 1} to continue.`)
    }, 15000)
    
    try {
      console.log(`🚀 Auto-progressing from paragraph ${currentIndex + 1} to ${nextIndex + 1}`)
      await handlePlayParagraph(nextIndex)
      console.log(`✅ handlePlayParagraph completed for paragraph ${nextIndex + 1}`)
    } catch (error) {
      console.error('Auto-progression failed:', error)
      
      if (autoProgressTimeoutRef.current) {
        clearTimeout(autoProgressTimeoutRef.current)
        autoProgressTimeoutRef.current = null
      }
      
      setIsPlaying(false)
      setIsLoadingAudio(false)
      setIsAutoProgressing(false)
      
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setErrorMessage(`Auto-progression failed: ${errorMsg}. Click the next paragraph to continue manually.`)
      setCurrentParagraph(nextIndex)
    }
  }

  // Play a paragraph at the specified index
  const handlePlayParagraph = async (index: number, isManualClick = false) => {
    console.log(`🎯 handlePlayParagraph called for index ${index + 1}, isManualClick: ${isManualClick}`)
    
    if (index >= paragraphs.length) {
      setIsPlaying(false)
      setCurrentParagraph(null)
      setIsLoadingAudio(false)
      setErrorMessage(null)
      setIsAutoProgressing(false)
      return
    }

    if (isManualClick) {
      setIsAutoProgressing(false)
    }

    setCurrentParagraph(index)
    setIsLoadingAudio(true)
    setErrorMessage(null)

    if (audioRef.current) {
      audioRef.current.pause()
      if (!isSafari) {
        audioRef.current = null
      }
    }

    // Revoke previous blob URL to prevent memory leak
    if (currentAudioUrlRef.current) {
      revokeAudioObjectUrl(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }

    try {
      let audioUrl: string | null = null

      if (currentSession) {
        audioUrl = getAudioUrlForPlayback(currentSession, index,
          isPreGenerated && preGeneratedAudio[index] ? preGeneratedAudio[index] : undefined)
      } else if (isPreGenerated && preGeneratedAudio[index]) {
        // Resolve relative path to full URL for no-session playback
        audioUrl = `${getBaseUrl()}${preGeneratedAudio[index]}`
        console.log(`Using pre-generated audio for paragraph ${index + 1}/${paragraphs.length}`)
      }

      if (!audioUrl) {
        console.log(`Generating TTS for paragraph ${index + 1}/${paragraphs.length} (${paragraphs[index].length} characters)`)

        const result = await ttsService.generateTTS(paragraphs[index], {
          characterVoice: selectedVoice,
          language,
          outputFileName: `paragraph_${index}_${Date.now()}`,
          // speed removed - now handled client-side via playbackRate
          pitch,
          temperature,
          repetitionPenalty,
        })

        if (!result) {
          throw new Error('Failed to generate audio')
        }

        audioUrl = result.fullAudioUrl
      }

      if (audioUrl !== null) {
        console.log(`${isSafari ? '🍎' : '🔧'} ${isSafari ? 'Reusing' : 'Creating'} audio object for paragraph ${index + 1} with URL: ${audioUrl}`)
        
        let audio: HTMLAudioElement

        if (isSafari && audioRef.current) {
          audio = audioRef.current
          audio.oncanplaythrough = null
          audio.oncanplay = null
          audio.onended = null
          audio.onerror = null
          audio.src = audioUrl
          configureAudioPlayback(audio)
          console.log(`🍎 Safari: Updated audio source to ${audioUrl}`)
        } else {
          audio = new Audio(audioUrl)
          configureAudioPlayback(audio)
        }
        
        let hasPlayStarted = false
        
        const startPlayback = () => {
          if (hasPlayStarted) return
          hasPlayStarted = true

          console.log(`📻 Audio ready for paragraph ${index + 1}, starting playback`)

          // Re-apply playback settings right before play to ensure they haven't been reset by load()
          configureAudioPlayback(audio)

          setIsLoadingAudio(false)
          setIsPlaying(true)
          setIsAutoProgressing(false)

          if (autoProgressTimeoutRef.current) {
            clearTimeout(autoProgressTimeoutRef.current)
            autoProgressTimeoutRef.current = null
          }

          audio.play().then(() => {
            console.log(`🔊 Audio playback started successfully for paragraph ${index + 1}`)
          }).catch(err => {
            console.error(`❌ Failed to play audio for paragraph ${index + 1}:`, err)
            setIsPlaying(false)
            setIsAutoProgressing(false)
            
            if (err.name === 'NotAllowedError') {
              setErrorMessage('Autoplay blocked by browser. Click to continue playing.')
            } else {
              setErrorMessage('Failed to play audio. Please try again.')
            }
          })
        }
        
        audio.oncanplaythrough = startPlayback
        audio.oncanplay = startPlayback

        audio.onended = () => {
          console.log(`🎵 Audio ended for paragraph ${index + 1}, current paragraph in state: ${currentParagraph}, starting auto-progression`)
          setIsPlaying(false)
          handleAutoProgression(index)
        }

        audio.onerror = (e) => {
          console.error('Audio error:', e)
          setIsPlaying(false)
          setIsLoadingAudio(false)
          setIsAutoProgressing(false)
          
          if (autoProgressTimeoutRef.current) {
            clearTimeout(autoProgressTimeoutRef.current)
            autoProgressTimeoutRef.current = null
          }
          
          if (currentSession?.isOfflineSession) {
            setErrorMessage('Offline audio not available for this paragraph.')
          } else if (!isServerConnected) {
            setErrorMessage('AllTalk server is offline. Please connect to the server or use an offline session.')
          } else {
            setErrorMessage('Error playing audio. Please try again.')
          }
        }
        
        audioRef.current = audio
        currentAudioUrlRef.current = audioUrl
        audio.preload = 'auto'
        audio.load()
      } else {
        console.error('Audio URL is null, cannot play audio')
        setIsPlaying(false)
        setIsLoadingAudio(false)
        setIsAutoProgressing(false)
        setErrorMessage('Failed to generate audio. Please try again.')
      }
    } catch (error) {
      console.error('Failed to play paragraph:', error)
      setIsPlaying(false)
      setIsLoadingAudio(false)
      setIsAutoProgressing(false)
      
      if (autoProgressTimeoutRef.current) {
        clearTimeout(autoProgressTimeoutRef.current)
        autoProgressTimeoutRef.current = null
      }
      
      if (error instanceof Error && error.message.includes('fetch')) {
        setErrorMessage('AllTalk server is not accessible. Please check if the server is running.')
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
      }
    }
  }

  const togglePlayback = () => {
    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlaying(false)
    } else if (!isLoadingAudio) {
      handlePlayParagraph(currentParagraph !== null ? currentParagraph : 0, true)
    }
  }

  const reset = () => {
    setCurrentParagraph(null)
    setIsPlaying(false)
    setIsLoadingAudio(false)
    setErrorMessage(null)
    setIsAutoProgressing(false)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (autoProgressTimeoutRef.current) {
      clearTimeout(autoProgressTimeoutRef.current)
      autoProgressTimeoutRef.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (autoProgressTimeoutRef.current) {
        clearTimeout(autoProgressTimeoutRef.current)
        autoProgressTimeoutRef.current = null
      }
      // Revoke all blob URLs to prevent memory leaks
      revokeAllAudioObjectUrls()
    }
  }, [])

  return {
    currentParagraph,
    isPlaying,
    isLoadingAudio,
    errorMessage,
    isAutoProgressing,
    handlePlayParagraph,
    togglePlayback,
    reset
  }
}