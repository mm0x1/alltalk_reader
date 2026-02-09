import { useState } from 'react'

const DEFAULT_VOICE = 'female_01.wav'

// Default values for advanced settings
// Temperature: 0.65 for stability (reduces vocal fry/distortion in longer texts)
// Repetition Penalty: 3.0 for natural speech patterns (5.0 was too restrictive)
const DEFAULT_TEMPERATURE = 0.65
const DEFAULT_REPETITION_PENALTY = 3.0
const DEFAULT_RVC_PITCH = 0

export interface AdvancedTtsSettings {
  temperature: number
  repetitionPenalty: number
  selectedRvcVoice: string | null
  rvcPitch: number
}

export function useTtsSettings() {
  // Basic settings
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE)
  /** @deprecated Speed is now handled client-side via playbackRate. Always 1.0 for generation. */
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [language, setLanguage] = useState('en')

  // Advanced settings (Phase 5)
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE)
  const [repetitionPenalty, setRepetitionPenalty] = useState(DEFAULT_REPETITION_PENALTY)
  const [selectedRvcVoice, setSelectedRvcVoice] = useState<string | null>(null)
  const [rvcPitch, setRvcPitch] = useState(DEFAULT_RVC_PITCH)

  const updateVoice = (voice: string, resetPreGenerated?: () => void) => {
    setSelectedVoice(voice)
    resetPreGenerated?.()
  }

  /** @deprecated Speed is now handled client-side via playbackRate. This does nothing. */
  const updateSpeed = (newSpeed: number, resetPreGenerated?: () => void) => {
    // Deprecated: Speed changes no longer invalidate cache
    // Always keep speed at 1.0 for normalized generation
    console.warn('[useTtsSettings] updateSpeed is deprecated. Use playbackSpeed from usePlaybackSettings instead.')
    // Do not call resetPreGenerated - speed changes don't require regeneration
  }

  const updatePitch = (newPitch: number, resetPreGenerated?: () => void) => {
    setPitch(newPitch)
    resetPreGenerated?.()
  }

  const updateLanguage = (newLanguage: string, resetPreGenerated?: () => void) => {
    setLanguage(newLanguage)
    resetPreGenerated?.()
  }

  // Advanced settings updaters
  const updateTemperature = (newTemperature: number, resetPreGenerated?: () => void) => {
    setTemperature(newTemperature)
    resetPreGenerated?.()
  }

  const updateRepetitionPenalty = (newPenalty: number, resetPreGenerated?: () => void) => {
    setRepetitionPenalty(newPenalty)
    resetPreGenerated?.()
  }

  const updateRvcVoice = (voice: string | null, resetPreGenerated?: () => void) => {
    setSelectedRvcVoice(voice)
    resetPreGenerated?.()
  }

  const updateRvcPitch = (newPitch: number, resetPreGenerated?: () => void) => {
    setRvcPitch(newPitch)
    resetPreGenerated?.()
  }

  const loadFromSession = (
    voice: string,
    sessionSpeed: number, // Kept for backwards compatibility, but ignored
    sessionPitch: number,
    sessionLanguage: string,
    advancedSettings?: Partial<AdvancedTtsSettings>
  ) => {
    setSelectedVoice(voice)
    // Always normalize speed to 1.0 (playback speed is handled separately)
    setSpeed(1.0)
    setPitch(sessionPitch)
    setLanguage(sessionLanguage)

    // Load advanced settings if provided
    if (advancedSettings) {
      if (advancedSettings.temperature !== undefined) {
        setTemperature(advancedSettings.temperature)
      }
      if (advancedSettings.repetitionPenalty !== undefined) {
        setRepetitionPenalty(advancedSettings.repetitionPenalty)
      }
      if (advancedSettings.selectedRvcVoice !== undefined) {
        setSelectedRvcVoice(advancedSettings.selectedRvcVoice)
      }
      if (advancedSettings.rvcPitch !== undefined) {
        setRvcPitch(advancedSettings.rvcPitch)
      }
    }
  }

  const reset = () => {
    setSelectedVoice(DEFAULT_VOICE)
    setSpeed(1.0)
    setPitch(0)
    setLanguage('en')
    // Reset advanced settings
    setTemperature(DEFAULT_TEMPERATURE)
    setRepetitionPenalty(DEFAULT_REPETITION_PENALTY)
    setSelectedRvcVoice(null)
    setRvcPitch(DEFAULT_RVC_PITCH)
  }

  const resetAdvanced = () => {
    setTemperature(DEFAULT_TEMPERATURE)
    setRepetitionPenalty(DEFAULT_REPETITION_PENALTY)
    setSelectedRvcVoice(null)
    setRvcPitch(DEFAULT_RVC_PITCH)
  }

  return {
    // Basic settings
    selectedVoice,
    /** @deprecated Speed is now handled client-side via playbackRate. Always 1.0. */
    speed,
    pitch,
    language,
    updateVoice,
    /** @deprecated Use playbackSpeed from usePlaybackSettings instead. */
    updateSpeed,
    updatePitch,
    updateLanguage,

    // Advanced settings
    temperature,
    repetitionPenalty,
    selectedRvcVoice,
    rvcPitch,
    updateTemperature,
    updateRepetitionPenalty,
    updateRvcVoice,
    updateRvcPitch,

    // Utilities
    loadFromSession,
    reset,
    resetAdvanced,

    // Constants for UI
    defaults: {
      temperature: DEFAULT_TEMPERATURE,
      repetitionPenalty: DEFAULT_REPETITION_PENALTY,
      rvcPitch: DEFAULT_RVC_PITCH,
    }
  }
}
