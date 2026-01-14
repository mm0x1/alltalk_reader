/**
 * Capabilities Hook
 *
 * Derives AllTalk server capabilities from the ApiStateContext.
 * Used for capability-aware UI rendering.
 */

import { useMemo, useState, useEffect } from 'react';
import { useApiState } from '~/contexts/ApiStateContext';

export interface AllTalkCapabilities {
  // Basic capabilities (always checked)
  speed: boolean;
  pitch: boolean;
  language: boolean;

  // Advanced capabilities (Phase 5)
  streaming: boolean;
  multivoice: boolean;
  deepspeed: boolean;
  lowvram: boolean;
  temperature: boolean;
  rvc: boolean;

  // Current state
  deepspeedEnabled: boolean;
  lowvramEnabled: boolean;

  // Model info
  currentModel: string | null;
  currentEngine: string | null;
  audioFormat: string | null;
  availableModels: string[];
}

const defaultCapabilities: AllTalkCapabilities = {
  speed: true,
  pitch: true,
  language: true,
  streaming: false,
  multivoice: false,
  deepspeed: false,
  lowvram: false,
  temperature: false,
  rvc: false,
  deepspeedEnabled: false,
  lowvramEnabled: false,
  currentModel: null,
  currentEngine: null,
  audioFormat: null,
  availableModels: [],
};

export function useCapabilities(): AllTalkCapabilities {
  const { state } = useApiState();
  const settings = state.serverStatus?.currentSettings;
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return useMemo(() => {
    // Return default capabilities during SSR
    if (!isClient) {
      return defaultCapabilities;
    }

    return {
      // Basic capabilities
      speed: settings?.generationspeed_capable ?? true,
      pitch: settings?.pitch_capable ?? true,
      language: settings?.languages_capable ?? true,

      // Advanced capabilities
      streaming: settings?.streaming_capable ?? false,
      multivoice: settings?.multivoice_capable ?? false,
      deepspeed: settings?.deepspeed_available ?? false,
      lowvram: settings?.lowvram_capable ?? false,
      temperature: settings?.temperature_capable ?? false,
      rvc: (settings?.rvc_available ?? false) || (state.availableRvcVoices?.length > 0),

      // Current state
      deepspeedEnabled: settings?.deepspeed_enabled ?? false,
      lowvramEnabled: settings?.lowvram_enabled ?? false,

      // Model info
      currentModel: settings?.current_model_loaded ?? null,
      currentEngine: settings?.current_engine_loaded ?? null,
      audioFormat: settings?.audio_format ?? null,
      // models_available is an array of objects with 'name' property
      availableModels: (settings?.models_available as Array<{ name: string }> | undefined)?.map(m => m.name) ?? [],
    };
  }, [settings, state.availableRvcVoices, isClient]);
}

/**
 * Check if advanced API settings are enabled via environment variable
 * Uses useEffect to avoid SSR hydration issues
 */
export function useAdvancedSettingsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Only access the config on the client side to avoid SSR issues
    // Dynamic import to prevent SSR serialization problems
    import('~/config/env').then(({ API_CONFIG }) => {
      setEnabled(API_CONFIG.advancedApiSettings);
    });
  }, []);

  return enabled;
}
