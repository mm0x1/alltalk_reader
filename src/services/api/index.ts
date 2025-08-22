/**
 * API Services Index
 * 
 * Exports all API services and provides a unified interface
 * that replaces the monolithic alltalkApi.ts file.
 */

export * from './client';
export * from './status';
export * from './voices';
export * from './tts';

// Re-export services for easy access
export { statusService } from './status';
export { voiceService } from './voices';
export { ttsService } from './tts';