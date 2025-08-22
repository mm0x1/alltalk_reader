import { useState } from 'react'
import { AudioSession, importSessionFromFile } from '~/services/sessionStorage'

export function useSessionManager() {
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [sessionManagerKey, setSessionManagerKey] = useState(Date.now())
  const [currentSession, setCurrentSession] = useState<AudioSession | null>(null)
  const [isOfflineSession, setIsOfflineSession] = useState(false)

  const openSessionManager = () => {
    setSessionManagerKey(Date.now())
    setShowSessionManager(true)
  }

  const closeSessionManager = () => {
    setShowSessionManager(false)
  }

  const loadSession = (session: AudioSession) => {
    if (!session) return

    try {
      setCurrentSession(session)

      if (session.isOfflineSession && session.audioBlobData) {
        setIsOfflineSession(true)
        console.log('Loaded offline session with embedded audio')
      } else {
        setIsOfflineSession(false)
      }

      console.log(`Loaded session with ${session.paragraphs.length} paragraphs`)
      return {
        text: session.text,
        paragraphs: session.paragraphs,
        voice: session.settings.voice,
        speed: session.settings.speed,
        pitch: session.settings.pitch,
        language: session.settings.language,
        preGeneratedAudio: session.audioUrls || []
      }
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

  const refreshSessionManager = () => {
    setSessionManagerKey(Date.now())
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
    refreshSessionManager
  }
}