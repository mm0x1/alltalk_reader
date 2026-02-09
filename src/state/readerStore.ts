import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AudioSession } from '~/services/session'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * TTS generation settings (server-side)
 */
export interface TtsSettings {
  selectedVoice: string
  /** @deprecated Speed is now handled client-side. Always 1.0 for generation. */
  speed: number
  pitch: number
  language: string
  // Advanced settings
  temperature: number
  repetitionPenalty: number
  selectedRvcVoice: string | null
  rvcPitch: number
}

/**
 * Playback settings (client-side audio control)
 */
export interface PlaybackSettings {
  speed: number
  preservesPitch: boolean
}

/**
 * Text processing state
 */
export interface TextState {
  text: string
  paragraphs: string[]
  isProcessing: boolean
  wasAo3Parsed: boolean
  ao3Metadata: {
    title?: string
    author?: string
    summary?: string
  } | null
}

/**
 * Session management state
 */
export interface SessionState {
  currentSession: AudioSession | null
  isOfflineSession: boolean
  showSessionManager: boolean
  sessionManagerKey: number
}

/**
 * Batch generation state
 */
export interface BatchGenerationState {
  preGeneratedAudio: string[]
  isPreGenerated: boolean
}

/**
 * Modal visibility state
 */
export interface ModalState {
  showSettings: boolean
  showBatchGenerator: boolean
  showExportImport: boolean
  showBufferSettings: boolean
}

/**
 * Resume position state
 */
export interface ResumeState {
  showResumePrompt: boolean
  lastPlaybackPositionIndex: number | null
}

/**
 * Import/export state
 */
export interface ImportExportState {
  importError: string | null
}

/**
 * Smart split toggle
 */
export interface SmartSplitState {
  useSmartSplit: boolean
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

export interface ReaderStore {
  // State slices
  ttsSettings: TtsSettings
  playbackSettings: PlaybackSettings
  textState: TextState
  sessionState: SessionState
  batchGeneration: BatchGenerationState
  modalState: ModalState
  resumeState: ResumeState
  importExportState: ImportExportState
  smartSplitState: SmartSplitState

  // TTS Settings Actions
  updateVoice: (voice: string) => void
  updateSpeed: (speed: number) => void
  updatePitch: (pitch: number) => void
  updateLanguage: (language: string) => void
  updateTemperature: (temperature: number) => void
  updateRepetitionPenalty: (penalty: number) => void
  updateRvcVoice: (voice: string | null) => void
  updateRvcPitch: (pitch: number) => void
  loadTtsFromSession: (voice: string, speed: number, pitch: number, language: string) => void
  resetTtsSettings: () => void

  // Playback Settings Actions
  updatePlaybackSpeed: (speed: number) => void
  updatePreservesPitch: (preserve: boolean) => void
  resetPlaybackSettings: () => void

  // Text State Actions
  updateText: (text: string) => void
  updateParagraphs: (paragraphs: string[]) => void
  setProcessing: (isProcessing: boolean) => void
  setAo3Parsed: (wasAo3Parsed: boolean, metadata: TextState['ao3Metadata']) => void
  loadTextFromSession: (text: string, paragraphs: string[]) => void
  resetTextState: () => void

  // Session State Actions
  setCurrentSession: (session: AudioSession | null) => void
  setOfflineSession: (isOffline: boolean) => void
  openSessionManager: () => void
  closeSessionManager: () => void
  refreshSessionManager: () => void
  clearSession: () => void
  loadSessionData: (session: AudioSession) => {
    text: string
    paragraphs: string[]
    voice: string
    speed: number
    pitch: number
    language: string
    preGeneratedAudio: string[]
  }

  // Batch Generation Actions
  setPreGeneratedAudio: (audio: string[]) => void
  setIsPreGenerated: (isPreGenerated: boolean) => void
  resetBatchGeneration: () => void
  initializeBatchForParagraphs: (paragraphCount: number) => void
  loadBatchFromSession: (audio: string[]) => void

  // Modal State Actions
  toggleSettings: () => void
  openBatchGenerator: () => void
  closeBatchGenerator: () => void
  openExportImport: () => void
  closeExportImport: () => void
  setShowBufferSettings: (show: boolean) => void

  // Resume State Actions
  setShowResumePrompt: (show: boolean) => void
  setLastPlaybackPosition: (index: number | null) => void
  handleResumePosition: (session: AudioSession) => void

