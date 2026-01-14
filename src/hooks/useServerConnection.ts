import { useEffect, useCallback } from 'react'
import { useApiState } from '~/contexts/ApiStateContext'
import { initializeSessionApi } from '~/services/session'

export function useServerConnection() {
  const { state, actions } = useApiState()

  useEffect(() => {
    // Initialize session API on mount
    initializeSessionApi()
  }, [])

  const updateConnectionStatus = useCallback((status: boolean) => {
    // This is now managed by the ApiStateContext
    // If we need to manually update, we can trigger a re-check
    if (status) {
      actions.checkConnection()
    }
  }, [actions])

  return {
    isServerConnected: state.isConnected,
    updateConnectionStatus
  }
}
