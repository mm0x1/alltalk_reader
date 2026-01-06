/**
 * Session Services
 *
 * Modular session management services for audio sessions.
 */

// Types
export type { AudioSession, SessionStorageConfig } from './types';

// API (CRUD operations)
export {
  initializeSessionApi,
  getSessionApiConfig,
  getAllSessions,
  getSessionById,
  saveSession,
  deleteSession,
} from './api';

// Validation
export { isSessionValid } from './validation';

// Cache
export {
  cacheAudioBlobsForSession,
  getCachedAudioBlobsForSession,
  clearCachedAudioBlobsForSession,
  clearAllCachedAudioBlobs,
  getCacheSize,
} from './cache';

// Offline
export {
  getOfflineAudioUrl,
  getAudioUrlForPlayback,
  revokeAudioObjectUrl,
  revokeAllAudioObjectUrls,
} from './offline';

// Export
export {
  prepareSessionForExport,
  prepareSessionForExportFromCache,
  downloadSessionAsFile,
} from './export';

// Import
export { importSessionFromFile } from './import';

// Utils
export {
  generateSessionName,
  generateSessionId,
  blobToBase64,
  base64ToBlob,
} from './utils';
