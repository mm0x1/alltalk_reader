import { useState, useEffect } from 'react';

const PLAYBACK_SETTINGS_KEY = 'alltalk-playback-settings';

interface PlaybackSettings {
  speed: number;
  preservesPitch: boolean;
}

const DEFAULT_SETTINGS: PlaybackSettings = {
  speed: 1.0,
  preservesPitch: true,
};

// Load from localStorage
const loadSettings = (): PlaybackSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(PLAYBACK_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('[PlaybackSettings] Failed to load from localStorage:', e);
  }
  return DEFAULT_SETTINGS;
};

// Save to localStorage
const saveSettings = (settings: PlaybackSettings): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PLAYBACK_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[PlaybackSettings] Failed to save to localStorage:', e);
  }
};

export function usePlaybackSettings() {
  const [settings, setSettings] = useState<PlaybackSettings>(() => loadSettings());

  // Persist to localStorage whenever settings change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSpeed = (speed: number) => {
    setSettings((prev) => ({ ...prev, speed }));
  };

  const updatePreservesPitch = (preservesPitch: boolean) => {
    setSettings((prev) => ({ ...prev, preservesPitch }));
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return {
    speed: settings.speed,
    preservesPitch: settings.preservesPitch,
    updateSpeed,
    updatePreservesPitch,
    reset,
  };
}
