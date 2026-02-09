import { useEffect, useRef } from 'react'
import { useMachine } from '@xstate/react'
import { playbackMachine, type PlaybackInput } from '~/state/playbackMachine'

/**
 * React hook wrapper for playback state machine (Phase 4)
 *
 * Manages audio playback lifecycle with explicit state transitions.
 * Eliminates race conditions by making invalid states unrepresentable.
 *
 * @example
 * const { state, send, isPlaying } = usePlaybackMachine({
 *   paragraphs,
 *   voice,
 *   // ... other settings
 * })
 *
 * // Play paragraph
 * send({ type: 'PLAY', paragraphIndex: 0 })
 *
 * // Pause
 * send({ type: 'PAUSE' })
 */
export function usePlaybackMachine(input: PlaybackInput) {
  const [state, send] = useMachine(playbackMachine, { input })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Derive convenient flags from state
  const isIdle = state.matches('idle')
  const isLoading = state.matches('loading')
  const isReady = state.matches('ready')
  const isPlaying = state.matches('playing')
  const isPaused = state.matches('paused')
  const isError = state.matches('error')

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current

    // Configure audio element with playback settings
    audio.playbackRate = state.context.playbackSpeed
    audio.preservesPitch = state.context.preservesPitch

    // Handle audio ended event
    const handleEnded = () => {
      console.log('🎵 Audio ended, transitioning to next paragraph')
      send({ type: 'AUDIO_ENDED' })
    }

    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('ended', handleEnded)
    }
  }, [state.context.playbackSpeed, state.context.preservesPitch, send])

  // Handle state transitions that require audio element control
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // State: ready → Load audio URL
    if (isReady && state.context.audioUrl) {
      audio.src = state.context.audioUrl
      console.log(`🎵 [Playback Machine] Audio ready for paragraph ${state.context.currentParagraph + 1}`)
    }

    // State: playing → Play audio
    if (isPlaying && state.context.audioUrl) {
      audio.play().catch((error) => {
        console.error('Failed to play audio:', error)
        send({ type: 'STOP' })
      })
    }

    // State: paused → Pause audio
    if (isPaused) {
      audio.pause()
    }

    // State: idle/error → Stop and clear audio
    if (isIdle || isError) {
      audio.pause()
      audio.currentTime = 0
      audio.src = ''
    }
  }, [isIdle, isReady, isPlaying, isPaused, isError, state.context.audioUrl, state.context.currentParagraph, send])

  // Update machine context when input props change
  useEffect(() => {
    send({
      type: 'UPDATE_SETTINGS',
      settings: {
        voice: input.voice,
        speed: input.speed,
        pitch: input.pitch,
        language: input.language,
        temperature: input.temperature,
        repetitionPenalty: input.repetitionPenalty,
        playbackSpeed: input.playbackSpeed,
        preservesPitch: input.preservesPitch,
        preGeneratedAudio: input.preGeneratedAudio,
        isPreGenerated: input.isPreGenerated,
        currentSession: input.currentSession,
        isServerConnected: input.isServerConnected,
      },
    })
  }, [
    input.voice,
    input.speed,
    input.pitch,
    input.language,
    input.temperature,
    input.repetitionPenalty,
    input.playbackSpeed,
    input.preservesPitch,
    input.preGeneratedAudio,
    input.isPreGenerated,
    input.currentSession,
    input.isServerConnected,
    send,
  ])

  // Update paragraphs when they change
  useEffect(() => {
    if (input.paragraphs) {
      send({ type: 'UPDATE_PARAGRAPHS', paragraphs: input.paragraphs })
    }
  }, [input.paragraphs, send])

  return {
    // State machine
    state,
    send,

    // Audio element
    audioRef,

    // Derived state flags
    isIdle,
    isLoading,
    isReady,
    isPlaying,
    isPaused,
    isError,

    // Context
    currentParagraph: state.context.currentParagraph,
    audioUrl: state.context.audioUrl,
    errorMessage: state.context.errorMessage,

    // Convenience methods
    play: (paragraphIndex?: number, forceReload = false) =>
      send({ type: 'PLAY', paragraphIndex, forceReload }),
    pause: () => send({ type: 'PAUSE' }),
    resume: () => send({ type: 'RESUME' }),
    stop: () => send({ type: 'STOP' }),
    skipTo: (paragraphIndex: number) => send({ type: 'SKIP_TO', paragraphIndex }),
    clearError: () => send({ type: 'CLEAR_ERROR' }),
  }
}
