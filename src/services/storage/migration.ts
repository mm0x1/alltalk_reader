/**
 * Storage Migration
 *
 * Handles migration from sessionStorage to IndexedDB.
 */

import { storeAudioBlobsForSession, hasSessionCache } from './indexedDb';
import { base64ToBlob } from '../session/utils';
import type { MigrationProgress, MigrationProgressCallback } from './types';

interface SessionStorageMeta {
  sessionId: string;
  keys: string[];
  timestamp: number;
}

/**
 * Find all session caches in sessionStorage
 */
function findSessionStorageCaches(): SessionStorageMeta[] {
  const sessions: SessionStorageMeta[] = [];

  try {
    const keys = Object.keys(sessionStorage);
    const metaKeys = keys.filter((key) => key.endsWith('_meta') && key.startsWith('audio_cache_'));

    for (const metaKey of metaKeys) {
      const metaData = sessionStorage.getItem(metaKey);
      if (metaData) {
        try {
          const meta = JSON.parse(metaData) as SessionStorageMeta;
          sessions.push(meta);
        } catch {
          console.warn(`Failed to parse meta for ${metaKey}`);
        }
      }
    }
  } catch (error) {
    console.error('Error finding sessionStorage caches:', error);
  }

  return sessions;
}

/**
 * Migrate a single session from sessionStorage to IndexedDB
 */
async function migrateSession(meta: SessionStorageMeta): Promise<boolean> {
  const cacheKey = `audio_cache_${meta.sessionId}`;
  const blobs: Record<string, Blob> = {};

  try {
    // Check if already migrated
    if (await hasSessionCache(meta.sessionId)) {
      console.log(`Session ${meta.sessionId} already migrated, skipping`);
      return true;
    }

    // Extract all audio blobs
    for (const key of meta.keys) {
      const base64Data = sessionStorage.getItem(`${cacheKey}_${key}`);
      if (base64Data) {
        blobs[key] = base64ToBlob(base64Data);
      }
    }

    if (Object.keys(blobs).length === 0) {
      return false;
    }

    // Store in IndexedDB
    await storeAudioBlobsForSession(meta.sessionId, blobs);
    return true;
  } catch (error) {
    console.error(`Failed to migrate session ${meta.sessionId}:`, error);
    return false;
  }
}

/**
 * Clear a session from sessionStorage after successful migration
 */
function clearSessionStorageCache(sessionId: string, keys: string[]): void {
  const cacheKey = `audio_cache_${sessionId}`;

  try {
    for (const key of keys) {
      sessionStorage.removeItem(`${cacheKey}_${key}`);
    }
    sessionStorage.removeItem(`${cacheKey}_meta`);
  } catch (error) {
    console.error(`Error clearing sessionStorage for ${sessionId}:`, error);
  }
}

/**
 * Migrate all session caches from sessionStorage to IndexedDB
 *
 * @param onProgress - Optional callback for progress updates
 * @param clearAfterMigration - Whether to clear sessionStorage after successful migration
 * @returns Migration statistics
 */
export async function migrateFromSessionStorage(
  onProgress?: MigrationProgressCallback,
  clearAfterMigration = true
): Promise<MigrationProgress> {
  const sessions = findSessionStorageCaches();

  const progress: MigrationProgress = {
    total: sessions.length,
    migrated: 0,
    failed: 0,
    currentSession: null,
  };

  if (sessions.length === 0) {
    return progress;
  }

  console.log(`Found ${sessions.length} sessions to migrate from sessionStorage`);

  for (const meta of sessions) {
    progress.currentSession = meta.sessionId;
    onProgress?.(progress);

    const success = await migrateSession(meta);

    if (success) {
      progress.migrated++;
      if (clearAfterMigration) {
        clearSessionStorageCache(meta.sessionId, meta.keys);
      }
    } else {
      progress.failed++;
    }

    // Yield to main thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  progress.currentSession = null;
  onProgress?.(progress);

  console.log(
    `Migration complete: ${progress.migrated} succeeded, ${progress.failed} failed`
  );

  return progress;
}

/**
 * Check if there are caches in sessionStorage that need migration
 */
export function hasPendingMigration(): boolean {
  const sessions = findSessionStorageCaches();
  return sessions.length > 0;
}

/**
 * Get the count of sessions pending migration
 */
export function getPendingMigrationCount(): number {
  const sessions = findSessionStorageCaches();
  return sessions.length;
}
