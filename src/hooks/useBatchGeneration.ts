import { useReaderStore } from '~/state/readerStore'

/**
 * Hook for managing batch generation state (pre-generated audio)
 * Now backed by Zustand store (Phase 3)
 */
export function useBatchGeneration() {
  const preGeneratedAudio = useReaderStore((state) => state.batchGeneration.preGeneratedAudio)
  const isPreGenerated = useReaderStore((state) => state.batchGeneration.isPreGenerated)

  const setPreGeneratedAudio = useReaderStore((state) => state.setPreGeneratedAudio)
  const setIsPreGenerated = useReaderStore((state) => state.setIsPreGenerated)
  const resetPreGenerated = useReaderStore((state) => state.resetBatchGeneration)
  const initializeForParagraphs = useReaderStore((state) => state.initializeBatchForParagraphs)
  const loadFromSession = useReaderStore((state) => state.loadBatchFromSession)

  const handleBatchComplete = (audioUrls: string[]) => {
    setPreGeneratedAudio(audioUrls)
    setIsPreGenerated(true)
  }

  return {
    preGeneratedAudio,
    isPreGenerated,
    handleBatchComplete,
    resetPreGenerated,
    initializeForParagraphs,
    loadFromSession,
  }
}