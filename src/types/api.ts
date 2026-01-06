/**
 * API Type Definitions
 *
 * Type definitions for AllTalk API responses and data structures.
 */

/**
 * AllTalk server settings returned by /api/currentsettings
 * These indicate what TTS engine capabilities are available.
 */
export interface AllTalkSettings {
  // Engine capabilities
  generationspeed_capable: boolean;
  pitch_capable: boolean;
  languages_capable: boolean;

  // Additional settings that may be returned by the API
  [key: string]: unknown;
}

/**
 * TTS Generation response from /api/tts-generate
 */
export interface TtsGenerateResponse {
  status: 'generate-success' | 'generate-failure';
  output_file_url?: string;
  output_file_path?: string;
  output_cache_url?: string;
  error?: string;
}

/**
 * Voice list response from /api/voices
 */
export interface VoicesResponse {
  voices?: string[];
  error?: string;
}

/**
 * RVC Voices list response from /api/rvcvoices
 */
export interface RvcVoicesResponse {
  rvcvoices?: string[];
  error?: string;
}

/**
 * Server ready response from /api/ready
 */
export type ReadyResponse = 'Ready' | string;
