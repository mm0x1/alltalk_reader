/**
 * IndexedDB Storage
 *
 * Provides persistent storage for audio blobs using IndexedDB.
 * Much larger capacity than sessionStorage (typically 50%+ of disk).
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { AudioCacheEntry, SessionCacheMetadata, StorageStats } from './types';

const DB_NAME = 'alltalk-audio-cache';
const DB_VERSION = 1;

// Store names
const AUDIO_STORE = 'audioBlobs';
const SESSION_STORE = 'sessions';

type AudioCacheDB = IDBPDatabase<{
  [AUDIO_STORE]: {
    key: string;
    value: AudioCacheEntry;
    indexes: { bySession: string };
  };
  [SESSION_STORE]: {
    key: string;
    value: SessionCacheMetadata;
  };
}>;

let dbInstance: AudioCacheDB | null = null;

/**
 * Get or create the database instance
 */
async function getDb(): Promise<AudioCacheDB> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<{
    [AUDIO_STORE]: {
      key: string;
      value: AudioCacheEntry;
      indexes: { bySession: string };
    };
    [SESSION_STORE]: {
      key: string;
      value: SessionCacheMetadata;
    };
  }>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create audio blobs store with session index
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const audioStore = db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
        audioStore.createIndex('bySession', 'sessionId');
      }

      // Create session metadata store
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' });
      }
    },
  }) as AudioCacheDB;

  return dbInstance;
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Store a single audio blob
 */
export async function storeAudioBlob(
  sessionId: string,
  index: number,
  blob: Blob
): Promise<void> {
  const db = await getDb();
  const id = `${sessionId}_${index}`;

  const entry: AudioCacheEntry = {
    id,
    sessionId,
    index,
    blob,
    createdAt: Date.now(),
  };

  await db.put(AUDIO_STORE, entry);
}

/**
 * Store multiple audio blobs for a session (chunked for performance)
 */
export async function storeAudioBlobsForSession(
  sessionId: string,
  audioBlobs: Record<string, Blob>,
  onProgress?: (progress: number) => void
): Promise<void> {
  const db = await getDb();
  const keys = Object.keys(audioBlobs);
  const now = Date.now();
  let totalSize = 0;

  // Process in chunks to avoid blocking
  const CHUNK_SIZE = 10;
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    const tx = db.transaction(AUDIO_STORE, 'readwrite');

    await Promise.all(
      chunk.map(async (key) => {
        const blob = audioBlobs[key];
        // Extract index from key (e.g., "audio_0" -> 0)
        const indexMatch = key.match(/audio_(\d+)/);
        const index = indexMatch ? parseInt(indexMatch[1], 10) : i;

        const entry: AudioCacheEntry = {
          id: `${sessionId}_${index}`,
          sessionId,
          index,
          blob,
          createdAt: now,
        };

        totalSize += blob.size;
        return tx.store.put(entry);
      })
    );

    await tx.done;

    if (onProgress) {
      onProgress(Math.min(100, ((i + chunk.length) / keys.length) * 100));
    }

    // Yield to main thread
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Update session metadata
  const metadata: SessionCacheMetadata = {
    sessionId,
    audioCount: keys.length,
    totalSizeBytes: totalSize,
    createdAt: now,
    updatedAt: now,
  };
  await db.put(SESSION_STORE, metadata);
}

/**
 * Get a single audio blob
 */
export async function getAudioBlob(
  sessionId: string,
  index: number
): Promise<Blob | null> {
  const db = await getDb();
  const id = `${sessionId}_${index}`;
  const entry = await db.get(AUDIO_STORE, id);
  return entry?.blob ?? null;
}

/**
 * Get all audio blobs for a session
 */
export async function getAudioBlobsForSession(
  sessionId: string
): Promise<Record<string, Blob>> {
  const db = await getDb();
  const index = db.transaction(AUDIO_STORE).store.index('bySession');
  const entries = await index.getAll(sessionId);

  const blobs: Record<string, Blob> = {};
  for (const entry of entries) {
    blobs[`audio_${entry.index}`] = entry.blob;
  }

  return blobs;
}

/**
 * Check if a session has cached audio
 */
export async function hasSessionCache(sessionId: string): Promise<boolean> {
  const db = await getDb();
  const metadata = await db.get(SESSION_STORE, sessionId);
  return metadata !== undefined && metadata.audioCount > 0;
}

/**
 * Get session cache metadata
 */
export async function getSessionCacheMetadata(
  sessionId: string
): Promise<SessionCacheMetadata | null> {
  const db = await getDb();
  const metadata = await db.get(SESSION_STORE, sessionId);
  return metadata ?? null;
}

/**
 * Delete all audio blobs for a session
 */
export async function deleteSessionCache(sessionId: string): Promise<void> {
  const db = await getDb();

  // Delete all audio entries for this session
  const tx = db.transaction(AUDIO_STORE, 'readwrite');
  const index = tx.store.index('bySession');
  const keys = await index.getAllKeys(sessionId);

  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;

  // Delete session metadata
  await db.delete(SESSION_STORE, sessionId);
}

/**
 * Clear all cached data
 */
export async function clearAllCache(): Promise<void> {
  const db = await getDb();
  await db.clear(AUDIO_STORE);
  await db.clear(SESSION_STORE);
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
  const db = await getDb();

  const sessions = await db.getAll(SESSION_STORE);
  const totalSizeBytes = sessions.reduce((sum, s) => sum + s.totalSizeBytes, 0);

  return {
    totalSessions: sessions.length,
    totalAudioFiles: sessions.reduce((sum, s) => sum + s.audioCount, 0),
    totalSizeBytes,
    estimatedSizeMB: Math.round((totalSizeBytes / (1024 * 1024)) * 100) / 100,
  };
}

/**
 * Get all cached session IDs
 */
export async function getCachedSessionIds(): Promise<string[]> {
  const db = await getDb();
  const sessions = await db.getAll(SESSION_STORE);
  return sessions.map((s) => s.sessionId);
}

/**
 * Iterate over audio blobs for a session (for streaming export)
 */
export async function* iterateSessionAudio(
  sessionId: string
): AsyncGenerator<{ index: number; blob: Blob }> {
  const db = await getDb();
  const index = db.transaction(AUDIO_STORE).store.index('bySession');
  const entries = await index.getAll(sessionId);

  // Sort by index to ensure correct order
  entries.sort((a, b) => a.index - b.index);

  for (const entry of entries) {
    yield { index: entry.index, blob: entry.blob };
  }
}
