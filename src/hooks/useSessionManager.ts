import { useReaderStore } from '~/state/readerStore'
import { type AudioSession, importSessionFromFile } from '~/services/session'

/**
 * Hook for managing session state (current session, offline mode, session manager UI)
 * Now backed by Zustand store (Phase 3)
 */
export function useSessionManager() {
  const showSessionManager = useReaderStore((state) => state.sessionState.showSessionManager)
  const sessionManagerKey = useReaderStore((state) => state.sessionState.sessionManagerKey)
  const currentSession = useReaderStore((state) => state.sessionState.currentSession)
  const isOfflineSession = useReaderStore((state) => state.sessionState.isOfflineSession)

  const openSessionManager = useReaderStore((state) => state.openSessionManager)
  const closeSessionManager = useReaderStore((state) => state.closeSessionManager)
  const refreshSessionManager = useReaderStore((state) => state.refreshSessionManager)
  const clearSession = useReaderStore((state) => state.clearSession)
  const loadSessionData = useReaderStore((state) => state.loadSessionData)

  const loadSession = (session: AudioSession) => {
    if (!session) return

    try {
      return loadSessionData(session)
    } catch (error) {
      console.error('Error loading session:', error)
      throw new Error('Failed to load the session. Please try again.')
    }
  }

  const handleFileImport = async (file: File): Promise<AudioSession> => {
    try {
      const importedSession = await importSessionFromFile(file)
      return importedSession
    } catch (error) {
      console.error('Error importing session:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to import session')
    }
  }

  return {
    showSessionManager,
    sessionManagerKey,
    currentSession,
    isOfflineSession,
    openSessionManager,
    closeSessionManager,
    loadSession,
    handleFileImport,
    refreshSessionManager,
    clearSession,
  }
}