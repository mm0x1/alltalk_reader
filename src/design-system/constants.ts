/**
 * Design System Constants
 * 
 * Centralized design tokens for consistent styling throughout the application.
 * This replaces scattered hardcoded values with a single source of truth.
 */

export const COLORS = {
  // Accent colors
  ACCENT_PRIMARY: 'rgb(59, 130, 246)',
  ACCENT_SUCCESS: 'rgb(34, 197, 94)',
  ACCENT_WARNING: 'rgb(245, 158, 11)',
  ACCENT_DANGER: 'rgb(239, 68, 68)',
  
  // Dark theme colors
  DARK_100: '#1f2937',
  DARK_200: '#374151',
  DARK_300: '#4b5563',
  DARK_400: '#6b7280',
  DARK_500: '#9ca3af',
  
  // Text colors
  TEXT_WHITE: '#ffffff',
  TEXT_GRAY_200: '#e5e7eb',
  TEXT_GRAY_300: '#d1d5db',
  TEXT_GRAY_400: '#9ca3af',
} as const;

export const SPACING = {
  XS: '0.25rem',
  SM: '0.5rem', 
  MD: '1rem',
  LG: '1.5rem',
  XL: '2rem',
  XXL: '3rem',
} as const;

export const BORDER_RADIUS = {
  SM: '0.25rem',
  MD: '0.375rem',
  LG: '0.5rem',
  FULL: '9999px',
} as const;

export const AUDIO_STATUS = {
  INITIAL: 'initial',
  GENERATING: 'generating', 
  PLAYING: 'playing',
  PAUSED: 'paused',
  ERROR: 'error',
} as const;

export const API_ENDPOINTS = {
  READY: '/api/ready',
  CURRENT_SETTINGS: '/api/currentsettings',
  VOICES: '/api/voices',
  RVC_VOICES: '/api/rvcvoices',
  RELOAD_CONFIG: '/api/reload_config',
  TTS_GENERATE: '/api/tts-generate',
  // Advanced API endpoints (Phase 5)
  MODEL_RELOAD: '/api/reload',
  DEEPSPEED_TOGGLE: '/api/deepspeed',
  LOWVRAM_TOGGLE: '/api/lowvramsetting',
  TTS_GENERATE_STREAMING: '/api/tts-generate-streaming',
} as const;