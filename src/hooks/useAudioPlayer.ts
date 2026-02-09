import { useState, useRef, useEffect, useCallback } from 'react'
import { ttsService } from '~/services/api'
import {
  type AudioSession,
  getAudioUrlForPlayback,
  revokeAllAudioObjectUrls,
  updateSessionPosition
} from '~/services/session'
import { getBaseUrl } from '~/config/env'
import { AudioEngine } from '~/core/AudioEngine'
import { SafariAdapter } from '~/core/SafariAdapter'

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

  const autoProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize AudioEngine with SafariAdapter
  const audioEngineRef = useRef<AudioEngine | null>(null)
  if (!audioEngineRef.current) {
    const safariAdapter = new SafariAdapter()
    audioEngineRef.current = new AudioEngine(safariAdapter)
  }

  // Update AudioEngine settings when playback settings change
  useEffect(() => {
    console.log(`[AudioPlayer] Updating playback settings - speed: ${playbackSpeed}, preservesPitch: ${preservesPitch}`)
    audioEngineRef.current?.updateSettings({
      speed: playbackSpeed,
      preservesPitch
    })
  }, [playbackSpeed, preservesPitch])

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

    // Stop current playback
    audioEngineRef.current?.stop()

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
        console.log(`[AudioPlayer] Playing audio for paragraph ${index + 1} with URL: ${audioUrl}`)

        // Use AudioEngine to play audio
        const success = await audioEngineRef.current!.play(audioUrl, {
          onCanPlay: () => {
            console.log(`📻 Audio ready for paragraph ${index + 1}, starting playback`)
            setIsLoadingAudio(false)
            setIsPlaying(true)
            setIsAutoProgressing(false)

            if (autoProgressTimeoutRef.current) {
              clearTimeout(autoProgressTimeoutRef.current)
              autoProgressTimeoutRef.current = null
            }
          },
          onEnded: () => {
            console.log(`🎵 Audio ended for paragraph ${index + 1}, starting auto-progression`)
            setIsPlaying(false)
            handleAutoProgression(index)
          },
          onError: (err) => {
            console.error('Audio error:', err)
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
        })

        if (!success) {
          setIsPlaying(false)
          setIsAutoProgressing(false)
          setErrorMessage('Autoplay blocked by browser. Click to continue playing.')
        }
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
      audioEngineRef.current?.pause()
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

    audioEngineRef.current?.stop()

    if (autoProgressTimeoutRef.current) {
      clearTimeout(autoProgressTimeoutRef.current)
      autoProgressTimeoutRef.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngineRef.current?.dispose()
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