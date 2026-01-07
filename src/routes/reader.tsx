import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { generateSessionId, generateSessionName, type AudioSession } from '~/services/session'
import { useAudioPlayer } from '~/hooks/useAudioPlayer'
import { useSessionManager } from '~/hooks/useSessionManager'
import { useTtsSettings } from '~/hooks/useTtsSettings'
import { useTextProcessor } from '~/hooks/useTextProcessor'
import { useModalState } from '~/hooks/useModalState'
import { useBatchGeneration } from '~/hooks/useBatchGeneration'
import { useServerConnection } from '~/hooks/useServerConnection'
import { useBufferedPlayback } from '~/hooks/useBufferedPlayback'

import ProgressBar from '~/components/ProgressBar'
import ParagraphList from '~/components/ParagraphList'
import PlaybackControls from '~/components/PlaybackControls'
import AudioCacheStatus from '~/components/AudioCacheStatus'
import SettingsMonitor from '~/components/SettingsMonitor'
import VoiceSelector from '~/components/VoiceSelector'
import TtsSettings from '~/components/TtsSettings'
import BatchGenerator from '~/components/BatchGenerator'
import SessionManager from '~/components/SessionManager'
import SessionStorageConfig from '~/components/SessionStorageConfig'
import ExportImportManager from '~/components/ExportImportManager'
import { BufferStatusIndicator, BufferPlayButton, BufferSettings } from '~/components/buffer'
import { ResumePrompt } from '~/components/session'
import { AllTalkServerSettings } from '~/components/settings'
import { useAdvancedSettingsEnabled } from '~/hooks/useCapabilities'

export const Route = createFileRoute('/reader')({
  component: BookReader,
  ssr: false, // Disable SSR to avoid serialization errors with non-serializable state (Blobs, Sets, etc.)
})

