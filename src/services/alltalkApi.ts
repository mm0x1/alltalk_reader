/**
 * AllTalk API Service (Legacy Compatibility Layer)
 * 
 * This file now provides backward compatibility for existing components
 * while the actual implementation has been moved to modular services.
 * 
 * @deprecated Use the new modular services from ~/services/api instead
 */

import { 
  statusService, 
  voiceService, 
  ttsService, 
  type ServerStatus,
  type TtsOptions 
} from './api';
import { API_CONFIG } from '~/config/env';

// Legacy global state for backward compatibility
// This will be removed when all components are updated to use React context
let LEGACY_SERVER_STATUS: ServerStatus = {
  ready: false,
  error: null,
  currentSettings: null,
  availableVoices: [],
  availableRvcVoices: [],
};


/**
 * Check if the AllTalk server is ready
 * @deprecated Use statusService.checkReady() from ~/services/api instead
 */
export async function checkServerReady(): Promise<boolean> {
  try {
    const isReady = await statusService.checkReady();
    LEGACY_SERVER_STATUS.ready = isReady;
    LEGACY_SERVER_STATUS.error = null;
    return isReady;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LEGACY_SERVER_STATUS.ready = false;
    LEGACY_SERVER_STATUS.error = errorMessage;
    return false;
  }
}

/**
 * Initialize the API service by checking server status and fetching settings and voices
 * @deprecated Use the ApiStateProvider context instead
 */
export async function initializeApi(): Promise<boolean> {
  try {
    const isReady = await checkServerReady();
    if (!isReady) return false;

    const [settings, voices, rvcVoices] = await Promise.all([
      statusService.getCurrentSettings().catch(() => null),
      voiceService.getAvailableVoices().catch(() => []),
      voiceService.getAvailableRvcVoices().catch(() => []),
    ]);

    LEGACY_SERVER_STATUS.currentSettings = settings;
    LEGACY_SERVER_STATUS.availableVoices = voices;
    LEGACY_SERVER_STATUS.availableRvcVoices = rvcVoices;

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LEGACY_SERVER_STATUS.error = errorMessage;
    return false;
  }
}

/**
 * Fetch current settings from the server
 * @deprecated Use statusService.getCurrentSettings() from ~/services/api instead
 */
export async function getCurrentSettings(): Promise<boolean> {
  try {
    const settings = await statusService.getCurrentSettings();
    LEGACY_SERVER_STATUS.currentSettings = settings;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LEGACY_SERVER_STATUS.error = errorMessage;
    return false;
  }
}

/**
 * Fetch available voices from the server
 * @deprecated Use voiceService.getAvailableVoices() from ~/services/api instead
 */
export async function getAvailableVoices(): Promise<boolean> {
  try {
    const voices = await voiceService.getAvailableVoices();
    LEGACY_SERVER_STATUS.availableVoices = voices;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LEGACY_SERVER_STATUS.error = errorMessage;
    return false;
  }
}

/**
 * Fetch available RVC voices from the server
 * @deprecated Use voiceService.getAvailableRvcVoices() from ~/services/api instead
 */
export async function getAvailableRvcVoices(): Promise<boolean> {
  try {
    const rvcVoices = await voiceService.getAvailableRvcVoices();
    LEGACY_SERVER_STATUS.availableRvcVoices = rvcVoices;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LEGACY_SERVER_STATUS.error = errorMessage;
    return false;
  }
}

/**
 * Reload the server configuration
 * @deprecated Use statusService.reloadConfig() from ~/services/api instead
 */
export async function reloadConfig(): Promise<boolean> {
  try {
    await statusService.reloadConfig();
    await initializeApi();
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LEGACY_SERVER_STATUS.error = errorMessage;
    return false;
  }
}

/**
 * Generate Text-to-Speech audio
 * @deprecated Use ttsService.generateTTS() from ~/services/api instead
 */
export async function generateTTS(text: string, options: TtsOptions = {}) {
  try {
    const result = await ttsService.generateTTS(text, options);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    LEGACY_SERVER_STATUS.error = errorMessage;
    return null;
  }
}

/**
 * Split text into chunks that respect the maximum character limit
 * @deprecated Use ttsService.splitTextIntoChunks() from ~/services/api instead
 */
export function splitTextIntoChunks(text: string, maxLength = API_CONFIG.maxCharacters): string[] {
  return ttsService.splitTextIntoChunks(text, maxLength);
}

/**
 * Split text into paragraphs and ensure each paragraph respects character limits
 * @deprecated Use ttsService.splitIntoParagraphs() from ~/services/api instead
 */
export function splitIntoParagraphs(text: string): string[] {
  return ttsService.splitIntoParagraphs(text);
}

/**
 * Get the current server status
 * @deprecated Use useApiState hook instead
 */
export function getServerStatus() {
  return { ...LEGACY_SERVER_STATUS };
}

/**
 * Get the current API configuration
 * @deprecated Import API_CONFIG directly from ~/config/env instead
 */
export function getApiConfig() {
  return { ...API_CONFIG };
}

/**
 * Update API configuration
 * @deprecated Configuration should be managed through environment variables
 */
export function updateApiConfig(newConfig: any) {
  // This is deprecated - configuration should be managed through environment variables
  console.warn('updateApiConfig is deprecated. Use environment variables for configuration.');
}

/**
 * Get a list of available voices in a user-friendly format
 * @deprecated Use voiceService.getVoiceOptions() from ~/services/api instead
 */
export function getVoiceOptions() {
  const voices = LEGACY_SERVER_STATUS.availableVoices || [];
  return voiceService.formatVoiceOptions(voices);
}

// Legacy initialization - this will be removed when all components use the new context
initializeApi().catch(error => {
  console.error('Failed to initialize legacy API:', error);
});