  // Import/Export State Actions
  setImportError: (error: string | null) => void

  // Smart Split Actions
  setUseSmartSplit: (use: boolean) => void

  // Global Actions
  resetAll: () => void
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_VOICE = 'female_01.wav'
const DEFAULT_TEMPERATURE = 0.65
const DEFAULT_REPETITION_PENALTY = 3.0
const DEFAULT_RVC_PITCH = 0

const defaultTtsSettings: TtsSettings = {
  selectedVoice: DEFAULT_VOICE,
  speed: 1.0,
  pitch: 0,
  language: 'en',
  temperature: DEFAULT_TEMPERATURE,
  repetitionPenalty: DEFAULT_REPETITION_PENALTY,
  selectedRvcVoice: null,
  rvcPitch: DEFAULT_RVC_PITCH,
}

// Load playback settings from localStorage
const loadPlaybackSettings = (): PlaybackSettings => {
  if (typeof window === 'undefined') {
    return { speed: 1.0, preservesPitch: true }
  }

  try {
    const stored = localStorage.getItem('alltalk-playback-settings')
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        speed: parsed.speed ?? 1.0,
        preservesPitch: parsed.preservesPitch ?? true,
      }
    }
  } catch (e) {
    console.warn('[PlaybackSettings] Failed to load from localStorage:', e)
  }
  return { speed: 1.0, preservesPitch: true }
}

const defaultPlaybackSettings: PlaybackSettings = loadPlaybackSettings()

const defaultTextState: TextState = {
  text: '',
  paragraphs: [],
  isProcessing: false,
  wasAo3Parsed: false,
  ao3Metadata: null,
}

const defaultSessionState: SessionState = {
  currentSession: null,
  isOfflineSession: false,
  showSessionManager: false,
  sessionManagerKey: Date.now(),
}

const defaultBatchGeneration: BatchGenerationState = {
  preGeneratedAudio: [],
  isPreGenerated: false,
}

const defaultModalState: ModalState = {
  showSettings: false,
  showBatchGenerator: false,
  showExportImport: false,
  showBufferSettings: false,
}

const defaultResumeState: ResumeState = {
  showResumePrompt: false,
  lastPlaybackPositionIndex: null,
}

const defaultImportExportState: ImportExportState = {
  importError: null,
}