function BookReader() {
  // Import/export state (kept local as it's specific to UI flow)
  const [importError, setImportError] = useState<string | null>(null)

  // Resume position state
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [lastPlaybackPositionIndex, setLastPlaybackPositionIndex] = useState<number | null>(null)

  // Advanced settings flag (Phase 5)
  const advancedSettingsEnabled = useAdvancedSettingsEnabled()

  // Custom hooks
  const { isServerConnected, updateConnectionStatus } = useServerConnection()
  const { text, paragraphs, isProcessing, handleTextChange, processText, loadFromSession: loadTextFromSession, reset: resetText, wasAo3Parsed, ao3Metadata } = useTextProcessor()
  const {
    selectedVoice, speed, pitch, language,
    updateVoice, updateSpeed, updatePitch, updateLanguage,
    // Advanced settings (Phase 5)
    temperature, repetitionPenalty, selectedRvcVoice, rvcPitch,
    updateTemperature, updateRepetitionPenalty, updateRvcVoice, updateRvcPitch,
    defaults: ttsDefaults,
    loadFromSession: loadTtsFromSession, reset: resetTts
  } = useTtsSettings()
  const { preGeneratedAudio, isPreGenerated, handleBatchComplete, resetPreGenerated, initializeForParagraphs, loadFromSession: loadBatchFromSession } = useBatchGeneration()
  const { showSettings, showBatchGenerator, showExportImport, toggleSettings, openBatchGenerator, closeBatchGenerator, openExportImport, closeExportImport } = useModalState()
  
  const { 
    showSessionManager, 
    sessionManagerKey, 
    currentSession, 
    isOfflineSession, 
    openSessionManager, 
    closeSessionManager, 
    loadSession, 
    handleFileImport, 
    refreshSessionManager 
  } = useSessionManager()

  const {
    currentParagraph,
    isPlaying,
    isLoadingAudio,
    errorMessage,
    handlePlayParagraph,
    togglePlayback,
    reset: resetAudio
  } = useAudioPlayer({
    paragraphs,
    selectedVoice,
    speed,
    pitch,
    language,
    isServerConnected,
    preGeneratedAudio,
    isPreGenerated,
    currentSession,
    // Advanced settings (Phase 5)
    temperature,
    repetitionPenalty,
  })

  // Buffered playback mode
  const {
    state: bufferState,
    config: bufferConfig,
    start: startBufferedPlayback,
    pause: pauseBufferedPlayback,
    resume: resumeBufferedPlayback,
    stop: stopBufferedPlayback,
    skipTo: skipToBuffered,
    updateConfig: updateBufferConfig,
    isActive: isBufferModeActive
  } = useBufferedPlayback({
    paragraphs,
    voice: selectedVoice,
    speed,
    pitch,
    language,
    isServerConnected,
    // Advanced settings (Phase 5)
    temperature,
    repetitionPenalty,
  })

  // Track if we're showing buffer settings
  const [showBufferSettings, setShowBufferSettings] = useState(false)

  // Smart Split (BETA) toggle state
  const [useSmartSplit, setUseSmartSplit] = useState(false)

  // Process text and initialize for batch generation
  const handleProcessText = () => {
    try {
      const newParagraphs = processText({ enableSmartDetection: useSmartSplit })
      initializeForParagraphs(newParagraphs.length)
      resetAudio()
    } catch (error) {
      console.error('Error processing text:', error)
    }
  }

  // Load a saved session
  const handleLoadSession = (session: AudioSession) => {
    try {
      const sessionData = loadSession(session)
      if (sessionData) {
        loadTextFromSession(sessionData.text, sessionData.paragraphs)
        loadTtsFromSession(sessionData.voice, sessionData.speed, sessionData.pitch, sessionData.language)

        if (session.isOfflineSession) {
          resetPreGenerated()
        } else {
          loadBatchFromSession(sessionData.preGeneratedAudio)
        }

        // Stop both playback modes to ensure clean state
        resetAudio()
        stopBufferedPlayback()

        // Check for saved playback position
        if (session.lastPlaybackPosition) {
          const { paragraphIndex, timestamp } = session.lastPlaybackPosition
          // Show resume prompt if position is recent (within 30 days) and not at the start
          const isRecent = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000
          if (isRecent && paragraphIndex > 0 && paragraphIndex < session.paragraphs.length) {
            setLastPlaybackPositionIndex(paragraphIndex)
            setShowResumePrompt(true)
          } else {
            setLastPlaybackPositionIndex(null)
          }
        } else {
          setLastPlaybackPositionIndex(null)
        }
      }
    } catch (error) {
      console.error('Error loading session:', error)
    }
    closeSessionManager()
  }

  // Handle resume from saved position
  const handleResumeFromPosition = (index: number) => {
    setShowResumePrompt(false)
    if (isBufferModeActive) {
      skipToBuffered(index)
    } else {
      handlePlayParagraph(index, true)
    }
  }

  // Handle start over (dismiss position)
  const handleStartOver = () => {
    setShowResumePrompt(false)
    setLastPlaybackPositionIndex(null)
  }

  // Handle dismiss resume prompt (keep position marker visible)
  const handleDismissResumePrompt = () => {
    setShowResumePrompt(false)
  }

  // Handle file selection for import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    setImportError(null)

    try {
      const importedSession = await handleFileImport(file)
      handleLoadSession(importedSession)
      closeExportImport()
    } catch (error) {
      console.error('Error importing session:', error)
      setImportError(error instanceof Error ? error.message : 'Failed to import session')
    }

    e.target.value = ''
  }

  // Reset everything
  const handleReset = () => {
    resetText()
    resetTts()
    resetPreGenerated()
    resetAudio()
    stopBufferedPlayback()
    closeBatchGenerator()
    setShowBufferSettings(false)
    setShowResumePrompt(false)
    setLastPlaybackPositionIndex(null)
  }

  // Handle paragraph click - choose the right mode
  const handleParagraphClick = (index: number) => {
    if (isBufferModeActive) {
      skipToBuffered(index)
    } else {
      handlePlayParagraph(index, true)
    }
  }

  // Determine the active paragraph (buffer mode or regular mode)
  const activeParagraph = isBufferModeActive ? bufferState.currentParagraph : currentParagraph

  // Handle voice change with pre-generation reset
  const handleVoiceChange = (voice: string) => {
    updateVoice(voice, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  // Handle settings changes with pre-generation reset
  const handleSpeedChange = (newSpeed: number) => {
    updateSpeed(newSpeed, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  const handlePitchChange = (newPitch: number) => {
    updatePitch(newPitch, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  const handleLanguageChange = (newLanguage: string) => {
    updateLanguage(newLanguage, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  // Advanced settings handlers (Phase 5)
  const handleTemperatureChange = (newTemperature: number) => {
    updateTemperature(newTemperature, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  const handleRepetitionPenaltyChange = (newPenalty: number) => {
    updateRepetitionPenalty(newPenalty, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  const handleRvcVoiceChange = (voice: string | null) => {
    updateRvcVoice(voice, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  const handleRvcPitchChange = (newPitch: number) => {
    updateRvcPitch(newPitch, resetPreGenerated)
    if (isPlaying) {
      resetAudio()
    }
    if (isBufferModeActive) {
      stopBufferedPlayback()
    }
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-white">AllTalk Book Reader</h1>
      <div className="flex flex-wrap items-center justify-between mb-4">
        <p className="text-gray-400">
          Using the standard AllTalk API to generate TTS audio paragraph by paragraph. Text longer than <b>Max characters</b> will be split up.
        </p>
        <button
          onClick={openSessionManager}
          className="text-sm px-3 py-1.5 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          Saved Sessions
        </button>
      </div>
      <p className="text-gray-400 mb-4">
        Click the green "Reload alltalk configuration" to load voices.
      </p>
      <SettingsMonitor onConnectionStatusChange={updateConnectionStatus} />
      {/* Advanced AllTalk Server Settings (Phase 5) */}
      {advancedSettingsEnabled && isServerConnected && (
        <AllTalkServerSettings className="mb-4" />
      )}
      <SessionStorageConfig onConfigChange={refreshSessionManager} />
      {/* Session Manager Modal */}
      {showSessionManager && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto">
            <SessionManager
              key={sessionManagerKey}
              onLoadSession={handleLoadSession}
              onClose={closeSessionManager}
            />
          </div>
        </div>
      )}
      {/* Import Session Modal - Only for initial screen */}
      {showExportImport && paragraphs.length === 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-200">Import Session</h2>
                <button
                  onClick={() => {
                    closeExportImport()
                    setImportError(null)
                  }}
                  className="p-1.5 hover:bg-dark-400 rounded"
                  title="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <p className="text-gray-400 mb-4">
                Import a previously exported session with embedded audio files for offline playback.
                Select a file to import:
              </p>

              {importError && (
                <div className="mb-4 p-3 bg-accent-danger/20 text-accent-danger rounded-lg border border-accent-danger/30">
                  <p className="font-medium">Import Error</p>
                  <p className="text-sm mt-1">{importError}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label
                  htmlFor="file-upload-initial"
                  className="px-4 py-2 rounded flex items-center bg-accent-primary hover:bg-accent-primary/80 text-white cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L4 8m4-4v12" />
                  </svg>
                  Select File to Import
                  <input
                    id="file-upload-initial"
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="sr-only"
                  />
                </label>
              </div>

              <p className="text-sm text-gray-400 mt-2">
                Only files previously exported from AllTalk Reader can be imported.
              </p>
            </div>
          </div>
        </div>
      )}
      {paragraphs.length === 0 ? (
        <div className="space-y-4">
          <div className="card">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="text-input" className="block font-medium text-lg text-gray-200">
                  Paste your text below:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openExportImport}
                    className="text-sm px-3 py-1 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Import Session
                  </button>
                  <button
                    onClick={toggleSettings}
                    className="text-sm px-3 py-1 bg-dark-300 hover:bg-dark-400 rounded flex items-center transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    {showSettings ? 'Hide Settings' : 'Show Settings'}
                  </button>
                </div>
              </div>
              <textarea
                id="text-input"
                className="input-field h-64"
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Paste your book text here... (AO3 full pages are automatically parsed)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tip: You can paste full AO3 pages - chapter content will be automatically extracted.
              </p>
            </div>

            {showSettings && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 bg-dark-300 p-4 rounded-lg">
                <VoiceSelector
                  value={selectedVoice}
                  onChange={handleVoiceChange}
                  label="Character Voice"
                />

                <TtsSettings
                  speed={speed}
                  pitch={pitch}
                  language={language}
                  onSpeedChange={handleSpeedChange}
                  onPitchChange={handlePitchChange}
                  onLanguageChange={handleLanguageChange}
                  // Advanced settings (Phase 5)
                  temperature={temperature}
                  repetitionPenalty={repetitionPenalty}
                  selectedRvcVoice={selectedRvcVoice}
                  rvcPitch={rvcPitch}
                  onTemperatureChange={handleTemperatureChange}
                  onRepetitionPenaltyChange={handleRepetitionPenaltyChange}
                  onRvcVoiceChange={handleRvcVoiceChange}
                  onRvcPitchChange={handleRvcPitchChange}
                  advancedDefaults={ttsDefaults}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <div className="text-sm text-gray-400">
                  {text ? `${text.length} characters in ${text.trim().split(/\s+/).length} words` : 'No text entered'}
                </div>
                {/* Smart Split Toggle */}
                <label className="flex items-center gap-2 cursor-pointer group" title="Enable smart paragraph detection for PDFs, ebooks, and wall-of-text content">
                  <input
                    type="checkbox"
                    checked={useSmartSplit}
                    onChange={(e) => setUseSmartSplit(e.target.checked)}
                    className="w-4 h-4 rounded border-dark-500 bg-dark-400 text-accent-primary focus:ring-accent-primary focus:ring-offset-dark-300"
                  />
                  <span className="text-sm text-gray-300 group-hover:text-gray-200">
                    Smart Split
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-accent-primary/20 text-accent-primary rounded">BETA</span>
                  </span>
                  <span title="Detects indentation, PDF formats, and fixes 'wall of text' issues">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </span>
                </label>
              </div>
              <button
                className="btn-primary"
                onClick={handleProcessText}
                disabled={isProcessing || !text.trim() || !isServerConnected}
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : !isServerConnected ? (
                  <span className="flex items-center">
                    <svg className="mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Server Not Connected
                  </span>
                ) : 'Process Text'}
              </button>
            </div>

            {!isServerConnected && (
              <div className="mt-4 p-3 bg-dark-400 text-amber-300 rounded-lg border border-amber-500">
                <div className="flex items-start">
                  <svg className="h-5 w-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium">AllTalk server is not connected</p>
                    <p className="text-sm mt-1">Please check your server settings. The app needs a connection to the AllTalk API server to generate TTS audio.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* AO3 parsing notification */}
          {wasAo3Parsed && (
            <div className="p-3 bg-accent-success/20 text-accent-success rounded-lg border border-accent-success/30 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <span className="font-medium">AO3 page detected and parsed</span>
                {ao3Metadata?.chapterTitle && (
                  <span className="ml-2 text-sm opacity-80">— {ao3Metadata.chapterTitle}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-between bg-dark-300 p-4 rounded-lg mb-1">
            <PlaybackControls
              isPlaying={isBufferModeActive ? (bufferState.status === 'playing') : isPlaying}
              selectedVoice={selectedVoice}
              onPlayPause={isBufferModeActive
                ? (bufferState.status === 'playing' ? pauseBufferedPlayback : resumeBufferedPlayback)
                : togglePlayback}
              onVoiceChange={handleVoiceChange}
              onReset={handleReset}
              canSkipPrevious={activeParagraph !== null && activeParagraph > 0}
              canSkipNext={activeParagraph !== null && activeParagraph < paragraphs.length - 1}
              onSkipPrevious={() => {
                if (activeParagraph !== null && activeParagraph > 0) {
                  if (isBufferModeActive) {
                    skipToBuffered(activeParagraph - 1)
                  } else {
                    handlePlayParagraph(activeParagraph - 1, true)
                  }
                }
              }}
              onSkipNext={() => {
                if (activeParagraph !== null && activeParagraph < paragraphs.length - 1) {
                  if (isBufferModeActive) {
                    skipToBuffered(activeParagraph + 1)
                  } else {
                    handlePlayParagraph(activeParagraph + 1, true)
                  }
                }
              }}
              isLoading={isBufferModeActive ? (bufferState.status === 'initial-buffering' || bufferState.status === 'buffering') : isLoadingAudio}
            />

            <div className="flex gap-2">
              {/* Buffer Play Button */}
              <BufferPlayButton
                status={bufferState.status}
                isServerConnected={isServerConnected}
                hasParagraphs={paragraphs.length > 0}
                onStart={() => {
                  // Stop regular audio player before starting buffer mode
                  resetAudio()
                  startBufferedPlayback(activeParagraph ?? 0)
                }}
                onPause={pauseBufferedPlayback}
                onResume={resumeBufferedPlayback}
                onStop={stopBufferedPlayback}
              />

              {/* Buffer Settings Toggle */}
              <button
                onClick={() => setShowBufferSettings(!showBufferSettings)}
                className={`px-2 py-1.5 text-sm rounded transition-colors ${
                  showBufferSettings
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary'
                    : 'bg-dark-400 hover:bg-dark-500 text-gray-300'
                }`}
                title="Buffer settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>

              <button
                onClick={openBatchGenerator}
                disabled={showBatchGenerator || isPreGenerated || !isServerConnected || isBufferModeActive}
                className={`px-3 py-1.5 text-sm rounded flex items-center ${isPreGenerated
                  ? 'bg-accent-success/20 text-accent-success border border-accent-success'
                  : showBatchGenerator || !isServerConnected || isBufferModeActive
                    ? 'bg-dark-200 text-gray-500 cursor-not-allowed'
                    : 'bg-dark-400 text-accent-primary hover:bg-dark-500 border border-accent-primary'
                  }`}
              >
                {isPreGenerated ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Pre-Generated
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Pre-Generate All Audio
                  </>
                )}
              </button>

              <button
                onClick={openExportImport}
                className="px-3 py-1.5 text-sm rounded flex items-center bg-dark-400 text-white hover:bg-dark-500 border border-dark-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                {isOfflineSession ? "Offline Session" : "Export/Import"}
              </button>
            </div>
          </div>

          {/* Buffer Settings */}
          {showBufferSettings && (
            <BufferSettings
              config={bufferConfig}
              onConfigChange={updateBufferConfig}
              disabled={isBufferModeActive}
            />
          )}

          {/* Buffer Status Indicator */}
          {isBufferModeActive && (
            <BufferStatusIndicator
              status={bufferState.status}
              currentParagraph={bufferState.currentParagraph}
              totalParagraphs={paragraphs.length}
              bufferStatus={bufferState.bufferStatus}
              error={bufferState.error}
            />
          )}

          {/* Batch generator */}
          {showBatchGenerator && (
            <BatchGenerator
              paragraphs={paragraphs}
              text={text}
              voice={selectedVoice}
              speed={speed}
              pitch={pitch}
              language={language}
              onComplete={handleBatchComplete}
              onCancel={closeBatchGenerator}
              temperature={temperature}
              repetitionPenalty={repetitionPenalty}
            />
          )}

          {/* Export/Import manager for existing session */}
          {showExportImport && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="w-full max-w-3xl max-h-[90vh] overflow-auto">
                <ExportImportManager
                  session={currentSession ?? {
                    id: generateSessionId(),
                    name: generateSessionName(text),
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    text,
                    paragraphs,
                    audioUrls: (preGeneratedAudio ?? []).map(url => url || ''),
                    settings: {
                      voice: selectedVoice,
                      speed,
                      pitch,
                      language,
                    }
                  }}
                  isPreGenerated={isPreGenerated}
                  onImportSession={handleLoadSession}
                  onClose={closeExportImport}
                />
              </div>
            </div>
          )}

          {showSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-dark-300 border border-dark-500 rounded-lg">
              <VoiceSelector
                value={selectedVoice}
                onChange={handleVoiceChange}
                label="Character Voice"
              />

              <TtsSettings
                speed={speed}
                pitch={pitch}
                language={language}
                onSpeedChange={handleSpeedChange}
                onPitchChange={handlePitchChange}
                onLanguageChange={handleLanguageChange}
                // Advanced settings (Phase 5)
                temperature={temperature}
                repetitionPenalty={repetitionPenalty}
                selectedRvcVoice={selectedRvcVoice}
                rvcPitch={rvcPitch}
                onTemperatureChange={handleTemperatureChange}
                onRepetitionPenaltyChange={handleRepetitionPenaltyChange}
                onRvcVoiceChange={handleRvcVoiceChange}
                onRvcPitchChange={handleRvcPitchChange}
                advancedDefaults={ttsDefaults}
              />
            </div>
          )}

          {/* Status indicator (only show when not in buffer mode) */}
          {!isBufferModeActive && currentParagraph !== null && (
            <AudioCacheStatus
              status={
                errorMessage
                  ? 'error'
                  : isLoadingAudio
                    ? 'generating'
                    : isPlaying
                      ? 'playing'
                      : 'paused'
              }
              paragraphIndex={currentParagraph}
              totalParagraphs={paragraphs.length}
              errorMessage={errorMessage || undefined}
            />
          )}

          <div className="card book-reader-card">
            <div className="flex px-2 pt-2 items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-200">Book Content</h2>
              <button
                onClick={toggleSettings}
                className="text-sm px-3 py-1 bg-dark-400 hover:bg-dark-500 rounded flex items-center transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                {showSettings ? 'Hide Settings' : 'Show Settings'}
              </button>
            </div>

            <ProgressBar
              currentIndex={activeParagraph}
              totalParagraphs={paragraphs.length}
              onSelectParagraph={handleParagraphClick}
            />

            <ParagraphList
              paragraphs={paragraphs}
              currentParagraphIndex={activeParagraph}
              onPlayParagraph={handleParagraphClick}
              isLoading={isBufferModeActive ? (bufferState.status === 'initial-buffering' || bufferState.status === 'buffering') : isLoadingAudio}
              preGeneratedStatus={isPreGenerated ? preGeneratedAudio.map(url => url !== null) : undefined}
              isOfflineSession={isOfflineSession}
              lastPlaybackPositionIndex={lastPlaybackPositionIndex}
            />
          </div>
        </div>
      )}

      {/* Resume Prompt Modal */}
      {showResumePrompt && lastPlaybackPositionIndex !== null && (
        <ResumePrompt
          paragraphIndex={lastPlaybackPositionIndex}
          totalParagraphs={paragraphs.length}
          onResume={handleResumeFromPosition}
          onStartOver={handleStartOver}
          onDismiss={handleDismissResumePrompt}
        />
      )}
    </div>
  )
}