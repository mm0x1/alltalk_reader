import { useReaderStore } from '~/state/readerStore'

/**
 * Hook for managing client-side playback settings (speed, preservesPitch)
 * Now backed by Zustand store with localStorage persistence (Phase 3)
 */
export function usePlaybackSettings() {
  const speed = useReaderStore((state) => state.playbackSettings.speed)
  const preservesPitch = useReaderStore((state) => state.playbackSettings.preservesPitch)

  const updateSpeed = useReaderStore((state) => state.updatePlaybackSpeed)
  const updatePreservesPitch = useReaderStore((state) => state.updatePreservesPitch)
  const reset = useReaderStore((state) => state.resetPlaybackSettings)

  return {
    speed,
    preservesPitch,
    updateSpeed,
    updatePreservesPitch,
    reset,
  }
}