const defaultSmartSplitState: SmartSplitState = {
  useSmartSplit: false,
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useReaderStore = create<ReaderStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      ttsSettings: defaultTtsSettings,
      playbackSettings: defaultPlaybackSettings,
      textState: defaultTextState,
      sessionState: defaultSessionState,
      batchGeneration: defaultBatchGeneration,
      modalState: defaultModalState,
      resumeState: defaultResumeState,
      importExportState: defaultImportExportState,
      smartSplitState: defaultSmartSplitState,

      // TTS Settings Actions
      updateVoice: (voice) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, selectedVoice: voice },
          }),
          false,
          'updateVoice'
        ),

      updateSpeed: (speed) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, speed },
          }),
          false,
          'updateSpeed'
        ),

      updatePitch: (pitch) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, pitch },
          }),
          false,
          'updatePitch'
        ),

      updateLanguage: (language) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, language },
          }),
          false,
          'updateLanguage'
        ),

      updateTemperature: (temperature) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, temperature },
          }),
          false,
          'updateTemperature'
        ),

      updateRepetitionPenalty: (penalty) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, repetitionPenalty: penalty },
          }),
          false,
          'updateRepetitionPenalty'
        ),

      updateRvcVoice: (voice) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, selectedRvcVoice: voice },
          }),
          false,
          'updateRvcVoice'
        ),

      updateRvcPitch: (pitch) =>
        set(
          (state) => ({
            ttsSettings: { ...state.ttsSettings, rvcPitch: pitch },
          }),
          false,
          'updateRvcPitch'
        ),

      loadTtsFromSession: (voice, speed, pitch, language) =>
        set(
          (state) => ({
            ttsSettings: {
              ...state.ttsSettings,
              selectedVoice: voice,
              speed,
              pitch,
              language,
            },
          }),
          false,
          'loadTtsFromSession'
        ),

      resetTtsSettings: () =>
        set({ ttsSettings: defaultTtsSettings }, false, 'resetTtsSettings'),

      // Playback Settings Actions
      updatePlaybackSpeed: (speed) =>
        set(
          (state) => ({
            playbackSettings: { ...state.playbackSettings, speed },
          }),
          false,
          'updatePlaybackSpeed'
        ),

      updatePreservesPitch: (preserve) =>
        set(
          (state) => ({
            playbackSettings: { ...state.playbackSettings, preservesPitch: preserve },
          }),
          false,
          'updatePreservesPitch'
        ),

      resetPlaybackSettings: () => {
        const defaults = { speed: 1.0, preservesPitch: true }
        set({ playbackSettings: defaults }, false, 'resetPlaybackSettings')
        // Persist reset to localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('alltalk-playback-settings', JSON.stringify(defaults))
          } catch (e) {
            console.warn('[PlaybackSettings] Failed to save to localStorage:', e)
          }
        }
      },

      // Text State Actions
      updateText: (text) =>
        set(
          (state) => ({
            textState: { ...state.textState, text },
          }),
          false,
          'updateText'
        ),

      updateParagraphs: (paragraphs) =>
        set(
          (state) => ({
            textState: { ...state.textState, paragraphs },
          }),
          false,
          'updateParagraphs'
        ),

      setProcessing: (isProcessing) =>
        set(
          (state) => ({
            textState: { ...state.textState, isProcessing },
          }),
          false,
          'setProcessing'
        ),

      setAo3Parsed: (wasAo3Parsed, metadata) =>
        set(
          (state) => ({
            textState: { ...state.textState, wasAo3Parsed, ao3Metadata: metadata },
          }),
          false,
          'setAo3Parsed'
        ),

      loadTextFromSession: (text, paragraphs) =>
        set(
          (state) => ({
            textState: {
              ...state.textState,
              text,
              paragraphs,
              wasAo3Parsed: false,
              ao3Metadata: null,
            },
          }),
          false,
          'loadTextFromSession'
        ),

      resetTextState: () =>
        set({ textState: defaultTextState }, false, 'resetTextState'),

      // Session State Actions
      setCurrentSession: (session) =>
        set(
          (state) => ({
            sessionState: { ...state.sessionState, currentSession: session },
          }),
          false,
          'setCurrentSession'
        ),

      setOfflineSession: (isOffline) =>
        set(
          (state) => ({
            sessionState: { ...state.sessionState, isOfflineSession: isOffline },
          }),
          false,
          'setOfflineSession'
        ),

      openSessionManager: () =>
        set(
          (state) => ({
            sessionState: {
              ...state.sessionState,
              showSessionManager: true,
              sessionManagerKey: Date.now(),
            },
          }),
          false,
          'openSessionManager'
        ),

      closeSessionManager: () =>
        set(
          (state) => ({
            sessionState: { ...state.sessionState, showSessionManager: false },
          }),
          false,
          'closeSessionManager'
        ),

      refreshSessionManager: () =>
        set(
          (state) => ({
            sessionState: { ...state.sessionState, sessionManagerKey: Date.now() },
          }),
          false,
          'refreshSessionManager'
        ),

      clearSession: () =>
        set(
          (state) => ({
            sessionState: {
              ...state.sessionState,
              currentSession: null,
              isOfflineSession: false,
            },
          }),
          false,
          'clearSession'
        ),

      loadSessionData: (session) => {
        const { sessionState } = get()

        // Update session state
        set(
          {
            sessionState: {
              ...sessionState,
              currentSession: session,
              isOfflineSession: session.isOfflineSession ?? false,
            },
          },
          false,
          'loadSessionData'
        )

        if (session.isOfflineSession && session.audioBlobData) {
          console.log('Loaded offline session with embedded audio')
        } else {
          console.log(`Loaded session with ${session.paragraphs.length} paragraphs`)
        }

        return {
          text: session.text,
          paragraphs: session.paragraphs,
          voice: session.settings.voice,
          speed: session.settings.speed,
          pitch: session.settings.pitch,
          language: session.settings.language,
          preGeneratedAudio: session.audioUrls || [],
        }
      },

      // Batch Generation Actions
      setPreGeneratedAudio: (audio) =>
        set(
          (state) => ({
            batchGeneration: { ...state.batchGeneration, preGeneratedAudio: audio },
          }),
          false,
          'setPreGeneratedAudio'
        ),

      setIsPreGenerated: (isPreGenerated) =>
        set(
          (state) => ({
            batchGeneration: { ...state.batchGeneration, isPreGenerated },
          }),
          false,
          'setIsPreGenerated'
        ),

      resetBatchGeneration: () =>
        set({ batchGeneration: defaultBatchGeneration }, false, 'resetBatchGeneration'),

      initializeBatchForParagraphs: (paragraphCount) =>
        set(
          {
            batchGeneration: {
              preGeneratedAudio: new Array(paragraphCount).fill(''),
              isPreGenerated: false,
            },
          },
          false,
          'initializeBatchForParagraphs'
        ),

      loadBatchFromSession: (audio) =>
        set(
          {
            batchGeneration: {
              preGeneratedAudio: audio,
              isPreGenerated: audio.length > 0 && audio.every((url) => url !== ''),
            },
          },
          false,
          'loadBatchFromSession'
        ),

      // Modal State Actions
      toggleSettings: () =>
        set(
          (state) => ({
            modalState: { ...state.modalState, showSettings: !state.modalState.showSettings },
          }),
          false,
          'toggleSettings'
        ),

      openBatchGenerator: () =>
        set(
          (state) => ({
            modalState: { ...state.modalState, showBatchGenerator: true },
          }),
          false,
          'openBatchGenerator'
        ),

      closeBatchGenerator: () =>
        set(
          (state) => ({
            modalState: { ...state.modalState, showBatchGenerator: false },
          }),
          false,
          'closeBatchGenerator'
        ),

      openExportImport: () =>
        set(
          (state) => ({
            modalState: { ...state.modalState, showExportImport: true },
          }),
          false,
          'openExportImport'
        ),

      closeExportImport: () =>
        set(
          (state) => ({
            modalState: { ...state.modalState, showExportImport: false },
          }),
          false,
          'closeExportImport'
        ),

      setShowBufferSettings: (show) =>
        set(
          (state) => ({
            modalState: { ...state.modalState, showBufferSettings: show },
          }),
          false,
          'setShowBufferSettings'
        ),

      // Resume State Actions
      setShowResumePrompt: (show) =>
        set(
          (state) => ({
            resumeState: { ...state.resumeState, showResumePrompt: show },
          }),
          false,
          'setShowResumePrompt'
        ),

      setLastPlaybackPosition: (index) =>
        set(
          (state) => ({
            resumeState: { ...state.resumeState, lastPlaybackPositionIndex: index },
          }),
          false,
          'setLastPlaybackPosition'
        ),

      handleResumePosition: (session) => {
        if (session.lastPlaybackPosition) {
          const { paragraphIndex, timestamp } = session.lastPlaybackPosition
          // Show resume prompt if position is recent (within 30 days) and not at the start
          const isRecent = Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000
          if (isRecent && paragraphIndex > 0 && paragraphIndex < session.paragraphs.length) {
            set(
              {
                resumeState: {
                  showResumePrompt: true,
                  lastPlaybackPositionIndex: paragraphIndex,
                },
              },
              false,
              'handleResumePosition'
            )
          } else {
            set(
              { resumeState: defaultResumeState },
              false,
              'handleResumePosition_reset'
            )
          }
        } else {
          set(
            { resumeState: defaultResumeState },
            false,
            'handleResumePosition_noPosition'
          )
        }
      },

      // Import/Export State Actions
      setImportError: (error) =>
        set({ importExportState: { importError: error } }, false, 'setImportError'),

      // Smart Split Actions
      setUseSmartSplit: (use) =>
        set({ smartSplitState: { useSmartSplit: use } }, false, 'setUseSmartSplit'),

      // Global Actions
      resetAll: () =>
        set(
          {
            ttsSettings: defaultTtsSettings,
            playbackSettings: defaultPlaybackSettings,
            textState: defaultTextState,
            sessionState: { ...defaultSessionState, sessionManagerKey: Date.now() },
            batchGeneration: defaultBatchGeneration,
            modalState: defaultModalState,
            resumeState: defaultResumeState,
            importExportState: defaultImportExportState,
            smartSplitState: defaultSmartSplitState,
          },
          false,
          'resetAll'
        ),
    }),
    { name: 'ReaderStore' }
  )
)

// Subscribe to playback settings changes and persist to localStorage
if (typeof window !== 'undefined') {
  useReaderStore.subscribe(
    (state) => state.playbackSettings,
    (playbackSettings) => {
      try {
        localStorage.setItem('alltalk-playback-settings', JSON.stringify(playbackSettings))
      } catch (e) {
        console.warn('[PlaybackSettings] Failed to save to localStorage:', e)
      }
    }
  )
}
