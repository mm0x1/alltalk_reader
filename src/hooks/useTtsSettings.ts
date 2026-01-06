import { useState } from 'react'

const DEFAULT_VOICE = 'female_01.wav'

export function useTtsSettings() {
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE)
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [language, setLanguage] = useState('en')

  const updateVoice = (voice: string, resetPreGenerated?: () => void) => {
    setSelectedVoice(voice)
    resetPreGenerated?.()
  }

  const updateSpeed = (newSpeed: number, resetPreGenerated?: () => void) => {
    setSpeed(newSpeed)
    resetPreGenerated?.()
  }

  const updatePitch = (newPitch: number, resetPreGenerated?: () => void) => {
    setPitch(newPitch)
    resetPreGenerated?.()
  }

  const updateLanguage = (newLanguage: string, resetPreGenerated?: () => void) => {
    setLanguage(newLanguage)
    resetPreGenerated?.()
  }

  const loadFromSession = (voice: string, sessionSpeed: number, sessionPitch: number, sessionLanguage: string) => {
    setSelectedVoice(voice)
    setSpeed(sessionSpeed)
    setPitch(sessionPitch)
    setLanguage(sessionLanguage)
  }

  const reset = () => {
    setSelectedVoice(DEFAULT_VOICE)
    setSpeed(1.0)
    setPitch(0)
    setLanguage('en')
  }

  return {
    selectedVoice,
    speed,
    pitch,
    language,
    updateVoice,
    updateSpeed,
    updatePitch,
    updateLanguage,
    loadFromSession,
    reset
  }
}
