import { useEffect } from 'react'
import { useMachine } from '@xstate/react'
import { playbackMachine, type PlaybackInput } from '~/state/playbackMachine'

/**
 * React hook wrapper for playback state machine (Phase 4)
 *
 * Manages playback state transitions (NOT audio playback itself).
 * Audio playback is handled by AudioEngine in useAudioPlayer.
 *
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

  // Derive convenient flags from state
  const isIdle = state.matches('idle')
  const isLoading = state.matches('loading')
  const isReady = state.matches('ready')
  const isPlaying = state.matches('playing')
  const isPaused = state.matches('paused')
  const isError = state.matches('error')

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
