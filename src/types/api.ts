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

  // Advanced capabilities (Phase 5)
  streaming_capable?: boolean;
  multivoice_capable?: boolean;
  deepspeed_available?: boolean;
  deepspeed_enabled?: boolean;
  lowvram_capable?: boolean;
  lowvram_enabled?: boolean;
  temperature_capable?: boolean;
  rvc_available?: boolean;

  // Current loaded model/engine info
  current_model_loaded?: string;
  current_engine_loaded?: string;
  audio_format?: string;
  available_models?: string[];

  // Additional settings that may be returned by the API
  [key: string]: unknown;
}

/**
 * Response from /api/reload (model switch)
 */
export interface ModelReloadResponse {
  status: 'model-success' | 'model-failure';
  message?: string;
}

/**
 * Response from /api/deepspeed toggle
 */
export interface DeepSpeedToggleResponse {
  status: 'deepspeed-success' | 'deepspeed-failure';
  message?: string;
}

/**
 * Response from /api/lowvramsetting toggle
 */
export interface LowVramToggleResponse {
  status: 'lowvram-success' | 'lowvram-failure';
  message?: string;
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
