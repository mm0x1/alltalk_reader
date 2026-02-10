import { useRef, useEffect, useCallback } from 'react'
import {
  type AudioSession,
  updateSessionPosition
} from '~/services/session'
import { usePlaybackMachine } from './usePlaybackMachine'
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

/**
 * Audio Player Hook (Phase 4: State Machine Refactor)
 *
 * Now uses XState playback machine to eliminate race conditions.
 * State transitions are explicit and type-safe.
 *
 * Before (Phase 1-3): Multiple useState hooks, boolean flags
 * After (Phase 4): Single state machine, impossible invalid states
 */
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
  temperature = 0.65,
  repetitionPenalty = 3.0,
}: UseAudioPlayerProps) {
  // Initialize AudioEngine with SafariAdapter (Phase 2)
  const audioEngineRef = useRef<AudioEngine | null>(null)
  if (!audioEngineRef.current) {
    const safariAdapter = new SafariAdapter()
    audioEngineRef.current = new AudioEngine(safariAdapter)
  }

  // Use state machine for playback state (Phase 4)
  const {
    state,
    send,
    isPlaying,
    isLoading,
    isError,
    currentParagraph,
    errorMessage,
    play,
    pause,
    stop,
  } = usePlaybackMachine({
    paragraphs,
    voice: selectedVoice,
    speed,
    pitch,
    language,
    temperature,
    repetitionPenalty,
    playbackSpeed,
    preservesPitch,
    preGeneratedAudio,
    isPreGenerated,
    currentSession,
    isServerConnected,
  })

  // Update AudioEngine settings when playback settings change
  useEffect(() => {
    console.log(`[AudioPlayer] Updating playback settings - speed: ${playbackSpeed}, preservesPitch: ${preservesPitch}`)
    audioEngineRef.current?.updateSettings({
      speed: playbackSpeed,
      preservesPitch
    })
  }, [playbackSpeed, preservesPitch])

  // Sync AudioEngine with state machine
  useEffect(() => {
    const audioEngine = audioEngineRef.current
    if (!audioEngine) return

    const audioUrl = state.context.audioUrl
    if (!audioUrl) return

    // When audio is ready, start playing and transition to playing state
    if (state.matches('ready')) {
      console.log('▶️ [AudioPlayer] Audio ready, starting playback and transitioning to PLAYING')
      audioEngine.play(audioUrl, {
        onEnded: () => {
          console.log('🎵 [AudioPlayer] Audio ended, sending AUDIO_ENDED event')
          send({ type: 'AUDIO_ENDED' })
        },
        onError: (error: any) => {
          console.error('[AudioPlayer] Audio playback error:', error)
          send({ type: 'STOP' })
        },
      }).then((success) => {
        if (success) {
          // Transition state machine to playing after audio starts successfully
          console.log('✅ [AudioPlayer] Audio started, sending PLAY event to enter PLAYING state')
          send({ type: 'PLAY' })
        }
      }).catch((error: any) => {
        console.error('[AudioPlayer] Failed to start playback:', error)
        send({ type: 'STOP' })
      })
    }

    // Pause audio when state machine transitions to paused
    if (state.matches('paused')) {
      audioEngine.pause()
    }

    // Resume audio when transitioning back to playing from paused
    // (This is for the RESUME event)
    if (state.matches('playing') && audioEngine.getAudioElement()?.paused) {
      audioEngine.resume()
    }

    // Stop audio when state machine transitions to idle/error
    if (state.matches('idle') || state.matches('error')) {
      audioEngine.stop()
    }
  }, [state, send])

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

  // Play paragraph (with optional force reload)
  const handlePlayParagraph = useCallback(
    (index: number, forceReload = false) => {
      console.log(`🎯 [AudioPlayer] Playing paragraph ${index + 1}${forceReload ? ' (force reload)' : ''}`)

      // Send PLAY event to state machine
      play(index, forceReload)
    },
    [play]
  )

  // Toggle playback (play/pause)
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause()
    } else if (state.matches('paused')) {
      send({ type: 'RESUME' })
    } else if (currentParagraph !== null) {
      play(currentParagraph)
    } else {
      play(0)
    }
  }, [isPlaying, state, currentParagraph, pause, play, send])

  // Reset (stop playback and clear state)
  const reset = useCallback(() => {
    console.log('🔄 [AudioPlayer] Resetting playback state')
    stop()
  }, [stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngineRef.current?.dispose()
    }
  }, [])

  return {
    currentParagraph,
    isPlaying,
    isLoadingAudio: isLoading,
    errorMessage,
    handlePlayParagraph,
    togglePlayback,
    reset,

    // Expose state machine for debugging
    _stateMachine: { state, send },
  }
}
