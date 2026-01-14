/**
 * Storage Services
 *
 * IndexedDB-based storage for audio caching with migration from sessionStorage.
 */

// Types
export type {
  AudioCacheEntry,
  SessionCacheMetadata,
  StorageStats,
  MigrationProgress,
  MigrationProgressCallback,
} from './types';

// IndexedDB operations
export {
  isIndexedDbAvailable,
  storeAudioBlob,
  storeAudioBlobsForSession,
  getAudioBlob,
  getAudioBlobsForSession,
  hasSessionCache,
  getSessionCacheMetadata,
  deleteSessionCache,
  clearAllCache,
  getStorageStats,
  getCachedSessionIds,
  iterateSessionAudio,
} from './indexedDb';

// Migration
export {
  migrateFromSessionStorage,
  hasPendingMigration,
  getPendingMigrationCount,
} from './migration';
