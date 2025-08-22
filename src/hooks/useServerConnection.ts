import { useState, useEffect } from 'react'
import { initializeApi } from '~/services/alltalkApi'
import { initializeSessionApi } from '~/services/sessionStorage'

export function useServerConnection() {
  const [isServerConnected, setIsServerConnected] = useState(false)

  useEffect(() => {
    initializeApi()
      .then(success => {
        setIsServerConnected(success)
      })
      .catch(error => {
        console.error('Failed to initialize API:', error)
        setIsServerConnected(false)
      })

    initializeSessionApi()
  }, [])

  const updateConnectionStatus = (status: boolean) => {
    setIsServerConnected(status)
  }

  return {
    isServerConnected,
    updateConnectionStatus
  }
}