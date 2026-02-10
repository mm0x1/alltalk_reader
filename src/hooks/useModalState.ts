import { useReaderStore } from '~/state/readerStore'

/**
 * Hook for managing modal visibility state
 * Now backed by Zustand store (Phase 3)
 */
export function useModalState() {
  const showSettings = useReaderStore((state) => state.modalState.showSettings)
  const showBatchGenerator = useReaderStore((state) => state.modalState.showBatchGenerator)
  const showExportImport = useReaderStore((state) => state.modalState.showExportImport)

  const toggleSettings = useReaderStore((state) => state.toggleSettings)
  const openBatchGenerator = useReaderStore((state) => state.openBatchGenerator)
  const closeBatchGenerator = useReaderStore((state) => state.closeBatchGenerator)
  const openExportImport = useReaderStore((state) => state.openExportImport)
  const closeExportImport = useReaderStore((state) => state.closeExportImport)

  const closeAllModals = () => {
    useReaderStore.setState((state) => ({
      modalState: {
        ...state.modalState,
        showSettings: false,
        showBatchGenerator: false,
        showExportImport: false,
      },
    }))
  }

  return {
    showSettings,
    showBatchGenerator,
    showExportImport,
    toggleSettings,
    openBatchGenerator,
    closeBatchGenerator,
    openExportImport,
    closeExportImport,
    closeAllModals,
  }
}