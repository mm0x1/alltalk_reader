import { useState } from 'react'

export function useModalState() {
  const [showSettings, setShowSettings] = useState(false)
  const [showBatchGenerator, setShowBatchGenerator] = useState(false)
  const [showExportImport, setShowExportImport] = useState(false)

  const toggleSettings = () => setShowSettings(!showSettings)
  const openBatchGenerator = () => setShowBatchGenerator(true)
  const closeBatchGenerator = () => setShowBatchGenerator(false)
  const openExportImport = () => setShowExportImport(true)
  const closeExportImport = () => setShowExportImport(false)

  const closeAllModals = () => {
    setShowSettings(false)
    setShowBatchGenerator(false)
    setShowExportImport(false)
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
    closeAllModals
  }
}