/**
 * Environment Configuration
 *
 * Centralized configuration management using environment variables.
 * This replaces hardcoded configuration values throughout the application.
 *
 * User can override host/port via the UI, stored in localStorage.
 */

interface ApiConfig {
  protocol: string;
  host: string;
  port: string;
  connectionTimeout: number;
  maxCharacters: number;
  advancedApiSettings: boolean;
}

const STORAGE_KEY = "alltalk-server-config";

/**
 * Default maximum characters per TTS request.
 * Single source of truth — used as the fallback when VITE_MAX_CHARACTERS is unset
 * and as the hard paragraph-length limit during text splitting.
 */
export const DEFAULT_MAX_CHARACTERS = 512;

// Load stored config from localStorage (only in browser)
function getStoredConfig(): { host?: string; port?: string } {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return {};
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

const storedConfig = getStoredConfig();

export const API_CONFIG: ApiConfig = {
  protocol: import.meta.env.VITE_API_PROTOCOL || "http://",
  host: storedConfig.host || import.meta.env.VITE_API_HOST || "localhost",
  port: storedConfig.port || import.meta.env.VITE_API_PORT || "7851",
  connectionTimeout: Number(import.meta.env.VITE_CONNECTION_TIMEOUT) || 5,
  maxCharacters:
    Number(import.meta.env.VITE_MAX_CHARACTERS) || DEFAULT_MAX_CHARACTERS,
  advancedApiSettings: import.meta.env.VITE_ADVANCED_API_SETTINGS === "true",
};

export const getBaseUrl = () =>
  `${API_CONFIG.protocol}${API_CONFIG.host}:${API_CONFIG.port}`;
