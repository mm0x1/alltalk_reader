import { useReaderStore } from "~/state/readerStore";

const DEFAULT_VOICE = "female_01.wav";
const DEFAULT_TEMPERATURE = 0.6;
const DEFAULT_REPETITION_PENALTY = 3.0;
const DEFAULT_RVC_PITCH = 0;

export interface AdvancedTtsSettings {
  temperature: number;
  repetitionPenalty: number;
  selectedRvcVoice: string | null;
  rvcPitch: number;
}

/**
 * Hook for managing TTS generation settings
 * Now backed by Zustand store (Phase 3)
 *
 * NOTE: The resetPreGenerated callback pattern is maintained for backward
 * compatibility but represents tight coupling. In Phase 3.5, this should be
 * refactored so that reader.tsx calls both actions separately.
 */
export function useTtsSettings() {
  // Select state
  const selectedVoice = useReaderStore(
    (state) => state.ttsSettings.selectedVoice,
  );
  const speed = useReaderStore((state) => state.ttsSettings.speed);
  const pitch = useReaderStore((state) => state.ttsSettings.pitch);
  const language = useReaderStore((state) => state.ttsSettings.language);
  const temperature = useReaderStore((state) => state.ttsSettings.temperature);
  const repetitionPenalty = useReaderStore(
    (state) => state.ttsSettings.repetitionPenalty,
  );
  const selectedRvcVoice = useReaderStore(
    (state) => state.ttsSettings.selectedRvcVoice,
  );
  const rvcPitch = useReaderStore((state) => state.ttsSettings.rvcPitch);

  // Select actions
  const updateVoiceStore = useReaderStore((state) => state.updateVoice);
  const updateSpeedStore = useReaderStore((state) => state.updateSpeed);
  const updatePitchStore = useReaderStore((state) => state.updatePitch);
  const updateLanguageStore = useReaderStore((state) => state.updateLanguage);
  const updateTemperatureStore = useReaderStore(
    (state) => state.updateTemperature,
  );
  const updateRepetitionPenaltyStore = useReaderStore(
    (state) => state.updateRepetitionPenalty,
  );
  const updateRvcVoiceStore = useReaderStore((state) => state.updateRvcVoice);
  const updateRvcPitchStore = useReaderStore((state) => state.updateRvcPitch);
  const loadTtsFromSessionStore = useReaderStore(
    (state) => state.loadTtsFromSession,
  );
  const resetTtsSettingsStore = useReaderStore(
    (state) => state.resetTtsSettings,
  );

  // Wrapper functions that maintain callback pattern for backward compatibility
  const updateVoice = (voice: string, resetPreGenerated?: () => void) => {
    updateVoiceStore(voice);
    resetPreGenerated?.();
  };

  /** @deprecated Speed is now handled client-side via playbackRate. This does nothing. */
  const updateSpeed = (newSpeed: number, resetPreGenerated?: () => void) => {
    // Deprecated: Speed changes no longer invalidate cache
    // Always keep speed at 1.0 for normalized generation
    console.warn(
      "[useTtsSettings] updateSpeed is deprecated. Use playbackSpeed from usePlaybackSettings instead.",
    );
    // Do not call resetPreGenerated - speed changes don't require regeneration
  };

  const updatePitch = (newPitch: number, resetPreGenerated?: () => void) => {
    updatePitchStore(newPitch);
    resetPreGenerated?.();
  };

  const updateLanguage = (
    newLanguage: string,
    resetPreGenerated?: () => void,
  ) => {
    updateLanguageStore(newLanguage);
    resetPreGenerated?.();
  };

  const updateTemperature = (
    newTemperature: number,
    resetPreGenerated?: () => void,
  ) => {
    updateTemperatureStore(newTemperature);
    resetPreGenerated?.();
  };

  const updateRepetitionPenalty = (
    newPenalty: number,
    resetPreGenerated?: () => void,
  ) => {
    updateRepetitionPenaltyStore(newPenalty);
    resetPreGenerated?.();
  };

  const updateRvcVoice = (
    voice: string | null,
    resetPreGenerated?: () => void,
  ) => {
    updateRvcVoiceStore(voice);
    resetPreGenerated?.();
  };

  const updateRvcPitch = (newPitch: number, resetPreGenerated?: () => void) => {
    updateRvcPitchStore(newPitch);
    resetPreGenerated?.();
  };

  const loadFromSession = (
    voice: string,
    sessionSpeed: number, // Kept for backwards compatibility, but ignored
    sessionPitch: number,
    sessionLanguage: string,
    advancedSettings?: Partial<AdvancedTtsSettings>,
  ) => {
    loadTtsFromSessionStore(voice, sessionSpeed, sessionPitch, sessionLanguage);

    // Load advanced settings if provided
    if (advancedSettings) {
      if (advancedSettings.temperature !== undefined) {
        updateTemperatureStore(advancedSettings.temperature);
      }
      if (advancedSettings.repetitionPenalty !== undefined) {
        updateRepetitionPenaltyStore(advancedSettings.repetitionPenalty);
      }
      if (advancedSettings.selectedRvcVoice !== undefined) {
        updateRvcVoiceStore(advancedSettings.selectedRvcVoice);
      }
      if (advancedSettings.rvcPitch !== undefined) {
        updateRvcPitchStore(advancedSettings.rvcPitch);
      }
    }
  };

  const reset = () => {
    resetTtsSettingsStore();
  };

  const resetAdvanced = () => {
    updateTemperatureStore(DEFAULT_TEMPERATURE);
    updateRepetitionPenaltyStore(DEFAULT_REPETITION_PENALTY);
    updateRvcVoiceStore(null);
    updateRvcPitchStore(DEFAULT_RVC_PITCH);
  };

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
    },
  };
}
